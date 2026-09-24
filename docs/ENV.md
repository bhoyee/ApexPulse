# Environment Reference

Required:
- `NEXTAUTH_SECRET`
- `DATABASE_URL`

Recommended (global, shared across all users):
- `OPENAI_API_KEY` (primary AI signals), `DEEPSEEK_API_KEY` (fallback)
- `RESEND_API_KEY`, `RESEND_FROM`

Operational:
- `BINANCE_MIN_VALUE_USD` (threshold; default 0)
- `CRON_INTERVAL_SECONDS` (cron cadence; default 300)
- `PORT` (default 3100)
- `REDIS_URL` (optional)

Billing (optional): Stripe keys/prices/URLs.

**Not env vars -- entered per-user in Settings, stored in the database:**
`BINANCE_API_KEY`/`BINANCE_API_SECRET`, Trading 212 API key + secret, Mansa API key. These are
per-user credentials (each self-hosted instance can have multiple accounts), so they live in
`ApiSetting`, not `.env`.

