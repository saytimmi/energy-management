import { describe, it, expect } from "vitest";
import { getSeverity, getTriggersForSeverity, analyzeSeverity } from "../services/energy-analysis.js";

describe("energy-analysis", () => {
  describe("getSeverity", () => {
    it("returns critical when drop >= 4", () => {
      expect(getSeverity(3, 7)).toBe("critical");
    });

    it("returns critical when level <= 3 and drop >= 3", () => {
      expect(getSeverity(2, 5)).toBe("critical");
    });

    it("returns moderate when drop 2-3", () => {
      expect(getSeverity(5, 7)).toBe("moderate");
    });

    it("returns improved when rise >= 2", () => {
      expect(getSeverity(8, 6)).toBe("improved");
    });

    it("returns stable when no significant change", () => {
      expect(getSeverity(7, 7)).toBe("stable");
    });

    it("returns mild when drop is 1", () => {
      expect(getSeverity(6, 7)).toBe("mild");
    });
  });

  describe("getTriggersForSeverity", () => {
    it("returns critical triggers for critical severity", () => {
      const triggers = getTriggersForSeverity("critical", "physical");
      expect(triggers).toContain("Не спал");
      expect(triggers.length).toBeGreaterThan(0);
    });

    it("returns improved triggers for improved severity", () => {
      const triggers = getTriggersForSeverity("improved", "mental");
      expect(triggers).toContain("Медитация");
    });

    it("returns empty for stable severity", () => {
      const triggers = getTriggersForSeverity("stable", "physical");
      expect(triggers).toEqual([]);
    });
  });

  describe("analyzeSeverity", () => {
    it("detects critical drops", () => {
      const current = { physical: 3, mental: 7, emotional: 7, spiritual: 7 };
      const previous = { physical: 8, mental: 7, emotional: 7, spiritual: 7 };
      const result = analyzeSeverity(current, previous);
      expect(result.drops.length).toBe(1);
      expect(result.drops[0].type).toBe("physical");
      expect(result.drops[0].severity).toBe("critical");
    });

    it("detects improvements", () => {
      const current = { physical: 8, mental: 7, emotional: 7, spiritual: 7 };
      const previous = { physical: 5, mental: 7, emotional: 7, spiritual: 7 };
      const result = analyzeSeverity(current, previous);
      expect(result.improvements.length).toBe(1);
      expect(result.improvements[0].type).toBe("physical");
    });

    it("returns stable when no previous data", () => {
      const current = { physical: 5, mental: 5, emotional: 5, spiritual: 5 };
      const result = analyzeSeverity(current, null);
      expect(result.drops.length).toBe(0);
      expect(result.improvements.length).toBe(0);
      expect(result.stable).toBe(true);
    });

    it("detects multiple changes", () => {
      const current = { physical: 3, mental: 9, emotional: 5, spiritual: 5 };
      const previous = { physical: 7, mental: 6, emotional: 5, spiritual: 5 };
      const result = analyzeSeverity(current, previous);
      expect(result.drops.length).toBe(1);
      expect(result.improvements.length).toBe(1);
      expect(result.stable).toBe(false);
    });
  });
});
