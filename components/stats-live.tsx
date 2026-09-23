"use client";

import { useQuery } from "@tanstack/react-query";
import { StatCards } from "./stat-cards";

interface Holding {
  asset: string;
  amount: number;
  avgBuyPrice: number;
  createdAt?: string;
}

interface Price {
  symbol: string;
  price: number;
  change24h?: number;
}

interface Trade {
  symbol: string;
  quantity: number;
  price: number;
  executedAt: string;
}

async function fetchHoldings(): Promise<Holding[]> {
  const res = await fetch("/api/holdings");
  if (!res.ok) throw new Error("Failed to load holdings");
  return res.json();
}

async function fetchPrices(): Promise<Price[]> {
  const res = await fetch("/api/prices");
  if (!res.ok) throw new Error("Failed to load prices");
  const data = await res.json();
  return data.markets ?? [];
}

async function fetchTrades(): Promise<Trade[]> {
  const res = await fetch("/api/transactions");
  if (!res.ok) throw new Error("Failed to load trades");
  return res.json();
}

const STABLES = ["USDT", "USDC", "BUSD", "FDUSD", "TUSD"];

export function StatsLive({
  initialHoldings,
  initialPrices,
  initialTrades,
  minHoldingValueUsd = 5,
  symbols,
  variant = "crypto"
}: {
  initialHoldings: Holding[];
  initialPrices: Price[];
  initialTrades: Trade[];
  minHoldingValueUsd?: number;
  /** Restrict all stats to this set of asset symbols (e.g. one dashboard section). Omit to include everything. */
  symbols?: string[];
  variant?: "crypto" | "stock";
}) {
  const { data: allHoldings = initialHoldings } = useQuery({
    queryKey: ["holdings"],
    queryFn: fetchHoldings,
    initialData: initialHoldings,
    refetchInterval: 15000
  });

  const { data: prices = initialPrices } = useQuery({
    queryKey: ["prices"],
    queryFn: fetchPrices,
    initialData: initialPrices,
    refetchInterval: 15000
  });

  const { data: allTrades = initialTrades } = useQuery({
    queryKey: ["trades"],
    queryFn: fetchTrades,
    initialData: initialTrades,
    refetchInterval: 15000
  });

  const allowed = symbols ? new Set(symbols.map((s) => s.toUpperCase())) : null;
  const holdings = allowed ? allHoldings.filter((h) => allowed.has(h.asset.toUpperCase())) : allHoldings;
  const trades = allowed ? allTrades.filter((t) => allowed.has(t.symbol.toUpperCase())) : allTrades;

  const priceMap = prices.reduce<Record<string, Price>>((acc, p) => {
    acc[p.symbol.toUpperCase()] = p;
    return acc;
  }, {});

  const portfolioValue = holdings.reduce(
    (sum, h) => sum + Number(h.amount) * (priceMap[h.asset.toUpperCase()]?.price ?? 0),
    0
  );

  const activeSymbols = new Set(
    holdings
      .filter((h) => {
        const qty = Number(h.amount);
        if (qty <= 0) return false;
        const price = priceMap[h.asset.toUpperCase()]?.price ?? 0;
        return qty * price > minHoldingValueUsd;
      })
      .map((h) => h.asset.toUpperCase())
  );
  const filterActive = activeSymbols.size > 0;

  // Invested/PnL prefer real trade history per symbol, but fall back to the
  // holding's own avgBuyPrice*amount for symbols with no Transaction rows
  // (manual Bamboo/NGX/CSCS entries never create trade history).
  const investedBySymbol = new Map<string, number>();
  trades.forEach((t) => {
    const sym = t.symbol.toUpperCase();
    if (filterActive && !activeSymbols.has(sym)) return;
    investedBySymbol.set(sym, (investedBySymbol.get(sym) ?? 0) + Number(t.quantity) * Number(t.price));
  });
  holdings.forEach((h) => {
    const sym = h.asset.toUpperCase();
    if (investedBySymbol.has(sym)) return;
    if (filterActive && !activeSymbols.has(sym)) return;
    investedBySymbol.set(sym, Number(h.amount) * Number(h.avgBuyPrice));
  });
  const totalInvested = Array.from(investedBySymbol.values()).reduce((s, v) => s + v, 0);

  const pnlBySymbol = new Map<string, number>();
  trades.forEach((t) => {
    const sym = t.symbol.toUpperCase();
    const qty = Number(t.quantity);
    const cost = qty * Number(t.price);
    const current = qty * (priceMap[sym]?.price ?? 0);
    pnlBySymbol.set(sym, (pnlBySymbol.get(sym) ?? 0) + (current - cost));
  });
  holdings.forEach((h) => {
    const sym = h.asset.toUpperCase();
    if (pnlBySymbol.has(sym)) return;
    const qty = Number(h.amount);
    const cost = qty * Number(h.avgBuyPrice);
    const current = qty * (priceMap[sym]?.price ?? 0);
    pnlBySymbol.set(sym, current - cost);
  });
  const overallPnl = Array.from(pnlBySymbol.values()).reduce((s, v) => s + v, 0);

  const relevantPrices = allowed
    ? prices.filter((p) => allowed.has(p.symbol.toUpperCase()))
    : prices;
  const change24h =
    relevantPrices.length > 0
      ? relevantPrices.reduce((s, p) => s + (p.change24h ?? 0), 0) / relevantPrices.length
      : 0;

  if (variant === "stock") {
    const bestMover = relevantPrices.reduce<{ symbol: string; change: number } | undefined>(
      (best, p) => {
        const change = p.change24h ?? 0;
        if (!best || change > best.change) return { symbol: p.symbol, change };
        return best;
      },
      undefined
    );

    return (
      <StatCards
        stats={{
          variant: "stock",
          portfolioValue,
          change24h,
          overallPnl,
          totalInvested,
          positions: holdings.filter((h) => Number(h.amount) > 0).length,
          bestMover
        }}
      />
    );
  }

  const btcPrice = priceMap["BTC"]?.price ?? 0;
  const totalStables = holdings
    .filter((h) => STABLES.includes(h.asset.toUpperCase()))
    .reduce((sum, h) => sum + Number(h.amount) * (priceMap[h.asset.toUpperCase()]?.price ?? 1), 0);

  return (
    <StatCards
      stats={{
        variant: "crypto",
        portfolioValue,
        change24h,
        overallPnl,
        totalInvested,
        btcPrice,
        totalStables
      }}
    />
  );
}
