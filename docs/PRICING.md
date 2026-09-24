# Pricing Logic

Every source converts to USD internally (`lib/fx.ts`, live rates via Yahoo FX tickers), so the
whole app -- portfolio value, PnL, the Invest column -- can assume USD regardless of which asset
class it's looking at. NGX values are converted back to Naira purely for display on that tab.

## Crypto (Binance)
- Primary: `/api/v3/ticker/24hr?symbols=[COINUSDT]` (bulk)
- Fallback: `/api/v3/ticker/price?symbol=COINUSDT` per missing symbol
- Stablecoins (USDT/USDC/BUSD/FDUSD/TUSD): anchored to price = 1 if held, excluded from Overall PnL
- Threshold: `minHoldingValueUsd` (per-user, Settings; default $5), applied to USD value

## US stocks
- Yahoo Finance's free chart endpoint (`query1.finance.yahoo.com/v8/finance/chart/{symbol}`), no key required

## Trading 212
- **Not live-polled.** Priced from the snapshot captured at your last "Sync Trading 212 now" click.
- Each position's price/quantity is reported in the *instrument's* native currency (e.g. GBP for an
  LSE listing) -- converted to USD once at sync time, using the real currency from Trading 212's own
  `/equity/metadata/instruments` endpoint (not guessed from the ticker).
- The converted "current price" is stored (`Holding.lastPriceUsd`) so ongoing display never has to
  re-fetch or re-guess a ticker's currency.

## Nigeria Stock (NGX)
- **Primary (optional):** Mansa API (`ApiSetting.mansaApiKey`) -- bulk NGX list in one request,
  cached 20 minutes (free tier is 100 req/day).
- **Fallback:** free scrape of `afx.kwayisi.org/ngx/`, cached 5 minutes. No official free NGX API
  exists (the real one costs $1k-2.5k/year).
- If a symbol isn't covered by either right now, it falls back to that holding's own cost basis
  (`avgBuyPrice`) rather than pricing at $0 -- this is why a position never just vanishes from the
  dashboard even when both sources are temporarily unreachable.

## If a symbol still shows $0
For crypto, it means Binance returned no USDT price for that asset. For a stock, it means neither
the live source nor the cost-basis fallback resolved -- check that the holding actually has an
`avgBuyPrice` set.
