import type { ReactNode } from "react";
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
import { DashboardTabs } from "../components/dashboard-tabs";
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
      ? await getPricesForHoldings(holdings, tradeSymbols, {
          mansaApiKey: settings?.mansaApiKey ?? undefined
        })
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

  const cryptoTab = (
    <>
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
    </>
  );

  const trading212Tab = (
    <>
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
    </>
  );

  const ngxTab = (
    <>
      <StatsLive
        initialHoldings={holdingsSafe as any}
        initialPrices={markets as any}
        initialTrades={tradesSafe as any}
        minHoldingValueUsd={minHoldingValueUsd}
        symbols={ngxSymbols}
        variant="stock"
        displayCurrency="NGN"
      />
      <MarketRadar
        markets={holdingsWithValue.filter((h) => ngxSymbols.includes(h.symbol.toUpperCase())) as any}
        minHoldingValueUsd={minHoldingValueUsd}
        symbols={ngxSymbols}
        displayCurrency="NGN"
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
        displayCurrency="NGN"
      />
    </>
  );

  const tabs: { id: string; label: string; badge?: string; content: ReactNode }[] = [
    { id: "crypto", label: "Crypto", badge: "Binance", content: cryptoTab },
    { id: "trading212", label: "Trading 212", badge: "Auto-synced", content: trading212Tab },
    { id: "ngx", label: "Nigeria Stock", badge: "NGX", content: ngxTab }
  ];

  // Any stock holding that isn't NGX and isn't Trading212 (e.g. a Bamboo
  // position in a US stock) gets a small extra tab -- only if it's actually
  // used, so nothing silently disappears.
  if (otherStockSymbols.length > 0) {
    tabs.push({
      id: "other",
      label: "Other Stocks",
      content: (
        <>
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
        </>
      )
    });
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="w-full space-y-6 px-4 py-6 pb-16 sm:px-6 lg:px-10">
        <section className="glass relative overflow-hidden rounded-xl border border-white/10 p-5 shadow-floating">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.3em] text-primary">
                ApexPulse OS
              </p>
              <h1 className="mt-1 text-2xl font-bold">
                The ultimate self-hosted investing HQ
              </h1>
              <p className="text-sm text-muted-foreground">
                Crypto, Nigerian stocks, and Trading 212 -- all in one dashboard.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs text-primary">
                Docker-native
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs text-foreground">
                Self-hosted
              </span>
            </div>
          </div>
        </section>

        <DashboardTabs tabs={tabs} />
      </main>
    </div>
  );
}
