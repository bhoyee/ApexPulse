"use client";

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
  "#a78bfa" // violet
];

export function MarketRadar({ markets }: { markets: AssetSnapshot[] }) {
  const data = (markets || [])
    .map((m) => ({ symbol: m.symbol.toUpperCase(), value: Number(m.value ?? m.price ?? 0) }))
    .filter((d) => d.value > 5);

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="chart-card bg-card border border-border text-card-foreground">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">Price Glide</h3>
          <span className="text-xs text-muted-foreground">Holdings &gt; $5</span>
        </div>
        <div className="mt-4 h-80 md:h-96 overflow-x-auto">
          <div className="flex items-end gap-3 min-w-full">
            {data.map((item, idx) => {
              const heightPct = Math.max((item.value / maxValue) * 100, 5);
              const color = palette[idx % palette.length];
              return (
                <div
                  key={item.symbol}
                  className="flex w-14 flex-col items-center text-[10px] text-muted-foreground"
                  title={`${item.symbol}: ${formatCurrency(item.value)}`}
                >
                  <span className="mb-1 text-center text-[11px] font-semibold text-card-foreground">
                    {formatCurrency(item.value)}
                  </span>
                  <div
                    className="w-full rounded-t-md"
                    style={{ height: `${heightPct}%`, backgroundColor: color }}
                  />
                  <span className="mt-1 text-card-foreground text-[11px]">{item.symbol}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="chart-card bg-card border border-border text-card-foreground">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">Dominance</h3>
          <span className="text-xs text-muted-foreground">Share by value</span>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <div className="h-6 w-full overflow-hidden rounded-full border border-border bg-muted/30">
            <div className="flex h-full w-full">
              {data.map((item, idx) => {
                const pct = total ? (item.value / total) * 100 : 0;
                const color = palette[idx % palette.length];
                return (
                  <div
                    key={item.symbol}
                    style={{ width: `${pct}%`, backgroundColor: color }}
                    title={`${item.symbol}: ${pct.toFixed(1)}%`}
                  />
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            {data.map((item, idx) => {
              const pct = total ? ((item.value / total) * 100).toFixed(1) : "0.0";
              const color = palette[idx % palette.length];
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
