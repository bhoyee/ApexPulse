import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { getUsdRate, MARKET_CURRENCY } from "../../../lib/fx";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const holdings = await prisma.holding.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json(holdings);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await req.json();
  const { asset, amount, avgBuyPrice, tags, timestamp, assetClass, market, source } = data;
  const amountNum = Number(amount);
  const avgNum = Number(avgBuyPrice);
  if (!asset || Number.isNaN(amountNum) || Number.isNaN(avgNum)) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  let createdAt: Date | undefined;
  if (timestamp) {
    const t = new Date(timestamp);
    if (!Number.isNaN(t.getTime())) {
      createdAt = t;
    }
  }

  const isStock = assetClass === "STOCK";
  const holdingMarket = isStock ? (market || "US").toUpperCase() : null;
  const currency = holdingMarket ? MARKET_CURRENCY[holdingMarket] : undefined;
  const fxRate = currency ? await getUsdRate(currency) : 1;
  const avgBuyPriceUsd = avgNum * fxRate;

  const holding = await prisma.holding.create({
    data: {
      asset: asset.toUpperCase(),
      amount: amountNum,
      avgBuyPrice: avgBuyPriceUsd,
      tags,
      userId: session.user.id,
      assetClass: isStock ? "STOCK" : "CRYPTO",
      market: isStock ? market || "US" : null,
      source: isStock ? source || "manual" : "binance",
      ...(createdAt ? { createdAt } : {})
    }
  });

  return NextResponse.json(holding, { status: 201 });
}
