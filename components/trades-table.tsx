"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { formatCurrency } from "../lib/utils";
import { toast } from "sonner";

interface Trade {
  id: string;
  symbol: string;
  quantity: number;
  price: number;
  executedAt: string;
}

interface Price {
  symbol: string;
  price: number;
}

async function fetchTrades(): Promise<Trade[]> {
  const res = await fetch("/api/transactions");
  if (!res.ok) throw new Error("Failed to load trades");
  return res.json();
}

async function fetchPrices(): Promise<Price[]> {
  const res = await fetch("/api/prices");
  if (!res.ok) throw new Error("Failed to load prices");
  const data = await res.json();
  return data.markets ?? [];
}

export function TradesTable({
  initial,
  prices
}: {
  initial: Trade[];
  prices: Price[];
}) {
  const client = useQueryClient();
  const { data = initial } = useQuery({
    queryKey: ["trades"],
    queryFn: fetchTrades,
    initialData: initial
  });

  const { data: livePrices = prices } = useQuery({
    queryKey: ["prices"],
    queryFn: fetchPrices,
    initialData: prices
  });

  const combinedPrices = [...prices, ...livePrices];

  const priceMap = combinedPrices.reduce<Record<string, number>>((acc, p) => {
    acc[p.symbol.toUpperCase()] = p.price;
    return acc;
  }, {});

  const syncTrades = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/sync/binance/trades", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Unable to sync trades");
      }
      return res.json();
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["trades"] });
      toast.success("Binance trades synced");
    },
    onError: (err: any) => toast.error(err.message)
  });

  return (
    <div className="glass rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">Trade history (buys only)</p>
          <p className="text-xs text-muted-foreground">
            Auto-synced from Binance; shows each fill and live P/L.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncTrades.mutate()}
          disabled={syncTrades.isPending}
        >
          {syncTrades.isPending ? "Syncing…" : "Sync Binance trades"}
        </Button>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 sm:hidden">
        {data.map((t) => {
          const qty = Number(t.quantity);
          const buyPrice = Number(t.price);
          const investment = qty * buyPrice;
          const currentPrice = priceMap[t.symbol.toUpperCase()] ?? 0;
          const presentValue = qty * currentPrice;
          const pnl = presentValue - investment;
          const pnlClass = pnl >= 0 ? "text-emerald-400" : "text-rose-400";
          return (
            <div key={t.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>{t.symbol}</span>
                <span className={pnlClass}>{formatCurrency(pnl)}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>
                  <p>Investment</p>
                  <p className="text-foreground">{formatCurrency(investment)}</p>
                </div>
                <div>
                  <p>Qty</p>
                  <p className="text-foreground">{qty.toFixed(2)}</p>
                </div>
                <div>
                  <p>Buy price</p>
                  <p className="text-foreground">{formatCurrency(buyPrice)}</p>
                </div>
                <div>
                  <p>Current price</p>
                  <p className="text-foreground">
                    {currentPrice ? formatCurrency(currentPrice) : "—"}
                  </p>
                </div>
                <div>
                  <p>Present value</p>
                  <p className="text-foreground">
                    {presentValue ? formatCurrency(presentValue) : "—"}
                  </p>
                </div>
                <div>
                  <p>Time</p>
                  <p className="text-foreground">
                    {new Date(t.executedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-white/5">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Symbol</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Investment (USD)</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Qty</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Buy Price</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Current Price</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Present Value</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">P/L</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.map((t) => {
              const qty = Number(t.quantity);
              const buyPrice = Number(t.price);
              const investment = qty * buyPrice;
              const currentPrice = priceMap[t.symbol.toUpperCase()] ?? 0;
              const presentValue = qty * currentPrice;
              const pnl = presentValue - investment;
              const pnlClass = pnl >= 0 ? "text-emerald-400" : "text-rose-400";
              return (
                <tr key={t.id} className="hover:bg-white/5">
                  <td className="px-3 py-2 font-semibold">{t.symbol}</td>
                  <td className="px-3 py-2 text-right text-sm">{formatCurrency(investment)}</td>
                  <td className="px-3 py-2 text-right text-sm">{qty.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right text-sm">{formatCurrency(buyPrice)}</td>
                  <td className="px-3 py-2 text-right text-sm">
                    {currentPrice ? formatCurrency(currentPrice) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-sm">
                    {presentValue ? formatCurrency(presentValue) : "—"}
                  </td>
                  <td className={`px-3 py-2 text-right text-sm ${pnlClass}`}>
                    {formatCurrency(pnl)}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(t.executedAt).toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
