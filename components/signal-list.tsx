"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { BadgeDollarSign, RefreshCw } from "lucide-react";
import { formatPercent } from "../lib/utils";
import { toast } from "sonner";

interface Signal {
  id: string;
  symbol: string;
  summary: string;
  confidence: number;
  source: string;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  createdAt: string;
}

async function fetchSignals(refresh = false): Promise<Signal[]> {
  const res = await fetch(`/api/signals${refresh ? "?refresh=true" : ""}`);
  if (!res.ok) throw new Error("Unable to fetch signals");
  return res.json();
}

export function SignalList({ initial }: { initial: Signal[] }) {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["signals"],
    queryFn: () => fetchSignals(false),
    initialData: initial
  });

  const refresh = async () => {
    toast("Generating fresh swings with OpenAI (DeepSeek fallback)…");
    await fetchSignals(true);
    await refetch();
  };

  return (
    <div className="glass rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">AI Swing Signals</p>
          <p className="text-xs text-muted-foreground">
            OpenAI primary, DeepSeek fallback — stored locally for compliance.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={isFetching} onClick={refresh}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {isFetching ? "Updating..." : "Refresh"}
        </Button>
      </div>
      <div className="space-y-3">
        {data?.map((s) => (
          <div key={s.id ?? s.symbol} className="rounded-lg border border-white/5 bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-primary/20 px-2 py-1 text-xs font-semibold text-primary">
                  {s.symbol}
                </span>
                <span className="text-xs text-muted-foreground uppercase">{s.source}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <BadgeDollarSign className="h-4 w-4" />
                <span>Conf {s.confidence}%</span>
                <span>
                  Entry{" "}
                  {s.entryPrice !== undefined && s.entryPrice !== null
                    ? `$${Number(s.entryPrice).toFixed(4)}`
                    : "—"}
                </span>
                <span>SL {s.stopLoss ?? "—"}%</span>
                <span>TP {s.takeProfit ?? "—"}%</span>
              </div>
            </div>
            <p className="mt-2 text-sm text-foreground">{s.summary}</p>
            <p className="text-xs text-muted-foreground">
              Issued {new Date(s.createdAt ?? Date.now()).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
