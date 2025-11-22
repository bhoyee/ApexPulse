import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { getMarketTickers } from "../../../lib/binance";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [holdings, trades] = await Promise.all([
    prisma.holding.findMany({ where: { userId: session.user.id } }),
    prisma.transaction.findMany({
      where: { userId: session.user.id, type: "BUY" },
      select: { symbol: true }
    })
  ]);

  const symbols = Array.from(
    new Set([
      ...holdings.map((h) => h.asset.toUpperCase()),
      ...trades.map((t) => t.symbol.toUpperCase())
    ])
  ).slice(0, 50);

  const markets = await getMarketTickers(symbols.length ? symbols : ["BTC", "ETH", "SOL"]);

  // ensure stables always have price 1
  const stableSymbols = ["USDT", "USDC", "BUSD", "FDUSD", "TUSD"];
  stableSymbols.forEach((s) => {
    if (symbols.includes(s) && !markets.find((m) => m.symbol === s)) {
      markets.push({
        symbol: s,
        price: 1,
        change24h: 0,
        volume: 0,
        high: 1,
        low: 1
      } as any);
    }
  });

  const missing = symbols.filter(
    (s) => !markets.find((m) => m.symbol === s && m.price > 0)
  );
  if (missing.length) {
    console.warn("prices missing symbols", missing);
  }

  return NextResponse.json({ markets });
}
