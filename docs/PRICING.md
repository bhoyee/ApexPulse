# Pricing Logic

- Primary: `/api/v3/ticker/24hr?symbols=[COINUSDT]` (bulk)
- Fallback: `/api/v3/ticker/price?symbol=COINUSDT` per missing symbol
- Stablecoins: USDT/USDC/BUSD/FDUSD/TUSD anchored to price = 1 if present in holdings
- Threshold: `BINANCE_MIN_VALUE_USD` (default 0) applied to USD value; set to 0 to keep all balances.

If a symbol still shows $0, it means Binance returned no USDT price for that asset.
