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

  const colors = ["cyan", "violet", "emerald", "amber", "pink", "indigo", "lime", "red", "blue"];

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="chart-card bg-card border border-border text-card-foreground">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">Price Glide</h3>
          <span className="text-xs text-muted-foreground">Your held assets</span>
        </div>
        <div className="mt-4 space-y-2">
          {data.map((item, idx) => {
            const pct = Math.max((item.value / maxValue) * 100, 4);
            const color = colors[idx % colors.length];
            return (
              <div key={item.symbol} className="text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-card-foreground">{item.symbol}</span>
                  <span>{formatCurrency(item.value)}</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-border">
                  <div
                    className="h-2 rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                  />
                </div>
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
