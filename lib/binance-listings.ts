const CMS_BASE = "https://www.binance.com/bapi/composite/v1/public/cms/article";

export interface ListingAnnouncement {
  articleId: string;
  title: string;
  symbol: string;
  pair: string;
  /** When trading actually opens, if we could parse it from the announcement body. */
  goLiveAt: Date | null;
  url: string;
}

interface RawArticle {
  id: number;
  code: string;
  title: string;
}

// Binance's own announcements feed, catalogId 48 = "New Cryptocurrency
// Listing". No auth, no key -- this is the exchange's own public CMS, the
// same one www.binance.com/en/support/announcement renders from. Undocumented
// but stable in practice; best-effort by design like every other price/data
// source in this app -- a failure here returns [] rather than throwing.
async function fetchAnnouncementList(): Promise<RawArticle[]> {
  const res = await fetch(
    `${CMS_BASE}/catalog/list/query?catalogId=48&pageNo=1&pageSize=20`,
    { signal: AbortSignal.timeout(10000) }
  );
  if (!res.ok) {
    console.warn(`[binance-listings] catalog fetch failed: ${res.status} ${res.statusText}`);
    return [];
  }
  const data = await res.json();
  return data?.data?.articles ?? [];
}

// "Binance Will List X (SYMBOL)..." is a genuine new spot listing (including
// ones with a Seed Tag -- that's a risk classification, not a trading
// restriction, so it's still tradable immediately). "Binance Will Add X on
// Earn/Convert/Margin/VIP Loan" means X is already listed elsewhere and is
// only gaining a new product, not a new trading pair -- explicitly excluded.
function isNewListingTitle(title: string) {
  return /^Binance Will List\b/i.test(title) && !/\bWill Add\b/i.test(title);
}

function extractSymbol(title: string): string | null {
  const match = title.match(/\(([A-Z0-9]{2,15})\)/);
  return match ? match[1].toUpperCase() : null;
}

// Best-effort parse of Binance's usual "YYYY-MM-DD HH:MM (UTC)" go-live
// format out of the announcement body. If the wording doesn't match, this
// returns null and the caller skips the announcement rather than emailing a
// guess -- an alert with no go-live time isn't the advance countdown promised.
function extractGoLiveAt(text: string): Date | null {
  const match = text.match(/(\d{4}-\d{2}-\d{2})[^0-9]{1,10}(\d{1,2}:\d{2})\s*\(?UTC\)?/i);
  if (!match) return null;
  const [, date, time] = match;
  const parsed = new Date(`${date}T${time}:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function fetchArticleBody(articleCode: string): Promise<string> {
  const res = await fetch(
    `${CMS_BASE}/detail/query?articleCode=${encodeURIComponent(articleCode)}`,
    { signal: AbortSignal.timeout(10000) }
  );
  if (!res.ok) return "";
  const data = await res.json();
  const html: string = data?.data?.body ?? "";
  return html.replace(/<[^>]+>/g, " "); // strip tags for plain-text regex matching
}

// Returns only USDT-quoted new listings we could confidently parse a go-live
// time for -- symbols/pairs not in the announcement text, or announcements
// whose go-live time we couldn't parse, are silently dropped rather than
// guessed at.
export async function getNewUsdtListings(): Promise<ListingAnnouncement[]> {
  let articles: RawArticle[];
  try {
    articles = await fetchAnnouncementList();
  } catch (err) {
    console.warn(`[binance-listings] catalog fetch threw: ${err instanceof Error ? err.message : String(err)}`);
    return [];
  }

  const candidates = articles.filter((a) => isNewListingTitle(a.title));
  const results: ListingAnnouncement[] = [];

  for (const article of candidates) {
    const symbol = extractSymbol(article.title);
    if (!symbol) continue;

    let body = "";
    try {
      body = await fetchArticleBody(article.code);
    } catch (err) {
      console.warn(`[binance-listings] detail fetch threw for ${article.code}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    if (!body) continue;

    const pair = `${symbol}USDT`;
    const hasUsdtPair = new RegExp(`${symbol}\\s*/?\\s*USDT`, "i").test(body);
    if (!hasUsdtPair) continue; // no USDT pair mentioned -- not what we want

    const goLiveAt = extractGoLiveAt(body);
    if (!goLiveAt) continue; // can't give a countdown without this

    results.push({
      articleId: article.code,
      title: article.title,
      symbol,
      pair,
      goLiveAt,
      url: `https://www.binance.com/en/support/announcement/${article.code}`
    });
  }

  return results;
}
