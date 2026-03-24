import { describe, it, expect } from "vitest";

describe("mission API", () => {
  it("should export missionRoute", async () => {
    const mod = await import("../api/mission.js");
    expect(mod.missionRoute).toBeDefined();
    expect(typeof mod.missionRoute).toBe("function");
  });
});
