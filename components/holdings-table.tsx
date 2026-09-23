"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { formatCurrency } from "../lib/utils";
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

async function fetchStockQuote(symbol: string, market: string) {
  const res = await fetch(`/api/stock-quote?symbol=${encodeURIComponent(symbol)}&market=${market}`);
  if (!res.ok) return null;
  return res.json() as Promise<{ quote: Price | null; currency: string }>;
}

export function HoldingsTable({
  initialHoldings,
  initialPrices,
  minHoldingValueUsd = 5
}: {
  initialHoldings: Holding[];
  initialPrices: Price[];
  minHoldingValueUsd?: number;
}) {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"value" | "asset">("value");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [asset, setAsset] = useState("BTC");
  const [investmentUsd, setInvestmentUsd] = useState("1000");
  const [quantity, setQuantity] = useState("1");
  const [timestamp, setTimestamp] = useState("");
  const [buyPrice, setBuyPrice] = useState("1000");
  const [assetClass, setAssetClass] = useState<"CRYPTO" | "STOCK">("CRYPTO");
  const [market, setMarket] = useState<"US" | "NGX">("US");
  const [source, setSource] = useState("bamboo");

  const { data: holdings = initialHoldings } = useQuery({
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

  const { data: stockPreview } = useQuery({
    queryKey: ["stock-quote", assetClass, asset, market],
    queryFn: () => fetchStockQuote(asset, market),
    enabled: assetClass === "STOCK" && asset.trim().length > 0
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const qty = Number(quantity);
      const buy = Number(buyPrice) || (Number(investmentUsd) && qty ? Number(investmentUsd) / qty : 0);
      if (!asset || !qty || !buy) {
        throw new Error("Fill symbol, qty, and buy price/investment");
      }
      // create holding
      const res = await fetch("/api/holdings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asset: asset.toUpperCase(),
          amount: qty,
          avgBuyPrice: buy,
          tags: [],
          timestamp: timestamp || undefined,
          assetClass,
          ...(assetClass === "STOCK" ? { market, source } : {})
        })
      });
      if (!res.ok) throw new Error("Failed to add holding");
      const holding = await res.json();
      // also create a BUY trade for history (crypto only -- stock trade
      // history isn't tracked yet)
      if (assetClass === "CRYPTO") {
        await fetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol: asset.toUpperCase(),
            quantity: qty,
            price: buy,
            executedAt: timestamp || undefined
          })
        });
      }
      return holding;
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["holdings"] });
      toast.success("Holding saved");
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
    const current = (market?.price ?? 0) * Number(h.amount);
    const invest =
      investMap[h.asset.toUpperCase()] ?? Number(h.amount) * Number(h.avgBuyPrice ?? 0);
    return { ...h, current, invest, market };
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

  const isNgx = assetClass === "STOCK" && market === "NGX";
  const currencyLabel = isNgx ? "NGN" : "USD";
  const currentPrice =
    assetClass === "STOCK"
      ? stockPreview?.quote?.price ?? 0
      : priceMap[asset.toUpperCase()]?.price ?? 0;
  const presentValue = (Number(quantity) || 0) * currentPrice;

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground">Add manual position</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="assetClass">Type</Label>
            <select
              id="assetClass"
              className="w-full rounded-md border border-white/10 bg-background px-3 py-2 text-sm text-foreground"
              value={assetClass}
              onChange={(e) => setAssetClass(e.target.value as "CRYPTO" | "STOCK")}
            >
              <option value="CRYPTO">Crypto (Binance)</option>
              <option value="STOCK">Stock</option>
            </select>
          </div>
          {assetClass === "STOCK" && (
            <>
              <div>
                <Label htmlFor="market">Market</Label>
                <select
                  id="market"
                  className="w-full rounded-md border border-white/10 bg-background px-3 py-2 text-sm text-foreground"
                  value={market}
                  onChange={(e) => setMarket(e.target.value as "US" | "NGX")}
                >
                  <option value="US">US</option>
                  <option value="NGX">NGX (Nigeria)</option>
                </select>
              </div>
              <div>
                <Label htmlFor="source">Broker</Label>
                <select
                  id="source"
                  className="w-full rounded-md border border-white/10 bg-background px-3 py-2 text-sm text-foreground"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                >
                  <option value="bamboo">Bamboo</option>
                  <option value="cscs">CSCS / local broker</option>
                  <option value="manual">Other</option>
                </select>
              </div>
            </>
          )}
          <div>
            <Label htmlFor="asset">Symbol</Label>
            <Input
              id="asset"
              value={asset}
              onChange={(e) => setAsset(e.target.value.toUpperCase())}
              placeholder={assetClass === "STOCK" ? "e.g. DANGCEM or AAPL" : "e.g. VET"}
            />
          </div>
          <div>
            <Label htmlFor="investment">Investment ({currencyLabel})</Label>
            <Input
              id="investment"
              value={investmentUsd}
              onChange={(e) => setInvestmentUsd(e.target.value)}
              type="number"
              min="0"
            />
          </div>
          <div>
            <Label htmlFor="qty">Quantity</Label>
            <Input
              id="qty"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              type="number"
              step="0.0001"
              min="0"
            />
          </div>
          <div>
            <Label htmlFor="buy">Buy price ({currencyLabel})</Label>
            <Input
              id="buy"
              value={buyPrice}
              onChange={(e) => setBuyPrice(e.target.value)}
              type="number"
              step="0.0001"
              min="0"
            />
            {isNgx && (
              <p className="mt-1 text-xs text-muted-foreground">
                Converted to USD automatically at today&apos;s rate when saved.
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="ts">Date/Time (optional)</Label>
            <Input
              id="ts"
              value={timestamp}
              onChange={(e) => setTimestamp(e.target.value)}
              type="datetime-local"
            />
          </div>
          <div>
            <Label>Current price</Label>
            <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm">
              {currentPrice
                ? formatCurrency(currentPrice, currencyLabel)
                : assetClass === "STOCK" && asset.trim()
                  ? "Looking up..."
                  : "-"}
            </div>
          </div>
          <div>
            <Label>Present value (auto)</Label>
            <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm">
              {presentValue ? formatCurrency(presentValue, currencyLabel) : "-"}
            </div>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
            {createMutation.isPending ? "Saving..." : "Save position"}
          </Button>
        </div>
      </div>

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
            className="rounded-md border border-white/10 bg-transparent px-2 py-1 text-sm"
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
                <p>Invest</p>
                <p className="text-foreground">{formatCurrency(row.invest ?? 0)}</p>
              </div>
              <div>
                <p>Amount</p>
                <p className="text-foreground">{Number(row.amount).toFixed(2)}</p>
              </div>
              <div>
                <p>Value</p>
                <p className="text-foreground">{formatCurrency(row.current)}</p>
              </div>
            </div>
            {row.createdAt && (
              <div className="mt-1 text-[11px] text-muted-foreground">
                {new Date(row.createdAt).toLocaleString()}
              </div>
            )}
          </div>
        ))}
        <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Total</span>
            <span>{formatCurrency(totalValue)}</span>
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
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Invest</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Amount</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Value</th>
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
                <td className="px-4 py-3 text-right">{formatCurrency(row.invest ?? 0)}</td>
                <td className="px-4 py-3 text-right">{Number(row.amount).toFixed(2)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(row.current)}</td>
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
              <td className="px-4 py-3 text-right font-semibold">{formatCurrency(totalInvest)}</td>
              <td className="px-4 py-3 text-right font-semibold">{formatCurrency(totalValue)}</td>
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

