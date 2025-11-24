"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { toast } from "sonner";

const schema = z.object({
  binanceApiKey: z.string().optional(),
  binanceApiSecret: z.string().optional(),
  openaiApiKey: z.string().optional(),
  deepseekApiKey: z.string().optional(),
  resendApiKey: z.string().optional(),
  resendFrom: z.string().email().optional(),
  dailyEmailTo: z.string().email().optional()
});

type FormValues = z.infer<typeof schema>;

export function SettingsForm({ initial }: { initial?: Partial<FormValues> }) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial ?? {}
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

  return (
    <form
      className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-6 shadow-floating"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="binanceApiKey">Binance API Key</Label>
          <Input id="binanceApiKey" {...form.register("binanceApiKey")} placeholder="Optional" />
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
          <Label htmlFor="openaiApiKey">OpenAI API Key (primary)</Label>
          <Input id="openaiApiKey" {...form.register("openaiApiKey")} placeholder="sk-..." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="deepseekApiKey">DeepSeek API Key (fallback)</Label>
          <Input id="deepseekApiKey" {...form.register("deepseekApiKey")} placeholder="sk-..." />
        </div>
        <div className="space-y-2">
          <Label htmlFor="resendApiKey">Resend API Key</Label>
          <Input id="resendApiKey" {...form.register("resendApiKey")} placeholder="re_" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="resendFrom">Resend From Email</Label>
          <Input id="resendFrom" type="email" {...form.register("resendFrom")} placeholder="no-reply@yourdomain.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dailyEmailTo">Daily Signal Email</Label>
          <Input id="dailyEmailTo" type="email" {...form.register("dailyEmailTo")} placeholder="you@desk.io" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="submit">Save configuration</Button>
      </div>
    </form>
  );
}
