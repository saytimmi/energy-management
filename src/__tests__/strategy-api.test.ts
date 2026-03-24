import { describe, it, expect } from "vitest";

describe("strategy API", () => {
  it("should export strategyRoute", async () => {
    const mod = await import("../api/strategy.js");
    expect(mod.strategyRoute).toBeDefined();
    expect(typeof mod.strategyRoute).toBe("function");
  });
});
