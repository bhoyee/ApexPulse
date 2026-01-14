"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { formatCurrency } from "../lib/utils";
import { toast } from "sonner";
import { Download } from "lucide-react";

interface Trade {
  id: string;
  symbol: string;
  quantity: number;
  price: number;
  executedAt: string;
}

interface Holding {
  asset: string;
  amount: number;
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

async function fetchHoldings(): Promise<Holding[]> {
  const res = await fetch("/api/holdings");
  if (!res.ok) throw new Error("Failed to load holdings");
  return res.json();
}

export function TradesTable({
  initial,
  prices,
  ownerName
}: {
  initial: Trade[];
  prices: Price[];
  ownerName?: string;
}) {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const [search, setSearch] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data = initial } = useQuery({
    queryKey: ["trades"],
    queryFn: fetchTrades,
    initialData: initial,
    refetchInterval: 15000
  });

  const { data: holdings = [] } = useQuery({
    queryKey: ["holdings"],
    queryFn: fetchHoldings,
    initialData: [],
    refetchInterval: 15000
  });

  const { data: livePrices = prices } = useQuery({
    queryKey: ["prices"],
    queryFn: fetchPrices,
    initialData: prices,
    refetchInterval: 15000
  });

  const combinedPrices = [...prices, ...livePrices];

  const priceMap = combinedPrices.reduce<Record<string, number>>((acc, p) => {
    acc[p.symbol.toUpperCase()] = p.price;
    return acc;
  }, {});

  const activeSymbols = new Set(
    holdings
      .filter((h) => {
        const qty = Number(h.amount);
        if (qty <= 0) return false;
        const price = priceMap[h.asset.toUpperCase()] ?? 0;
        return qty * price > 5;
      })
      .map((h) => h.asset.toUpperCase())
  );
  const filterActive = activeSymbols.size > 0;

  const filtered = data
    .filter((t) => !filterActive || activeSymbols.has(t.symbol.toUpperCase()))
    .filter((t) => t.symbol.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aTime = new Date(a.executedAt).getTime();
      const bTime = new Date(b.executedAt).getTime();
      return sortDir === "desc" ? bTime - aTime : aTime - bTime;
    });

  const filteredByDate = useMemo(() => {
    const fromTs = fromDate ? new Date(fromDate).getTime() : null;
    const toTs = toDate ? new Date(toDate).getTime() : null;
    return filtered.filter((t) => {
      const ts = new Date(t.executedAt).getTime();
      if (fromTs && ts < fromTs) return false;
      if (toTs && ts > toTs) return false;
      return true;
    });
  }, [filtered, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filteredByDate.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const tradesPage = filteredByDate.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const totals = useMemo(() => {
    return filteredByDate.reduce(
      (acc, t) => {
        const qty = Number(t.quantity);
        const buy = Number(t.price);
        const current = priceMap[t.symbol.toUpperCase()] ?? 0;
        acc.invested += qty * buy;
        acc.present += qty * current;
        return acc;
      },
      { invested: 0, present: 0 }
    );
  }, [filteredByDate, priceMap]);
  const totalPnl = totals.present - totals.invested;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete trade");
    },
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ["trades"] });
      toast.success("Trade removed");
    },
    onError: (err: any) => toast.error(err.message)
  });

  return (
    <div className="glass rounded-xl p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">Trade history (buys only)</p>
          <p className="text-xs text-muted-foreground">
            Auto-synced from Binance; shows each fill and live P/L.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="hidden rounded-md border border-white/10 bg-transparent px-3 py-2 text-sm sm:block"
            placeholder="Filter..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <input
            type="date"
            className="rounded-md border border-white/10 bg-transparent px-3 py-2 text-xs"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
          />
          <input
            type="date"
            className="rounded-md border border-white/10 bg-transparent px-3 py-2 text-xs"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
          />
          <button
            className="inline-flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-xs"
            onClick={async () => {
              try {
                const { jsPDF } = await import("jspdf");
                const autoTable = (await import("jspdf-autotable")).default;
                const doc = new jsPDF();
                const generatedAt = new Date().toLocaleString();
                const rangeLabel =
                  fromDate || toDate
                    ? `Date range: ${fromDate || "start"} to ${toDate || "now"}`
                    : "Date range: all records";
                doc.setFontSize(14);
                doc.text("ApexPulse Trade History", 14, 14);
                doc.setFontSize(10);
                const accountLabel = ownerName ? `Account: ${ownerName}` : "Account: (not set)";
                doc.text(accountLabel, 14, 22);
                doc.text(rangeLabel, 14, 28);
                doc.text(`Generated: ${generatedAt}`, 14, 34);
                autoTable(doc, {
                  head: [["Symbol", "Qty", "Buy", "Current", "Present", "P/L", "Time"]],
                  startY: 42,
                  body: filteredByDate.map((t) => {
                    const qty = Number(t.quantity);
                    const buy = Number(t.price);
                    const current = priceMap[t.symbol.toUpperCase()] ?? 0;
                    const present = qty * current;
                    const pnl = present - qty * buy;
                    return [
                      t.symbol,
                      qty.toFixed(2),
                      formatCurrency(buy),
                      current ? formatCurrency(current) : "-",
                      present ? formatCurrency(present) : "-",
                      formatCurrency(pnl),
                      new Date(t.executedAt).toLocaleString()
                    ];
                  })
                });
                autoTable(doc, {
                  head: [["Totals", "Invested", "Present", "P/L"]],
                  body: [
                    [
                      "Summary",
                      formatCurrency(totals.invested),
                      formatCurrency(totals.present),
                      formatCurrency(totalPnl)
                    ]
                  ],
                  startY: (doc as any).lastAutoTable.finalY + 8
                });
                doc.save("apexpulse-trades.pdf");
              } catch (err: any) {
                toast.error("Failed to export PDF");
              }
            }}
          >
            <Download className="h-4 w-4" />
            Export PDF
          </button>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 sm:hidden">
        {tradesPage.map((t) => {
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
                    {presentValue ? formatCurrency(presentValue) : "-"}
                  </p>
                </div>
                <div>
                  <p>Time</p>
                  <p className="text-foreground">
                    {new Date(t.executedAt).toLocaleString()}
                  </p>
                </div>
                <div className="col-span-2 flex justify-end">
                  <button
                    className="text-destructive"
                    onClick={() => deleteMutation.mutate(t.id)}
                    disabled={deleteMutation.isPending}
                  >
                    Remove
                  </button>
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
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {tradesPage.map((t) => {
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
                    {presentValue ? formatCurrency(presentValue) : "-"}
                  </td>
                  <td className={`px-3 py-2 text-right text-sm ${pnlClass}`}>
                    {formatCurrency(pnl)}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {new Date(t.executedAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      className="text-destructive underline-offset-2 hover:underline"
                      onClick={() => deleteMutation.mutate(t.id)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-white/10 bg-white/5 px-3 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Sort</span>
            <button
              className="rounded-md border border-white/10 px-2 py-1"
              onClick={() => setSortDir(sortDir === "desc" ? "asc" : "desc")}
            >
              {sortDir === "desc" ? "Newest" : "Oldest"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="rounded-md border border-white/10 bg-transparent px-2 py-1"
              placeholder="Filter..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <button
              className="rounded-md border border-white/10 px-2 py-1 disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              Prev
            </button>
            <span>
              Page {currentPage} / {totalPages} | {filteredByDate.length} trades
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
    </div>
  );
}




