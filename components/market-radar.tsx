"use client";

import { DonutChart } from "@tremor/react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "../lib/utils";

interface AssetSnapshot {
  symbol: string;
  price: number;
  value: number;
}

const tokens = ["red", "blue", "green", "yellow", "pink", "gray", "amber", "cyan", "violet"];
const tokenHex: Record<string, string> = {
  red: "#f87171",
  blue: "#60a5fa",
  green: "#34d399",
  yellow: "#facc15",
  pink: "#f472b6",
  gray: "#9ca3af",
  amber: "#fb923c",
  cyan: "#22d3ee",
  violet: "#a78bfa"
};

interface Holding {
  asset: string;
  amount: number;
}
interface Price {
  symbol: string;
  price: number;
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

export function MarketRadar({ markets }: { markets: AssetSnapshot[] }) {
  const { data: holdings = [] } = useQuery({
    queryKey: ["holdings"],
    queryFn: fetchHoldings,
    initialData: [],
    refetchInterval: 15000
  });

  const { data: prices = [] } = useQuery({
    queryKey: ["prices"],
    queryFn: fetchPrices,
    initialData: markets.map((m) => ({ symbol: m.symbol, price: m.price })),
    refetchInterval: 15000
  });

  const priceMap = prices.reduce<Record<string, number>>((acc, p) => {
    acc[p.symbol.toUpperCase()] = p.price;
    return acc;
  }, {});

  const data = holdings
    .map((h) => {
      const price = priceMap[h.asset.toUpperCase()] ?? 0;
      return { symbol: h.asset.toUpperCase(), value: Number(h.amount) * price };
    })
    .filter((m) => m.value > 5);

  const donut = data.map((m, idx) => ({
    name: m.symbol,
    value: m.value,
    color: tokens[idx % tokens.length]
  }));

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const maxBarHeight = 320; // px for better fill

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="chart-card bg-card border border-border text-card-foreground">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">Price Glide</h3>
          <span className="text-xs text-muted-foreground">Your held assets</span>
        </div>
        <div className="mt-4 h-80 md:h-96 overflow-x-auto">
          <div className="flex items-end gap-3">
            {data.map((item, idx) => {
              const heightPx = Math.max((item.value / maxValue) * maxBarHeight, 12);
              const token = tokens[idx % tokens.length];
              const color = tokenHex[token] || token;
              return (
                <div
                  key={item.symbol}
                  className="flex w-14 flex-col items-center text-[11px] text-muted-foreground"
                  title={`${item.symbol}: ${formatCurrency(item.value)}`}
                >
                  <span className="mb-1 font-semibold text-card-foreground">
                    {formatCurrency(item.value)}
                  </span>
                  <div
                    className="w-full rounded-t-md"
                    style={{ height: `${heightPx}px`, backgroundColor: color }}
                  />
                  <span className="mt-1 text-card-foreground">{item.symbol}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="chart-card bg-card border border-border text-card-foreground">
        <h3 className="text-sm font-semibold text-muted-foreground">Dominance</h3>
        <DonutChart
          className="mt-3 h-80 text-xs"
          data={donut}
          category="value"
          index="name"
          colors={tokens}
          valueFormatter={(n) => formatCurrency(Number(n))}
        />
      </div>
    </div>
  );
}
