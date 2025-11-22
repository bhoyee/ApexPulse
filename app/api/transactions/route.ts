import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trades = await prisma.transaction.findMany({
    where: { userId: session.user.id },
    orderBy: { executedAt: "desc" },
    take: 200
  });

  return NextResponse.json(trades);
}
