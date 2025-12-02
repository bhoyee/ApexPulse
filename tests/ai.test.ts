import { describe, it, expect } from "vitest";
import { parseSignals } from "../lib/ai";

describe("AI parsing", () => {
  it("parses a valid JSON array of signals", () => {
    const raw = JSON.stringify([
      { symbol: "HBAR", thesis: "Test", confidence: 80, stopLoss: 5, takeProfit: 12, entryPrice: 0.1 },
      { ticker: "VET", reason: "Edge", confidence: 70 }
    ]);
    const result = parseSignals(raw, "openai");
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      symbol: "HBAR",
      thesis: "Test",
      confidence: 80,
      stopLoss: 5,
      takeProfit: 12,
      source: "openai"
    });
    expect(result[1]).toMatchObject({
      symbol: "VET",
      confidence: 70,
      source: "openai"
    });
  });

  it("falls back when JSON is invalid", () => {
    const result = parseSignals("not-json", "fallback");
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].symbol).toBeTruthy();
  });
});
