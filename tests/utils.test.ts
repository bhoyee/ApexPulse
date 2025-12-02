import { describe, it, expect } from "vitest";
import { formatCurrency, formatPercent } from "../lib/utils";

describe("utils formatting", () => {
  it("formats currency with USD default", () => {
    expect(formatCurrency(1234.567)).toBe("$1,234.57");
  });

  it("formats percent with sign", () => {
    expect(formatPercent(2.5)).toBe("+2.50%");
    expect(formatPercent(-3)).toBe("-3.00%");
    expect(formatPercent(0)).toBe("+0.00%");
  });
});
