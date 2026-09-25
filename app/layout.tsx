import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cn } from "../lib/utils";
import { ThemeProvider } from "../components/theme-provider";
import { QueryProvider } from "../components/query-provider";
import { Toaster } from "../components/ui/sonner";
import { AuthProvider } from "../components/session-provider";
import { VersionFooter } from "../components/version-footer";
import { DeployRefreshGuard } from "../components/deploy-refresh-guard";
import { auth } from "../lib/auth";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ApexPulse | Crypto + Trading 212 + Nigeria Stock, with AI Swing Signals",
  description: "Self-hosted investing dashboard. Binance, Trading 212, and NGX sync, AI signals, Tremor charts."
};

export default async function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(inter.className, "min-h-screen bg-background")}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <AuthProvider session={session}>
            <QueryProvider>
              <DeployRefreshGuard />
              {children}
              <VersionFooter />
              <Toaster position="top-right" />
            </QueryProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
