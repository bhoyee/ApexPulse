import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { getMarketTickers } from "../lib/binance";

describe("binance price aggregation", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    const fetchMock = vi.fn(async (url: any) => {
      const u = typeof url === "string" ? url : url?.url;
      // Binance 24hr ticker
      if (u?.includes("/api/v3/ticker/24hr")) {
        return { ok: false, json: async () => [] } as any;
      }
      // Binance single price
      if (u?.includes("/api/v3/ticker/price")) {
        return { ok: false, json: async () => ({}) } as any;
      }
      // CoinGecko fallback
      if (u?.includes("api.coingecko.com")) {
        return {
          ok: true,
          json: async () => ({
            "hedera-hashgraph": { usd: 0.12 }
          })
        } as any;
      }
      return { ok: false, json: async () => ({}) } as any;
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sets stablecoins to $1 even when ticker fails", async () => {
    const data = await getMarketTickers(["USDT"]);
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ symbol: "USDT", price: 1 });
  });

  it("falls back to CoinGecko for missing symbols", async () => {
    const data = await getMarketTickers(["HBAR"]);
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ symbol: "HBAR", price: 0.12 });
  });
});
