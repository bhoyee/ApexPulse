import { getMarketTickers } from "./binance";
import { getStockQuotes } from "./stocks";

export interface HoldingRef {
  asset: string;
  assetClass?: string | null;
  market?: string | null;
}

// Every dashboard component keys prices by symbol via a flat {symbol, price,
// change24h, volume, high, low}[] list -- this fans a mixed crypto+stock
// holdings set out to the right source per asset and merges the results back
// into that same shape, so no component needs to know an asset is a stock.
export async function getPricesForHoldings(holdings: HoldingRef[], extraCryptoSymbols: string[] = []) {
  const cryptoSymbols = new Set(extraCryptoSymbols.map((s) => s.toUpperCase()));
  const stocksByMarket = new Map<string, Set<string>>();

  holdings.forEach((h) => {
    const symbol = h.asset.toUpperCase();
    if (h.assetClass === "STOCK") {
      const market = (h.market || "US").toUpperCase();
      if (!stocksByMarket.has(market)) stocksByMarket.set(market, new Set());
      stocksByMarket.get(market)!.add(symbol);
    } else {
      cryptoSymbols.add(symbol);
    }
  });

  const [cryptoMarkets, ...stockMarkets] = await Promise.all([
    getMarketTickers(Array.from(cryptoSymbols)),
    ...Array.from(stocksByMarket.entries()).map(([market, symbols]) =>
      getStockQuotes(Array.from(symbols), market)
    )
  ]);

  return [...cryptoMarkets, ...stockMarkets.flat()];
}
