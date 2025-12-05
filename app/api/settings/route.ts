import { NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.apiSetting.findUnique({
    where: { userId: session.user.id }
  });

  return NextResponse.json(settings);
}

export async function PUT(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const data = {
    fullName: body.fullName || null,
    binanceApiKey: body.binanceApiKey || null,
    binanceApiSecret: body.binanceApiSecret || null,
    grokApiKey: null,
    openaiApiKey: body.openaiApiKey || null,
    deepseekApiKey: body.deepseekApiKey || null,
    resendApiKey: body.resendApiKey || null,
    resendFrom: body.resendFrom || null,
    dailyEmailTo: body.dailyEmailTo || null
  };
  const updated = await prisma.apiSetting.upsert({
    where: { userId: session.user.id },
    update: data,
    create: { ...data, userId: session.user.id }
  });

  return NextResponse.json(updated);
}
