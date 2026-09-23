import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import {
  getTrading212Positions,
  getTrading212Instruments,
  getTrading212FilledOrders,
  parseTrading212Ticker
} from "../../../../lib/trading212";
import { getUsdRate } from "../../../../lib/fx";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const settings = await prisma.apiSetting.findUnique({
    where: { userId }
  });

  if (!settings?.trading212ApiKey || !settings?.trading212ApiSecret) {
    return NextResponse.json(
      { error: "Trading 212 API credentials missing" },
      { status: 400 }
    );
  }
  const { trading212ApiKey: apiKey, trading212ApiSecret: apiSecret } = settings;

  let positions;
  let instruments;
  try {
    [positions, instruments] = await Promise.all([
      getTrading212Positions(apiKey, apiSecret),
      getTrading212Instruments(apiKey, apiSecret)
    ]);
  } catch (error) {
    console.error("Trading212 sync failed", error);
    return NextResponse.json({ error: "Trading 212 request failed" }, { status: 502 });
  }

  // Positions are reported in the INSTRUMENT's native currency (e.g. GBP for
  // an LSE listing), not USD -- convert every price to USD here, once, so
  // nothing downstream (dashboard, stats, charts) has to know or guess.
  const currencyByTicker = new Map(instruments.map((i) => [i.ticker, i.currencyCode]));
  const rateCache = new Map<string, number>();
  const rateFor = async (currency: string) => {
    if (!rateCache.has(currency)) rateCache.set(currency, await getUsdRate(currency));
    return rateCache.get(currency)!;
  };

  await Promise.all(
    positions.map(async (position) => {
      const { symbol, market } = parseTrading212Ticker(position.ticker);
      const currency = currencyByTicker.get(position.ticker) || "USD";
      const rate = await rateFor(currency);
      const avgBuyPrice = position.averagePrice * rate;
      const lastPriceUsd = position.currentPrice * rate;

      const existing = await prisma.holding.findFirst({
        where: { userId, asset: symbol, source: "trading212" }
      });

      if (existing) {
        return prisma.holding.update({
          where: { id: existing.id },
          data: { amount: position.quantity, avgBuyPrice, lastPriceUsd }
        });
      }

      return prisma.holding.create({
        data: {
          userId,
          asset: symbol,
          amount: position.quantity,
          avgBuyPrice,
          lastPriceUsd,
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
    where: { userId, source: "trading212" }
  });
  await Promise.all(
    staleHoldings
      .filter((h) => !currentSymbols.has(h.asset))
      .map((h) => prisma.holding.delete({ where: { id: h.id } }))
  );

  // Mirror filled orders into Transaction history, same as Binance trades.
  let fills: Awaited<ReturnType<typeof getTrading212FilledOrders>> = [];
  try {
    fills = await getTrading212FilledOrders(apiKey, apiSecret);
  } catch (error) {
    console.error("Trading212 order history fetch failed", error);
  }

  await Promise.all(
    fills.map(async (fill) => {
      const { symbol } = parseTrading212Ticker(fill.ticker);
      const currency = currencyByTicker.get(fill.ticker) || "USD";
      const rate = await rateFor(currency);
      return prisma.transaction.upsert({
        where: { externalId: `t212-${fill.fillId}` },
        update: {},
        create: {
          userId,
          type: fill.side,
          symbol,
          quantity: fill.quantity,
          price: fill.price * rate,
          source: "trading212",
          externalId: `t212-${fill.fillId}`,
          executedAt: new Date(fill.filledAt)
        }
      });
    })
  );

  const holdings = await prisma.holding.findMany({
    where: { userId, source: "trading212" }
  });

  return NextResponse.json({ holdings, synced: positions.length, transactionsSynced: fills.length });
}
