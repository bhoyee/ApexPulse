import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: any, init?: any) => ({ jsonBody: body, status: init?.status ?? 200 })
  }
}));

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn()
  },
  signal: { createMany: vi.fn() },
  emailLog: { create: vi.fn() }
}));

vi.mock("../lib/prisma", () => ({
  prisma: prismaMock
}));

const binanceMock = vi.hoisted(() => ({
  getMarketTickers: vi.fn()
}));
vi.mock("../lib/binance", () => binanceMock);

const aiMock = vi.hoisted(() => ({
  generateSwingSignals: vi.fn()
}));
vi.mock("../lib/ai", () => aiMock);

const emailMock = vi.hoisted(() => ({
  sendDailyEmail: vi.fn()
}));
vi.mock("../lib/email", () => emailMock);

vi.mock("../lib/auth", () => ({
  auth: vi.fn()
}));

import { POST as cronDaily } from "../app/api/cron/daily/route";

describe("POST /api/cron/daily", () => {
  beforeEach(() => {
    process.env.SYNC_TOKEN = "token123";
    prismaMock.user.findUnique.mockReset();
    prismaMock.user.findFirst.mockReset();
    prismaMock.signal.createMany.mockReset();
  prismaMock.emailLog.create.mockReset();
  binanceMock.getMarketTickers.mockReset();
  aiMock.generateSwingSignals.mockReset();
  emailMock.sendDailyEmail.mockReset();
  process.env.RESEND_API_KEY = "test-resend";
  // default auth to null; bearer path will be used
  const authModule = vi.importMock<any>("../lib/auth");
  authModule.then((mod) => mod.auth.mockResolvedValue(null));
});

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates signals and sends email when authorized via bearer", async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: "user1" });
    prismaMock.user.findUnique.mockResolvedValue({
      id: "user1",
      email: "demo@example.com",
      name: "Demo",
      apiSetting: { dailyEmailTo: "demo@example.com" },
      holdings: [{ asset: "HBAR", amount: 100 }]
    });
    binanceMock.getMarketTickers.mockResolvedValue([
      { symbol: "HBAR", price: 0.1, change24h: 0, volume: 0, high: 0.1, low: 0.1 }
    ]);
    aiMock.generateSwingSignals.mockResolvedValue([
      { symbol: "HBAR", thesis: "test", confidence: 80, source: "openai" }
    ]);
    emailMock.sendDailyEmail.mockResolvedValue({ sent: true });

    const res = (await cronDaily(
      new Request("http://localhost/api/cron/daily", {
        method: "POST",
        headers: { Authorization: "Bearer token123" }
      })
    )) as any;

    expect(res.status).toBe(200);
    expect(prismaMock.signal.createMany).toHaveBeenCalled();
    expect(emailMock.sendDailyEmail).toHaveBeenCalled();
  });
});
