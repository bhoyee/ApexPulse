import { redirect } from "next/navigation";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { Navbar } from "../components/navbar";
import { StatCards } from "../components/stat-cards";
import { StatsLive } from "../components/stats-live";
import { HoldingsTable } from "../components/holdings-table";
import { MarketRadar } from "../components/market-radar";
import { getMarketTickers } from "../lib/binance";
import { TradesTable } from "../components/trades-table";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const holdings = await prisma.holding.findMany({
    where: { userId: session.user.id }
  });

  const settings = await prisma.apiSetting.findUnique({
    where: { userId: session.user.id }
  });

  const trades = await prisma.transaction.findMany({
    where: { userId: session.user.id },
    orderBy: { executedAt: "desc" },
    take: 200
  });

  const symbolsAll = Array.from(
    new Set([
      ...holdings.map((h) => h.asset.toUpperCase()),
      ...trades.map((t) => t.symbol.toUpperCase())
    ])
  );

  let markets =
    symbolsAll.length > 0
      ? await getMarketTickers(symbolsAll)
      : [];

  if (!markets.length) {
    markets = [
      { symbol: "BTC", price: 67000, change24h: 1.2, volume: 100000, high: 67500, low: 65000 },
      { symbol: "ETH", price: 3400, change24h: 2.3, volume: 85000, high: 3450, low: 3300 },
      { symbol: "SOL", price: 165, change24h: -0.4, volume: 32000, high: 170, low: 150 },
      { symbol: "LINK", price: 18.2, change24h: 1.1, volume: 12000, high: 18.8, low: 17.4 }
    ];
  }

  const priceMap = markets.reduce<Record<string, number>>((acc, m) => {
    acc[m.symbol] = m.price;
    return acc;
  }, {});
  const portfolioValue = holdings.reduce(
    (sum, h) => sum + Number(h.amount) * (priceMap[h.asset] ?? 0),
    0
  );

  const holdingsWithValue = holdings
    .map((h) => {
      const price = priceMap[h.asset] ?? 0;
      const value = Number(h.amount) * price;
      return { symbol: h.asset, price, value };
    })
    .filter((h) => h.value > 5);

  const holdingsSafe = holdings.map((h) => ({
    ...h,
    amount: Number(h.amount),
    avgBuyPrice: Number(h.avgBuyPrice),
    createdAt: h.createdAt.toISOString(),
    updatedAt: h.updatedAt.toISOString()
  }));

  const priceList = markets.map((m) => ({
    symbol: m.symbol.toUpperCase(),
    price: m.price
  }));

  const tradesSafe = trades.map((t) => ({
    ...t,
    quantity: Number(t.quantity),
    price: Number(t.price),
    fee: t.fee ? Number(t.fee) : undefined,
    executedAt: t.executedAt.toISOString()
  }));

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl space-y-8 p-4 pb-12">
        <section className="glass relative overflow-hidden rounded-2xl border border-white/10 p-8 shadow-floating">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-primary">
                ApexPulse OS
              </p>
              <h1 className="mt-2 text-3xl font-bold">
                The ultimate self-hosted crypto HQ
              </h1>
              <p className="text-sm text-muted-foreground">
                Binance sync, AI swing signals, Tremor dashboards, dark-mode perfection. OpenAI primary with DeepSeek fallback.
              </p>
            </div>
            <div className="flex gap-3">
              <span className="rounded-full bg-primary/10 px-4 py-2 text-sm text-primary">
                Docker-native
              </span>
              <span className="rounded-full bg-white/10 px-4 py-2 text-sm text-foreground">
                Self-hosted
              </span>
            </div>
          </div>
        </section>

        <StatsLive
          initialHoldings={holdingsSafe as any}
          initialPrices={markets as any}
          initialTrades={tradesSafe as any}
        />
        <MarketRadar markets={holdingsWithValue as any} />
        <div className="grid gap-4">
          <HoldingsTable initialHoldings={holdingsSafe as any} initialPrices={markets as any} />
          <TradesTable
            initial={tradesSafe as any}
            prices={priceList as any}
            ownerName={settings?.fullName ?? ""}
          />
        </div>
      </main>
    </div>
  );
}
