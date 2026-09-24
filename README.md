# ApexPulse -- Self-Hosted Crypto + Trading 212 + Nigeria Stock Dashboard with AI Swing Signals

![ApexPulse](public/logo.svg)

ApexPulse is a production-ready, multi-asset investing dashboard: crypto (Binance, auto-synced),
Trading 212 (auto-synced via their official API), and Nigeria Stock Exchange positions (Bamboo/CSCS,
tracked with live NGX pricing) -- each in its own tab with its own stat cards and charts, plus
AI swing signals grounded in real market data. Built on Next.js 15 (App Router), Tailwind + shadcn/ui,
Tremor 3.0 + Recharts, TanStack Query v5, Prisma + Postgres, NextAuth v5, OpenAI primary with DeepSeek
fallback, Resend daily briefs, and full Docker support from day one.

## Tech
- **Next.js 15 (App Router) + TypeScript:** full-stack app with typed API routes, server components, and strict types for safety.
- **TailwindCSS + shadcn/ui + lucide-react:** consistent, fast UI build with accessible components and iconography.
- **Tremor + Recharts:** Price Glide (current value) and Dominance (cost basis) charts, scoped per dashboard tab.
- **TanStack Query v5:** background refresh, shared cache across tabs, instant UI updates after any add/sync/remove.
- **React Hook Form + Zod + next-themes:** validated forms, schema safety, and theming.
- **Prisma ORM + PostgreSQL:** clean data modeling + durable relational storage.
- **NextAuth v5 (Credentials + Google):** secure login and session management.
- **Binance Spot API (REST):** crypto holdings, trades, and market prices, auto-synced.
- **Trading 212 Public API:** stock/ETF positions and order history, auto-synced via a personal API key (read-only).
- **Mansa API + free NGX scraper fallback:** live Nigeria Stock Exchange prices, converted to USD internally and displayed in Naira.
- **Yahoo Finance (free, no key):** US stock quotes and the FX rates used to convert GBP/NGN to USD.
- **OpenAI primary → DeepSeek fallback:** AI swing signals grounded in real Binance market data, gated at 80%+ confidence.
- **Resend + React Email:** transactional daily signals email.
- **Docker + docker-compose:** one-command local/dev/prod parity, version-stamped builds, optional Redis for caching later.

### Default Ports (avoids 3000/3300/5433/15432)
- App: `3100`
- Postgres: `5442`
- Redis: `6380`
- Prisma Studio (host mode example): `5557`

## Quickstart (Docker)
```bash
cp .env.example .env
# adjust DATABASE_URL if needed; defaults to dockerized Postgres
docker compose up --build
```
Services (migrations auto-run before start):
- `apexpulse`: Next.js app (listens on 3100)
- `postgres`: Postgres 16-alpine (mapped 5442:5432)
- `redis`: reserved for future rate limiting (mapped 6380:6379)
- `cron`: runs the daily AI signal + email job via `npm run cron`

### Rebuilding after pulling new code
`docker compose up --build` always rebuilds from whatever is in your working
tree, so a `git pull` followed by that command picks up the latest code.
To also stamp the exact commit + build date into the image (shown in the
footer of every page), build with:
```bash
npm run docker:build   # stamps GIT_COMMIT/BUILD_DATE, then docker compose build
docker compose up
```

Visit http://localhost:3100. Seed admin (if provided) is created via `prisma/seed.js`. Set up each asset class in **Settings**:
- **Crypto:** add Binance API key/secret -- the cron worker auto-syncs (default every 5m via `CRON_INTERVAL_SECONDS`).
- **Trading 212:** add your API key + secret (generated in the Trading 212 app under Settings -> API Beta), then click **Sync Trading 212 now**.
- **Nigeria Stock (NGX):** add positions once from the dashboard's NGX tab (symbol, quantity, avg cost) -- price then auto-refreshes on every load. Optionally add a free Mansa API key for more reliable NGX pricing than the built-in scraper fallback.

## Local Dev (without Docker)
```bash
cp .env.example .env    # set NEXTAUTH_SECRET and DB url
npm install
npx prisma migrate dev  # creates schema locally
npm run dev             # http://localhost:3100
```
Generate Prisma client if needed: `npx prisma generate`. Seed sample data: `npm run seed`.

## Database Options
- **Docker Postgres (default):** `DATABASE_URL=postgresql://apexpulse:apexpulse@postgres:5432/apexpulse` (compose wire-up).
- **Supabase:** Grab the `postgresql` connection string from Supabase (Project Settings -> Database). Set `DATABASE_URL` and redeploy. Run migrations: `npx prisma migrate deploy`.

### Backups
- Docker PG: `docker compose exec postgres pg_dump -U apexpulse apexpulse > backup.sql`
- Supabase: use scheduled backups or `pg_dump` against the Supabase host.

## Auth
- Credentials (email/password stored with bcrypt) + Google OAuth.
- Set `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- Login page: `/login`. Middleware protects everything else.

## Providers
Global (env vars, `.env`):
- **OpenAI (primary):** `OPENAI_API_KEY` -> model `gpt-4o-mini`.
- **DeepSeek (fallback):** `DEEPSEEK_API_KEY` -> model `deepseek-chat`.
- **Resend:** `RESEND_API_KEY`, `RESEND_FROM`. Daily brief uses React Email template.
- **Binance refresh:** `BINANCE_MIN_VALUE_USD` (default 0 to include all balances), `CRON_INTERVAL_SECONDS` (default 300s ~5m auto-sync).

Per-user (entered in **Settings**, stored in the database, not env vars):
- **Binance:** API key + secret for live crypto balances/trades.
- **Trading 212:** API key + secret (Trading 212 app -> Settings -> API Beta). Read-only, auto-syncs positions and order history.
- **Mansa API** (optional): free key from [mansaapi.com](https://mansaapi.com/docs) (100 req/day, no card) for more reliable NGX stock prices than the built-in free scraper fallback.

## Cron / Automations
- A dedicated `cron` service in `docker-compose.yml` runs `npm run cron` (TSX + Prisma) to:
  - Sync Binance crypto holdings for each user
  - Pull a real, liquid market snapshot (top-volume Binance pairs + your holdings)
  - Generate 0-5 AI swing signals gated at 80%+ confidence (OpenAI -> DeepSeek -> empty result if nothing qualifies)
  - Persist signals to Postgres
  - Email the daily brief via Resend (if configured)
- Trading 212 and NGX pricing are refreshed on-demand by the dashboard (client polling + caching), not by cron -- Trading 212 via the **Sync Trading 212 now** button in Settings, NGX automatically on every page load.
- Manual trigger: `POST /api/cron/daily` (authorized users only).

## Deploy Recipes
- **Coolify:** Add the repo, choose Dockerfile, set env (PORT=3100, DATABASE_URL, NEXTAUTH_*), expose 3100. Add a Postgres service or point to Supabase. Include the `cron` service as a sidecar.
- **Railway/Render:** Use Docker or Nixpacks; set PORT=3100. Provision Postgres add-on (or Supabase). Run `npx prisma migrate deploy` on release. Add a worker using the same image with command `npm run cron`.
- **Vercel:** `output: "standalone"` is enabled. For cron/email, keep the cron worker on a VPS/container.
- **VPS/Fly.io:** Build from Dockerfile; map inbound traffic to 3100. Mount a volume for Postgres or point to external DB.

## Project Structure
- `app/` -- App Router pages + API routes
- `components/` -- UI kit, themed controls, dashboard widgets (`dashboard-tabs.tsx`, `add-position-form.tsx`, `market-radar.tsx`, `stats-live.tsx`, `holdings-table.tsx`, `trades-table.tsx`)
- `lib/` -- Prisma client, auth config, and per-domain integrations:
  - `binance.ts` -- crypto balances, trades, market prices
  - `trading212.ts` -- read-only Trading 212 client (positions, instrument currency, order history)
  - `stocks.ts` -- US stock quotes (Yahoo) and NGX quotes (Mansa API + free scraper fallback, cached)
  - `mansa.ts` -- Mansa API client for bulk NGX prices
  - `fx.ts` -- live currency conversion (GBP/NGN -> USD) via Yahoo FX tickers
  - `pricing.ts` -- fans a mixed crypto/stock holdings list out to the right source and merges results back into one USD-denominated price list
  - `ai.ts` -- AI swing signal generation + the 80%+ confidence gate
  - `email.tsx` -- daily brief templates (React Email)
- `scripts/cron.ts` -- daily swing signal + Resend job (used by cron service)
- `scripts/docker-build.mjs` -- stamps `GIT_COMMIT`/`BUILD_DATE` into the image before building
- `prisma/` -- schema + seed
- `tests/` -- Vitest unit tests (utils, AI parsing, Binance fallbacks, sync/cron with mocks)

## Running Prisma Migrations in Docker
```bash
docker compose exec apexpulse npx prisma migrate deploy
# seed (optional)
docker compose exec apexpulse node prisma/seed.js
```

## Testing
- Runner: Vitest
- Command: `npm test`
- Coverage highlights: formatting utils, AI signal parsing, Binance ticker fallbacks, trade parsing, sync and cron endpoints via mocks, auth credential schema.

## Notes
- Multi-stage Dockerfile keeps the final image lean and production-ready; `COPY --chown` (not a separate `RUN chown -R` pass) keeps rebuilds fast.
- Tremor 3.0 is pre-wired for charts; next-themes for dark/light.
- Ports 3000/3300/5433/15432 are intentionally unused per request.
- Auto-sync: cron refreshes Binance holdings every `CRON_INTERVAL_SECONDS` without manual button presses; pricing has bulk + per-symbol fallbacks and stablecoin anchors at $1.
- Every price source is best-effort: a stock holding with no live quote right now (source down, rate-limited, ticker not covered) falls back to its own cost basis rather than disappearing from the dashboard.
- Holdings are matched by `{userId, asset, source}`, not just `{userId, asset}`, so Binance/Trading 212/manual entries never silently collide even if two brokers happen to use the same ticker.

## Environment Keys (reference)
- `PORT` (default 3100)
- `DATABASE_URL` (Postgres or Supabase)
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `BINANCE_API_KEY`, `BINANCE_API_SECRET`
- `BINANCE_MIN_VALUE_USD`, `CRON_INTERVAL_SECONDS`
- `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`
- `RESEND_API_KEY`, `RESEND_FROM`
- `DAILY_EMAIL_TO` (per-user configurable in Settings UI)
- (optional) `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_ENTERPRISE`, `STRIPE_PORTAL_RETURN_URL`, `STRIPE_TEST_CUSTOMER_ID`, `STRIPE_CHECKOUT_PRO_URL`, `STRIPE_CHECKOUT_ENTERPRISE_URL`

## Architecture (high level)
ApexPulse is a **modular monolith**: the UI and API live in one Next.js app, and background work
is done by a separate cron container. The database is a single Postgres instance accessed through
Prisma. A dedicated **pricing engine** (`lib/pricing.ts`) fans each holding out to the right price
source by asset class/market and merges results back into one USD-denominated list, so no dashboard
component has to know whether an asset is crypto, a Trading 212 stock, or an NGX stock.

![Architecture Diagram](public/architecture.svg)

```mermaid
flowchart TD
    Browser[Next.js App<br/>Tabs: Crypto / Trading212 / NGX<br/>TanStack Query + Tremor] --> API[/Next.js API Routes/]
    API --> Auth[NextAuth v5<br/>Prisma Adapter]
    API --> Pricing[Pricing Engine<br/>lib/pricing.ts]
    API --> AI[AI Signals<br/>OpenAI -> DeepSeek<br/>80%+ gate]
    API --> Email[Resend + React Email]
    Pricing --> Binance[Binance<br/>crypto]
    Pricing --> Yahoo[Yahoo Finance<br/>US stocks + FX]
    Pricing --> T212[Trading212 synced snapshot]
    Pricing --> NGX[Mansa API -> free scraper<br/>Nigeria Stock NGX]
    Auth --> DB[(PostgreSQL via Prisma)]
    Pricing -.avgBuyPrice fallback.-> DB
    Cron[Cron container<br/>tsx scripts/cron.ts] --> Binance
    Cron --> AI
    Cron --> Email
    Cron --> DB
```

### How the pieces connect
- **UI (Next.js App Router):** dashboard tabs (Crypto default, then Trading 212, then Nigeria Stock, plus an Other Stocks tab that only appears if used), settings, and trade history.
- **API routes (Next.js):** expose `/api/*` endpoints for holdings, trades, prices, signals, and per-source syncs.
- **Pricing engine:** routes each holding to Binance, Yahoo Finance, Trading 212's own synced snapshot, or Mansa/the free NGX scraper -- converts everything to USD internally (`lib/fx.ts`), and falls back to a holding's own cost basis if its live source is temporarily unavailable, so nothing vanishes from the dashboard.
- **Prisma ORM:** all read/write access to Postgres.
- **Cron worker:** runs scheduled Binance sync + AI signal generation + email jobs (Trading 212/NGX refresh on-demand from the dashboard instead).
- **External services:** Binance and Trading 212 for holdings; Mansa/Yahoo/the free NGX scraper for prices; OpenAI/DeepSeek for signals; Resend for email.

This keeps deployment simple while still separating web requests from background jobs.

## Database Diagram (ERD)
```mermaid
erDiagram
  User ||--o{ ApiSetting : has
  User ||--o{ Holding : owns
  User ||--o{ Transaction : records
  User ||--o{ Signal : receives

  User {
    string id
    string email
    string name
    datetime createdAt
  }
  ApiSetting {
    string id
    string userId
    string binanceApiKey
    string binanceApiSecret
    string trading212ApiKey
    string trading212ApiSecret
    string mansaApiKey
    string openaiApiKey
    string deepseekApiKey
    string resendApiKey
    string resendFrom
    string dailyEmailTo
    string fullName
    float minHoldingValueUsd
    datetime createdAt
  }
  Holding {
    string id
    string userId
    string asset
    float amount
    float avgBuyPrice
    string assetClass "CRYPTO or STOCK"
    string market "US, NGX, LSE, etc."
    string source "binance, trading212, bamboo, cscs, manual"
    float lastPriceUsd "Trading212 synced snapshot only"
    datetime updatedAt
  }
  Transaction {
    string id
    string userId
    string symbol
    float quantity
    float price
    string type
    string source "binance, trading212"
    datetime executedAt
  }
  Signal {
    string id
    string userId
    string symbol
    string summary
    int confidence
    float entryPrice
    float stopLoss
    float takeProfit
    string source
    datetime createdAt
  }
```

## Scaling Guide (when you grow)
- **Single-node:** One app container + Postgres + cron (Docker compose).
- **Split services:** Run the Next.js app and cron worker as separate services.
- **External DB:** Move Postgres to Supabase/managed Postgres for durability.
- **Caching:** Add Redis to reduce API calls and speed up dashboards.
- **Rate limits:** Add per-user rate limiting and task queues for sync jobs.

## More brokers/exchanges (status)
Rather than a formal adapter interface, each new source got its own small client under `lib/`
(`binance.ts`, `trading212.ts`, `stocks.ts`, `mansa.ts`) that all resolve to the same
`{symbol, price, change24h, volume, high, low}` shape, fanned out by `lib/pricing.ts`. Adding
another crypto exchange (Coinbase, Kraken, KuCoin, OKX, Bybit) would follow the same pattern.
A shared `ExchangeAdapter` interface is still a reasonable refactor once there are 2+ crypto
exchanges, just not built yet.

## Pricing behavior
Every source converts to USD internally (`lib/fx.ts` for live GBP/NGN rates) so the whole app --
portfolio value, PnL, the Invest column -- can assume USD, with NGX display converted back to Naira
purely at render time.

- **Crypto (Binance):** bulk prices from `/api/v3/ticker/24hr`, per-symbol fallback via
  `/api/v3/ticker/price` if missing. Stablecoins (USDT/USDC/BUSD/FDUSD/TUSD) anchored to 1 when held
  and excluded from PnL (they're cash-equivalent, not a directional bet).
- **US stocks:** Yahoo Finance's free chart endpoint (no key).
- **Trading 212:** priced from the position snapshot captured at your last **Sync Trading 212 now**
  click (not live-polled) -- Trading 212 reports each instrument in its own native currency (e.g. GBP
  for an LSE listing), converted to USD once at sync time via the instrument's real currency from
  Trading 212's own metadata endpoint.
- **Nigeria Stock (NGX):** Mansa API primary (if you've added a free key in Settings), the free
  `afx.kwayisi.org` scraper as fallback -- cached 5-20 minutes rather than polled every 15s, since
  both are rate-limited/best-effort free resources.
- **Any stock with no live quote right now** (source down, rate-limited, ticker not covered): falls
  back to that holding's own cost basis rather than pricing at $0, so it never disappears from a
  chart/card/table.
- Threshold: `minHoldingValueUsd`, configurable per-user in Settings (default $5), applied after
  conversion so it always compares against USD regardless of which tab you're viewing.

## Auto-sync cadence
- **Crypto:** `CRON_INTERVAL_SECONDS` (default 300s ~5m) via the cron container.
- **Trading 212:** manual, via the **Sync Trading 212 now** button in Settings (their API doesn't
  support webhooks/push).
- **Nigeria Stock:** automatic on every dashboard load/15s poll, from whichever price source is
  configured -- no sync button, since these are one-time-entered positions, not synced from a broker
  account.

## Internal API (not public)
These endpoints are used by the frontend and cron worker. All require auth unless noted.

- `GET /api/holdings` -> list of holdings.
- `POST /api/holdings` -> create a holding (manual add; converts NGN buy price to USD server-side for NGX).
- `PUT /api/holdings/[id]` -> update holding.
- `DELETE /api/holdings/[id]` -> delete holding.
- `GET /api/prices` -> current prices for all your holdings, across every source, merged.
- `GET /api/stock-quote?symbol=&market=` -> live single-symbol preview for the "Add position" form (before it's saved).
- `GET /api/fx?to=CURRENCY` -> how many units of `CURRENCY` equal 1 USD.
- `GET /api/transactions` -> buy-only trades (history table).
- `POST /api/transactions` -> create manual trade.
- `DELETE /api/transactions/[id]` -> delete trade.
- `GET /api/signals` -> latest AI signals.
- `GET /api/signals?refresh=true` -> generate new signals, gated at 80%+ confidence (uses Settings keys).
- `GET/PUT /api/settings` -> manage per-user API keys and preferences.
- `POST /api/cron/daily` -> cron signal + email (authorized).
- `POST /api/sync/binance` -> sync crypto holdings/trades (authorized).
- `POST /api/sync/trading212` -> sync Trading 212 positions + order history (authorized).
