import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trades = await prisma.transaction.findMany({
    where: { userId: session.user.id, type: "BUY" },
    orderBy: { executedAt: "desc" },
    take: 200
  });

  return NextResponse.json(trades);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await req.json();
  const { symbol, quantity, price, executedAt } = data;
  const qtyNum = Number(quantity);
  const priceNum = Number(price);
  if (!symbol || Number.isNaN(qtyNum) || Number.isNaN(priceNum) || qtyNum <= 0 || priceNum <= 0) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  const ts = executedAt ? new Date(executedAt) : new Date();
  const trade = await prisma.transaction.create({
    data: {
      userId: session.user.id,
      type: "BUY",
      symbol: symbol.toUpperCase(),
      quantity: qtyNum,
      price: priceNum,
      executedAt: ts
    }
  });

  return NextResponse.json(trade, { status: 201 });
}
