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
            ApexPulse is a self-hosted, multi-asset dashboard: crypto (Binance, auto-synced),
            Trading 212 (auto-synced via their official API), and Nigeria Stock Exchange positions
            (Bamboo/CSCS, tracked with live NGX pricing) -- each in its own tab -- plus AI swing
            signals grounded in real market data. This page explains how it works and how to use it.
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
            <li>Auto-syncs crypto balances/trades from Binance and stock positions from Trading 212.</li>
            <li>Tracks Nigeria Stock Exchange (NGX) positions you enter once, with live price auto-refresh after that.</li>
            <li>Shows each asset class in its own dashboard tab: stat cards, Price Glide + Dominance charts, and a holdings table scoped to just that section.</li>
            <li>Shows buy-only trade history with live P/L and exportable PDF reports.</li>
            <li>Generates AI swing signals grounded in real market data, only surfacing ideas that clear an 80%+ conviction bar (OpenAI primary, DeepSeek fallback).</li>
            <li>Sends a daily email summary of new AI signals.</li>
            <li>Runs fully in Docker for self-hosted deployments, with version-stamped, fast rebuilds.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Architecture Overview</h2>
          <p className="text-sm text-muted-foreground">
            ApexPulse uses a <span className="font-semibold text-foreground">modular monolith</span>.
            The web UI and API live in one Next.js app. A dedicated{" "}
            <span className="font-semibold text-foreground">pricing engine</span> (
            <code>lib/pricing.ts</code>) fans each holding out to the right source by asset
            class/market -- Binance for crypto, Yahoo Finance for US stocks, Trading 212&apos;s own
            synced snapshot, Mansa API/a free scraper for NGX -- and merges results back into one
            USD-denominated list, so no UI component needs to know an asset is a stock. A separate
            cron worker runs scheduled crypto sync + AI signal jobs. Everything talks to the same
            Postgres database through Prisma.
          </p>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
            <p className="mb-2 font-semibold text-foreground">High-level flow</p>
            <pre className="whitespace-pre-wrap">
{`[UI] Next.js App Router (Crypto / Trading212 / NGX tabs)
  ↕ API Routes
  ↕ Pricing Engine (lib/pricing.ts) ↔ Binance / Yahoo / Trading212 / Mansa+scraper
  ↕ Prisma ORM
  ↕ PostgreSQL
  ↕ OpenAI/DeepSeek + Resend`}
            </pre>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
            <p className="mb-2 font-semibold text-foreground">Mermaid diagram (renderable)</p>
            <pre className="whitespace-pre-wrap">
{`flowchart TD
    Browser[Next.js App\\nTabs: Crypto / Trading212 / NGX\\nTanStack Query + Tremor] --> API[/Next.js API Routes/]
    API --> Auth[NextAuth v5\\nPrisma Adapter]
    API --> Pricing[Pricing Engine\\nlib/pricing.ts]
    API --> AI[AI Signals\\nOpenAI -> DeepSeek\\n80%+ gate]
    API --> Email[Resend + React Email]
    Pricing --> Binance[Binance: crypto]
    Pricing --> Yahoo[Yahoo Finance: US stocks + FX]
    Pricing --> T212[Trading212 synced snapshot]
    Pricing --> NGX[Mansa API -> free scraper: NGX]
    Auth --> DB[(PostgreSQL via Prisma)]
    Cron[Cron container\\ntsx scripts/cron.ts] --> Binance
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
            <li>Binance provides crypto balances, trades, and prices; Trading 212&apos;s own API provides stock positions and order history.</li>
            <li>Yahoo Finance prices US stocks (free, no key); Mansa API + a free scraper price NGX stocks, with a cost-basis fallback if both are temporarily unavailable.</li>
            <li>OpenAI/DeepSeek generate swing signals, gated at 80%+ confidence.</li>
            <li>Resend sends daily signal emails.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Dashboard Walkthrough</h2>
          <p className="text-sm text-muted-foreground">
            The dashboard is a full-width tab bar, not one long scrolling page: Crypto (default),
            Trading 212, Nigeria Stock, and an Other Stocks tab that only appears if you hold
            something that isn&apos;t NGX or Trading 212. Each tab is fully independent -- its own
            stat cards, charts, and holdings table, scoped only to that section&apos;s assets.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">Stat cards</span> differ by section:
              crypto shows Portfolio Value, 24h Change, Overall PnL (stablecoins excluded -- they&apos;re
              cash-equivalent, not a directional bet), Total Invested, BTC Price, and Stable Balance.
              Stock sections swap the last two for Positions count and Best Mover (highest 24h % change
              among your held tickers on that tab).
            </li>
            <li>
              <span className="font-semibold text-foreground">Charts</span> are deliberately different
              from each other: Price Glide shows current market value per position; Dominance shows
              cost basis (how much capital actually went into each position) -- a coin/stock that
              mooned dominates Price Glide but not Dominance, and vice versa. Both only show assets
              above your minimum holding value (default $5, configurable in Settings).
            </li>
            <li>
              <span className="font-semibold text-foreground">Holdings table</span> lists assets,
              current value, invested totals, and a PnL column (green for profit, red for loss). Every
              broker/source is tagged (Binance, Trading 212, Bamboo, CSCS, manual) next to the symbol.
              Remove is always a solid red danger button.
            </li>
            <li>
              <span className="font-semibold text-foreground">Add position</span> (Crypto and NGX
              tabs): one-time entry of symbol, quantity, and avg cost -- price then auto-refreshes on
              every load, same as a Binance-synced holding. NGX entries show a live preview price and
              accept your buy price in Naira, converting to USD automatically on save.
            </li>
            <li>
              <span className="font-semibold text-foreground">Trade history</span> (Crypto and Trading
              212 tabs) lists buy fills, with live prices, P/L, and export to PDF.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Settings</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Add Binance API keys to auto-sync crypto balances and trades.</li>
            <li>
              Add Trading 212 API key + secret (generated in the Trading 212 app under Settings -&gt;
              API Beta) and click <span className="font-semibold text-foreground">Sync Trading 212 now</span>{" "}
              to pull positions and order history.
            </li>
            <li>
              Optional: add a free Mansa API key (100 req/day, no card, signup at{" "}
              <Link href="https://mansaapi.com/docs" className="underline underline-offset-4">mansaapi.com</Link>
              ) for more reliable NGX prices than the built-in free scraper fallback.
            </li>
            <li>Add OpenAI API key (primary) and DeepSeek key (fallback) for AI signals.</li>
            <li>Add Resend API key and sender email for daily emails.</li>
            <li>Set your minimum holding value (default $5) -- hides dust across every tab.</li>
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
              <span className="font-semibold text-foreground">Tremor + Recharts:</span> Price Glide
              (current value) and Dominance (cost basis) charts, scoped per dashboard tab.
            </li>
            <li>
              <span className="font-semibold text-foreground">TanStack Query:</span> background refresh,
              shared cache across tabs, and instant UI updates after any add/sync/remove.
            </li>
            <li>
              <span className="font-semibold text-foreground">Prisma + PostgreSQL:</span> structured
              storage for holdings (tagged by asset class/market/source), trades, settings, and signals.
            </li>
            <li>
              <span className="font-semibold text-foreground">NextAuth v5:</span> secure sessions with
              credentials + Google OAuth.
            </li>
            <li>
              <span className="font-semibold text-foreground">Binance + Trading 212:</span> auto-synced
              crypto and stock holdings via each provider&apos;s official API (Trading 212 read-only).
            </li>
            <li>
              <span className="font-semibold text-foreground">Mansa API + Yahoo Finance:</span> NGX and
              US stock prices, plus live FX rates for GBP/NGN -&gt; USD conversion.
            </li>
            <li>
              <span className="font-semibold text-foreground">OpenAI + DeepSeek:</span> AI swing signal
              generation, gated at 80%+ confidence against real market data.
            </li>
            <li>
              <span className="font-semibold text-foreground">Resend + React Email:</span> daily signal
              email delivery.
            </li>
            <li>
              <span className="font-semibold text-foreground">Docker + compose:</span> portable
              deployment with local/prod parity, version-stamped and fast to rebuild.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Calling Plan</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Crypto prices/holdings/trades refresh on a short polling interval; auto-synced from Binance every `CRON_INTERVAL_SECONDS`.</li>
            <li>Trading 212 refreshes only when you click Sync -- their API has no push/webhook support.</li>
            <li>NGX prices refresh automatically (Mansa cached ~20min, free scraper fallback cached ~5min -- both are rate-limited free resources, not polled every request).</li>
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
          <h2 className="text-xl font-semibold">More Brokers/Exchanges</h2>
          <p className="text-sm text-muted-foreground">
            Trading 212 and NGX (Mansa/scraper) were added as individual clients under{" "}
            <code>lib/</code>, each resolving to the same price shape and fanned out by{" "}
            <code>lib/pricing.ts</code> -- rather than a formal adapter interface. Adding another
            crypto exchange (Coinbase, Kraken, KuCoin, OKX, Bybit) would follow the same pattern.
          </p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Add a client under <code>lib/</code> resolving to <code>{"{symbol, price, change24h, volume, high, low}"}</code>.</li>
            <li>Wire it into <code>lib/pricing.ts</code>&apos;s fan-out by asset class/market/source.</li>
            <li>A shared <code>ExchangeAdapter</code> interface is a reasonable refactor once there are 2+ crypto exchanges.</li>
          </ol>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Database Diagram (ERD)</h2>
          <p className="text-sm text-muted-foreground">
            The core tables are Users, Settings, Holdings, Transactions, and Signals. Below is a
            Mermaid ERD you can paste into any Mermaid renderer.
          </p>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
            <pre className="whitespace-pre-wrap">
{`erDiagram
  User ||--o{ ApiSetting : has
  User ||--o{ Holding : owns
  User ||--o{ Transaction : records
  User ||--o{ Signal : receives

  User {
    string id
    string email
    string name
    datetime createdAt
  }
  ApiSetting {
    string id
    string userId
    string binanceApiKey
    string binanceApiSecret
    string trading212ApiKey
    string trading212ApiSecret
    string mansaApiKey
    string openaiApiKey
    string deepseekApiKey
    string resendApiKey
    string resendFrom
    string dailyEmailTo
    string fullName
    float minHoldingValueUsd
    datetime createdAt
  }
  Holding {
    string id
    string userId
    string asset
    float amount
    float avgBuyPrice
    string assetClass "CRYPTO or STOCK"
    string market "US, NGX, LSE, etc."
    string source "binance, trading212, bamboo, cscs, manual"
    float lastPriceUsd "Trading212 synced snapshot only"
    datetime updatedAt
  }
  Transaction {
    string id
    string userId
    string symbol
    float quantity
    float price
    string type
    string source "binance, trading212"
    datetime executedAt
  }
  Signal {
    string id
    string userId
    string symbol
    string summary
    int confidence
    float entryPrice
    float stopLoss
    float takeProfit
    string source
    datetime createdAt
  }`}
            </pre>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Security Notes</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Never commit API keys; set them in Settings (per-user, stored in the database) or env vars (global).</li>
            <li>Use read-only keys where possible -- ApexPulse&apos;s Trading 212 client is read-only by design and never issues a mutating request.</li>
            <li>Rotate keys if you suspect exposure.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">How to Use</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Sign in and open Settings.</li>
            <li>Add keys for whichever asset classes you use: Binance (crypto), Trading 212 (stocks), Mansa (optional, NGX pricing), OpenAI/DeepSeek, Resend.</li>
            <li>Return to the Dashboard: crypto auto-syncs, click Sync Trading 212 if you added those keys, and add NGX positions once from that tab.</li>
            <li>Use the Trade History export for tax reporting.</li>
          </ol>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">Internal API (Not Public)</h2>
          <p className="text-sm text-muted-foreground">
            These endpoints are consumed by the UI and cron worker. They are not designed as a
            public API and require authentication.
          </p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>GET /api/holdings, POST /api/holdings</li>
            <li>PUT /api/holdings/[id], DELETE /api/holdings/[id]</li>
            <li>GET /api/prices -- merged across every source, all USD</li>
            <li>GET /api/stock-quote?symbol=&amp;market= -- live preview before saving a position</li>
            <li>GET /api/fx?to=CURRENCY -- units of CURRENCY per 1 USD</li>
            <li>GET /api/transactions, POST /api/transactions</li>
            <li>DELETE /api/transactions/[id]</li>
            <li>GET /api/signals, GET /api/signals?refresh=true (80%+ confidence gate)</li>
            <li>GET/PUT /api/settings</li>
            <li>POST /api/cron/daily (authorized)</li>
            <li>POST /api/sync/binance (authorized)</li>
            <li>POST /api/sync/trading212 (authorized, read-only against Trading 212)</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
