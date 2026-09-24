"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";

const schema = z.object({
  fullName: z.string().optional(),
  binanceApiKey: z.string().optional(),
  binanceApiSecret: z.string().optional(),
  trading212ApiKey: z.string().optional(),
  trading212ApiSecret: z.string().optional(),
  mansaApiKey: z.string().optional(),
  openaiApiKey: z.string().optional(),
  deepseekApiKey: z.string().optional(),
  resendApiKey: z.string().optional(),
  resendFrom: z.string().email().optional(),
  dailyEmailTo: z.string().email().optional(),
  minHoldingValueUsd: z.coerce.number().min(0).optional()
});

type FormValues = z.infer<typeof schema>;

export function SettingsForm({ initial }: { initial?: Partial<FormValues> }) {
  const client = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { minHoldingValueUsd: 5, ...initial }
  });

  const onSubmit = async (values: FormValues) => {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values)
    });
    if (!res.ok) {
      toast.error("Unable to save settings");
      return;
    }
    toast.success("Settings saved");
  };

  const syncTrading212 = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/sync/trading212", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Trading 212 sync failed");
        return;
      }
      // Sync happens on this page, but holdings/prices/trades are shown on
      // the dashboard -- invalidate here so it's already fresh whenever you
      // navigate there, instead of waiting for its next 15s poll.
      client.invalidateQueries({ queryKey: ["holdings"] });
      client.invalidateQueries({ queryKey: ["prices"] });
      client.invalidateQueries({ queryKey: ["trades"] });
      toast.success(`Synced ${data.synced ?? 0} Trading 212 position(s)`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <form
      className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-floating"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full name (for reports)</Label>
          <Input id="fullName" {...form.register("fullName")} placeholder="Portfolio owner" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="binanceApiKey">Binance API Key</Label>
          <Input id="binanceApiKey" type="password" {...form.register("binanceApiKey")} placeholder="Optional" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="binanceApiSecret">Binance API Secret</Label>
          <Input
            id="binanceApiSecret"
            type="password"
            {...form.register("binanceApiSecret")}
            placeholder="Optional"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="trading212ApiKey">Trading 212 API Key</Label>
          <Input id="trading212ApiKey" type="password" {...form.register("trading212ApiKey")} placeholder="Optional" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="trading212ApiSecret">Trading 212 API Secret</Label>
          <Input
            id="trading212ApiSecret"
            type="password"
            {...form.register("trading212ApiSecret")}
            placeholder="Optional"
          />
          <p className="text-xs text-muted-foreground">
            Generate both in the Trading 212 app under Settings &rarr; API (Beta).
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="mansaApiKey">Mansa API Key (NGX prices)</Label>
          <Input id="mansaApiKey" type="password" {...form.register("mansaApiKey")} placeholder="mansa_live_sk_..." />
          <p className="text-xs text-muted-foreground">
            Free at{" "}
            <a
              href="https://mansaapi.com/docs"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline-offset-2 hover:underline"
            >
              mansaapi.com
            </a>{" "}
            (100 req/day, no card). Without a key, NGX prices fall back to a free scraper.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="openaiApiKey">OpenAI API Key (primary)</Label>
          <Input id="openaiApiKey" type="password" {...form.register("openaiApiKey")} placeholder="sk-..." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deepseekApiKey">DeepSeek API Key (fallback)</Label>
          <Input id="deepseekApiKey" type="password" {...form.register("deepseekApiKey")} placeholder="sk-..." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="resendApiKey">Resend API Key</Label>
          <Input id="resendApiKey" type="password" {...form.register("resendApiKey")} placeholder="re_" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="resendFrom">Resend From Email</Label>
          <Input id="resendFrom" type="email" {...form.register("resendFrom")} placeholder="no-reply@yourdomain.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dailyEmailTo">Daily Signal Email</Label>
          <Input id="dailyEmailTo" type="email" {...form.register("dailyEmailTo")} placeholder="you@desk.io" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="minHoldingValueUsd">Minimum holding value to track ($)</Label>
          <Input
            id="minHoldingValueUsd"
            type="number"
            min="0"
            step="0.01"
            {...form.register("minHoldingValueUsd")}
            placeholder="5"
          />
          <p className="text-xs text-muted-foreground">
            Holdings, charts, and stats worth less than this are hidden from the dashboard. Default is $5.
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={syncing} onClick={syncTrading212}>
          {syncing ? "Syncing..." : "Sync Trading 212 now"}
        </Button>
        <Button type="submit">Save configuration</Button>
      </div>
    </form>
  );
}
