"use client";

import { DonutChart } from "@tremor/react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart as RBarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Cell
} from "recharts";
import { formatCurrency } from "../lib/utils";

interface Holding {
  asset: string;
  amount: number;
  avgBuyPrice: number;
}

interface Price {
  symbol: string;
  price: number;
}

interface Trade {
  symbol: string;
  quantity: number;
  price: number;
  type?: string;
}

interface AssetSnapshot {
  symbol: string;
  price: number;
  value: number;
}

// Distinct color palette for the recharts bar chart (raw hex, same hues/order as tremorColors below)
const colors = [
  "#ef4444", // red
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#a855f7", // purple
  "#ec4899", // pink
  "#22d3ee", // cyan
  "#f97316", // orange
  "#84cc16", // lime
  "#0ea5e9", // sky
  "#6366f1", // indigo
  "#14b8a6"  // teal
];

// Tremor's DonutChart only recognizes its own named color tokens, not hex
// codes — passing hex here silently falls back to a single dark fill for
// every slice. Same order/hues as `colors` above so both charts match.
const tremorColors = [
  "red",
  "blue",
  "emerald",
  "amber",
  "purple",
  "pink",
  "cyan",
  "orange",
  "lime",
  "sky",
  "indigo",
  "teal"
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

async function fetchTrades(): Promise<Trade[]> {
  const res = await fetch("/api/transactions");
  if (!res.ok) return [];
  return res.json();
}

export function MarketRadar({
  markets,
  minHoldingValueUsd = 5,
  symbols
}: {
  markets: AssetSnapshot[];
  minHoldingValueUsd?: number;
  /** Restrict the chart to this set of asset symbols (e.g. one dashboard section). Omit to include everything. */
  symbols?: string[];
}) {
  const { data: allHoldings = [] } = useQuery({
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

  const { data: trades = [] } = useQuery({
    queryKey: ["trades"],
    queryFn: fetchTrades,
    initialData: [],
    refetchInterval: 15000
  });

  const allowed = symbols ? new Set(symbols.map((s) => s.toUpperCase())) : null;
  const holdings = allowed ? allHoldings.filter((h) => allowed.has(h.asset.toUpperCase())) : allHoldings;

  const priceMap = prices.reduce<Record<string, number>>((acc, p) => {
    acc[p.symbol.toUpperCase()] = p.price;
    return acc;
  }, {});

  // Price Glide: current market value per position (what it's worth NOW).
  const barData = holdings
    .map((h) => {
      const price = priceMap[h.asset.toUpperCase()] ?? 0;
      return { symbol: h.asset.toUpperCase(), value: Number(h.amount) * price };
    })
    .filter((d) => d.value > minHoldingValueUsd);

  // Dominance: cost basis per position (how much capital actually went INTO
  // it). Deliberately different from Price Glide -- a coin/stock that mooned
  // can dominate current value while barely showing up here, and vice versa.
  //
  // Prefer real trade history per symbol: Binance's balance API doesn't
  // return historical cost, so freshly-synced crypto holdings have
  // avgBuyPrice=0 until a BUY trade exists. Only fall back to
  // amount*avgBuyPrice for symbols with no trade rows (manual/NGX/Trading212
  // entries, which always have a real avgBuyPrice).
  const investedBySymbol = new Map<string, number>();
  trades
    .filter((t) => (t.type ?? "BUY") === "BUY")
    .forEach((t) => {
      const sym = t.symbol.toUpperCase();
      if (allowed && !allowed.has(sym)) return;
      investedBySymbol.set(sym, (investedBySymbol.get(sym) ?? 0) + Number(t.quantity) * Number(t.price));
    });

  const donutData = holdings
    .map((h) => {
      const sym = h.asset.toUpperCase();
      const value = investedBySymbol.get(sym) ?? Number(h.amount) * Number(h.avgBuyPrice ?? 0);
      return { name: sym, value };
    })
    .filter((d) => d.value > minHoldingValueUsd);
  const donutColors = donutData.map((_, i) => tremorColors[i % tremorColors.length]);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="chart-card bg-card border border-border p-4 text-card-foreground">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground">Price Glide</h3>
          <span className="text-xs text-muted-foreground">Current value</span>
        </div>
        <div className="mt-2 h-44 md:h-52">
          <ResponsiveContainer width="100%" height="100%">
            <RBarChart data={barData} margin={{ left: 12, right: 12, top: 8, bottom: 16 }}>
              <XAxis dataKey="symbol" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => formatCurrency(Number(v)).replace("$", "")}
              />
              <RTooltip formatter={(val) => formatCurrency(Number(val))} />
              <Bar dataKey="value">
                {barData.map((entry, index) => (
                  <Cell key={entry.symbol} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </RBarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="chart-card bg-card border border-border p-4 text-card-foreground">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-muted-foreground">Dominance</h3>
          <span className="text-xs text-muted-foreground">By cost invested</span>
        </div>
        <DonutChart
          className="mt-2 h-44 text-xs md:h-52"
          data={donutData}
          category="value"
          index="name"
          colors={donutColors}
          valueFormatter={(n) => formatCurrency(Number(n))}
        />
      </div>
    </div>
  );
}
