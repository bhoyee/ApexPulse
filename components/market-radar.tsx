"use client";

import { DonutChart } from "@tremor/react";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "../lib/utils";

interface AssetSnapshot {
  symbol: string;
  price: number;
  value: number;
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
    color: palette[idx % palette.length]
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
        <div className="mt-4 h-80 md:h-96 flex items-end gap-3 overflow-x-auto pb-4">
          {data.map((item, idx) => {
            const heightPx = Math.max((item.value / maxValue) * maxBarHeight, 12);
            const color = palette[idx % palette.length];
            return (
              <div
                key={item.symbol}
                className="flex min-w-[48px] flex-1 flex-col items-center text-[11px] text-muted-foreground"
                title={`${item.symbol}: ${formatCurrency(item.value)}`}
              >
                <span className="mb-1 font-semibold text-card-foreground">
                  {formatCurrency(item.value)}
                </span>
                <div
                  className="w-10 rounded-t-md"
                  style={{ height: `${heightPx}px`, backgroundColor: color }}
                />
                <span className="mt-1 text-card-foreground">{item.symbol}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="chart-card bg-card border border-border text-card-foreground">
        <h3 className="text-sm font-semibold text-muted-foreground">Dominance</h3>
        <DonutChart
          className="mt-3 h-80 text-xs"
          data={donut}
          category="value"
          index="name"
          colors={donut.map((d) => d.color)}
          valueFormatter={(n) => formatCurrency(Number(n))}
        />
      </div>
    </div>
  );
}
