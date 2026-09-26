"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { formatCurrency } from "../lib/utils";
import { toast } from "sonner";

interface Price {
  symbol: string;
  price: number;
  change24h?: number;
}

async function fetchPrices(): Promise<Price[]> {
  const res = await fetch("/api/prices");
  if (!res.ok) return [];
  const data = await res.json();
  return data.markets ?? [];
}

async function fetchStockQuote(symbol: string, market: string) {
  const res = await fetch(`/api/stock-quote?symbol=${encodeURIComponent(symbol)}&market=${market}`);
  if (!res.ok) return null;
  return res.json() as Promise<{ quote: Price | null; currency: string }>;
}

export function AddPositionForm({
  title = "Add manual position",
  defaultAssetClass = "CRYPTO",
  lockAssetClass = false,
  defaultMarket = "US",
  lockMarket = false,
  defaultSymbol = "",
  defaultSource = "bamboo"
}: {
  title?: string;
  defaultAssetClass?: "CRYPTO" | "STOCK";
  lockAssetClass?: boolean;
  defaultMarket?: "US" | "NGX";
  lockMarket?: boolean;
  defaultSymbol?: string;
  defaultSource?: string;
}) {
  const client = useQueryClient();
  const [asset, setAsset] = useState(defaultSymbol);
  const [investmentUsd, setInvestmentUsd] = useState("1000");
  const [quantity, setQuantity] = useState("1");
  const [timestamp, setTimestamp] = useState("");
  const [buyPrice, setBuyPrice] = useState("1000");
  const [assetClass, setAssetClass] = useState<"CRYPTO" | "STOCK">(defaultAssetClass);
  const [market, setMarket] = useState<"US" | "NGX">(defaultMarket);
  const [source, setSource] = useState(defaultSource);

  const { data: prices = [] } = useQuery({
    queryKey: ["prices"],
    queryFn: fetchPrices,
    initialData: []
  });

  const { data: stockPreview } = useQuery({
    queryKey: ["stock-quote", assetClass, asset, market],
    queryFn: () => fetchStockQuote(asset, market),
    enabled: assetClass === "STOCK" && asset.trim().length > 0
  });

  const priceMap = prices.reduce<Record<string, Price>>((acc, p) => {
    acc[p.symbol.toUpperCase()] = p;
    return acc;
  }, {});

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
          tags: [],
          timestamp: timestamp || undefined,
          assetClass,
          ...(assetClass === "STOCK" ? { market, source } : {})
        })
      });
      if (!res.ok) throw new Error("Failed to add holding");
      const holding = await res.json();
      // Also record this as a BUY trade so it shows up in trade history --
      // `price`/`market` here are the raw values as entered (e.g. NGN for
      // NGX), converted to USD server-side the same way the holding was.
      await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: asset.toUpperCase(),
          quantity: qty,
          price: buy,
          executedAt: timestamp || undefined,
          ...(assetClass === "STOCK" ? { market } : {})
        })
      });
      return holding;
    },
    onSuccess: () => {
      // /api/prices derives its symbol list from current holdings, so a
      // newly-added symbol has no price yet until this refetches -- without
      // it, the new row computes to $0 and gets filtered out of every
      // table/chart until the next 15s poll (or a full page reload, which
      // is why that "fixed" it).
      client.invalidateQueries({ queryKey: ["holdings"] });
      client.invalidateQueries({ queryKey: ["trades"] });
      client.invalidateQueries({ queryKey: ["prices"] });
      toast.success("Holding saved");
      setAsset(defaultSymbol);
      setQuantity("1");
    },
    onError: (error: any) => toast.error(error.message)
  });

  const isNgx = assetClass === "STOCK" && market === "NGX";
  const currencyLabel = isNgx ? "NGN" : "USD";
  const currentPrice =
    assetClass === "STOCK" ? stockPreview?.quote?.price ?? 0 : priceMap[asset.toUpperCase()]?.price ?? 0;
  const presentValue = (Number(quantity) || 0) * currentPrice;

  return (
    <div className="glass rounded-xl p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {!lockAssetClass && (
          <div>
            <Label htmlFor={`assetClass-${title}`}>Type</Label>
            <select
              id={`assetClass-${title}`}
              className="w-full rounded-md border border-white/10 bg-background px-3 py-2 text-sm text-foreground"
              value={assetClass}
              onChange={(e) => setAssetClass(e.target.value as "CRYPTO" | "STOCK")}
            >
              <option value="CRYPTO">Crypto (Binance)</option>
              <option value="STOCK">Stock</option>
            </select>
          </div>
        )}
        {assetClass === "STOCK" && !lockMarket && (
          <div>
            <Label htmlFor={`market-${title}`}>Market</Label>
            <select
              id={`market-${title}`}
              className="w-full rounded-md border border-white/10 bg-background px-3 py-2 text-sm text-foreground"
              value={market}
              onChange={(e) => setMarket(e.target.value as "US" | "NGX")}
            >
              <option value="US">US</option>
              <option value="NGX">NGX (Nigeria)</option>
            </select>
          </div>
        )}
        {assetClass === "STOCK" && (
          <div>
            <Label htmlFor={`source-${title}`}>Broker</Label>
            <select
              id={`source-${title}`}
              className="w-full rounded-md border border-white/10 bg-background px-3 py-2 text-sm text-foreground"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="bamboo">Bamboo</option>
              <option value="cscs">CSCS / local broker</option>
              <option value="manual">Other</option>
            </select>
          </div>
        )}
        <div>
          <Label htmlFor={`asset-${title}`}>Symbol</Label>
          <Input
            id={`asset-${title}`}
            value={asset}
            onChange={(e) => setAsset(e.target.value.toUpperCase())}
            placeholder={assetClass === "STOCK" ? "e.g. DANGCEM or AAPL" : "e.g. VET"}
          />
        </div>
        <div>
          <Label htmlFor={`investment-${title}`}>Investment ({currencyLabel})</Label>
          <Input
            id={`investment-${title}`}
            value={investmentUsd}
            onChange={(e) => setInvestmentUsd(e.target.value)}
            type="number"
            min="0"
          />
        </div>
        <div>
          <Label htmlFor={`qty-${title}`}>Quantity</Label>
          <Input
            id={`qty-${title}`}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            type="number"
            step="0.0001"
            min="0"
          />
        </div>
        <div>
          <Label htmlFor={`buy-${title}`}>Buy price ({currencyLabel})</Label>
          <Input
            id={`buy-${title}`}
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
          <Label htmlFor={`ts-${title}`}>Date/Time (optional)</Label>
          <Input
            id={`ts-${title}`}
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
  );
}
