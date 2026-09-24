import { getUsdRate } from "./fx";

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
          { headers: { "User-Agent": YAHOO_UA } }
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
  const res = await fetch(url, { headers: { "User-Agent": YAHOO_UA } });
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

// Scrapes a free, community-run NGX price table (no official free API exists --
// NGX's own data license runs $1k-2.5k/year). Best-effort by design: if the
// page structure changes or the site is down, this returns an empty/partial
// result rather than throwing, and callers should fall back to the holding's
// last-known/avg-buy price rather than fail outright.
//
// The scraped prices are in Naira. Every other price source in this app
// (Binance, Yahoo, Trading212's converted snapshot) returns USD, and every
// caller (portfolio value, PnL, the Invest column) assumes USD -- so this
// converts here, once, rather than leaking raw NGN into USD-denominated
// math. The NGX dashboard tab then converts back to NGN purely for display.
export async function getNgxStockQuotes(symbols: string[]): Promise<StockQuote[]> {
  const wanted = new Set(symbols.map((s) => s.toUpperCase()));
  const found = new Map<string, StockQuote>();

  try {
    let url: string | null = "https://afx.kwayisi.org/ngx/";
    let pagesLeft = 5; // safety cap against an infinite/broken pagination chain
    while (url && pagesLeft > 0 && found.size < wanted.size) {
      const { rows, next } = await fetchNgxPage(url);
      rows.forEach((quote, ticker) => {
        if (wanted.has(ticker)) found.set(ticker, quote);
      });
      url = next;
      pagesLeft -= 1;
    }
  } catch {
    // best-effort: return whatever was found before the failure
  }

  if (!found.size) return [];

  const usdPerNgn = await getUsdRate("NGN"); // USD value of 1 NGN
  return Array.from(found.values()).map((q) => ({
    ...q,
    price: q.price * usdPerNgn,
    high: q.high * usdPerNgn,
    low: q.low * usdPerNgn
  }));
}

export async function getStockQuotes(symbols: string[], market: string): Promise<StockQuote[]> {
  if (!symbols.length) return [];
  return market === "NGX" ? getNgxStockQuotes(symbols) : getUsStockQuotes(symbols);
}
