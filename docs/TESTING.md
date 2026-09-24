# Testing & Validation

Manual checks:
- Auth: register/login, NextAuth session persists.
- Holdings: add/edit/remove manually across Crypto/Trading212/NGX tabs; a new position appears instantly (no manual page reload needed).
- Trading 212: **Sync Trading 212 now** in Settings pulls real positions + order history.
- NGX: adding a position shows a live preview price; the dashboard tab displays in Naira.
- Signals: `/api/signals?refresh=true` returns 0-5 AI signals, each >=80% confidence; UI refresh button works.
- Cron: `docker compose logs -f cron` shows successful sync+signals.
- Pricing: `/api/prices` returns every symbol with price > 0 or $1 for stables.

Local commands:
- `npm test` (Vitest -- unit tests: utils, AI parsing, Binance fallbacks, sync/cron mocks)
- `npm run lint`
- `npm run dev`

