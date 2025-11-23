import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

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
  const { asset, amount, avgBuyPrice, tags, timestamp } = data;
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

  const holding = await prisma.holding.create({
    data: {
      asset: asset.toUpperCase(),
      amount: amountNum,
      avgBuyPrice: avgNum,
      tags,
      userId: session.user.id,
      ...(createdAt ? { createdAt } : {})
    }
  });

  return NextResponse.json(holding, { status: 201 });
}
