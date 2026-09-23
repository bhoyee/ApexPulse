import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { getTrading212Positions, parseTrading212Ticker } from "../../../../lib/trading212";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.apiSetting.findUnique({
    where: { userId: session.user.id }
  });

  if (!settings?.trading212ApiKey || !settings?.trading212ApiSecret) {
    return NextResponse.json(
      { error: "Trading 212 API credentials missing" },
      { status: 400 }
    );
  }

  let positions;
  try {
    positions = await getTrading212Positions(
      settings.trading212ApiKey,
      settings.trading212ApiSecret
    );
  } catch (error) {
    console.error("Trading212 sync failed", error);
    return NextResponse.json({ error: "Trading 212 request failed" }, { status: 502 });
  }

  await Promise.all(
    positions.map(async (position) => {
      const { symbol, market } = parseTrading212Ticker(position.ticker);
      const existing = await prisma.holding.findFirst({
        where: { userId: session.user!.id, asset: symbol, source: "trading212" }
      });

      if (existing) {
        return prisma.holding.update({
          where: { id: existing.id },
          data: { amount: position.quantity, avgBuyPrice: position.averagePrice }
        });
      }

      return prisma.holding.create({
        data: {
          userId: session.user!.id,
          asset: symbol,
          amount: position.quantity,
          avgBuyPrice: position.averagePrice,
          assetClass: "STOCK",
          market,
          source: "trading212"
        }
      });
    })
  );

  // Positions Trading212 no longer reports (fully sold) get removed so the
  // dashboard doesn't keep showing a closed position.
  const currentSymbols = new Set(
    positions.map((p) => parseTrading212Ticker(p.ticker).symbol)
  );
  const staleHoldings = await prisma.holding.findMany({
    where: { userId: session.user.id, source: "trading212" }
  });
  await Promise.all(
    staleHoldings
      .filter((h) => !currentSymbols.has(h.asset))
      .map((h) => prisma.holding.delete({ where: { id: h.id } }))
  );

  const holdings = await prisma.holding.findMany({
    where: { userId: session.user.id, source: "trading212" }
  });

  return NextResponse.json({ holdings, synced: positions.length });
}
