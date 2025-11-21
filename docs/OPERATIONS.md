# Operations Runbook

## Services
- app: Next.js server on 3100
- cron: tsx scripts/cron.ts, auto syncs Binance + signals every `CRON_INTERVAL_SECONDS` (default 300s)
- postgres: 5442->5432
- redis: 6380->6379

## Common commands (Docker)
- start: `docker compose up -d`
- rebuild: `docker compose up --build --force-recreate`
- logs app: `docker compose logs -f apexpulse`
- logs cron: `docker compose logs -f cron`
- seed: `docker compose exec apexpulse node prisma/seed.js`
- prisma studio (host): `set DATABASE_URL=postgresql://apexpulse:apexpulse@localhost:5442/apexpulse && npx prisma studio --hostname 127.0.0.1 --port 5557`

## Sync cadence
- Auto: cron container uses `CRON_INTERVAL_SECONDS`
- Manual refresh: click **Sync Binance** in the dashboard.

## Env knobs
- `BINANCE_MIN_VALUE_USD` (0 keeps all balances)
- `CRON_INTERVAL_SECONDS` (seconds, e.g., 300 for ~5m)

## Health
- Holdings present? Check `Holding` table via Studio.
- Prices present? `/api/prices` should show symbols with price > 0 (stables = 1).

