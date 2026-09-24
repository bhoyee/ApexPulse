# API Overview

- `POST /api/auth/register` -- credentials sign-up
- `GET/POST /api/auth/[...nextauth]` -- NextAuth v5 handlers
- `GET/POST /api/holdings` -- list/create holdings (create converts NGN buy price to USD for NGX)
- `PUT/DELETE /api/holdings/[id]` -- update/delete holding
- `GET /api/prices` -- merged market prices across every source (Binance, Yahoo, Trading212 snapshot, Mansa/NGX scraper), all USD
- `GET /api/stock-quote?symbol=&market=` -- live single-symbol preview for the "Add position" form, before it's saved
- `GET /api/fx?to=CURRENCY` -- how many units of `CURRENCY` equal 1 USD
- `GET /api/signals` -- list signals; `?refresh=true` to generate new (gated at 80%+ confidence)
- `POST /api/sync/binance` -- pull balances from Binance, apply threshold
- `POST /api/sync/trading212` -- pull positions + order history from Trading 212 (read-only)
- `GET/PUT /api/settings` -- manage per-user API keys (Binance, Trading 212, Mansa, AI, Resend) and preferences
- `POST /api/cron/daily` -- manual trigger for cron tasks (auth required)

All routes are protected by NextAuth middleware (except auth endpoints).
