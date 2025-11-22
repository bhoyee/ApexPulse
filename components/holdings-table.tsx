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

  const [page, setPage] = useState(1);

  const pageSize = 8;

  const [search, setSearch] = useState("");

  const [sortKey, setSortKey] = useState<"value" | "asset">("value");

  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [asset, setAsset] = useState("BTC");

  const [investmentUsd, setInvestmentUsd] = useState("1000");

  const [quantity, setQuantity] = useState("1");

  const [buyPrice, setBuyPrice] = useState("1000");



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

      const qty = Number(quantity);

      const buy = Number(buyPrice) || (Number(investmentUsd) && qty ? Number(investmentUsd) / qty : 0);

      if (!asset || !qty || !buy) {

        throw new Error("Fill symbol, qty, and buy price/investment");

      }

      const res = await fetch("/api/holdings", {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({

          asset: asset.toUpperCase(),

          amount: qty,

          avgBuyPrice: buy,

          tags: []

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



  const rowsRaw = holdings.map((h) => {

    const market = priceMap[h.asset];

    const current = (market?.price ?? 0) * Number(h.amount);

    const cost = Number(h.avgBuyPrice) * Number(h.amount);

    return { ...h, current, market };

  });



  const filtered = rowsRaw
    .filter((r) => r.current > 5) // only show >$5 positions
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



  const currentPrice = priceMap[asset.toUpperCase()]?.price ?? 0;

  const presentValue = (Number(quantity) || 0) * currentPrice;



  return (

    <div className="space-y-4">

      <div className="glass rounded-xl p-4">

        <div className="mb-2 flex items-center justify-between">

          <h3 className="text-sm font-semibold text-muted-foreground">Add manual position</h3>

        </div>

        <div className="grid gap-3 sm:grid-cols-3">

          <div>

            <Label htmlFor="asset">Symbol</Label>

            <Input

              id="asset"

              value={asset}

              onChange={(e) => setAsset(e.target.value.toUpperCase())}

              placeholder="e.g. VET"

            />

          </div>

          <div>

            <Label htmlFor="investment">Investment (USD)</Label>

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

            <Label htmlFor="buy">Buy price (USD)</Label>

            <Input

              id="buy"

              value={buyPrice}

              onChange={(e) => setBuyPrice(e.target.value)}

              type="number"

              step="0.0001"

              min="0"

            />

          </div>

          <div>

            <Label>Current price</Label>

            <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm">

              {currentPrice ? formatCurrency(currentPrice) : "-"}

            </div>

          </div>

          <div>

            <Label>Present value (auto)</Label>

            <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm">

              {presentValue ? formatCurrency(presentValue) : "-"}

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

                <p className="text-foreground">{Number(row.amount).toFixed(2)}</p>

              </div>

              <div>

                <p>Value</p>

                <p className="text-foreground">{formatCurrency(row.current)}</p>

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

              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Amount</th>

              <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Value</th>

              <th className="px-4 py-3" />

            </tr>

          </thead>

          <tbody className="divide-y divide-white/5">

            {rows.map((row) => (

              <tr key={row.id} className="hover:bg-white/5">

                <td className="px-4 py-3 font-semibold">{row.asset}</td>

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

              <td />

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

            Page {currentPage} / {totalPages}  {filtered.length} assets

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

