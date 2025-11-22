"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { formatCurrency, formatPercent } from "../lib/utils";
import { Textarea } from "./ui/textarea";
import { toast } from "sonner";

interface Holding {
  id: string;
  asset: string;
  amount: number;
  avgBuyPrice: number;
  tags: string[];
}

interface Price {
  symbol: string;
  price: number;
  change24h?: number;
}

async function fetchHoldings(): Promise<Holding[]> {
  const res = await fetch("/api/holdings");
  if (!res.ok) throw new Error("Failed to load holdings");
  return res.json();
}

async function fetchPrices(): Promise<Price[]> {
  const res = await fetch("/api/prices");
  if (!res.ok) return [];
  const data = await res.json();
  return data.markets ?? [];
}

export function HoldingsTable({
  initialHoldings,
  initialPrices
}: {
  initialHoldings: Holding[];
  initialPrices: Price[];
}) {
  const client = useQueryClient();
  const [asset, setAsset] = useState("BTC");
  const [amount, setAmount] = useState("0.1");
  const [avgBuyPrice, setAvgBuyPrice] = useState("50000");
  const [tags, setTags] = useState("");

  const { data: holdings = initialHoldings } = useQuery({
    queryKey: ["holdings"],
    queryFn: fetchHoldings,
    initialData: initialHoldings
  });

  const { data: prices = initialPrices } = useQuery({
    queryKey: ["prices"],
    queryFn: fetchPrices,
    initialData: initialPrices
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset,
          amount: Number(amount),
          avgBuyPrice: Number(avgBuyPrice),
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        })
      });
      if (!res.ok) throw new Error("Failed to add holding");
      return res.json();
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["holdings"] });
      toast.success("Holding saved");
    },
    onError: (error: any) => toast.error(error.message)
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/sync/binance", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Unable to sync Binance");
      }
      return res.json();
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["holdings"] });
      toast.success("Binance holdings synced");
    },
    onError: (error: any) => toast.error(error.message)
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/holdings/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["holdings"] }),
    onError: (error: any) => toast.error(error.message)
  });

  const priceMap = useMemo(
    () =>
      prices.reduce<Record<string, Price>>((acc, p) => {
        acc[p.symbol] = p;
        return acc;
      }, {}),
    [prices]
  );

  const rows = holdings.map((h) => {
    const market = priceMap[h.asset];
    const current = (market?.price ?? 0) * Number(h.amount);
    const cost = Number(h.avgBuyPrice) * Number(h.amount);
    const pnl = cost === 0 ? 0 : ((current - cost) / cost) * 100;
    return { ...h, current, pnl, market };
  });

  const totalValue = rows.reduce((t, r) => t + r.current, 0);

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">
            Quick add position
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? "Syncing…" : "Sync Binance"}
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <Label htmlFor="asset">Asset</Label>
            <Input id="asset" value={asset} onChange={(e) => setAsset(e.target.value.toUpperCase())} />
          </div>
          <div>
            <Label htmlFor="amount">Amount</Label>
            <Input id="amount" value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.0001" />
          </div>
          <div>
            <Label htmlFor="avg">Avg Buy Price (USD)</Label>
            <Input id="avg" value={avgBuyPrice} onChange={(e) => setAvgBuyPrice(e.target.value)} type="number" />
          </div>
          <div>
            <Label htmlFor="tags">Tags</Label>
            <Textarea
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="core, defi, momentum"
              className="h-10"
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Saving..." : "Save position"}
          </Button>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 sm:hidden">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{row.asset}</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => removeMutation.mutate(row.id)}
              >
                Remove
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                <p>Amount</p>
                <p className="text-foreground">{Number(row.amount).toFixed(4)}</p>
              </div>
              <div>
                <p>Value</p>
                <p className="text-foreground">{formatCurrency(row.current)}</p>
              </div>
              <div>
                <p>24h</p>
                <p className="text-foreground">
                  {row.market ? formatPercent(row.market.change24h ?? 0) : "—"}
                </p>
              </div>
              <div>
                <p>P/L</p>
                <p className={row.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  {formatPercent(row.pnl)}
                </p>
              </div>
            </div>
          </div>
        ))}
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Total</span>
            <span>{formatCurrency(totalValue)}</span>
          </div>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-white/10 sm:block">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-white/5">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Asset</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Amount</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Value</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">24h</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">P/L</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Tags</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-white/5">
                <td className="px-4 py-3 font-semibold">{row.asset}</td>
                <td className="px-4 py-3 text-right">{Number(row.amount).toFixed(4)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(row.current)}</td>
                <td className="px-4 py-3 text-right">
                  {row.market ? formatPercent(row.market.change24h ?? 0) : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={row.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}>
                    {formatPercent(row.pnl)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                  {row.tags?.join(", ") || "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeMutation.mutate(row.id)}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-white/5">
            <tr>
              <td className="px-4 py-3 font-semibold">Total</td>
              <td />
              <td className="px-4 py-3 text-right font-semibold">{formatCurrency(totalValue)}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
