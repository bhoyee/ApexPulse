import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { getStockQuotes } from "../../../lib/stocks";

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

  const quotes = await getStockQuotes([symbol], market);
  const quote = quotes.find((q) => q.symbol === symbol) ?? null;

  return NextResponse.json({
    quote,
    currency: market === "NGX" ? "NGN" : "USD"
  });
}
