import {
  Activity,
  BarChart3,
  Bitcoin,
  Coins,
  DollarSign,
  Layers,
  TrendingUp,
  Wallet
} from "lucide-react";
import { formatCurrency, formatPercent } from "../lib/utils";

interface CryptoStats {
  variant?: "crypto";
  portfolioValue: number;
  change24h: number;
  overallPnl: number;
  totalInvested: number;
  btcPrice: number;
  totalStables: number;
}

interface StockStats {
  variant: "stock";
  portfolioValue: number;
  change24h: number;
  overallPnl: number;
  totalInvested: number;
  positions: number;
  bestMover?: { symbol: string; change: number };
}

type StatProps = CryptoStats | StockStats;

export function StatCards({ stats }: { stats: StatProps }) {
  const base = [
    {
      label: "Portfolio",
      value: formatCurrency(stats.portfolioValue),
      helper: "Live valuation",
      icon: Wallet
    },
    {
      label: "24h Change",
      value: formatPercent(stats.change24h),
      helper: "Cross-asset delta",
      icon: Activity
    },
    {
      label: "Overall PnL",
      value: formatCurrency(stats.overallPnl),
      helper: "Total vs cost basis",
      icon: BarChart3,
      tone: stats.overallPnl >= 0 ? "text-emerald-400" : "text-rose-400"
    },
    {
      label: "Total Invested",
      value: formatCurrency(stats.totalInvested),
      helper: "All-time cost basis",
      icon: DollarSign
    }
  ];

  const items =
    stats.variant === "stock"
      ? [
          ...base,
          {
            label: "Positions",
            value: String(stats.positions),
            helper: "Open holdings",
            icon: Layers
          },
          {
            label: "Best Mover",
            value: stats.bestMover ? formatPercent(stats.bestMover.change) : "-",
            helper: stats.bestMover ? stats.bestMover.symbol : "No data yet",
            icon: TrendingUp,
            tone: stats.bestMover && stats.bestMover.change >= 0 ? "text-emerald-400" : "text-rose-400"
          }
        ]
      : [
          ...base,
          {
            label: "BTC Price",
            value: formatCurrency(stats.btcPrice),
            helper: "Live BTC/USDT",
            icon: Bitcoin
          },
          {
            label: "Stable Balance",
            value: formatCurrency(stats.totalStables),
            helper: "USDT/FDUSD/USDC/etc.",
            icon: Coins
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
