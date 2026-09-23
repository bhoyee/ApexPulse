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

export async function getTrading212Positions(
  apiKey: string,
  apiSecret: string
): Promise<Trading212Position[]> {
  const basicAuth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const res = await fetch(`${T212_BASE}/equity/portfolio`, {
    method: "GET",
    headers: { Authorization: `Basic ${basicAuth}` }
  });

  if (!res.ok) {
    throw new Error(`Trading212 API error ${res.status}`);
  }

  return (await res.json()) as Trading212Position[];
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
