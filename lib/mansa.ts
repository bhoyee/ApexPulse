import { getUsdRate } from "./fx";
import type { StockQuote } from "./stocks";

const MANSA_BASE = "https://mansaapi.com/api/v1";

// Free tier is 100 requests/day; Mansa's own backend refreshes every ~30min,
// so polling more often than that buys nothing. This TTL keeps worst-case
// usage around 72 req/day (one bulk call every 20min, 24/7), independent of
// how many NGX tickers are actually held.
const CACHE_TTL_MS = 20 * 60 * 1000;

interface MansaCache {
  fetchedAt: number;
  apiKey: string;
  rows: Map<string, StockQuote>;
}

let cache: MansaCache | null = null;
let inFlight: { apiKey: string; promise: Promise<Map<string, StockQuote>> } | null = null;

// Docs (mansaapi.com/docs) confirm the endpoint and auth but don't spell out
// the bulk list's exact field names -- parsed defensively across the couple
// of plausible variants so a naming mismatch degrades to "no data" (falls
// back to the free scraper) rather than throwing.
async function fetchMansaNgxTable(apiKey: string): Promise<Map<string, StockQuote>> {
  const rows = new Map<string, StockQuote>();
  const res = await fetch(`${MANSA_BASE}/markets/exchanges/NGX/stocks?limit=200`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) return rows;

  const data = await res.json();
  const list: any[] = Array.isArray(data) ? data : data?.data ?? data?.results ?? data?.stocks ?? [];

  const usdPerNgn = await getUsdRate("NGN");
  for (const item of list) {
    const ticker = String(item.ticker ?? item.symbol ?? "").toUpperCase();
    const priceNgn = Number(item.price ?? item.last_price ?? item.close ?? item.last);
    if (!ticker || !Number.isFinite(priceNgn) || priceNgn <= 0) continue;
    const price = priceNgn * usdPerNgn;
    rows.set(ticker, {
      symbol: ticker,
      price,
      change24h: Number(item.change_pct ?? item.change_percent ?? item.changePercent ?? 0),
      volume: Number(item.volume ?? 0),
      high: Number(item.high ?? item.day_high ?? priceNgn) * usdPerNgn,
      low: Number(item.low ?? item.day_low ?? priceNgn) * usdPerNgn
    });
  }
  return rows;
}

async function getTable(apiKey: string): Promise<Map<string, StockQuote>> {
  const now = Date.now();
  if (cache && cache.apiKey === apiKey && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rows;
  }
  if (!inFlight || inFlight.apiKey !== apiKey) {
    inFlight = {
      apiKey,
      promise: fetchMansaNgxTable(apiKey)
        .then((rows) => {
          if (rows.size) cache = { fetchedAt: Date.now(), apiKey, rows };
          return rows;
        })
        .catch(() => cache?.rows ?? new Map())
        .finally(() => {
          inFlight = null;
        })
    };
  }
  return inFlight.promise;
}

// Returns USD-denominated quotes (converted from Mansa's native NGN, same
// as every other price source in this app). Best-effort: any failure
// (bad key, rate limit, network) resolves to an empty array rather than
// throwing, so callers can fall back to the free scraper.
export async function getMansaNgxQuotes(symbols: string[], apiKey: string): Promise<StockQuote[]> {
  if (!apiKey || !symbols.length) return [];
  try {
    const table = await getTable(apiKey);
    const wanted = new Set(symbols.map((s) => s.toUpperCase()));
    return Array.from(table.entries())
      .filter(([ticker]) => wanted.has(ticker))
      .map(([, quote]) => quote);
  } catch {
    return [];
  }
}
