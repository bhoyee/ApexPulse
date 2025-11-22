"use client";

import { BarChart, DonutChart, BarList } from "@tremor/react";
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

  const barData = data.map((m) => ({
    symbol: m.symbol,
    value: m.value
  }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="chart-card">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">Price Glide</h3>
          <span className="text-xs text-muted-foreground">Your held assets</span>
        </div>
        <BarChart
          className="mt-4 h-64"
          data={barData}
          index="symbol"
          categories={["value"]}
          colors={["cyan"]}
          valueFormatter={(n) => formatCurrency(Number(n))}
        />
      </div>
      <div className="chart-card grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground">Dominance</h3>
          <DonutChart
            className="mt-3"
            data={donut}
            category="value"
            index="name"
            colors={["cyan", "blue", "emerald", "violet", "amber", "pink"]}
            valueFormatter={(n) => formatCurrency(Number(n))}
          />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground">Value Pulse</h3>
          <BarList
            data={donut.map((d) => ({ name: d.name, value: d.value }))}
            className="mt-3"
            color="cyan"
          />
        </div>
      </div>
    </div>
  );
}
