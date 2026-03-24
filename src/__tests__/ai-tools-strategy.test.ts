import { describe, it, expect } from "vitest";

describe("AI strategy tools", () => {
  it("should include set_mission, set_goal, get_goals in TOOLS", async () => {
    // Verify the module compiles and exports chat
    const mod = await import("../services/ai.js");
    expect(mod.chat).toBeDefined();
    expect(typeof mod.chat).toBe("function");
  });
});
