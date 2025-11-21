import { redirect } from "next/navigation";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { Navbar } from "../components/navbar";
import { StatCards } from "../components/stat-cards";
import { HoldingsTable } from "../components/holdings-table";
import { SignalList } from "../components/signal-list";
import { MarketRadar } from "../components/market-radar";
import { getMarketTickers } from "../lib/binance";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const holdings = await prisma.holding.findMany({
    where: { userId: session.user.id }
  });

  const signals = await prisma.signal.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 10
  });

  let markets =
    holdings.length > 0
      ? await getMarketTickers(
          Array.from(new Set(holdings.map((h) => h.asset))).slice(0, 10)
        )
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

  const stats = {
    portfolioValue,
    change24h: markets.reduce((s, m) => s + (m.change24h ?? 0), 0) / markets.length || 0,
    realizedPnl: 0,
    confidence: signals.length
      ? Math.round(
          signals.reduce((s, sig) => s + (sig.confidence ?? 0), 0) / signals.length
        )
      : 72
  };

  const holdingsSafe = holdings.map((h) => ({
    ...h,
    amount: Number(h.amount),
    avgBuyPrice: Number(h.avgBuyPrice),
    createdAt: h.createdAt.toISOString(),
    updatedAt: h.updatedAt.toISOString()
  }));

  const signalsSafe = signals.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString()
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
                Binance sync, AI swing signals, Tremor dashboards, dark-mode perfection. Grok primary with GPT fallback.
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

        <StatCards stats={stats} />
        <MarketRadar markets={markets} />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <HoldingsTable initialHoldings={holdingsSafe as any} initialPrices={markets as any} />
          </div>
          <SignalList initial={signalsSafe as any} />
        </div>
      </main>
    </div>
  );
}
