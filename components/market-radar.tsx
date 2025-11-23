"use client";

import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "../lib/utils";

interface AssetSnapshot {
  symbol: string;
  price: number;
  value: number;
}

interface Holding {
  asset: string;
  amount: number;
}
interface Price {
  symbol: string;
  price: number;
}

const palette = [
  "#f87171", // red
  "#60a5fa", // blue
  "#34d399", // green
  "#facc15", // yellow
  "#f472b6", // pink
  "#9ca3af", // gray
  "#fb923c", // orange/amber
  "#22d3ee", // cyan
  "#a78bfa"  // indigo/violet
];

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
    .filter((m) => m.value > 0);

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  // Build conic-gradient for pie
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let acc = 0;
  const gradient = data
    .map((d, idx) => {
      const start = (acc / total) * 360;
      acc += d.value;
      const end = (acc / total) * 360;
      const color = palette[idx % palette.length];
      return `${color} ${start}deg ${end}deg`;
    })
    .join(", ");

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Bar chart */}
      <div className="chart-card bg-card border border-border text-card-foreground">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">Price Glide</h3>
          <span className="text-xs text-muted-foreground">Your held assets</span>
        </div>
        <div className="mt-4 h-80 md:h-96 overflow-x-auto">
          <div className="flex items-end gap-3 min-w-full">
            {data.map((item, idx) => {
              const heightPct = Math.max((item.value / maxValue) * 100, 5);
              const color = palette[idx % palette.length];
              return (
                <div
                  key={item.symbol}
                  className="flex w-16 flex-col items-center text-[11px] text-muted-foreground"
                  title={`${item.symbol}: ${formatCurrency(item.value)}`}
                >
                  <span className="mb-1 font-semibold text-card-foreground">
                    {formatCurrency(item.value)}
                  </span>
                  <div
                    className="w-full rounded-t-md"
                    style={{ height: `${heightPct}%`, backgroundColor: color }}
                  />
                  <span className="mt-1 text-card-foreground">{item.symbol}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pie chart */}
      <div className="chart-card bg-card border border-border text-card-foreground">
        <h3 className="text-sm font-semibold text-muted-foreground">Dominance</h3>
        <div className="mt-4 flex flex-col items-center gap-3">
          <div
            className="h-64 w-64 rounded-full shadow-inner"
            style={{
              background: `conic-gradient(${gradient || "#22d3ee 0deg 360deg"})`
            }}
          />
          <div className="grid w-full grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            {data.map((item, idx) => {
              const color = palette[idx % palette.length];
              const pct = total ? ((item.value / total) * 100).toFixed(1) : "0.0";
              return (
                <div key={item.symbol} className="flex items-center gap-2">
                  <span className="block h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-card-foreground">
                    {item.symbol} — {pct}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
