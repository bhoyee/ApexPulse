"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { formatCurrency } from "../lib/utils";
import { toast } from "sonner";

interface Trade {
  id: string;
  symbol: string;
  type: "BUY" | "SELL" | "TRANSFER";
  quantity: number;
  price: number;
  fee?: number;
  executedAt: string;
}

async function fetchTrades(): Promise<Trade[]> {
  const res = await fetch("/api/transactions");
  if (!res.ok) throw new Error("Failed to load trades");
  return res.json();
}

export function TradesTable({ initial }: { initial: Trade[] }) {
  const client = useQueryClient();
  const { data = initial } = useQuery({
    queryKey: ["trades"],
    queryFn: fetchTrades,
    initialData: initial
  });

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
          <p className="text-sm font-semibold text-muted-foreground">Trade history</p>
          <p className="text-xs text-muted-foreground">
            Pulls per-symbol fills from Binance (USDT pairs).
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
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-white/10">
          <thead className="bg-white/5">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Symbol</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Type</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Qty</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Price</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Fee</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.map((t) => (
              <tr key={t.id} className="hover:bg-white/5">
                <td className="px-3 py-2 font-semibold">{t.symbol}</td>
                <td className="px-3 py-2 text-xs">
                  <span className={t.type === "BUY" ? "text-emerald-400" : "text-rose-400"}>
                    {t.type}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-sm">{Number(t.quantity).toFixed(6)}</td>
                <td className="px-3 py-2 text-right text-sm">{formatCurrency(Number(t.price))}</td>
                <td className="px-3 py-2 text-right text-sm">
                  {t.fee ? formatCurrency(Number(t.fee)) : "—"}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {new Date(t.executedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
