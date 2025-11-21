import { redirect } from "next/navigation";
import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { Navbar } from "../../components/navbar";
import { SettingsForm } from "../../components/settings-form";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const settings = await prisma.apiSetting.findUnique({
    where: { userId: session.user.id }
  });

  const safeSettings = settings
    ? {
        ...settings,
        createdAt: settings.createdAt.toISOString(),
        updatedAt: settings.updatedAt.toISOString()
      }
    : null;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-4xl space-y-6 p-4 pb-12">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Controls</p>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Connect Binance, AI providers, and email. All secrets stay on your box.
          </p>
        </div>
        <SettingsForm initial={safeSettings as any} />
      </main>
    </div>
  );
}
