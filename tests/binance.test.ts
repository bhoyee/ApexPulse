import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getBinanceTrades } from "../lib/binance";

describe("binance trades fetch", () => {
  beforeEach(() => {
    process.env.BINANCE_API_KEY = "test_key";
    process.env.BINANCE_API_SECRET = "test_secret";
    const mockFetch = vi.fn(async (url: any) => {
      const urlStr = typeof url === "string" ? url : url?.url;
      if (urlStr?.includes("/api/v3/time")) {
        return {
          ok: true,
          json: async () => ({ serverTime: 1700000000000 })
        } as any;
      }
      if (urlStr?.includes("/api/v3/myTrades")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => [
            {
              id: 1,
              qty: "10",
              price: "0.25",
              commission: "0.01",
              isBuyer: true,
              time: 1700000001000
            }
          ]
        } as any;
      }
      return { ok: false, status: 500, statusText: "err", json: async () => ({}) } as any;
    });
    vi.stubGlobal("fetch", mockFetch as any);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed trades per symbol", async () => {
    const trades = await getBinanceTrades(["HBAR"]);
    expect(trades).toHaveLength(1);
    expect(trades[0]).toMatchObject({
      symbol: "HBAR",
      qty: 10,
      price: 0.25,
      isBuyer: true
    });
  });
});
