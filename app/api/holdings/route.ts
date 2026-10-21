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
  const symbol = asset.toUpperCase();
  const resolvedAssetClass = isStock ? "STOCK" : "CRYPTO";
  const resolvedMarket = isStock ? market || "US" : null;
  const resolvedSource = isStock ? source || "manual" : "binance";

  // Adding to a position you already hold (same asset/market/source) should
  // top it up, not create a second row -- the asset table is one row per
  // position; every individual buy still gets its own entry in trade
  // history separately. Cost basis is recombined as a quantity-weighted
  // average so PnL reflects the blended price, not just the latest buy.
  const existing = await prisma.holding.findFirst({
    where: {
      userId: session.user.id,
      asset: symbol,
      assetClass: resolvedAssetClass,
      market: resolvedMarket,
      source: resolvedSource
    }
  });

  if (existing) {
    const oldQty = Number(existing.amount);
    const oldAvg = Number(existing.avgBuyPrice);
    const newQty = oldQty + amountNum;
    const newAvg = newQty > 0 ? (oldQty * oldAvg + amountNum * avgBuyPriceUsd) / newQty : avgBuyPriceUsd;
    const updated = await prisma.holding.update({
      where: { id: existing.id },
      data: { amount: newQty, avgBuyPrice: newAvg }
    });
    return NextResponse.json(updated, { status: 200 });
  }

  const holding = await prisma.holding.create({
    data: {
      asset: symbol,
      amount: amountNum,
      avgBuyPrice: avgBuyPriceUsd,
      tags,
      userId: session.user.id,
      assetClass: resolvedAssetClass,
      market: resolvedMarket,
      source: resolvedSource,
      ...(createdAt ? { createdAt } : {})
    }
  });

  return NextResponse.json(holding, { status: 201 });
}
