# ApexPulse 1.0 (v1.0.0)

ApexPulse 1.0 is the first stable, self-hosted release of the crypto portfolio + AI swing trader.

## Highlights
- Docker-ready stack with Next.js + Prisma + Postgres and cron worker
- Live portfolio dashboard with charts and responsive tables
- Buy-only trade history with PDF export
- Binance holdings/trades sync
- DeepSeek primary + OpenAI fallback for swing signals
- Daily email delivery via Resend
- In-app documentation and architecture diagram
- Full README with architecture, scaling notes, and ERD

## Notes
- Use Settings to configure API keys (Binance, DeepSeek/OpenAI, Resend).
- Signals refresh on demand or cron schedule.
- Cron worker handles background sync + daily emails.
