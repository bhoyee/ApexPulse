import { describe, it, expect } from "vitest";
import { credentialsSchema } from "../lib/auth-schema";

describe("credentials schema", () => {
  it("accepts valid email/password", () => {
    const parsed = credentialsSchema.safeParse({ email: "demo@example.com", password: "123456" });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const parsed = credentialsSchema.safeParse({ email: "bad", password: "123456" });
    expect(parsed.success).toBe(false);
  });

  it("rejects short password", () => {
    const parsed = credentialsSchema.safeParse({ email: "demo@example.com", password: "123" });
    expect(parsed.success).toBe(false);
  });
});
