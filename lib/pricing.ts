import { getMarketTickers } from "./binance";
import { getStockQuotes } from "./stocks";

export interface HoldingRef {
  asset: string;
  assetClass?: string | null;
  market?: string | null;
  source?: string | null;
  lastPriceUsd?: number | null;
}

// Every dashboard component keys prices by symbol via a flat {symbol, price,
// change24h, volume, high, low}[] list -- this fans a mixed crypto+stock
// holdings set out to the right source per asset and merges the results back
// into that same shape, so no component needs to know an asset is a stock.
export async function getPricesForHoldings(holdings: HoldingRef[], extraCryptoSymbols: string[] = []) {
  const cryptoSymbols = new Set(extraCryptoSymbols.map((s) => s.toUpperCase()));
  const stocksByMarket = new Map<string, Set<string>>();
  // Trading212 positions are reported in their own instrument currency
  // (e.g. GBP for LSE), already converted to USD once at sync time
  // (lastPriceUsd). Re-fetching them from a generic USD-assuming quote
  // source like Yahoo would silently mix currencies, so they're priced
  // directly from that stored snapshot instead of an external lookup.
  const trading212Quotes: { symbol: string; price: number; change24h: number; volume: number; high: number; low: number }[] = [];

  holdings.forEach((h) => {
    const symbol = h.asset.toUpperCase();
    if (h.assetClass !== "STOCK") {
      cryptoSymbols.add(symbol);
      return;
    }
    if (h.source === "trading212") {
      const price = h.lastPriceUsd ?? 0;
      trading212Quotes.push({ symbol, price, change24h: 0, volume: 0, high: price, low: price });
      return;
    }
    const market = (h.market || "US").toUpperCase();
    if (!stocksByMarket.has(market)) stocksByMarket.set(market, new Set());
    stocksByMarket.get(market)!.add(symbol);
  });

  const [cryptoMarkets, ...stockMarkets] = await Promise.all([
    getMarketTickers(Array.from(cryptoSymbols)),
    ...Array.from(stocksByMarket.entries()).map(([market, symbols]) =>
      getStockQuotes(Array.from(symbols), market)
    )
  ]);

  return [...cryptoMarkets, ...trading212Quotes, ...stockMarkets.flat()];
}
