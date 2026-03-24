import { describe, it, expect } from "vitest";

describe("goals API", () => {
  it("should export goalsRoute", async () => {
    const mod = await import("../api/goals.js");
    expect(mod.goalsRoute).toBeDefined();
    expect(typeof mod.goalsRoute).toBe("function");
  });
});
