import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { getDividendCandidates } from "../../../lib/us-dividend-stocks";
import { generateDividendPicks } from "../../../lib/ai";

// A flat, affordable-shares-first cap -- the whole point of this screen
// (per the user's own framing) is "not a high ticket stock," not merely
// "has a dividend." Kept server-side rather than AI-judged so it's a hard
// filter, not a preference the model could talk itself out of.
const MAX_PRICE_PER_SHARE_USD = 75;

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const refresh = searchParams.get("refresh") === "true";

  if (!refresh) {
    const picks = await prisma.dividendPick.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 10
    });
    return NextResponse.json(picks);
  }

  const settings = await prisma.apiSetting.findUnique({
    where: { userId: session.user.id }
  });
  if (!settings?.deepseekApiKey && !settings?.openaiApiKey) {
    return NextResponse.json({ error: "Missing AI API key" }, { status: 400 });
  }

  const candidates = await getDividendCandidates(MAX_PRICE_PER_SHARE_USD);
  const picks = await generateDividendPicks(candidates, {
    deepseekKey: settings?.deepseekApiKey ?? undefined,
    openaiKey: settings?.openaiApiKey ?? undefined
  });

  await prisma.dividendPick.deleteMany({ where: { userId: session.user.id } });
  await prisma.dividendPick.createMany({
    data: picks.map((p) => ({
      userId: session.user.id,
      symbol: p.symbol,
      thesis: p.thesis,
      confidence: p.confidence,
      price: p.price,
      dividendYieldPct: p.dividendYieldPct,
      source: p.source.toUpperCase() as any
    }))
  });

  const latest = await prisma.dividendPick.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 10
  });

  return NextResponse.json(latest);
}
