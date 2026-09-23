const YAHOO_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// How many USD one unit of `currency` is worth, via Yahoo's free FX tickers
// (e.g. "GBPUSD=X", "NGNUSD=X"). Best-effort: on any failure this returns 1
// (treats the amount as already-USD) rather than throwing, so a currency
// hiccup never blocks a sync or holding save outright -- callers that care
// should log when a non-USD currency silently got rate 1.
export async function getUsdRate(currency: string): Promise<number> {
  const code = currency?.toUpperCase();
  if (!code || code === "USD") return 1;

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${code}USD=X`,
      { headers: { "User-Agent": YAHOO_UA } }
    );
    if (!res.ok) return 1;
    const data = await res.json();
    const rate = Number(data?.chart?.result?.[0]?.meta?.regularMarketPrice);
    return Number.isFinite(rate) && rate > 0 ? rate : 1;
  } catch {
    return 1;
  }
}
