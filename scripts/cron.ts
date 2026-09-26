import "dotenv/config";
import {
  PrismaClient,
  SyncJobStatus,
  SyncJobType,
  TransactionType
} from "@prisma/client";
import { generateSwingSignals, generateListingSignal, MIN_LISTING_CONFIDENCE } from "../lib/ai";
import { sendDailyEmail, sendListingAlertEmail } from "../lib/email";
import { getNewUsdtListings } from "../lib/binance-listings";
import {
  getMarketTickers,
  getSwingCandidateMarkets,
  getBinanceBalances,
  getBinanceTrades
} from "../lib/binance";

const prisma = new PrismaClient();
const MIN_VALUE_USD =
  Number(process.env.BINANCE_MIN_VALUE_USD ?? "0") || 0;
const STABLES = new Set(["USDT", "USDC", "BUSD", "FDUSD", "TUSD"]);

async function syncHoldingsForUser(user: any) {
  const settings = user.apiSetting;
  if (!settings?.binanceApiKey || !settings?.binanceApiSecret) return;

  const balances = await getBinanceBalances(
    settings.binanceApiKey,
    settings.binanceApiSecret
  );
  if (!balances.length) return;

  const nonStableSymbols = balances
    .map((b) => b.asset.toUpperCase())
    .filter((sym) => !STABLES.has(sym));
  const tickers = await getMarketTickers(nonStableSymbols);
  const priceMap = tickers.reduce<Record<string, number>>((acc, t) => {
    acc[t.symbol.toUpperCase()] = t.price;
    return acc;
  }, {});

  const filtered = balances.filter((b) => {
    const sym = b.asset.toUpperCase();
    const price = STABLES.has(sym) ? 1 : priceMap[sym] ?? 0;
    if (!price || Number.isNaN(price)) return false;
    return price * b.amount >= MIN_VALUE_USD;
  });

  await Promise.all(
    filtered.map(async (balance) => {
      const sym = balance.asset.toUpperCase();
      const existing = await prisma.holding.findFirst({
        where: { userId: user.id, asset: sym, source: "binance" }
      });
      const avgBuyPrice = existing ? existing.avgBuyPrice : 0;
      if (existing) {
        await prisma.holding.update({
          where: { id: existing.id },
          data: {
            amount: balance.amount
          }
        });
      } else {
        await prisma.holding.create({
          data: {
            userId: user.id,
            asset: sym,
            amount: balance.amount,
            avgBuyPrice
          }
        });
      }
    })
  );
}

async function syncTradesForUser(user: any, symbols: string[]) {
  const settings = user.apiSetting;
  if (!settings?.binanceApiKey || !settings?.binanceApiSecret) return;
  const tradable = symbols.filter((s) => !STABLES.has(s));
  if (!tradable.length) return;

  const trades = await getBinanceTrades(
    tradable,
    settings.binanceApiKey,
    settings.binanceApiSecret
  );
  if (!trades.length) return;

  await Promise.all(
    trades
      .filter((t) => t.isBuyer) // only keep buys
      .map((t) =>
        prisma.transaction.upsert({
          where: { externalId: t.id },
          update: {},
          create: {
            userId: user.id,
            holdingId: null,
            type: TransactionType.BUY,
            symbol: t.symbol.toUpperCase(),
            quantity: t.qty,
            price: t.price,
            fee: t.commission,
            executedAt: new Date(t.time),
            source: "binance",
            externalId: t.id
          }
        })
      )
  );
}

async function runDaily() {
  const users = await prisma.user.findMany({
    include: {
      apiSetting: true,
      holdings: true
    }
  });

  for (const user of users) {
    // Refresh holdings from Binance before generating signals
    await syncHoldingsForUser(user);

    const refreshedHoldings = await prisma.holding.findMany({
      where: { userId: user.id }
    });
    const symbols = Array.from(new Set(refreshedHoldings.map((h) => h.asset)));

    // Sync trades per symbol (USDT pairs)
    await syncTradesForUser(user, symbols);

    const markets = await getSwingCandidateMarkets(symbols);

    const holdingsValue = refreshedHoldings.map((h) => {
      const price = markets.find((m) => m.symbol === h.asset)?.price ?? 0;
      return {
        asset: h.asset,
        amount: Number(h.amount),
        value: Number(h.amount) * price
      };
    });

    const signals = await generateSwingSignals(markets, {
      openaiKey: user.apiSetting?.openaiApiKey ?? undefined,
      deepseekKey: user.apiSetting?.deepseekApiKey ?? undefined
    });

    // keep only latest batch per user
    await prisma.signal.deleteMany({ where: { userId: user.id } });
    await prisma.signal.createMany({
      data: signals.map((s) => ({
        userId: user.id,
        symbol: s.symbol,
        summary: s.thesis,
        confidence: s.confidence,
        entryPrice: s.entryPrice ?? null,
        source: s.source.toUpperCase() as any,
        stopLoss: s.stopLoss,
        takeProfit: s.takeProfit
      }))
    });

    const recipient = user.apiSetting?.dailyEmailTo || user.email;
    // Per-user Settings values take priority over the server-wide env vars
    // -- a user's own Resend key (entered in Settings) was previously
    // ignored entirely in favor of an env var that was never set, which is
    // why no daily email had ever gone out despite Settings looking configured.
    const apiKey = user.apiSetting?.resendApiKey || process.env.RESEND_API_KEY;
    const fromAddr = user.apiSetting?.resendFrom || process.env.RESEND_FROM;
    if (recipient) {
      try {
        const result = await sendDailyEmail({
          to: recipient,
          from: fromAddr ?? undefined,
          apiKey,
          userName: user.name ?? undefined,
          signals,
          holdings: holdingsValue
        });
        if ("skipped" in result && result.skipped) {
          await prisma.emailLog.create({
            data: {
              userId: user.id,
              subject: "ApexPulse | AI Swing Signals",
              status: "skipped",
              error: result.reason
            }
          });
        } else {
          await prisma.emailLog.create({
            data: {
              userId: user.id,
              subject: "ApexPulse | AI Swing Signals",
              status: "sent"
            }
          });
        }
      } catch (error: any) {
        await prisma.emailLog.create({
          data: {
            userId: user.id,
            subject: "ApexPulse | AI Swing Signals",
            status: "failed",
            error: error?.message ?? "unknown"
          }
        });
      }
    }

    await prisma.syncJob.upsert({
      where: { userId_type: { userId: user.id, type: SyncJobType.DAILY_SIGNALS } },
      update: {
        status: SyncJobStatus.SUCCESS,
        lastRun: new Date(),
        lastMessage: "Daily signals + email processed"
      },
      create: {
        userId: user.id,
        type: SyncJobType.DAILY_SIGNALS,
        status: SyncJobStatus.SUCCESS,
        lastRun: new Date(),
        lastMessage: "Daily signals + email processed"
      }
    });
  }
}

async function estimateCryptoPortfolioUsd(user: any): Promise<number> {
  const cryptoHoldings = (user.holdings ?? []).filter((h: any) => h.assetClass !== "STOCK");
  if (!cryptoHoldings.length) return 0;
  const symbols = Array.from(new Set(cryptoHoldings.map((h: any) => h.asset.toUpperCase())));
  const tickers = await getMarketTickers(symbols as string[]);
  const priceMap = tickers.reduce<Record<string, number>>((acc, t) => {
    acc[t.symbol.toUpperCase()] = t.price;
    return acc;
  }, {});
  return cryptoHoldings.reduce(
    (sum: number, h: any) => sum + Number(h.amount) * (priceMap[h.asset.toUpperCase()] ?? 0),
    0
  );
}

// Binance's own "new listing" announcements, checked far more often than the
// daily signal cycle since the whole point is advance notice before trading
// opens -- a 12-24h-later daily email would be useless for this.
async function checkNewListings() {
  let listings: Awaited<ReturnType<typeof getNewUsdtListings>>;
  try {
    listings = await getNewUsdtListings();
  } catch (error) {
    console.error("Listing check failed", error);
    return;
  }
  if (!listings.length) return;

  const existing = await prisma.listingAlert.findMany({
    where: { articleId: { in: listings.map((l) => l.articleId) } },
    select: { articleId: true }
  });
  const seenIds = new Set(existing.map((e) => e.articleId));
  const fresh = listings.filter((l) => !seenIds.has(l.articleId));
  if (!fresh.length) return;

  const now = Date.now();
  const users = await prisma.user.findMany({
    where: { apiSetting: { listingAlertsEnabled: true } },
    include: { apiSetting: true, holdings: true }
  });

  for (const listing of fresh) {
    // Recorded immediately, before any email logic, so a crash mid-loop or
    // a retry on the next poll never re-alerts on the same announcement.
    await prisma.listingAlert.create({
      data: {
        articleId: listing.articleId,
        symbol: listing.symbol,
        pair: listing.pair,
        title: listing.title,
        goLiveAt: listing.goLiveAt
      }
    });

    // This poller's first run (or a restart) can surface announcements from
    // days ago; those are recorded above so they're never reprocessed, but
    // skipped here since "trading opened 2 days ago" isn't the advance
    // countdown this feature promises.
    if (!listing.goLiveAt || listing.goLiveAt.getTime() <= now) continue;

    for (const user of users) {
      const recipient = user.apiSetting?.dailyEmailTo || user.email;
      if (!recipient) continue;

      let signal = null;
      try {
        signal = await generateListingSignal(listing, {
          openaiKey: user.apiSetting?.openaiApiKey ?? undefined,
          deepseekKey: user.apiSetting?.deepseekApiKey ?? undefined
        });
      } catch (error) {
        console.error("Listing signal generation failed", error);
      }

      // Sized off the user's own crypto book (this trades on Binance, same
      // account) and clamped to a conservative range regardless of
      // confidence or portfolio size -- a brand-new listing with zero price
      // history never warrants a large position.
      let suggestedBuyUsd: number | null = null;
      if (signal && signal.confidence >= MIN_LISTING_CONFIDENCE) {
        const portfolioUsd = await estimateCryptoPortfolioUsd(user);
        const raw = portfolioUsd * (signal.confidence / 100) * 0.02;
        suggestedBuyUsd = Math.min(200, Math.max(10, raw));
      }

      const apiKey = user.apiSetting?.resendApiKey || process.env.RESEND_API_KEY;
      const fromAddr = user.apiSetting?.resendFrom || process.env.RESEND_FROM;
      const subject = `ApexPulse | New Listing: ${listing.pair}`;
      try {
        const result = await sendListingAlertEmail({
          to: recipient,
          from: fromAddr ?? undefined,
          apiKey,
          userName: user.name ?? undefined,
          listing,
          signal,
          suggestedBuyUsd
        });
        await prisma.emailLog.create({
          data: {
            userId: user.id,
            subject,
            status: "skipped" in result && result.skipped ? "skipped" : "sent",
            error: "skipped" in result ? result.reason : undefined
          }
        });
      } catch (error: any) {
        await prisma.emailLog.create({
          data: { userId: user.id, subject, status: "failed", error: error?.message ?? "unknown" }
        });
      }
    }
  }
}

function msUntilNext13UTC() {
  const now = new Date();
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 13, 0, 0, 0));
  if (target.getTime() <= now.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target.getTime() - now.getTime();
}

async function loop() {
  try {
    await runDaily();
  } catch (error) {
    console.error("Cron failure", error);
  }
  setTimeout(loop, msUntilNext13UTC());
}

const LISTING_CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 min: frequent enough for advance notice, gentle on Binance's public CMS

async function listingLoop() {
  try {
    await checkNewListings();
  } catch (error) {
    console.error("Listing check loop failure", error);
  }
  setTimeout(listingLoop, LISTING_CHECK_INTERVAL_MS);
}

// Kick off: wait until next 13:00 UTC, but also run once at start so you have data now.
loop();
// Independent, much faster poll for new-listing alerts -- event-triggered, not on the daily schedule.
listingLoop();
