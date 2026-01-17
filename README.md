# ApexPulse -- Self-Hosted Crypto Portfolio + AI Swing Trader Signal

![ApexPulse](public/logo.svg)

ApexPulse is a production-ready crypto command center: Next.js 15 (App Router), Tailwind + shadcn/ui, Tremor 3.0 charts, TanStack Query v5, Prisma + Postgres, NextAuth v5, OpenAI primary with DeepSeek fallback, Resend daily briefs, and full Docker support from day one.

## Tech
- Next.js 15 (App Router) + TypeScript (strict)
- TailwindCSS + shadcn/ui + lucide-react + Tremor 3.0
- TanStack Query v5, React Hook Form + Zod, next-themes
- Prisma ORM + PostgreSQL, NextAuth v5 (Credentials + Google)
- Binance Spot API (REST + WebSocket ready hooks)
- OpenAI (primary) -> DeepSeek fallback, Resend + React Email
- Docker & docker-compose (multi-stage, small final image), optional Redis

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

Visit http://localhost:3100. Seed admin (if provided) is created via `prisma/seed.js`. After adding Binance API key/secret in **Settings**, the cron worker auto-syncs (default every 5m via `CRON_INTERVAL_SECONDS`), and you can also click **Sync Binance** on the dashboard holdings card for an immediate refresh.

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
- **Binance:** `BINANCE_API_KEY`, `BINANCE_API_SECRET` for live balances.
- **OpenAI (primary):** `OPENAI_API_KEY` -> model `gpt-4o-mini`.
- **DeepSeek (fallback):** `DEEPSEEK_API_KEY` -> model `deepseek-chat`.
- **Resend:** `RESEND_API_KEY`, `RESEND_FROM`. Daily brief uses React Email template.
- **Binance refresh:** `BINANCE_MIN_VALUE_USD` (default 0 to include all balances), `CRON_INTERVAL_SECONDS` (default 300s ~5m auto-sync).

## Cron / Automations
- A dedicated `cron` service in `docker-compose.yml` runs `npm run cron` (TSX + Prisma) to:
  - Pull latest market snapshot from Binance
  - Sync holdings (auto) from Binance before signals
- Generate five 24-72h swing signals (OpenAI -> DeepSeek -> deterministic fallback)
  - Persist signals to Postgres
  - Email the daily brief via Resend (if configured)
- Manual trigger: `POST /api/cron/daily` (authorized users only).

## Deploy Recipes
- **Coolify:** Add the repo, choose Dockerfile, set env (PORT=3100, DATABASE_URL, NEXTAUTH_*), expose 3100. Add a Postgres service or point to Supabase. Include the `cron` service as a sidecar.
- **Railway/Render:** Use Docker or Nixpacks; set PORT=3100. Provision Postgres add-on (or Supabase). Run `npx prisma migrate deploy` on release. Add a worker using the same image with command `npm run cron`.
- **Vercel:** `output: "standalone"` is enabled. For cron/email, keep the cron worker on a VPS/container.
- **VPS/Fly.io:** Build from Dockerfile; map inbound traffic to 3100. Mount a volume for Postgres or point to external DB.

## Project Structure
- `app/` -- App Router pages + API routes
- `components/` -- UI kit, themed controls, dashboard widgets
- `lib/` -- Prisma client, auth config, Binance client, AI + email utilities
- `scripts/cron.ts` -- Daily swing signal + Resend job (used by cron service)
- `prisma/` -- Schema + seed
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
- Multi-stage Dockerfile keeps the final image lean and production-ready.
- Tremor 3.0 is pre-wired for charts; next-themes for dark/light.
- Ports 3000/3300/5433/15432 are intentionally unused per request.
- Auto-sync: cron refreshes Binance holdings every `CRON_INTERVAL_SECONDS` without manual button presses; pricing has bulk + per-symbol fallbacks and stablecoin anchors at $1.

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
Prisma. External services (Binance, LLMs, Resend) are called by the API layer and the cron worker.

```mermaid
flowchart TD
    Browser[Next.js App<br/>TanStack Query + Tremor] --> API[/Next.js API Routes/]
    API --> Auth[NextAuth v5<br/>Prisma Adapter]
    API --> Holdings[Holdings/Signals/Settings APIs]
    API --> Binance[Binance REST + WebSocket]
    API --> AI[OpenAI -> DeepSeek]
    API --> Email[Resend + React Email]
    Holdings --> DB[(PostgreSQL via Prisma)]
    Auth --> DB
    Cron[Cron container<br/>tsx scripts/cron.ts] --> API
    Cron --> Binance
    Cron --> AI
    Cron --> Email
    Cron --> DB
```

### How the pieces connect
- **UI (Next.js App Router):** renders dashboard, charts, settings, and trade history.
- **API routes (Next.js):** expose `/api/*` endpoints for holdings, trades, prices, and signals.
- **Prisma ORM:** all read/write access to Postgres.
- **Cron worker:** runs scheduled sync + signal generation jobs.
- **External services:** Binance for balances/trades/prices, DeepSeek/OpenAI for signals, Resend for email.

This keeps deployment simple while still separating web requests from background jobs.

## Scaling Guide (when you grow)
- **Single-node:** One app container + Postgres + cron (Docker compose).
- **Split services:** Run the Next.js app and cron worker as separate services.
- **External DB:** Move Postgres to Supabase/managed Postgres for durability.
- **Caching:** Add Redis to reduce API calls and speed up dashboards.
- **Rate limits:** Add per-user rate limiting and task queues for sync jobs.

## Future Exchange Adapters (planned)
We plan to add a plug-in adapter framework so you can select your exchange and plug in API keys.
Next steps:
1. Create a shared `ExchangeAdapter` interface.
2. Refactor Binance to the adapter.
3. Add another exchange (Coinbase, Kraken, KuCoin, OKX, or Bybit).

## Pricing behavior
- Bulk prices from `/api/v3/ticker/24hr` for `COINUSDT`.
- Per-symbol fallback via `/api/v3/ticker/price?symbol=COINUSDT` if missing.
- Stablecoins (USDT/USDC/BUSD/FDUSD/TUSD) anchored to 1 when held.
- Threshold set by `BINANCE_MIN_VALUE_USD` (default 0 to keep all balances).

## Auto-sync cadence
- Controlled by `CRON_INTERVAL_SECONDS` (default 300s ~5m).
- Cron syncs Binance for each user before generating signals and emails.
