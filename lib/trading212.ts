const T212_BASE = "https://live.trading212.com/api/v0";

// Trading212's official public API (docs.trading212.com/api). Auth is HTTP
// Basic with the API key as the username and the API secret as the password
// -- a bare `Authorization: <key>` header is rejected with 401. This client
// is READ-ONLY: it must never issue a mutating (POST/PUT/PATCH/DELETE) request.
export interface Trading212Position {
  ticker: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  ppl: number;
}

function authHeader(apiKey: string, apiSecret: string) {
  return `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;
}

export async function getTrading212Positions(
  apiKey: string,
  apiSecret: string
): Promise<Trading212Position[]> {
  const res = await fetch(`${T212_BASE}/equity/portfolio`, {
    method: "GET",
    headers: { Authorization: authHeader(apiKey, apiSecret) }
  });

  if (!res.ok) {
    throw new Error(`Trading212 API error ${res.status}`);
  }

  return (await res.json()) as Trading212Position[];
}

export interface Trading212Instrument {
  ticker: string;
  currencyCode: string;
}

// Every position's price/quantity is reported in the INSTRUMENT's native
// currency (e.g. GBP for an LSE listing), never a fixed account currency --
// this is the only endpoint that tells us what that currency actually is.
// Trading212 rate-limits this endpoint much more tightly than the portfolio
// one, so callers must fetch it at most once per sync run.
export async function getTrading212Instruments(
  apiKey: string,
  apiSecret: string
): Promise<Trading212Instrument[]> {
  const res = await fetch(`${T212_BASE}/equity/metadata/instruments`, {
    method: "GET",
    headers: { Authorization: authHeader(apiKey, apiSecret) }
  });

  if (!res.ok) {
    throw new Error(`Trading212 API error ${res.status}`);
  }

  const data = (await res.json()) as Array<{ ticker: string; currencyCode: string }>;
  return data.map((d) => ({ ticker: d.ticker, currencyCode: d.currencyCode }));
}

export interface Trading212Fill {
  ticker: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  filledAt: string;
  fillId: number;
}

interface HistoryOrderItem {
  order: { ticker: string; status: string };
  fill?: { id: number; price: number; quantity: number; filledAt: string } | null;
}

// Auto-paginates Trading212's filled-order history via `nextPagePath`,
// capped at a small number of pages as a safety net against a broken cursor
// chain. Only FILLED orders with a `fill` are returned.
export async function getTrading212FilledOrders(
  apiKey: string,
  apiSecret: string,
  maxPages = 10
): Promise<Trading212Fill[]> {
  const fills: Trading212Fill[] = [];
  let path: string | null = "/equity/history/orders?limit=50";
  let pagesLeft = maxPages;

  while (path && pagesLeft > 0) {
    const res = await fetch(`${T212_BASE}${path.replace(/^\/api\/v0/, "")}`, {
      method: "GET",
      headers: { Authorization: authHeader(apiKey, apiSecret) }
    });
    if (!res.ok) break;

    const page = (await res.json()) as { items: HistoryOrderItem[]; nextPagePath: string | null };
    page.items.forEach((item) => {
      if (item.order.status !== "FILLED" || !item.fill) return;
      fills.push({
        ticker: item.order.ticker,
        side: item.fill.quantity >= 0 ? "BUY" : "SELL",
        quantity: Math.abs(item.fill.quantity),
        price: item.fill.price,
        filledAt: item.fill.filledAt,
        fillId: item.fill.id
      });
    });

    path = page.nextPagePath;
    pagesLeft -= 1;
  }

  return fills;
}

// Trading212 encodes tickers as "<SYMBOL>_<COUNTRY>_EQ" (e.g. "AAPL_US_EQ"),
// except LSE listings which drop the country code and use a trailing
// lowercase "l" instead (e.g. "VODl_EQ" -> "VOD.L").
const US_TICKER = /_[A-Z]+_EQ$/;
const LSE_TICKER = /l_EQ$/;

export function parseTrading212Ticker(ticker: string): { symbol: string; market: string } {
  if (LSE_TICKER.test(ticker)) {
    return { symbol: `${ticker.slice(0, -"l_EQ".length)}.L`, market: "LSE" };
  }
  if (US_TICKER.test(ticker)) {
    return { symbol: ticker.replace(US_TICKER, ""), market: "US" };
  }
  return { symbol: ticker.replace(/_EQ$/, ""), market: "OTHER" };
}
