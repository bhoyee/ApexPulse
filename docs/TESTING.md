# Testing & Validation

Manual checks:
- Auth: register/login, NextAuth session persists.
- Holdings: add/edit/remove manually; Sync Binance reflects balances.
- Signals: `/api/signals?refresh=true` returns AI signals; UI refresh button works.
- Cron: `docker compose logs -f cron` shows successful sync+signals.
- Pricing: `/api/prices` returns every symbol with price > 0 or $1 for stables.

Local commands:
- `npm run lint`
- `npm run dev`

