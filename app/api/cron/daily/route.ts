import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { generateSwingSignals } from "../../../../lib/ai";
import { getSwingCandidateMarkets } from "../../../../lib/binance";
import { sendDailyEmail, type HoldingGroup } from "../../../../lib/email";
import { getPricesForHoldings } from "../../../../lib/pricing";
import { getUsdRate } from "../../../../lib/fx";

function isBearerAuthorized(req: Request) {
  const token = process.env.SYNC_TOKEN;
  const header = req.headers.get("authorization") || "";
  if (!token) return false;
  return header === `Bearer ${token}`;
}

export async function POST(req: Request) {
  let userId: string | null = null;
  if (isBearerAuthorized(req)) {
    const firstUser = await prisma.user.findFirst({ select: { id: true } });
    userId = firstUser?.id ?? null;
  } else {
    const session = await auth();
    userId = session?.user?.id ?? null;
  }
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { apiSetting: true, holdings: true }
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const holdingSymbols = (user.holdings ?? []).map((h) => h.asset.toUpperCase());
  const markets = await getSwingCandidateMarkets(holdingSymbols);
  const signals = await generateSwingSignals(markets, {
    openaiKey: user.apiSetting?.openaiApiKey ?? undefined,
    deepseekKey: user.apiSetting?.deepseekApiKey ?? undefined
  });

  await prisma.signal.deleteMany({ where: { userId: user.id } });
  await prisma.signal.createMany({
    data: signals.map((s) => ({
      userId: user.id,
      symbol: s.symbol,
      summary: s.thesis,
      confidence: s.confidence,
      entryPrice: s.entryPrice,
      source: s.source.toUpperCase() as any,
      stopLoss: s.stopLoss,
      takeProfit: s.takeProfit
    }))
  });

  const to = user.apiSetting?.dailyEmailTo || user.email;
  if (to) {
    // Per-user Settings values take priority over the server-wide env vars.
    const apiKey = user.apiSetting?.resendApiKey || process.env.RESEND_API_KEY;
    const fromAddr = user.apiSetting?.resendFrom || process.env.RESEND_FROM;

    // `markets` is Binance-only (the swing-signal candidate universe), so
    // pricing every holding off it left NGX/Trading212 rows at $0 -- this
    // resolves each holding through its actual price source instead.
    const allMarkets = await getPricesForHoldings(user.holdings, holdingSymbols, {
      mansaApiKey: user.apiSetting?.mansaApiKey ?? undefined
    });
    const priceMap = new Map(allMarkets.map((m) => [m.symbol.toUpperCase(), m.price]));
    const minHoldingValueUsd = user.apiSetting?.minHoldingValueUsd ?? 5;
    const toRow = (h: (typeof user.holdings)[number]) => ({
      asset: h.asset,
      amount: Number(h.amount),
      valueUsd: Number(h.amount) * (priceMap.get(h.asset.toUpperCase()) ?? 0)
    });
    const aboveDust = (r: { valueUsd: number }) => r.valueUsd > minHoldingValueUsd;
    const ngxHoldings = user.holdings.filter((h) => h.assetClass === "STOCK" && h.market === "NGX");
    const ngxFxRate = ngxHoldings.length ? await getUsdRate("NGN") : 1;

    const holdingGroups: HoldingGroup[] = [
      {
        label: "Crypto (Binance)",
        displayCurrency: "USD",
        fxRate: 1,
        rows: user.holdings.filter((h) => h.assetClass !== "STOCK").map(toRow).filter(aboveDust)
      },
      {
        label: "Trading 212",
        displayCurrency: "USD",
        fxRate: 1,
        rows: user.holdings.filter((h) => h.source === "trading212").map(toRow).filter(aboveDust)
      },
      {
        label: "Nigeria Stock (NGX)",
        displayCurrency: "NGN",
        fxRate: ngxFxRate,
        rows: ngxHoldings.map(toRow).filter(aboveDust)
      },
      {
        label: "Other Stocks",
        displayCurrency: "USD",
        fxRate: 1,
        rows: user.holdings
          .filter((h) => h.assetClass === "STOCK" && h.market !== "NGX" && h.source !== "trading212")
          .map(toRow)
          .filter(aboveDust)
      }
    ];

    try {
      const result = await sendDailyEmail({
        to,
        from: fromAddr ?? undefined,
        apiKey,
        userName: user.name ?? undefined,
        signals,
        holdingGroups
      });
      await prisma.emailLog.create({
        data: {
          userId: user.id,
          subject: "ApexPulse | AI Swing Signals",
          status: "skipped" in result && result.skipped ? "skipped" : "sent",
          error: "skipped" in result ? result.reason : undefined
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

  return NextResponse.json({ ok: true, signals });
}
