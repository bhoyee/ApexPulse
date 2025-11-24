# Cron Worker

- Entry: `scripts/cron.ts`
- Runs in dedicated container (`cron` service)
- Interval: `CRON_INTERVAL_SECONDS` (default 300s)
- Steps per cycle:
  1. Sync Binance holdings for each user (uses stored API keys)
  2. Fetch market snapshot
  3. Generate AI swing signals (OpenAI -> DeepSeek fallback)
  4. Store signals; send Resend email if configured

Manual run:
- `docker compose exec cron npm run cron`

