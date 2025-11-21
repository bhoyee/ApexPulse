# API Overview

- `POST /api/auth/register` – credentials sign-up
- `GET/POST /api/auth/[...nextauth]` – NextAuth v5 handlers
- `GET/POST /api/holdings` – list/create holdings
- `PUT/DELETE /api/holdings/[id]` – update/delete holding
- `GET /api/prices` – market prices for held symbols (with fallbacks)
- `GET /api/signals` – list signals; `?refresh=true` to generate new
- `POST /api/sync/binance` – pull balances from Binance, apply threshold
- `GET/PUT /api/settings` – manage API keys
- `POST /api/cron/daily` – manual trigger for cron tasks (auth required)

All routes are protected by NextAuth middleware (except auth endpoints).
