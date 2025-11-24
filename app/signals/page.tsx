import { redirect } from "next/navigation";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { Navbar } from "../../components/navbar";
import { SignalList } from "../../components/signal-list";

export default async function SignalsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const signals = await prisma.signal.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  const signalsSafe = signals.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    entryPrice: (s as any).entryPrice ? Number((s as any).entryPrice) : null
  }));

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl space-y-6 p-4 pb-12">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">AI signals</p>
          <h1 className="text-3xl font-bold">Swing calls</h1>
          <p className="text-muted-foreground">
            OpenAI primary with DeepSeek fallback, cached per user. Refresh to generate new calls.
          </p>
        </div>
        <SignalList initial={signalsSafe as any} />
      </main>
    </div>
  );
}
