import { getUsdRate } from "./fx";
import { getMansaNgxQuotes } from "./mansa";

export interface StockQuote {
  symbol: string;
  price: number;
  change24h: number;
  volume: number;
  high: number;
  low: number;
}

const YAHOO_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// Free, no-key public quote endpoint. Best-effort: a symbol that fails to
// resolve is simply left out of the result rather than throwing, so one bad
// ticker never breaks pricing for the rest of the portfolio.
export async function getUsStockQuotes(symbols: string[]): Promise<StockQuote[]> {
  const results = await Promise.all(
    symbols.map(async (symbol) => {
      try {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
          { headers: { "User-Agent": YAHOO_UA }, signal: AbortSignal.timeout(8000) }
        );
        if (!res.ok) return null;
        const data = await res.json();
        const meta = data?.chart?.result?.[0]?.meta;
        const price = Number(meta?.regularMarketPrice);
        if (!meta || !Number.isFinite(price) || price <= 0) return null;
        return {
          symbol: symbol.toUpperCase(),
          price,
          change24h: Number(meta.regularMarketChangePercent ?? 0),
          volume: Number(meta.regularMarketVolume ?? 0),
          high: Number(meta.regularMarketDayHigh ?? price),
          low: Number(meta.regularMarketDayLow ?? price)
        } satisfies StockQuote;
      } catch {
        return null;
      }
    })
  );

  return results.filter((r): r is StockQuote => r !== null);
}

const NGX_ROW =
  /<tr><td><a[^>]*>([A-Z0-9]+)<\/a><td><a[^>]*>[^<]*<\/a><td>([\d,]+)<td>([\d,.]+)<td(?:\s+class=\w+)?>([+-][\d,.]+)/g;

async function fetchNgxPage(url: string): Promise<{ rows: Map<string, StockQuote>; next: string | null }> {
  const rows = new Map<string, StockQuote>();
  const res = await fetch(url, {
    headers: { "User-Agent": YAHOO_UA },
    signal: AbortSignal.timeout(8000)
  });
  if (!res.ok) return { rows, next: null };
  const html = await res.text();

  for (const match of Array.from(html.matchAll(NGX_ROW))) {
    const [, ticker, volumeRaw, priceRaw, changeRaw] = match;
    const price = Number(priceRaw.replace(/,/g, ""));
    const change = Number(changeRaw.replace(/,/g, ""));
    if (!Number.isFinite(price) || price <= 0) continue;
    const previousClose = price - change;
    rows.set(ticker, {
      symbol: ticker,
      price,
      change24h: previousClose ? (change / previousClose) * 100 : 0,
      volume: Number(volumeRaw.replace(/,/g, "")) || 0,
      high: price,
      low: price
    });
  }

  const nextMatch = html.match(/<link rel=next href="([^"]+)">/);
  return { rows, next: nextMatch ? nextMatch[1] : null };
}

// The dashboard polls its price endpoint every 15s -- re-scraping a free,
// community-run site that often would be a bad neighbor and risks getting
// this server's IP rate-limited or blocked outright. Fetch the whole table
// (both pages) at most once per NGX_CACHE_TTL_MS and serve every request
// from that cache in between; stock prices don't need 15s freshness the
// way crypto does.
const NGX_CACHE_TTL_MS = 5 * 60 * 1000;
let ngxTableCache: { fetchedAt: number; rows: Map<string, StockQuote> } | null = null;
let ngxFetchInFlight: Promise<Map<string, StockQuote>> | null = null;

async function fetchFullNgxTable(): Promise<Map<string, StockQuote>> {
  const all = new Map<string, StockQuote>();
  let url: string | null = "https://afx.kwayisi.org/ngx/";
  let pagesLeft = 5; // safety cap against an infinite/broken pagination chain
  while (url && pagesLeft > 0) {
    const { rows, next } = await fetchNgxPage(url);
    rows.forEach((quote, ticker) => all.set(ticker, quote));
    url = next;
    pagesLeft -= 1;
  }
  return all;
}

async function getNgxTable(): Promise<Map<string, StockQuote>> {
  const now = Date.now();
  if (ngxTableCache && now - ngxTableCache.fetchedAt < NGX_CACHE_TTL_MS) {
    return ngxTableCache.rows;
  }
  // Coalesce concurrent callers into a single in-flight fetch rather than
  // each kicking off their own scrape while the cache is cold/expiring.
  if (!ngxFetchInFlight) {
    ngxFetchInFlight = fetchFullNgxTable()
      .then((rows) => {
        if (rows.size) {
          ngxTableCache = { fetchedAt: Date.now(), rows };
          return rows;
        }
        // A graceful "no data" response (page unreachable/blocked, returns
        // an empty map rather than throwing) would otherwise overwrite a
        // still-recent cache with nothing -- serve the stale table instead,
        // and still bump fetchedAt so retries stay rate-limited during an outage.
        if (ngxTableCache) {
          ngxTableCache = { ...ngxTableCache, fetchedAt: Date.now() };
          return ngxTableCache.rows;
        }
        return rows;
      })
      .catch(() => ngxTableCache?.rows ?? new Map())
      .finally(() => {
        ngxFetchInFlight = null;
      });
  }
  return ngxFetchInFlight;
}

// Scrapes a free, community-run NGX price table (no official free API exists --
// NGX's own data license runs $1k-2.5k/year). Best-effort by design: if the
// page structure changes or the site is down/unreachable, this returns an
// empty/partial result rather than throwing -- callers fall back to the
// holding's last-known/avg-buy price rather than showing nothing.
//
// The scraped prices are in Naira. Every other price source in this app
// (Binance, Yahoo, Trading212's converted snapshot) returns USD, and every
// caller (portfolio value, PnL, the Invest column) assumes USD -- so this
// converts here, once, rather than leaking raw NGN into USD-denominated
// math. The NGX dashboard tab then converts back to NGN purely for display.
export async function getNgxStockQuotes(symbols: string[]): Promise<StockQuote[]> {
  const wanted = new Set(symbols.map((s) => s.toUpperCase()));
  let table: Map<string, StockQuote>;
  try {
    table = await getNgxTable();
  } catch {
    return [];
  }

  const found = Array.from(table.entries())
    .filter(([ticker]) => wanted.has(ticker))
    .map(([, quote]) => quote);
  if (!found.length) return [];

  const usdPerNgn = await getUsdRate("NGN"); // USD value of 1 NGN
  return found.map((q) => ({
    ...q,
    price: q.price * usdPerNgn,
    high: q.high * usdPerNgn,
    low: q.low * usdPerNgn
  }));
}

export async function getStockQuotes(
  symbols: string[],
  market: string,
  opts?: { mansaApiKey?: string }
): Promise<StockQuote[]> {
  if (!symbols.length) return [];
  if (market !== "NGX") return getUsStockQuotes(symbols);

  if (!opts?.mansaApiKey) return getNgxStockQuotes(symbols);

  // Mansa (structured, documented API) is primary when a key is configured;
  // the free scraper fills in anything Mansa's response didn't cover
  // (unrecognized field shape, ticker not in their universe, rate-limited).
  const mansaResults = await getMansaNgxQuotes(symbols, opts.mansaApiKey);
  const covered = new Set(mansaResults.map((q) => q.symbol));
  const missing = symbols.filter((s) => !covered.has(s.toUpperCase()));
  if (!missing.length) return mansaResults;

  const scraped = await getNgxStockQuotes(missing);
  return [...mansaResults, ...scraped];
}
