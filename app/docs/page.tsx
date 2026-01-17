import Link from "next/link";
import { Navbar } from "../../components/navbar";

export default function DocsPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl space-y-8 p-4 pb-12">
        <section className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-primary">Documentation</p>
          <h1 className="text-3xl font-bold">ApexPulse Guide</h1>
          <p className="text-muted-foreground">
            ApexPulse is a self-hosted crypto portfolio tracker with AI swing signals. It pulls
            balances and trades from your exchange, computes live valuations, and ships daily AI
            ideas by email. This page explains how it works and how to use it.
          </p>
          <div className="text-sm text-muted-foreground">
            GitHub:{" "}
            <Link className="underline underline-offset-4" href="https://github.com/bhoyee/ApexPulse">
              https://github.com/bhoyee/ApexPulse
            </Link>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">What It Does</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Tracks your portfolio balances and live prices in real time-ish updates.</li>
            <li>Shows buy-only trade history with live P/L and exportable PDF reports.</li>
            <li>Generates AI swing signals (DeepSeek primary, OpenAI fallback).</li>
            <li>Sends a daily email summary of new AI signals.</li>
            <li>Runs fully in Docker for self-hosted deployments.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Architecture Overview</h2>
          <p className="text-sm text-muted-foreground">
            ApexPulse uses a <span className="font-semibold text-foreground">modular monolith</span>.
            The web UI and API live in one Next.js app. A separate cron worker runs scheduled jobs.
            Both talk to the same Postgres database through Prisma. External services (Binance, LLMs,
            Resend) are called by the API layer and the cron worker.
          </p>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
            <p className="mb-2 font-semibold text-foreground">High-level flow</p>
            <pre className="whitespace-pre-wrap">
{`[UI] Next.js App Router
  ↕ API Routes
  ↕ Prisma ORM
  ↕ PostgreSQL
  ↕ Binance REST/WebSocket + LLMs + Resend`}
            </pre>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
            <p className="mb-2 font-semibold text-foreground">Mermaid diagram (renderable)</p>
            <pre className="whitespace-pre-wrap">
{`flowchart TD
    Browser[Next.js App\\nTanStack Query + Tremor] --> API[/Next.js API Routes/]
    API --> Auth[NextAuth v5\\nPrisma Adapter]
    API --> Holdings[Holdings/Signals/Settings APIs]
    API --> Binance[Binance REST + WebSocket]
    API --> AI[DeepSeek -> OpenAI]
    API --> Email[Resend + React Email]
    Holdings --> DB[(PostgreSQL via Prisma)]
    Auth --> DB
    Cron[Cron container\\ntsx scripts/cron.ts] --> API
    Cron --> Binance
    Cron --> AI
    Cron --> Email
    Cron --> DB`}
            </pre>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
            <p className="mb-2 font-semibold text-foreground">Architecture image</p>
            <img
              src="/architecture.svg"
              alt="ApexPulse architecture diagram"
              className="w-full rounded-lg border border-white/10 bg-white/5"
            />
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Next.js serves the UI and API routes from one app.</li>
            <li>Prisma handles database queries and data modeling.</li>
            <li>Binance APIs provide balances, trades, and market prices.</li>
            <li>DeepSeek/OpenAI generate swing signals.</li>
            <li>Resend sends daily signal emails.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Dashboard Walkthrough</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">Stat cards</span> show live portfolio
              value, overall PnL, total invested, BTC price, and stable balance.
            </li>
            <li>
              <span className="font-semibold text-foreground">Charts</span> show price glide (bar)
              and dominance (pie) using only assets valued over $5.
            </li>
            <li>
              <span className="font-semibold text-foreground">Holdings table</span> lists assets,
              current value, and invested totals.
            </li>
            <li>
              <span className="font-semibold text-foreground">Trade history</span> lists buy fills,
              with live prices, P/L, and export to PDF.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Settings</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Add Binance API keys to sync balances and trades.</li>
            <li>Add DeepSeek API key (primary) and OpenAI key (fallback).</li>
            <li>Add Resend API key and sender email for daily emails.</li>
            <li>Optional: your full name for PDF report headers.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Tech Stack</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">Next.js 15 + TypeScript:</span> full-stack
              app with typed API routes, server components, and strong type safety.
            </li>
            <li>
              <span className="font-semibold text-foreground">Tailwind + shadcn/ui + lucide:</span>{" "}
              rapid, consistent UI with accessible components and icons.
            </li>
            <li>
              <span className="font-semibold text-foreground">Tremor + Recharts:</span> clean charts for
              portfolio dominance and price glide.
            </li>
            <li>
              <span className="font-semibold text-foreground">TanStack Query:</span> background refresh,
              caching, and real-time-ish UI updates.
            </li>
            <li>
              <span className="font-semibold text-foreground">Prisma + PostgreSQL:</span> structured
              storage for trades, holdings, settings, and signals.
            </li>
            <li>
              <span className="font-semibold text-foreground">NextAuth v5:</span> secure sessions with
              credentials + Google OAuth.
            </li>
            <li>
              <span className="font-semibold text-foreground">DeepSeek + OpenAI:</span> AI swing signal
              generation with fallback reliability.
            </li>
            <li>
              <span className="font-semibold text-foreground">Resend + React Email:</span> daily signal
              email delivery.
            </li>
            <li>
              <span className="font-semibold text-foreground">Docker + compose:</span> portable deployment
              with local/prod parity.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Calling Plan</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Prices, holdings, and trades refresh on a short polling interval.</li>
            <li>AI signals refresh on demand or via cron schedule.</li>
            <li>Email delivery runs after signal generation.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Scaling Plan</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Single-node: app + Postgres + cron in one Docker compose.</li>
            <li>Split services: run app and cron as separate services.</li>
            <li>Move Postgres to a managed provider for durability.</li>
            <li>Add Redis for caching and rate limiting.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Future Exchange Adapters</h2>
          <p className="text-sm text-muted-foreground">
            Next plan: implement an exchange adapter framework so adding Coinbase, Kraken, KuCoin,
            OKX, or Bybit is a small plug-in change.
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Create an ExchangeAdapter interface (balances, trades, prices).</li>
            <li>Refactor Binance to the adapter.</li>
            <li>Add one new exchange based on your choice.</li>
          </ol>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Security Notes</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Never commit API keys; set them in Settings or env vars.</li>
            <li>Use read-only keys where possible.</li>
            <li>Rotate keys if you suspect exposure.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">How to Use</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Sign in and open Settings.</li>
            <li>Enter Binance + DeepSeek/OpenAI + Resend keys.</li>
            <li>Return to the Dashboard and click Refresh if needed.</li>
            <li>Use the Trade History export for tax reporting.</li>
          </ol>
        </section>
      </main>
    </div>
  );
}
