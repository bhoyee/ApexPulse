import { prisma } from "./prisma";
import { getTopUsdtMarkets, getTopLoserMarkets, getMarketsForSymbols, type MarketCandidate } from "./binance";

export type SignalPool = "momentum" | "reversal" | "recent_listing";

export interface TaggedMarketCandidate extends MarketCandidate {
  pool: SignalPool;
}

const RECENT_LISTING_WINDOW_DAYS = 30;

// Three distinct swing-signal candidate pools, each a different thesis:
// - momentum: already trending up, screened by liquidity (the original,
//   only pool before this).
// - reversal: dropped hard but shows real stabilization evidence (see
//   getTopLoserMarkets), not just "near the low."
// - recent_listing: listed on Binance in the last 30 days -- young enough
//   to still have outsized volatility, but past the New Listing Radar's
//   go-live alert window, so nothing else was watching these for a swing
//   setup. Reuses the ListingAlert table the Radar already maintains.
// A coin qualifying for more than one pool is tagged with whichever it
// hits first (momentum, then reversal, then recent_listing) -- it only
// needs one thesis, not all three.
export async function getSwingPools(
  holdingSymbols: string[] = [],
  limit = 20
): Promise<TaggedMarketCandidate[]> {
  const cutoff = new Date(Date.now() - RECENT_LISTING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const [momentum, reversal, recentListings] = await Promise.all([
    getTopUsdtMarkets(limit),
    getTopLoserMarkets(limit),
    prisma.listingAlert.findMany({ where: { goLiveAt: { gte: cutoff } }, select: { symbol: true } })
  ]);

  const recentSymbols = Array.from(new Set(recentListings.map((r) => r.symbol)));
  const recentMarkets = recentSymbols.length ? await getMarketsForSymbols(recentSymbols) : [];

  const tagged: TaggedMarketCandidate[] = [];
  const seen = new Set<string>();
  const add = (list: MarketCandidate[], pool: SignalPool) => {
    for (const m of list) {
      if (seen.has(m.symbol)) continue;
      seen.add(m.symbol);
      tagged.push({ ...m, pool });
    }
  };
  add(momentum, "momentum");
  add(reversal, "reversal");
  add(recentMarkets, "recent_listing");

  // An existing position should never be invisible to the AI just because
  // today was quiet for it -- tagged by its own direction (not a fixed
  // default) so the prompt applies the right checklist to it.
  if (holdingSymbols.length) {
    const held = await getMarketsForSymbols(holdingSymbols);
    for (const m of held) {
      if (seen.has(m.symbol)) continue;
      seen.add(m.symbol);
      tagged.push({ ...m, pool: m.change24h >= 0 ? "momentum" : "reversal" });
    }
  }

  return tagged;
}
