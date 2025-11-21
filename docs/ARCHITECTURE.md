# ApexPulse Architecture

```mermaid
flowchart TD
    Browser[Next.js App<br/>TanStack Query + Tremor] --> API[Next.js API Routes]
    API --> Auth[NextAuth v5 + Prisma]
    API --> Holdings[Holdings/Signals/Settings]
    API --> Binance[Binance REST + WebSocket]
    API --> AI[Grok -> OpenAI fallback]
    API --> Email[Resend + React Email]
    Holdings --> DB[(PostgreSQL via Prisma)]
    Auth --> DB
    Cron[Cron container<br/>tsx scripts/cron.ts] --> API
    Cron --> Binance
    Cron --> AI
    Cron --> Email
    Cron --> DB
```

- **Auto-sync**: cron calls Binance for each user, refreshes holdings, then computes AI signals.
- **Pricing**: bulk + per-symbol fallbacks for USDT pairs; stablecoins forced to 1.0.
- **Identity**: NextAuth v5 (Credentials + Google) backed by Prisma.
- **UI**: Next.js App Router + Tailwind + shadcn + Tremor.
```
