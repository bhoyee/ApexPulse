# Changelog

## 1.1.0
- Added Trading 212 auto-sync (positions + order history, read-only, currency-corrected).
- Added Nigeria Stock (NGX) tracking: one-time entry + auto-refreshing price via Mansa API or a free scraper fallback.
- Redesigned the dashboard: full-width, tabbed (Crypto / Trading 212 / Nigeria Stock / Other Stocks) instead of one long scroll.
- Fixed Dominance chart to show cost basis (was duplicating Price Glide's current-value data).
- Reworked AI signals to ground picks in real Binance market data with an 80%+ confidence gate.
- Added a PnL column to the Asset table; excluded stablecoins from Overall PnL.
- Made every Remove/Delete action a consistent danger-styled button.
- Fixed new positions/syncs not appearing without a manual page reload (missing cache invalidation).
- Docker: version-stamped builds, and a `COPY --chown` fix for much faster rebuilds.

## 1.0.0
- Initial release: Dockerized Next.js app with Prisma, NextAuth, Binance sync, cron auto-refresh.
- Docs added: architecture, operations, deploy, env, pricing, testing, API overview.

