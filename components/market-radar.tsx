"use client";

import { AreaChart, BarList, DonutChart } from "@tremor/react";
import { formatCurrency } from "../lib/utils";

interface Snapshot {
  symbol: string;
  price: number;
  change24h?: number;
  volume?: number;
}

export function MarketRadar({ markets }: { markets: Snapshot[] }) {
  const series = markets.map((m, idx) => ({
    timestamp: idx,
    symbol: m.symbol,
    price: m.price
  }));
  const donut = markets.map((m) => ({
    name: m.symbol,
    value: m.volume || m.price * 1000
  }));
  const barList = markets.map((m) => ({
    name: `${m.symbol} (${m.change24h?.toFixed(2) ?? 0}%)`,
    value: m.volume || m.price * 1000
  }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="chart-card">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">Price Glide</h3>
          <span className="text-xs text-muted-foreground">Live from Binance</span>
        </div>
        <AreaChart
          className="mt-4 h-64"
          data={series}
          categories={["price"]}
          index="timestamp"
          colors={["cyan"]}
          showLegend={false}
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
          />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground">Volume Pulse</h3>
          <BarList data={barList} className="mt-3" color="cyan" />
        </div>
      </div>
    </div>
  );
}
