import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";
import { getStockQuotes } from "../../../lib/stocks";
import { getUsdRate } from "../../../lib/fx";

// Live single-symbol preview for the "Add manual position" form -- unlike
// /api/prices, this isn't limited to symbols you already hold, since you're
// typing in a NEW one that hasn't been saved yet.
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol")?.toUpperCase();
  const market = (searchParams.get("market") || "US").toUpperCase();
  if (!symbol) {
    return NextResponse.json({ error: "symbol is required" }, { status: 400 });
  }

  const settings = await prisma.apiSetting.findUnique({ where: { userId: session.user.id } });
  const quotes = await getStockQuotes([symbol], market, {
    mansaApiKey: settings?.mansaApiKey ?? undefined
  });
  let quote = quotes.find((q) => q.symbol === symbol) ?? null;

  // getStockQuotes always returns USD (getNgxStockQuotes converts its raw
  // Naira scrape to USD internally, same as every other price source in
  // this app) -- convert back to NGN here purely for this preview display.
  const currency = market === "NGX" ? "NGN" : "USD";
  if (quote && currency === "NGN") {
    const ngnPerUsd = 1 / (await getUsdRate("NGN"));
    quote = {
      ...quote,
      price: quote.price * ngnPerUsd,
      high: quote.high * ngnPerUsd,
      low: quote.low * ngnPerUsd
    };
  }

  return NextResponse.json({ quote, currency });
}
