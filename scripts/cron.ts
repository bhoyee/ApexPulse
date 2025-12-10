import "dotenv/config";
import {
  PrismaClient,
  SyncJobStatus,
  SyncJobType,
  TransactionType
} from "@prisma/client";
import { generateSwingSignals } from "../lib/ai";
import { sendDailyEmail } from "../lib/email";
import {
  getMarketTickers,
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
        where: { userId: user.id, asset: sym }
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
  if (!symbols.length) return;

  const trades = await getBinanceTrades(
    symbols,
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
  const markets = await getMarketTickers(["BTC", "ETH", "SOL", "AVAX", "LINK", "OP", "TIA"]);

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

    const holdingsValue = refreshedHoldings.map((h) => {
      const price = markets.find((m) => m.symbol === h.asset)?.price ?? 0;
      return {
        asset: h.asset,
        amount: Number(h.amount),
        value: Number(h.amount) * price
      };
    });

    const signals = await generateSwingSignals(markets, {
      openaiKey: user.apiSetting?.openaiApiKey,
      deepseekKey: user.apiSetting?.deepseekApiKey
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
    const fromAddr = user.apiSetting?.resendFrom || process.env.RESEND_FROM;
    if (recipient && process.env.RESEND_API_KEY && process.env.RESEND_FROM) {
      try {
        await sendDailyEmail({
          to: recipient,
          from: fromAddr,
          userName: user.name ?? undefined,
          signals,
          holdings: holdingsValue
        });
        await prisma.emailLog.create({
          data: {
            userId: user.id,
            subject: "ApexPulse | AI Swing Signals",
            status: "sent"
          }
        });
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

// Kick off: wait until next 13:00 UTC, but also run once at start so you have data now.
loop();
