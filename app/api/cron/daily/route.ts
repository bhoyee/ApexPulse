import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";
import { generateSwingSignals } from "../../../../lib/ai";
import { getMarketTickers } from "../../../../lib/binance";
import { sendDailyEmail } from "../../../../lib/email";

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

  const base = ["BTC", "ETH", "SOL", "AVAX", "LINK", "OP", "TIA"];
  const holdingSymbols = (user.holdings ?? []).map((h) => h.asset.toUpperCase());
  const markets = await getMarketTickers(Array.from(new Set([...base, ...holdingSymbols])));
  const signals = await generateSwingSignals(markets, {
    openaiKey: user.apiSetting?.openaiApiKey,
    deepseekKey: user.apiSetting?.deepseekApiKey
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
  if (to && process.env.RESEND_API_KEY) {
    await sendDailyEmail({
      to,
      userName: user.name ?? undefined,
      signals,
      holdings: user.holdings.map((h) => ({
        asset: h.asset,
        amount: Number(h.amount),
        value: Number(h.amount) * (markets.find((m) => m.symbol === h.asset)?.price ?? 0)
      }))
    });
  }

  return NextResponse.json({ ok: true, signals });
}
