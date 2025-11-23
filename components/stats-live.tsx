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
  initialTrades
}: {
  initialHoldings: Holding[];
  initialPrices: Price[];
  initialTrades: Trade[];
}) {
  const { data: holdings = initialHoldings } = useQuery({
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

  const { data: trades = initialTrades } = useQuery({
    queryKey: ["trades"],
    queryFn: fetchTrades,
    initialData: initialTrades,
    refetchInterval: 15000
  });

  const priceMap = prices.reduce<Record<string, Price>>((acc, p) => {
    acc[p.symbol.toUpperCase()] = p;
    return acc;
  }, {});

  const portfolioValue = holdings.reduce(
    (sum, h) => sum + Number(h.amount) * (priceMap[h.asset.toUpperCase()]?.price ?? 0),
    0
  );

  // Total invested should match trade history (sum of Investment USD)
  const totalInvested = trades.reduce(
    (sum, t) => sum + Number(t.quantity) * Number(t.price),
    0
  );

  const overallPnl = portfolioValue - totalInvested;

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const holdings30d = holdings.filter((h) => {
    const t = h.createdAt ? new Date(h.createdAt).getTime() : 0;
    return t >= thirtyDaysAgo;
  });

  const realizedPnl30d = holdings30d.reduce((sum, h) => {
    const cost = Number(h.amount) * Number(h.avgBuyPrice);
    const current = Number(h.amount) * (priceMap[h.asset.toUpperCase()]?.price ?? 0);
    return sum + (current - cost);
  }, 0);

  const change24h =
    prices.length > 0
      ? prices.reduce((s, p) => s + (p.change24h ?? 0), 0) / prices.length
      : 0;

  const btcPrice = priceMap["BTC"]?.price ?? 0;

  const totalStables = holdings
    .filter((h) => STABLES.includes(h.asset.toUpperCase()))
    .reduce((sum, h) => sum + Number(h.amount) * (priceMap[h.asset.toUpperCase()]?.price ?? 1), 0);

  return (
    <StatCards
      stats={{
        portfolioValue,
        change24h,
        realizedPnl30d,
        overallPnl,
        totalInvested,
        btcPrice,
        totalStables
      }}
    />
  );
}
