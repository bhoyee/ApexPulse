import crypto from "crypto";
import WebSocket from "ws";

const BINANCE_API = "https://api.binance.com";

function signParams(query: string, secret?: string) {
  if (!secret) return "";
  return crypto.createHmac("sha256", secret).update(query).digest("hex");
}

export async function getBinanceBalances(
  overrideKey?: string,
  overrideSecret?: string
) {
  const apiKey = overrideKey || process.env.BINANCE_API_KEY;
  const apiSecret = overrideSecret || process.env.BINANCE_API_SECRET;
  if (!apiKey || !apiSecret) {
    return [];
  }

  const timestamp = Date.now();
  const query = `timestamp=${timestamp}`;
  const signature = signParams(query, apiSecret);
  const url = `${BINANCE_API}/api/v3/account?${query}&signature=${signature}`;

  const res = await fetch(url, {
    headers: { "X-MBX-APIKEY": apiKey },
    signal: AbortSignal.timeout(10000)
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Failed to fetch Binance balances: ${res.status} ${res.statusText} -- ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    balances: { asset: string; free: string; locked: string }[];
  };

  return data.balances
    .map((b) => ({
      asset: b.asset.toUpperCase(),
      amount: parseFloat(b.free) + parseFloat(b.locked)
    }))
    .filter((b) => b.amount > 0);
}

export async function getMarketTickers(symbols: string[]) {
  if (!symbols.length) return [];

  const uniqueSymbols = Array.from(
    new Set(symbols.map((sym) => sym.toUpperCase()))
  );

  const chunks: string[][] = [];
  for (let i = 0; i < uniqueSymbols.length; i += 50) {
    chunks.push(uniqueSymbols.slice(i, i + 50));
  }

  const tickerMap = new Map<
    string,
    {
      symbol: string;
      price: number;
      change24h: number;
      volume: number;
      high: number;
      low: number;
    }
  >();

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      const query = chunk.map((s) => `"${s}USDT"`).join(",");
      const url = `${BINANCE_API}/api/v3/ticker/24hr?symbols=[${query}]`;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) {
          return [];
        }
        const json = (await res.json()) as Array<{
          symbol: string;
          lastPrice: string;
          priceChangePercent: string;
          highPrice: string;
          lowPrice: string;
          volume: string;
        }>;
        return json.map((item) => ({
          symbol: item.symbol.replace("USDT", "").toUpperCase(),
          price: Number(item.lastPrice),
          change24h: Number(item.priceChangePercent),
          volume: Number(item.volume),
          high: Number(item.highPrice),
          low: Number(item.lowPrice)
        }));
      } catch {
        // Binance unreachable/slow: this chunk contributes nothing rather
        // than throwing and taking down the whole dashboard render with it.
        return [];
      }
    })
  );

  results.flat().forEach((item) => {
    if (!Number.isFinite(item.price) || item.price <= 0) return;
    tickerMap.set(item.symbol.toUpperCase(), item);
  });

  const missingSymbols = uniqueSymbols.filter(
    (sym) => !tickerMap.has(sym.toUpperCase())
  );

  const quotePrefs = ["USDT", "BUSD", "FDUSD", "USDC"];

  await Promise.all(
    missingSymbols.map(async (sym) => {
      for (const quote of quotePrefs) {
        try {
          const url = `${BINANCE_API}/api/v3/ticker/price?symbol=${sym}${quote}`;
          const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
          if (!res.ok) continue;
          const data = (await res.json()) as { price?: string };
          const price = Number(data.price);
          if (!price || Number.isNaN(price)) continue;
          tickerMap.set(sym.toUpperCase(), {
            symbol: sym.toUpperCase(),
            price,
            change24h: 0,
            volume: 0,
            high: price,
            low: price
          });
          break;
        } catch {
          // continue trying other quotes
        }
      }
    })
  );

  // Ensure stablecoins always have a price of 1
  ["USDT", "USDC", "BUSD", "FDUSD", "TUSD"].forEach((stable) => {
    if (uniqueSymbols.includes(stable) && !tickerMap.has(stable)) {
      tickerMap.set(stable, {
        symbol: stable,
        price: 1,
        change24h: 0,
        volume: 0,
        high: 1,
        low: 1
      });
    }
  });

  const stillMissing = uniqueSymbols.filter(
    (sym) => !tickerMap.has(sym.toUpperCase())
  );
  if (stillMissing.length) {
    const cg = await getCoingeckoPrices(stillMissing);
    cg.forEach((item) => tickerMap.set(item.symbol.toUpperCase(), item));
  }

  // Final safety: ask Binance avgPrice for any remaining symbols
  const finalMissing = uniqueSymbols.filter((sym) => !tickerMap.has(sym.toUpperCase()));
  await Promise.all(
    finalMissing.map(async (sym) => {
      try {
        const res = await fetch(`${BINANCE_API}/api/v3/avgPrice?symbol=${sym}USDT`, {
          signal: AbortSignal.timeout(6000)
        });
        if (!res.ok) return;
        const data = (await res.json()) as { price?: string };
        const price = Number(data.price);
        if (!price || Number.isNaN(price)) return;
        tickerMap.set(sym.toUpperCase(), {
          symbol: sym.toUpperCase(),
          price,
          change24h: 0,
          volume: 0,
          high: price,
          low: price
        });
      } catch {
        // ignore
      }
    })
  );

  return Array.from(tickerMap.values());
}

const LEVERAGED_TOKEN_SUFFIXES = ["UP", "DOWN", "BULL", "BEAR"];
const STABLE_OR_FIAT_BASES = new Set([
  "USDT", "USDC", "BUSD", "FDUSD", "TUSD", "DAI", "USDP",
  "EUR", "GBP", "TRY", "BRL", "ARS", "UAH", "ZAR"
]);

export interface MarketCandidate {
  symbol: string;
  price: number;
  change24h: number;
  volume: number;
  quoteVolume: number;
  high: number;
  low: number;
}

// Pulls Binance's full spot ticker list and narrows it to real, liquid,
// currently-tradable USDT pairs -- excludes stablecoins/fiat pairs and
// leveraged tokens (3x/UP/DOWN products) so every entry is a real,
// backed-by-live-data candidate rather than the model guessing at obscure
// tickers from memory. Shared by every candidate pool (momentum, reversal,
// recently-listed) so each only differs in how it filters/sorts this list.
async function fetchLiquidUsdtTickers(): Promise<MarketCandidate[]> {
  let res: Response;
  try {
    res = await fetch(`${BINANCE_API}/api/v3/ticker/24hr`, { signal: AbortSignal.timeout(10000) });
  } catch {
    return [];
  }
  if (!res.ok) return [];

  const all = (await res.json()) as Array<{
    symbol: string;
    lastPrice: string;
    priceChangePercent: string;
    highPrice: string;
    lowPrice: string;
    volume: string;
    quoteVolume: string;
  }>;

  return all
    .filter((t) => t.symbol.endsWith("USDT"))
    .map((t) => ({ ...t, base: t.symbol.slice(0, -4) }))
    .filter(
      ({ base }) =>
        !STABLE_OR_FIAT_BASES.has(base) &&
        !LEVERAGED_TOKEN_SUFFIXES.some((suffix) => base.endsWith(suffix))
    )
    .map(
      (t): MarketCandidate => ({
        symbol: t.base,
        price: Number(t.lastPrice),
        change24h: Number(t.priceChangePercent),
        volume: Number(t.volume),
        quoteVolume: Number(t.quoteVolume),
        high: Number(t.highPrice),
        low: Number(t.lowPrice)
      })
    )
    .filter((t) => Number.isFinite(t.price) && t.price > 0 && t.quoteVolume > 0);
}

// A single day's % change can't tell "just turned up, still early" apart
// from "day 5 of a pump, probably exhausted" -- both can show the exact
// same 24h number. Ranking candidates by "biggest gainer today" alone is
// structurally biased toward picks that have already run, which is
// chasing, not catching a trend early. This pulls a short daily-close
// history (free, same Binance API, no extra key) to tell those apart: how
// many consecutive days has the price been moving the same direction.
async function getDailyCloses(symbol: string, days = 12): Promise<number[]> {
  try {
    const res = await fetch(
      `${BINANCE_API}/api/v3/klines?symbol=${symbol}USDT&interval=1d&limit=${days}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const raw = (await res.json()) as unknown[][];
    return raw.map((k) => Number(k[4])); // close price is index 4
  } catch {
    return [];
  }
}

interface Freshness {
  consecutiveDays: number;
  /** The current move only started in the last 1-2 days -- not yet a
   * multi-day run, so there's still room before it's exhausted. */
  isFreshMove: boolean;
}

function classifyFreshness(closes: number[], direction: "up" | "down"): Freshness {
  if (closes.length < 3) return { consecutiveDays: 0, isFreshMove: true };
  let streak = 0;
  for (let i = closes.length - 1; i > 0; i--) {
    const moved = direction === "up" ? closes[i] > closes[i - 1] : closes[i] < closes[i - 1];
    if (!moved) break;
    streak++;
  }
  return { consecutiveDays: streak, isFreshMove: streak <= 2 };
}

// Momentum pool: coins that just turned up, not ones that have already run
// for several days. Shortlisted by liquidity+direction first (to bound how
// many klines calls this makes), then only the freshest moves survive --
// sorted so the newest turns (fewest consecutive up-days) rank first.
export async function getTopUsdtMarkets(limit = 30): Promise<MarketCandidate[]> {
  const liquid = await fetchLiquidUsdtTickers();
  const shortlist = liquid
    .filter((t) => t.change24h > 0)
    .sort((a, b) => b.quoteVolume - a.quoteVolume)
    .slice(0, 60);

  const withFreshness = await Promise.all(
    shortlist.map(async (c) => ({
      ...c,
      freshness: classifyFreshness(await getDailyCloses(c.symbol), "up")
    }))
  );

  return withFreshness
    .filter((c) => c.freshness.isFreshMove)
    .sort(
      (a, b) => a.freshness.consecutiveDays - b.freshness.consecutiveDays || b.quoteVolume - a.quoteVolume
    )
    .slice(0, limit)
    .map(({ freshness, ...c }) => c);
}

// Reversal pool: biggest 24h decliners that already show a real bounce off
// the low (price > 1.5% above the 24h low -- "near the low" alone just
// means "still falling"), AND where that bounce itself is still fresh (not
// already a multi-day recovery run) -- otherwise this has the exact same
// chasing problem momentum does, just one step later in the cycle.
export async function getTopLoserMarkets(limit = 30): Promise<MarketCandidate[]> {
  const liquid = await fetchLiquidUsdtTickers();
  const shortlist = liquid
    .filter((t) => t.change24h < 0 && t.low > 0 && t.price > t.low * 1.015)
    .sort((a, b) => a.change24h - b.change24h)
    .slice(0, 60);

  const withFreshness = await Promise.all(
    shortlist.map(async (c) => ({
      ...c,
      freshness: classifyFreshness(await getDailyCloses(c.symbol), "up")
    }))
  );

  return withFreshness
    .filter((c) => c.freshness.isFreshMove)
    .sort((a, b) => a.freshness.consecutiveDays - b.freshness.consecutiveDays || a.change24h - b.change24h)
    .slice(0, limit)
    .map(({ freshness, ...c }) => c);
}

// Pulls current stats for a specific set of symbols rather than ranking the
// whole market -- used for pools defined by membership (recently-listed,
// or a user's existing holdings) instead of by a volume/change24h cutoff.
export async function getMarketsForSymbols(symbols: string[]): Promise<MarketCandidate[]> {
  if (!symbols.length) return [];
  const wanted = new Set(symbols.map((s) => s.toUpperCase()));
  const liquid = await fetchLiquidUsdtTickers();
  return liquid.filter((t) => wanted.has(t.symbol));
}

const COINGECKO_IDS: Record<string, string> = {
  VET: "vechain",
  HBAR: "hedera-hashgraph",
  PEPE: "pepe",
  SUI: "sui",
  AVNT: "avant",
  BTC: "bitcoin",
  ETH: "ethereum"
};

async function getCoingeckoPrices(symbols: string[]) {
  const ids = symbols
    .map((s) => COINGECKO_IDS[s.toUpperCase()])
    .filter(Boolean)
    .join(",");
  if (!ids) return [];
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(6000) });
  } catch {
    return [];
  }
  if (!res.ok) return [];
  const data = (await res.json()) as Record<string, { usd: number }>;
  return Object.entries(data).map(([id, val]) => {
    const symbol = Object.entries(COINGECKO_IDS).find(
      ([, v]) => v === id
    )?.[0];
    return symbol
      ? {
          symbol,
          price: Number(val.usd),
          change24h: 0,
          volume: 0,
          high: Number(val.usd),
          low: Number(val.usd)
        }
      : null;
  }).filter(Boolean) as any[];
}
export async function getBinanceTrades(
  symbols: string[],
  apiKey?: string,
  apiSecret?: string,
  startTimes?: Record<string, number>
) {
  const key = apiKey || process.env.BINANCE_API_KEY;
  const secret = apiSecret || process.env.BINANCE_API_SECRET;
  if (!key || !secret) return [];

  // Align with server time to avoid timestamp drift issues
  let serverTime = Date.now();
  try {
    const t = await fetch(`${BINANCE_API}/api/v3/time`, { signal: AbortSignal.timeout(5000) });
    if (t.ok) {
      const json = (await t.json()) as { serverTime?: number };
      if (json.serverTime) serverTime = json.serverTime;
    }
  } catch {
    // ignore, fallback to local time
  }

  const results: Array<{
    id: string;
    symbol: string;
    qty: number;
    price: number;
    commission?: number;
    isBuyer: boolean;
    time: number;
  }> = [];

  for (const sym of symbols) {
    const pair = `${sym.toUpperCase()}USDT`;
    const timestamp = serverTime;
    const start = startTimes?.[sym.toUpperCase()];
    const queryParts = [
      `symbol=${pair}`,
      `limit=1000`,
      `recvWindow=50000`,
      `timestamp=${timestamp}`
    ];
    if (start) queryParts.push(`startTime=${start}`);
    const query = queryParts.join("&");
    const signature = signParams(query, secret);
    const url = `${BINANCE_API}/api/v3/myTrades?${query}&signature=${signature}`;

    try {
      const res = await fetch(url, {
        headers: { "X-MBX-APIKEY": key },
        signal: AbortSignal.timeout(10000)
      });
      if (!res.ok) {
        console.error("Trade fetch failed", pair, res.status, res.statusText);
        continue;
      }
      const json = (await res.json()) as Array<{
        id: number;
        qty: string;
        price: string;
        commission: string;
        isBuyer: boolean;
        time: number;
      }>;
      json.forEach((trade) => {
        results.push({
          id: `${pair}-${trade.id}`,
          symbol: sym.toUpperCase(),
          qty: Number(trade.qty),
          price: Number(trade.price),
          commission: trade.commission ? Number(trade.commission) : undefined,
          isBuyer: trade.isBuyer,
          time: trade.time
        });
      });
    } catch {
      // ignore errors per symbol
    }
  }

  return results;
}

export function streamMiniTickers(
  onData: (ticker: { symbol: string; price: number; change: number }) => void
) {
  const socket = new WebSocket("wss://stream.binance.com:9443/ws/!miniTicker@arr");
  socket.on("message", (data) => {
    try {
      const payload = JSON.parse(data.toString()) as Array<{
        s: string;
        c: string;
        P: string;
      }>;
      payload.forEach((item) =>
        onData({
          symbol: item.s.replace("USDT", ""),
          price: Number(item.c),
          change: Number(item.P)
        })
      );
    } catch (error) {
      console.error("Ticker stream parse error", error);
    }
  });

  return () => socket.close();
}
