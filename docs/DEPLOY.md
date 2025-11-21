# Deployment Notes

## Docker/VPS
- Copy `.env.example` -> `.env`
- Set required envs (NEXTAUTH_SECRET, DATABASE_URL, Binance keys, etc.)
- `docker compose up --build -d`
- Use `CRON_INTERVAL_SECONDS` to tune auto-sync frequency.

## Coolify
- Import repo, select Dockerfile, set env vars (PORT=3100, DATABASE_URL, NEXTAUTH_*).
- Add Postgres service or supply external DB.
- Include cron as sidecar service (same image, command `npm run cron`).

## Railway / Render
- Deploy via Docker/Nixpacks, set PORT=3100.
- Provision Postgres or point to Supabase.
- Add a worker using same image with command `npm run cron`.
- Run `prisma migrate deploy` on release.

## Vercel
- `output: "standalone"` enabled; app can run but cron/email need a separate worker/VPS.

## Supabase
- Swap `DATABASE_URL` to Supabase connection string.
- Run `npx prisma migrate deploy` against Supabase.

