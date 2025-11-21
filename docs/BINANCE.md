# Binance Sync Troubleshooting

- Ensure keys have Spot trading permission and are unrestricted or host IP whitelisted.
- Move balances from Funding/Earn into Spot to be visible to `/api/v3/account`.
- Threshold controlled by `BINANCE_MIN_VALUE_USD` (set 0 to include dust).
- If price unavailable, ensure a USDT spot pair exists; fallbacks query per-symbol.
- Manual refresh: use **Sync Binance** button or `docker compose exec cron npm run cron`.

