"use client";

import { DonutChart } from "@tremor/react";
import { formatCurrency } from "../lib/utils";

interface AssetSnapshot {
  symbol: string;
  price: number;
  value: number;
}

export function MarketRadar({ markets }: { markets: AssetSnapshot[] }) {
  const data = markets.filter((m) => m.value > 5);

  const donut = data.map((m) => ({
    name: m.symbol,
    value: m.value
  }));

  // Use Tremor-supported color tokens only
  const colors = ["red", "blue", "green", "yellow", "pink", "gray", "amber", "cyan", "indigo"];

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="chart-card bg-card border border-border text-card-foreground">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">Price Glide</h3>
          <span className="text-xs text-muted-foreground">Your held assets</span>
        </div>
        <div className="mt-4 h-64 flex items-end gap-3 overflow-x-auto pb-4">
          {data.map((item, idx) => {
            const heightPct = Math.max((item.value / maxValue) * 100, 6);
            const color = colors[idx % colors.length];
            return (
              <div key={item.symbol} className="flex flex-col items-center text-xs text-muted-foreground">
                <span className="mb-1 font-semibold text-card-foreground">
                  {formatCurrency(item.value)}
                </span>
                <div
                  className="w-10 rounded-t-md"
                  style={{ height: `${heightPct}%`, backgroundColor: `var(--${color}-500, ${color})` }}
                  title={`${item.symbol}: ${formatCurrency(item.value)}`}
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
          colors={colors}
          valueFormatter={(n) => formatCurrency(Number(n))}
        />
      </div>
    </div>
  );
}
