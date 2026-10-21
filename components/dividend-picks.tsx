"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { Percent, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface DividendPick {
  id: string;
  symbol: string;
  thesis: string;
  confidence: number;
  price: number;
  dividendYieldPct: number;
  source: string;
  createdAt: string;
}

async function fetchDividendPicks(refresh = false): Promise<DividendPick[]> {
  const res = await fetch(`/api/dividend-picks${refresh ? "?refresh=true" : ""}`);
  if (!res.ok) throw new Error("Unable to fetch dividend picks");
  return res.json();
}

export function DividendPicks({ initial }: { initial: DividendPick[] }) {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["dividend-picks"],
    queryFn: () => fetchDividendPicks(false),
    initialData: initial
  });

  const refresh = async () => {
    toast("Deep-searching dividend-paying US stocks with DeepSeek (OpenAI fallback)...");
    const res = await fetch(`/api/dividend-picks?refresh=true`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error ?? "Failed to refresh dividend picks");
      return;
    }
    await refetch();
  };

  return (
    <div className="glass rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">Dividend Picks</p>
          <p className="text-xs text-muted-foreground">
            Up to 2 US stocks screened for a real trailing dividend yield, room to grow, and an
            affordable per-share price (capped at $75) -- a value/income pick, not a timing call.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={isFetching} onClick={refresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {isFetching ? "Searching..." : "Refresh"}
        </Button>
      </div>
      <div className="space-y-3">
        {data?.map((p) => (
          <div key={p.id ?? p.symbol} className="rounded-lg border border-white/5 bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-primary/20 px-2 py-1 text-xs font-semibold text-primary">
                  {p.symbol}
                </span>
                <span className="text-xs text-muted-foreground uppercase">{p.source}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Percent className="h-4 w-4" />
                <span>Conf {p.confidence}%</span>
                <span>Price ${Number(p.price).toFixed(2)}</span>
                <span className="font-semibold text-emerald-400">
                  Yield {Number(p.dividendYieldPct).toFixed(2)}%
                </span>
              </div>
            </div>
            <p className="mt-2 text-sm text-foreground">{p.thesis}</p>
            <p className="text-xs text-muted-foreground">
              Issued {new Date(p.createdAt ?? Date.now()).toLocaleString()}
            </p>
          </div>
        ))}
        {!data?.length && (
          <div className="rounded-lg border border-white/5 bg-white/5 p-4 text-sm text-muted-foreground">
            No pick currently clears the bar. That's expected some days -- click Refresh to
            re-screen, or set your DeepSeek/OpenAI key in Settings if you haven't yet.
          </div>
        )}
      </div>
    </div>
  );
}
