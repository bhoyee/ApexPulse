import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { getPricesForHoldings } from "../../../lib/pricing";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [holdings, trades, settings] = await Promise.all([
    prisma.holding.findMany({ where: { userId: session.user.id } }),
    prisma.transaction.findMany({
      where: { userId: session.user.id, type: "BUY" },
      select: { symbol: true }
    }),
    prisma.apiSetting.findUnique({ where: { userId: session.user.id } })
  ]);

  // Transaction history is crypto-only today (stocks don't sync trades yet),
  // so BUY symbols always need a crypto quote regardless of what's held now.
  const tradeSymbols = trades.map((t) => t.symbol.toUpperCase());
  const symbols = Array.from(
    new Set([...holdings.map((h) => h.asset.toUpperCase()), ...tradeSymbols])
  );

  const markets = await getPricesForHoldings(
    holdings,
    tradeSymbols.length ? tradeSymbols : symbols.length ? [] : ["BTC", "ETH", "SOL"],
    { mansaApiKey: settings?.mansaApiKey ?? undefined }
  );

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
    console.warn("prices missing symbols", missing, "fetched", markets.map((m) => `${m.symbol}:${m.price}`));
  }

  return NextResponse.json({ markets });
}
