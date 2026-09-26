"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { formatCurrency } from "../lib/utils";
import { useFxRate } from "../lib/use-fx-rate";
import { toast } from "sonner";

interface Holding {
  id: string;
  asset: string;
  amount: number;
  avgBuyPrice: number;
  tags: string[];
  createdAt?: string;
  assetClass?: string;
  market?: string | null;
  source?: string | null;
}

interface Price {
  symbol: string;
  price: number;
  change24h?: number;
  /** True when this is a fallback (cost basis) price, not a live quote --
   * e.g. every upstream NGX source was unreachable when the price was fetched. */
  stale?: boolean;
}

interface Trade {
  symbol: string;
  quantity: number;
  price: number;
  type?: string;
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

async function fetchTrades(): Promise<Trade[]> {
  const res = await fetch("/api/transactions");
  if (!res.ok) return [];
  return res.json();
}

export function HoldingsTable({
  initialHoldings,
  initialPrices,
  minHoldingValueUsd = 5,
  symbols,
  displayCurrency = "USD"
}: {
  initialHoldings: Holding[];
  initialPrices: Price[];
  minHoldingValueUsd?: number;
  /** Restrict the listing to this set of asset symbols (e.g. one dashboard section). Omit to include everything. */
  symbols?: string[];
  /** Everything is stored/calculated in USD; this only converts the final displayed numbers (e.g. "NGN" for the NGX section). */
  displayCurrency?: string;
}) {
  const client = useQueryClient();
  const fxRate = useFxRate(displayCurrency);
  const fmt = (usdValue: number) => formatCurrency(usdValue * fxRate, displayCurrency);
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"value" | "asset">("value");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data: allHoldings = initialHoldings } = useQuery({
    queryKey: ["holdings"],
    queryFn: fetchHoldings,
    initialData: initialHoldings,
    refetchInterval: 15000
  });

  const { data: prices = initialPrices } = useQuery({
    queryKey: ["prices"],
    queryFn: fetchPrices,
    initialData: initialPrices,
    refetchInterval: 15000
  });

  const { data: trades = [] } = useQuery({
    queryKey: ["trades"],
    queryFn: fetchTrades,
    initialData: [],
    refetchInterval: 15000
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/holdings/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["holdings"] });
      client.invalidateQueries({ queryKey: ["prices"] });
    },
    onError: (error: any) => toast.error(error.message)
  });

  const allowed = symbols ? new Set(symbols.map((s) => s.toUpperCase())) : null;
  const holdings = allowed ? allHoldings.filter((h) => allowed.has(h.asset.toUpperCase())) : allHoldings;

  const priceMap = useMemo(
    () =>
      prices.reduce<Record<string, Price>>((acc, p) => {
        acc[p.symbol.toUpperCase()] = p;
        return acc;
      }, {}),
    [prices]
  );

  const investMap = useMemo(() => {
    const map: Record<string, number> = {};
    trades
      .filter((t) => (t.type ?? "BUY") === "BUY")
      .forEach((t) => {
        const sym = t.symbol.toUpperCase();
        const spend = Number(t.quantity) * Number(t.price);
        map[sym] = (map[sym] ?? 0) + spend;
      });
    return map;
  }, [trades]);

  const rowsRaw = holdings.map((h) => {
    const market = priceMap[h.asset.toUpperCase()];
    const currentPrice = market?.price ?? 0;
    const current = currentPrice * Number(h.amount);
    const invest =
      investMap[h.asset.toUpperCase()] ?? Number(h.amount) * Number(h.avgBuyPrice ?? 0);
    return { ...h, current, currentPrice, invest, pnl: current - invest, market };
  });

  const filtered = rowsRaw
    .filter((r) => r.current > minHoldingValueUsd) // only show positions above the configured threshold
    .filter((r) => r.asset.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortKey === "value") {
        return sortDir === "desc" ? b.current - a.current : a.current - b.current;
      }
      return sortDir === "desc"
        ? b.asset.localeCompare(a.asset)
        : a.asset.localeCompare(b.asset);
    });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const totalValue = rows.reduce((t, r) => t + r.current, 0);
  const totalInvest = rows.reduce((t, r) => t + (r.invest ?? 0), 0);
  const totalPnl = totalValue - totalInvest;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <input
          className="w-full rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm sm:w-64"
          placeholder="Filter assets..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Sort by</span>
          <select
            className="rounded-md border border-white/10 bg-background px-2 py-1 text-sm text-foreground"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as any)}
          >
            <option value="value">Value</option>
            <option value="asset">Asset</option>
          </select>
          <button
            className="rounded-md border border-white/10 px-2 py-1 text-sm"
            onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}
          >
            {sortDir === "desc" ? "DESC" : "ASC"}
          </button>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 sm:hidden">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold">
                {row.asset}
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-normal uppercase text-muted-foreground">
                  {row.source ?? "binance"}
                </span>
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => removeMutation.mutate(row.id)}
                disabled={removeMutation.isPending}
              >
                Remove
              </Button>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                <p>Qty</p>
                <p className="text-foreground">{Number(row.amount).toFixed(2)}</p>
              </div>
              <div>
                <p>Invest</p>
                <p className="text-foreground">{fmt(row.invest ?? 0)}</p>
              </div>
              <div>
                <p>Current price</p>
                <p className="flex items-center gap-1.5 text-foreground">
                  {fmt(row.currentPrice ?? 0)}
                  {row.market?.stale && (
                    <span
                      title="No live quote available right now -- showing cost basis until a price feed responds."
                      className="rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-normal uppercase text-amber-400"
                    >
                      stale
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p>Value</p>
                <p className="text-foreground">{fmt(row.current)}</p>
              </div>
              <div>
                <p>PnL</p>
                <p className={row.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}>
                  {fmt(row.pnl)}
                </p>
              </div>
            </div>
            {row.createdAt && (
              <div className="mt-1 text-[11px] text-muted-foreground">
                Added {new Date(row.createdAt).toLocaleString()}
              </div>
            )}
          </div>
        ))}
        {!rows.length && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
            No holdings here yet.
          </div>
        )}
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Total</span>
            <span>{fmt(totalValue)}</span>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <button
            className="rounded-md border border-white/10 px-2 py-1 disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Prev
          </button>
          <span>
            Page {currentPage} / {totalPages}
          </span>
          <button
            className="rounded-md border border-white/10 px-2 py-1 disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-white/10 sm:block">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-white/5">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Asset</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Qty</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Invest</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Current price</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Value</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">PnL</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Added</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-white/5">
                <td className="px-4 py-3 font-semibold">
                  <span className="flex items-center gap-2">
                    {row.asset}
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-normal uppercase text-muted-foreground">
                      {row.source ?? "binance"}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-3 text-right">{Number(row.amount).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">{fmt(row.invest ?? 0)}</td>
                <td className="px-4 py-3 text-right">
                  <span className="flex items-center justify-end gap-1.5">
                    {fmt(row.currentPrice ?? 0)}
                    {row.market?.stale && (
                      <span
                        title="No live quote available right now -- showing cost basis until a price feed responds."
                        className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-normal uppercase text-amber-400"
                      >
                        no live price
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">{fmt(row.current)}</td>
                <td
                  className={`px-4 py-3 text-right ${row.pnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}
                >
                  {fmt(row.pnl)}
                </td>
                <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                  {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "--"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeMutation.mutate(row.id)}
                    disabled={removeMutation.isPending}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No holdings here yet.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-white/5">
            <tr>
              <td className="px-4 py-3 font-semibold">Total</td>
              <td />
              <td className="px-4 py-3 text-right font-semibold">{fmt(totalInvest)}</td>
              <td />
              <td className="px-4 py-3 text-right font-semibold">{fmt(totalValue)}</td>
              <td
                className={`px-4 py-3 text-right font-semibold ${totalPnl >= 0 ? "text-emerald-400" : "text-rose-400"}`}
              >
                {fmt(totalPnl)}
              </td>
              <td />
              <td />
            </tr>
          </tfoot>
        </table>
        <div className="flex items-center justify-between border-t border-white/10 bg-white/5 px-4 py-2 text-xs text-muted-foreground">
          <button
            className="rounded-md border border-white/10 px-2 py-1 disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Prev
          </button>
          <span>
            Page {currentPage} / {totalPages} | {filtered.length} assets
          </span>
          <button
            className="rounded-md border border-white/10 px-2 py-1 disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
