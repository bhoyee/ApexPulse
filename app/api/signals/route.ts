import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { getMarketTickers } from "../../../lib/binance";
import { generateSwingSignals } from "../../../lib/ai";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const refresh = searchParams.get("refresh") === "true";

  if (!refresh) {
    const signals = await prisma.signal.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20
    });
    return NextResponse.json(signals);
  }

  const settings = await prisma.apiSetting.findUnique({
    where: { userId: session.user.id }
  });
  if (!settings?.deepseekApiKey && !settings?.openaiApiKey) {
    return NextResponse.json({ error: "Missing AI API key" }, { status: 400 });
  }

  const markets = await getMarketTickers(["BTC", "ETH", "SOL", "AVAX", "LINK", "OP", "TIA"]);
  const signals = await generateSwingSignals(markets, {
    deepseekKey: settings?.deepseekApiKey ?? undefined,
    openaiKey: settings?.openaiApiKey ?? undefined
  });

  await prisma.signal.deleteMany({ where: { userId: session.user.id } });
  await prisma.signal.createMany({
    data: signals.map((s) => ({
      userId: session.user.id,
      symbol: s.symbol,
      summary: s.thesis,
      confidence: s.confidence,
      entryPrice: s.entryPrice ?? null,
      source: s.source.toUpperCase() as any,
      stopLoss: s.stopLoss,
      takeProfit: s.takeProfit
    }))
  });

  const latest = await prisma.signal.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 20
  });

  return NextResponse.json(latest);
}
