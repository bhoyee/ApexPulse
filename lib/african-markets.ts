import { getUsdRate } from "./fx";
import type { StockQuote } from "./stocks";

// Free, no-key, open-source NGX/GSE data project (github.com/abkd1211/african-markets-api),
// hosted on Render's free tier by an independent maintainer -- a different
// backend/maintainer than Mansa, so it doesn't share Mansa's outages. No
// SLA though (Render's free tier can cold-start slowly after idling), so
// this is a fallback layer, not a replacement for Mansa as primary.
const BASE_URL = "https://african-markets-api-muuy.onrender.com";

// Render's free tier can take 20-30s to wake up from a cold start; a short
// timeout here would make this fallback look "down" when it's just asleep.
const FETCH_TIMEOUT_MS = 25000;

// This is a fallback-of-a-fallback, only hit when both Mansa and the
// scraper missed a symbol -- polling it every 15s like the dashboard would
// be unnecessary load on someone's free hobby project.
const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: { fetchedAt: number; rows: Map<string, StockQuote> } | null = null;
let inFlight: Promise<Map<string, StockQuote>> | null = null;

async function fetchNgxLiveTable(): Promise<Map<string, StockQuote>> {
  const rows = new Map<string, StockQuote>();
  const res = await fetch(`${BASE_URL}/api/v1/markets/ngx/live`, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  });
  if (!res.ok) {
    console.warn(`[african-markets] NGX fetch failed: ${res.status} ${res.statusText}`);
    return rows;
  }

  const data = await res.json();
  const tickers: any[] = Array.isArray(data?.tickers) ? data.tickers : [];
  for (const item of tickers) {
    const ticker = String(item.symbol ?? "").toUpperCase();
    const price = Number(item.price);
    if (!ticker || !Number.isFinite(price) || price <= 0) continue;
    const change = Number(item.change ?? 0);
    rows.set(ticker, {
      symbol: ticker,
      price,
      change24h: Number(item.change_pct ?? 0),
      volume: Number(item.volume ?? 0),
      high: price + Math.max(change, 0),
      low: price - Math.max(-change, 0)
    });
  }
  return rows;
}

async function getTable(): Promise<Map<string, StockQuote>> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rows;
  }
  if (!inFlight) {
    inFlight = fetchNgxLiveTable()
      .then((rows) => {
        if (rows.size) {
          cache = { fetchedAt: Date.now(), rows };
          return rows;
        }
        // Graceful "no data" (non-ok status) -- prefer a still-recent cache
        // over wiping it out with nothing.
        if (cache) {
          cache = { ...cache, fetchedAt: Date.now() };
          return cache.rows;
        }
        return rows;
      })
      .catch((err) => {
        console.warn(`[african-markets] NGX fetch threw: ${err instanceof Error ? err.message : String(err)}`);
        return cache?.rows ?? new Map();
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

// Prices come back in NGN (same as Mansa and the scraper); converted to USD
// here so every price source in this app returns the same currency.
export async function getAfricanMarketsNgxQuotes(symbols: string[]): Promise<StockQuote[]> {
  if (!symbols.length) return [];
  const wanted = new Set(symbols.map((s) => s.toUpperCase()));
  let table: Map<string, StockQuote>;
  try {
    table = await getTable();
  } catch {
    return [];
  }

  const found = Array.from(table.entries())
    .filter(([ticker]) => wanted.has(ticker))
    .map(([, quote]) => quote);
  if (!found.length) return [];

  const usdPerNgn = await getUsdRate("NGN");
  return found.map((q) => ({
    ...q,
    price: q.price * usdPerNgn,
    high: q.high * usdPerNgn,
    low: q.low * usdPerNgn
  }));
}
