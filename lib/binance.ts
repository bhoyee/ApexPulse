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
    headers: { "X-MBX-APIKEY": apiKey }
  });

  if (!res.ok) throw new Error("Failed to fetch Binance balances");

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
      const res = await fetch(url);
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
          const res = await fetch(url);
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
        const res = await fetch(`${BINANCE_API}/api/v3/avgPrice?symbol=${sym}USDT`);
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
  const res = await fetch(url);
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
    const timestamp = Date.now();
    const start = startTimes?.[sym.toUpperCase()];
    const queryParts = [`symbol=${pair}`, `limit=1000`, `timestamp=${timestamp}`];
    if (start) queryParts.push(`startTime=${start}`);
    const query = queryParts.join("&");
    const signature = signParams(query, secret);
    const url = `${BINANCE_API}/api/v3/myTrades?${query}&signature=${signature}`;

    try {
      const res = await fetch(url, {
        headers: { "X-MBX-APIKEY": key }
      });
      if (!res.ok) continue;
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
