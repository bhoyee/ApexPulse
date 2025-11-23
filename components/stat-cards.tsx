import { Activity, BarChart3, Bitcoin, Coins, DollarSign, Wallet } from "lucide-react";
import { formatCurrency, formatPercent } from "../lib/utils";

interface StatProps {
  portfolioValue: number;
  change24h: number;
  overallPnl: number;
  totalInvested: number;
  btcPrice: number;
  totalStables: number;
}

const icons = {
  value: Wallet,
  change: Activity,
  overall: BarChart3,
  invested: DollarSign,
  btc: Bitcoin,
  stables: Coins
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
      label: "Overall PnL",
      value: formatCurrency(stats.overallPnl),
      helper: "Total vs cost basis",
      icon: icons.overall,
      tone: stats.overallPnl >= 0 ? "text-emerald-400" : "text-rose-400"
    },
    {
      label: "Total Invested",
      value: formatCurrency(stats.totalInvested),
      helper: "All-time cost basis",
      icon: icons.invested
    },
    {
      label: "BTC Price",
      value: formatCurrency(stats.btcPrice),
      helper: "Live BTC/USDT",
      icon: icons.btc
    },
    {
      label: "Stable Balance",
      value: formatCurrency(stats.totalStables),
      helper: "USDT/FDUSD/USDC/etc.",
      icon: icons.stables
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
              <p className={`text-xl font-semibold ${item.tone ?? ""}`}>{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.helper}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
