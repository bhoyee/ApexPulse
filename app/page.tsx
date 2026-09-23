import { redirect } from "next/navigation";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { Navbar } from "../components/navbar";
import { StatsLive } from "../components/stats-live";
import { HoldingsTable } from "../components/holdings-table";
import { AddPositionForm } from "../components/add-position-form";
import { MarketRadar } from "../components/market-radar";
import { getPricesForHoldings } from "../lib/pricing";
import { TradesTable } from "../components/trades-table";
import Link from "next/link";

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

  const minHoldingValueUsd = settings?.minHoldingValueUsd ?? 5;

  const trades = await prisma.transaction.findMany({
    where: { userId: session.user.id },
    orderBy: { executedAt: "desc" },
    take: 200
  });

  // Trade history is crypto-only today, so BUY symbols always need a crypto
  // quote regardless of what's held now.
  const tradeSymbols = trades.map((t) => t.symbol.toUpperCase());
  const symbolsAll = Array.from(
    new Set([...holdings.map((h) => h.asset.toUpperCase()), ...tradeSymbols])
  );

  let markets =
    symbolsAll.length > 0
      ? await getPricesForHoldings(holdings, tradeSymbols)
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

  const holdingsWithValue = holdings
    .map((h) => {
      const price = priceMap[h.asset] ?? 0;
      const value = Number(h.amount) * price;
      return { symbol: h.asset, price, value };
    })
    .filter((h) => h.value > minHoldingValueUsd);

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

  // Split into the three broker/market groupings the dashboard shows as
  // separate sections. Anything STOCK that's neither NGX nor Trading212
  // (e.g. a Bamboo position in a US stock) falls into a small 4th section
  // that only renders if it's actually used, so nothing silently disappears.
  const cryptoSymbols = holdings
    .filter((h) => h.assetClass !== "STOCK")
    .map((h) => h.asset.toUpperCase());
  const ngxSymbols = holdings
    .filter((h) => h.assetClass === "STOCK" && h.market === "NGX")
    .map((h) => h.asset.toUpperCase());
  const trading212Symbols = holdings
    .filter((h) => h.source === "trading212")
    .map((h) => h.asset.toUpperCase());
  const otherStockSymbols = holdings
    .filter((h) => h.assetClass === "STOCK" && h.market !== "NGX" && h.source !== "trading212")
    .map((h) => h.asset.toUpperCase());

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="w-full space-y-10 px-4 py-6 pb-16 sm:px-6 lg:px-10">
        <section className="glass relative overflow-hidden rounded-2xl border border-white/10 p-8 shadow-floating">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-primary">
                ApexPulse OS
              </p>
              <h1 className="mt-2 text-3xl font-bold">
                The ultimate self-hosted investing HQ
              </h1>
              <p className="text-sm text-muted-foreground">
                Crypto, Nigerian stocks, and Trading 212 -- all in one dashboard. OpenAI primary with DeepSeek fallback for AI signals.
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

        {/* Crypto */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
            <h2 className="text-lg font-bold">Crypto</h2>
            <span className="text-xs text-muted-foreground">Binance</span>
          </div>
          <StatsLive
            initialHoldings={holdingsSafe as any}
            initialPrices={markets as any}
            initialTrades={tradesSafe as any}
            minHoldingValueUsd={minHoldingValueUsd}
            symbols={cryptoSymbols}
            variant="crypto"
          />
          <MarketRadar
            markets={holdingsWithValue.filter((h) => cryptoSymbols.includes(h.symbol.toUpperCase())) as any}
            minHoldingValueUsd={minHoldingValueUsd}
            symbols={cryptoSymbols}
          />
          <AddPositionForm title="Add crypto position" defaultAssetClass="CRYPTO" lockAssetClass />
          <HoldingsTable
            initialHoldings={holdingsSafe as any}
            initialPrices={markets as any}
            minHoldingValueUsd={minHoldingValueUsd}
            symbols={cryptoSymbols}
          />
          <TradesTable
            initial={tradesSafe as any}
            prices={priceList as any}
            ownerName={settings?.fullName ?? ""}
            minHoldingValueUsd={minHoldingValueUsd}
            symbols={cryptoSymbols}
            subtitle="Auto-synced from Binance; shows each fill and live P/L."
          />
        </section>

        {/* Nigeria Stock (NGX) */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <h2 className="text-lg font-bold">Nigeria Stock (NGX)</h2>
            <span className="text-xs text-muted-foreground">Bamboo &amp; CSCS</span>
          </div>
          <StatsLive
            initialHoldings={holdingsSafe as any}
            initialPrices={markets as any}
            initialTrades={tradesSafe as any}
            minHoldingValueUsd={minHoldingValueUsd}
            symbols={ngxSymbols}
            variant="stock"
          />
          <MarketRadar
            markets={holdingsWithValue.filter((h) => ngxSymbols.includes(h.symbol.toUpperCase())) as any}
            minHoldingValueUsd={minHoldingValueUsd}
            symbols={ngxSymbols}
          />
          <AddPositionForm
            title="Add Bamboo / NGX position"
            defaultAssetClass="STOCK"
            lockAssetClass
            defaultMarket="NGX"
            lockMarket
          />
          <HoldingsTable
            initialHoldings={holdingsSafe as any}
            initialPrices={markets as any}
            minHoldingValueUsd={minHoldingValueUsd}
            symbols={ngxSymbols}
          />
        </section>

        {/* Trading 212 */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-violet-400" />
            <h2 className="text-lg font-bold">Trading 212</h2>
            <span className="text-xs text-muted-foreground">Auto-synced</span>
          </div>
          <StatsLive
            initialHoldings={holdingsSafe as any}
            initialPrices={markets as any}
            initialTrades={tradesSafe as any}
            minHoldingValueUsd={minHoldingValueUsd}
            symbols={trading212Symbols}
            variant="stock"
          />
          <MarketRadar
            markets={holdingsWithValue.filter((h) => trading212Symbols.includes(h.symbol.toUpperCase())) as any}
            minHoldingValueUsd={minHoldingValueUsd}
            symbols={trading212Symbols}
          />
          {trading212Symbols.length === 0 && (
            <div className="glass rounded-xl p-4 text-sm text-muted-foreground">
              No Trading 212 positions synced yet. Add your API key and secret in{" "}
              <Link href="/settings" className="text-primary underline-offset-2 hover:underline">
                Settings
              </Link>
              , then click &quot;Sync Trading 212 now.&quot;
            </div>
          )}
          <HoldingsTable
            initialHoldings={holdingsSafe as any}
            initialPrices={markets as any}
            minHoldingValueUsd={minHoldingValueUsd}
            symbols={trading212Symbols}
          />
          <TradesTable
            initial={tradesSafe as any}
            prices={priceList as any}
            ownerName={settings?.fullName ?? ""}
            minHoldingValueUsd={minHoldingValueUsd}
            symbols={trading212Symbols}
            subtitle="Auto-synced from Trading 212; shows each fill and live P/L."
          />
        </section>

        {/* Any stock holding that isn't NGX and isn't Trading212 (e.g. a
            Bamboo position in a US stock) -- only shown if it's actually used. */}
        {otherStockSymbols.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              <h2 className="text-lg font-bold">Other Stocks</h2>
              <span className="text-xs text-muted-foreground">Non-NGX, non-Trading212</span>
            </div>
            <StatsLive
              initialHoldings={holdingsSafe as any}
              initialPrices={markets as any}
              initialTrades={tradesSafe as any}
              minHoldingValueUsd={minHoldingValueUsd}
              symbols={otherStockSymbols}
              variant="stock"
            />
            <HoldingsTable
              initialHoldings={holdingsSafe as any}
              initialPrices={markets as any}
              minHoldingValueUsd={minHoldingValueUsd}
              symbols={otherStockSymbols}
            />
          </section>
        )}
      </main>
    </div>
  );
}
