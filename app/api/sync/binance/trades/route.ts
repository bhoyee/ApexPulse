import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { prisma } from "../../../../../lib/prisma";
import { getBinanceTrades } from "../../../../../lib/binance";
import { TransactionType } from "@prisma/client";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.apiSetting.findUnique({
    where: { userId: session.user.id }
  });
  if (!settings?.binanceApiKey || !settings?.binanceApiSecret) {
    return NextResponse.json(
      { error: "Binance API credentials missing" },
      { status: 400 }
    );
  }

  const holdings = await prisma.holding.findMany({
    where: { userId: session.user.id }
  });
  const symbols = Array.from(new Set(holdings.map((h) => h.asset)));

  const trades = await getBinanceTrades(
    symbols,
    settings.binanceApiKey,
    settings.binanceApiSecret
  );

  let created = 0;
  for (const trade of trades) {
    try {
      await prisma.transaction.create({
        data: {
          userId: session.user.id,
          holdingId:
            holdings.find((h) => h.asset === trade.symbol)?.id || null,
          type: trade.isBuyer ? TransactionType.BUY : TransactionType.SELL,
          symbol: trade.symbol,
          quantity: trade.qty,
          price: trade.price,
          fee: trade.commission,
          executedAt: new Date(trade.time),
          source: "binance",
          externalId: trade.id
        }
      });
      created += 1;
    } catch {
      // ignore duplicates (unique externalId)
    }
  }

  const userTrades = await prisma.transaction.findMany({
    where: { userId: session.user.id },
    orderBy: { executedAt: "desc" }
  });

  return NextResponse.json({ created, total: userTrades.length, trades: userTrades });
}
