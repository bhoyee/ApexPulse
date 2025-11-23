"use client";

import { DonutChart } from "@tremor/react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "../lib/utils";

interface Holding {
  asset: string;
  amount: number;
}

interface Price {
  symbol: string;
  price: number;
}

interface AssetSnapshot {
  symbol: string;
  price: number;
  value: number;
}

const colors = ["red", "blue", "green", "yellow", "pink", "gray", "amber", "cyan", "violet"];
const colorHex: Record<string, string> = {
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
    .filter((h) => h.value > 5);

  const total = data.reduce((s, d) => s + d.value, 0);
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  const donutData = data.map((d) => ({ name: d.symbol, value: d.value }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Simple responsive bars */}
      <div className="chart-card bg-card border border-border text-card-foreground">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">Price Glide</h3>
          <span className="text-xs text-muted-foreground">Holdings &gt; $5</span>
        </div>
        <div className="mt-4 h-80 md:h-96 overflow-x-auto">
          <div className="flex items-end gap-3 min-w-full">
            {data.map((item, idx) => {
              const heightPct = Math.max((item.value / maxValue) * 100, 5);
              const color = colorHex[colors[idx % colors.length]];
              return (
                <div
                  key={item.symbol}
                  className="flex w-14 flex-col items-center text-[10px] text-muted-foreground"
                  title={`${item.symbol}: ${formatCurrency(item.value)}`}
                >
                  <span className="mb-1 font-semibold text-card-foreground text-xs">
                    {formatCurrency(item.value)}
                  </span>
                  <div
                    className="w-full rounded-t-md"
                    style={{ height: `${heightPct}%`, backgroundColor: color }}
                  />
                  <span className="mt-1 text-card-foreground text-xs">{item.symbol}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Donut chart */}
      <div className="chart-card bg-card border border-border text-card-foreground">
        <h3 className="text-sm font-semibold text-muted-foreground">Dominance</h3>
        <DonutChart
          className="mt-3 h-80 text-xs"
          data={donutData}
          category="value"
          index="name"
          colors={colors}
          valueFormatter={(n) => formatCurrency(Number(n))}
        />
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
          {data.map((item, idx) => {
            const pct = total ? ((item.value / total) * 100).toFixed(1) : "0.0";
            return (
              <div key={item.symbol} className="flex items-center gap-2">
                <span
                  className="block h-3 w-3 rounded-full"
                  style={{ backgroundColor: colorHex[colors[idx % colors.length]] }}
                />
                <span className="text-card-foreground">
                  {item.symbol} — {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
