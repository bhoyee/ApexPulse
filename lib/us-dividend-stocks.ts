import { YAHOO_UA } from "./stocks";

// A fixed, hand-picked universe of liquid, historically dividend-paying US
// stocks across sectors (banks, telecom, consumer staples, utilities,
// REITs) -- there's no free, keyless "list every dividend stock" API, so
// this plays the same role COINGECKO_IDS plays for crypto elsewhere in this
// app: a known-good starting set rather than an unbounded/unverifiable one.
export const DIVIDEND_CANDIDATE_SYMBOLS = [
  "JNJ", "PG", "KO", "PEP", "VZ", "T", "XOM", "CVX", "ABBV", "PFE",
  "MRK", "MO", "PM", "IBM", "CSCO", "MMM", "GIS", "KMB", "CLX", "SO",
  "DUK", "O", "VICI", "MAIN", "WBA", "C", "WFC", "BAC", "USB", "SCHW",
  "GILD", "BMY", "VTR", "KHC", "HRL", "K", "CAG", "SYY", "PAYX", "ADM"
];

export interface DividendCandidate {
  symbol: string;
  price: number;
  fiftyTwoWeekHigh: number;
  fiftyTwoWeekLow: number;
  /** Trailing-12-month dividend yield, as a % of current price -- computed
   * from real historical dividend payments, not a published "yield" field
   * (Yahoo's fundamentals endpoints that expose that directly now require
   * an authenticated session; this is the free, keyless substitute). */
  trailingDividendYieldPct: number;
}

// Free, no-key endpoint (same one getUsStockQuotes uses) -- `events=div`
// additionally returns each historical dividend payment, which a plain
// quote lookup doesn't include. Summing the last 365 days of payments and
// dividing by current price gives a real trailing yield without needing
// any fundamentals/key-gated API.
async function fetchDividendCandidate(symbol: string): Promise<DividendCandidate | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2y&events=div`,
      { headers: { "User-Agent": YAHOO_UA }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;
    const price = Number(meta?.regularMarketPrice);
    if (!meta || !Number.isFinite(price) || price <= 0) return null;

    const dividends: Record<string, { amount: number; date: number }> = result?.events?.dividends ?? {};
    const oneYearAgo = Date.now() / 1000 - 365 * 24 * 60 * 60;
    const trailingDividends = Object.values(dividends)
      .filter((d) => d.date >= oneYearAgo)
      .reduce((sum, d) => sum + Number(d.amount ?? 0), 0);

    return {
      symbol: symbol.toUpperCase(),
      price,
      fiftyTwoWeekHigh: Number(meta.fiftyTwoWeekHigh ?? price),
      fiftyTwoWeekLow: Number(meta.fiftyTwoWeekLow ?? price),
      trailingDividendYieldPct: (trailingDividends / price) * 100
    };
  } catch {
    return null;
  }
}

// Only real dividend payers make it through -- a candidate with zero
// trailing dividends isn't what "good dividend" means, so it's dropped
// here rather than left for the AI to notice.
export async function getDividendCandidates(maxPricePerShare?: number): Promise<DividendCandidate[]> {
  const results = await Promise.all(DIVIDEND_CANDIDATE_SYMBOLS.map(fetchDividendCandidate));
  return results
    .filter((r): r is DividendCandidate => r !== null)
    .filter((r) => r.trailingDividendYieldPct > 0)
    .filter((r) => !maxPricePerShare || r.price <= maxPricePerShare);
}
