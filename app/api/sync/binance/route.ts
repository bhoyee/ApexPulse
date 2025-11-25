import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { getBinanceBalances, getMarketTickers } from "../../../../lib/binance";

const MIN_VALUE_USDT =
  Number(process.env.BINANCE_MIN_VALUE_USD ?? "5") || 5;
const STABLES = new Set(["USDT", "USDC", "BUSD", "FDUSD", "TUSD"]);

function isBearerAuthorized(req: Request) {
  const token = process.env.SYNC_TOKEN;
  const header = req.headers.get("authorization") || "";
  if (!token) return false;
  return header === `Bearer ${token}`;
}

export async function POST(req: Request) {
  let userId: string | null = null;
  if (isBearerAuthorized(req)) {
    // allow GitHub Actions / external scheduler
    const firstUser = await prisma.user.findFirst({ select: { id: true } });
    userId = firstUser?.id ?? null;
  } else {
    const session = await auth();
    userId = session?.user?.id ?? null;
  }
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.apiSetting.findUnique({
    where: { userId }
  });

  if (!settings?.binanceApiKey || !settings?.binanceApiSecret) {
    return NextResponse.json(
      { error: "Binance API credentials missing" },
      { status: 400 }
    );
  }

  const balances = await getBinanceBalances(
    settings.binanceApiKey,
    settings.binanceApiSecret
  );

  if (!balances.length) {
    return NextResponse.json({ holdings: [] });
  }

  const tradables = balances.filter((b) => b.amount > 0);
  const nonStableSymbols = tradables
    .filter((b) => !STABLES.has(b.asset))
    .map((b) => b.asset.toUpperCase());
  const tickers = await getMarketTickers(nonStableSymbols);

  const priceMap = tickers.reduce<Record<string, number>>((acc, item) => {
    acc[item.symbol.toUpperCase()] = item.price;
    return acc;
  }, {});

  const filteredBalances: typeof tradables = [];
  const skippedDetails: Array<{
    asset: string;
    amount: number;
    reason: string;
    price?: number;
    usdValue?: number;
  }> = [];

  for (const balance of tradables) {
    const symbol = balance.asset.toUpperCase();
    if (STABLES.has(symbol)) {
      if (balance.amount >= MIN_VALUE_USDT) {
        filteredBalances.push(balance);
      } else {
        skippedDetails.push({
          asset: symbol,
          amount: balance.amount,
          reason: `below ${MIN_VALUE_USDT} ${symbol}`
        });
      }
      continue;
    }
    const price = priceMap[symbol];
    if (!price || Number.isNaN(price)) {
      skippedDetails.push({
        asset: symbol,
        amount: balance.amount,
        reason: "price unavailable"
      });
      continue;
    }
    const usdValue = price * balance.amount;
    if (usdValue >= MIN_VALUE_USDT) {
      filteredBalances.push(balance);
    } else {
      skippedDetails.push({
        asset: symbol,
        amount: balance.amount,
        price,
        usdValue,
        reason: `below ${MIN_VALUE_USDT} USD`
      });
    }
  }

  await Promise.all(
    filteredBalances.map(async (balance) => {
      const existing = await prisma.holding.findFirst({
        where: { userId, asset: balance.asset }
      });
      const avgBuyPrice = existing ? existing.avgBuyPrice : 0;
      if (existing) {
        await prisma.holding.update({
          where: { id: existing.id },
          data: { amount: balance.amount }
        });
      } else {
        await prisma.holding.create({
          data: {
            userId: session.user.id,
            asset: balance.asset,
            amount: balance.amount,
            avgBuyPrice
          }
        });
      }
    })
  );

  const updatedHoldings = await prisma.holding.findMany({
    where: { userId }
  });

  return NextResponse.json({
    holdings: updatedHoldings,
    synced: filteredBalances.length,
    skipped: tradables.length - filteredBalances.length,
    skippedDetails
  });
}
