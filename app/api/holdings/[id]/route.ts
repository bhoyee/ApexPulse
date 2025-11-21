import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { prisma } from "../../../../lib/prisma";

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } } | any
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.holding.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const holding = await prisma.holding.update({
    where: { id: params.id },
    data: {
      asset: body.asset?.toUpperCase(),
      amount: body.amount,
      avgBuyPrice: body.avgBuyPrice,
      tags: body.tags
    }
  });

  return NextResponse.json(holding);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } } | any
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.holding.findUnique({ where: { id: params.id } });
  if (!existing || existing.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.holding.delete({
    where: { id: params.id }
  });

  return NextResponse.json({ ok: true });
}
