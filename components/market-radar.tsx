"use client";

import { BarChart, DonutChart } from "@tremor/react";
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
    .filter((d) => d.value > 5);

  // Build a single-row dataset so each symbol renders with its own color
  const categories = data.map((d) => d.symbol);
  const categoryColors = categories.map((_, i) => colors[i % colors.length]);
  const barData =
    data.length === 0
      ? []
      : [
          data.reduce(
            (acc, d) => {
              acc[d.symbol] = d.value;
              return acc;
            },
            { symbol: "portfolio" } as Record<string, any>
          )
        ];
  const donutData = data.map((d) => ({ name: d.symbol, value: d.value }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="chart-card bg-card border border-border text-card-foreground">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">Price Glide</h3>
          <span className="text-xs text-muted-foreground">Holdings &gt; $5</span>
        </div>
        <BarChart
          className="mt-4 h-80 md:h-96"
          data={barData}
          index="symbol"
          categories={categories}
          colors={categoryColors}
          valueFormatter={(n) => formatCurrency(Number(n))}
          yAxisWidth={64}
        />
      </div>
      <div className="chart-card bg-card border border-border text-card-foreground">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">Dominance</h3>
          <span className="text-xs text-muted-foreground">Share by value</span>
        </div>
        <DonutChart
          className="mt-3 h-80 text-xs"
          data={donutData}
          category="value"
          index="name"
          colors={colors}
          valueFormatter={(n) => formatCurrency(Number(n))}
        />
      </div>
    </div>
  );
}
