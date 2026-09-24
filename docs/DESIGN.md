# Design Notes

- Layout: Next.js App Router, full-width (no centered max-width column), Tailwind base, shadcn components.
- Dashboard: tabbed, not stacked -- Crypto (default), Trading 212, Nigeria Stock, plus an Other Stocks
  tab that only renders if used. All tabs stay mounted (hidden, not unmounted) so live queries keep
  polling instead of resetting on every switch.
- Visuals: Tremor + Recharts (Price Glide = current value, Dominance = cost basis -- deliberately
  different data, not the same numbers in two chart shapes), glassmorphism cards, dark-first palette.
- Stat cards vary by section: crypto shows BTC Price/Stable Balance; stock sections show
  Positions count/Best Mover instead, since the crypto-specific metrics don't apply.
- Destructive actions (Remove/Delete) are always a solid `variant="destructive"` Button, never a
  plain text link or ghost-styled button, consistently across holdings and trade history.
- Interaction: TanStack Query for data (shared cache across tabs via identical query keys), toast
  feedback on sync/save/remove actions. Every mutation invalidates prices alongside
  holdings/trades so a new/removed position reflects instantly, not after a manual reload.
- Theme: next-themes toggles light/dark.

