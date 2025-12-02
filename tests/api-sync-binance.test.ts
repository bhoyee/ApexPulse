import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: any, init?: any) => ({ jsonBody: body, status: init?.status ?? 200 })
  }
}));

const prismaMock = vi.hoisted(() => ({
  user: { findFirst: vi.fn() },
  apiSetting: { findUnique: vi.fn() },
  holding: {
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn()
  },
  transaction: { upsert: vi.fn() }
}));

vi.mock("../lib/prisma", () => ({
  prisma: prismaMock
}));

const binanceMock = vi.hoisted(() => ({
  getBinanceBalances: vi.fn(),
  getMarketTickers: vi.fn(),
  getBinanceTrades: vi.fn()
}));

vi.mock("../lib/binance", () => binanceMock);
vi.mock("../lib/auth", () => ({
  auth: vi.fn()
}));

// Import after mocks
import { POST as syncPost } from "../app/api/sync/binance/route";

describe("POST /api/sync/binance", () => {
  beforeEach(() => {
    process.env.SYNC_TOKEN = "token123";
    Object.values(prismaMock).forEach((group: any) => {
      if (group && typeof group === "object") {
        Object.values(group).forEach((fn: any) => fn?.mockReset());
      }
    });
    Object.values(binanceMock).forEach((fn) => fn.mockReset());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("syncs holdings and trades when bearer token is provided", async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: "user1" });
    prismaMock.apiSetting.findUnique.mockResolvedValue({
      userId: "user1",
      binanceApiKey: "k",
      binanceApiSecret: "s"
    });

    binanceMock.getBinanceBalances.mockResolvedValue([
      { asset: "HBAR", amount: 254.75 },
      { asset: "USDT", amount: 50 }
    ]);
    binanceMock.getMarketTickers.mockResolvedValue([
      { symbol: "HBAR", price: 0.15, change24h: 0, volume: 0, high: 0.15, low: 0.15 }
    ]);
    binanceMock.getBinanceTrades.mockResolvedValue([
      {
        id: "HBARUSDT-1",
        symbol: "HBAR",
        qty: 254.75,
        price: 0.15,
        commission: 0.1,
        isBuyer: true,
        time: Date.now()
      }
    ]);

    prismaMock.holding.findFirst.mockResolvedValue(null);
    prismaMock.holding.create.mockResolvedValue({});
    prismaMock.holding.findMany.mockResolvedValue([{ asset: "HBAR", amount: 254.75 }]);

    const res = (await syncPost(
      new Request("http://localhost/api/sync/binance", {
        method: "POST",
        headers: { Authorization: "Bearer token123" }
      })
    )) as any;

    expect(res.status).toBe(200);
    expect(prismaMock.holding.create).toHaveBeenCalled();
    expect(prismaMock.transaction.upsert).toHaveBeenCalled();
    expect(res.jsonBody.synced).toBeGreaterThanOrEqual(1);
  });

  it("skips when no credentials", async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: "user1" });
    prismaMock.apiSetting.findUnique.mockResolvedValue(null);
    const res = (await syncPost(
      new Request("http://localhost/api/sync/binance", {
        method: "POST",
        headers: { Authorization: "Bearer token123" }
      })
    )) as any;
    expect(res.status).toBe(400);
    expect(res.jsonBody.error).toContain("Binance API credentials missing");
  });
});
