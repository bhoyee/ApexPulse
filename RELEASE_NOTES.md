# ApexPulse 1.1 (v1.1.0)

ApexPulse 1.1 turns the app from crypto-only into a multi-asset dashboard: Trading 212 (auto-synced)
and Nigeria Stock Exchange positions (Bamboo/CSCS, tracked with live NGX pricing) join Binance, each
in its own tab. AI signals are grounded in real market data instead of fabricated tickers.

## Highlights
- **Trading 212 auto-sync:** real positions and order history via their official read-only API, with
  currency correctly converted (each instrument's native currency, e.g. GBP for LSE, to USD).
- **Nigeria Stock (NGX) tracking:** one-time position entry (symbol, quantity, avg cost), then
  automatic price refresh via a free Mansa API key (recommended) or a built-in scraper fallback --
  displayed in Naira, calculated in USD internally.
- **Dashboard redesign:** full-width layout, tabbed instead of one long scroll (Crypto default, then
  Trading 212, then Nigeria Stock), with per-section stat cards, charts, and holdings tables.
- **Price Glide vs Dominance:** the two charts now show genuinely different things -- current value
  vs cost basis -- instead of the same numbers rendered two ways.
- **AI signals overhaul:** grounded in real, liquid Binance market data with a due-diligence prompt
  (trend, liquidity, upside room, risk/reward) and a hard 80%+ confidence gate enforced server-side.
- **PnL column** on the Asset table (green/red), stablecoins excluded from Overall PnL, and every
  Remove/Delete action is now a consistent danger-styled button.
- **Docker:** version-stamped builds (`GIT_COMMIT`/`BUILD_DATE` shown in-app), and a `COPY --chown`
  fix that cut rebuild time dramatically versus the old `RUN chown -R` pass.
- Every price source degrades gracefully: a stock holding with no live quote right now falls back
  to its own cost basis rather than vanishing from the dashboard.

## Notes
- Add Trading 212 and/or Mansa keys in Settings to enable those integrations; both are optional and
  the app works crypto-only without them, same as before.
- New positions (any tab) and sync actions now reflect instantly -- no manual page reload needed.

---

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
