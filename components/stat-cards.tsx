import { Activity, BarChart3, Brain, Wallet } from "lucide-react";
import { formatCurrency, formatPercent } from "../lib/utils";

interface StatProps {
  portfolioValue: number;
  change24h: number;
  realizedPnl: number;
  confidence: number;
}

const icons = {
  value: Wallet,
  change: Activity,
  pnl: BarChart3,
  ai: Brain
};

export function StatCards({ stats }: { stats: StatProps }) {
  const items = [
    {
      label: "Portfolio",
      value: formatCurrency(stats.portfolioValue),
      helper: "Live valuation",
      icon: icons.value
    },
    {
      label: "24h Change",
      value: formatPercent(stats.change24h),
      helper: "Cross-asset delta",
      icon: icons.change
    },
    {
      label: "Realized PnL",
      value: formatCurrency(stats.realizedPnl),
      helper: "Last 30d",
      icon: icons.pnl
    },
    {
      label: "AI Confidence",
      value: `${stats.confidence}%`,
      helper: "Grok/OpenAI consensus",
      icon: icons.ai
    }
  ];

  return (
    <div className="card-grid">
      {items.map((item) => (
        <div key={item.label} className="glass rounded-xl p-4 shadow-floating">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-primary/10 p-2 text-primary">
              <item.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="text-xl font-semibold">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.helper}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
