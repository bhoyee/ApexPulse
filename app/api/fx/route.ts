import { NextResponse } from "next/server";
import { getUsdRate } from "../../../lib/fx";

// How many units of `to` equal 1 USD -- the inverse of getUsdRate, which
// gives USD per unit of a currency. Used to convert already-USD-stored
// amounts back to a section's native currency for display (e.g. NGX in NGN).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const to = (searchParams.get("to") || "USD").toUpperCase();

  if (to === "USD") {
    return NextResponse.json({ rate: 1 });
  }

  const usdPerUnit = await getUsdRate(to);
  const rate = usdPerUnit > 0 ? 1 / usdPerUnit : 1;
  return NextResponse.json({ rate });
}
