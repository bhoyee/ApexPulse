# Environment Reference

Required:
- `NEXTAUTH_SECRET`
- `DATABASE_URL`
- `BINANCE_API_KEY`, `BINANCE_API_SECRET`

Recommended:
- `GROK_API_KEY` (primary AI), `OPENAI_API_KEY` (fallback)
- `RESEND_API_KEY`, `RESEND_FROM`

Operational:
- `BINANCE_MIN_VALUE_USD` (threshold; default 0)
- `CRON_INTERVAL_SECONDS` (cron cadence; default 300)
- `PORT` (default 3100)
- `REDIS_URL` (optional)

Billing (optional): Stripe keys/prices/URLs.

