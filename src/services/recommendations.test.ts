import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("../db.js", () => ({
  default: {
    energyLog: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../knowledge/index.js", () => ({
  getRecoveryPractices: vi.fn(),
}));

vi.mock("./ai.js", () => ({
  personalizeRecommendation: vi.fn(),
}));

import { getRecoveryPractices } from "../knowledge/index.js";
import { personalizeRecommendation } from "./ai.js";
import prisma from "../db.js";
import type { DiagnosticResult } from "./diagnostics.js";
import type { Practice } from "../knowledge/types.js";
import {
  getRecommendations,
  formatRecommendations,
  type Recommendation,
} from "./recommendations.js";

const mockedGetPractices = vi.mocked(getRecoveryPractices);
const mockedPersonalize = vi.mocked(personalizeRecommendation);
const mockedFindMany = vi.mocked(prisma.energyLog.findMany);

function makePractice(
  id: string,
  name: string,
  energyType: string,
  description = "Test description"
): Practice {
  return { id, name, description, energyType } as Practice;
}

describe("getRecommendations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFindMany.mockResolvedValue([]);
  });

  it("returns correct-type practices for detected drops", async () => {
    const diagnostic: DiagnosticResult = {
      hasEnoughData: true,
      drops: [
        { energyType: "physical" as any, currentValue: 3, previousAvg: 7, delta: -4 },
      ],
      chronicLows: [],
      lowestEnergy: { type: "physical" as any, value: 3 },
      latestLog: { physical: 3, mental: 7, emotional: 7, spiritual: 7 },
    };

    mockedGetPractices.mockReturnValue([
      makePractice("phys-1", "Sleep", "physical"),
      makePractice("phys-2", "Walk", "physical"),
    ]);
    mockedPersonalize.mockResolvedValue("Personalized tip");

    const recs = await getRecommendations(diagnostic, 1);

    expect(recs.length).toBeGreaterThan(0);
    expect(recs.every((r) => r.energyType === "physical")).toBe(true);
    expect(recs[0].practice.energyType).toBe("physical");
  });

  it("returns no cross-type practices", async () => {
    const diagnostic: DiagnosticResult = {
      hasEnoughData: true,
      drops: [
        { energyType: "mental" as any, currentValue: 2, previousAvg: 7, delta: -5 },
      ],
      chronicLows: [],
      lowestEnergy: { type: "mental" as any, value: 2 },
      latestLog: { physical: 7, mental: 2, emotional: 7, spiritual: 7 },
    };

    mockedGetPractices.mockReturnValue([
      makePractice("mental-1", "Reading", "mental"),
    ]);
    mockedPersonalize.mockResolvedValue("Tip");

    const recs = await getRecommendations(diagnostic, 1);

    for (const rec of recs) {
      expect(rec.practice.energyType).toBe(rec.energyType);
    }
  });

  it("uses practice description as fallback when AI fails", async () => {
    const diagnostic: DiagnosticResult = {
      hasEnoughData: true,
      drops: [
        { energyType: "emotional" as any, currentValue: 3, previousAvg: 7, delta: -4 },
      ],
      chronicLows: [],
      lowestEnergy: { type: "emotional" as any, value: 3 },
      latestLog: { physical: 7, mental: 7, emotional: 3, spiritual: 7 },
    };

    const practice = makePractice("emo-1", "Journaling", "emotional", "Write your feelings");
    mockedGetPractices.mockReturnValue([practice]);
    mockedPersonalize.mockRejectedValue(new Error("AI down"));

    const recs = await getRecommendations(diagnostic, 1);

    expect(recs.length).toBeGreaterThan(0);
    expect(recs[0].personalizedTip).toBe("Write your feelings");
  });

  it("caps total recommendations at 3", async () => {
    const diagnostic: DiagnosticResult = {
      hasEnoughData: true,
      drops: [
        { energyType: "physical" as any, currentValue: 2, previousAvg: 7, delta: -5 },
        { energyType: "mental" as any, currentValue: 2, previousAvg: 7, delta: -5 },
        { energyType: "emotional" as any, currentValue: 2, previousAvg: 7, delta: -5 },
      ],
      chronicLows: ["spiritual" as any],
      lowestEnergy: { type: "physical" as any, value: 2 },
      latestLog: { physical: 2, mental: 2, emotional: 2, spiritual: 4 },
    };

    mockedGetPractices.mockImplementation((type: any) => [
      makePractice(`${type}-1`, `Practice 1`, type),
      makePractice(`${type}-2`, `Practice 2`, type),
    ]);
    mockedPersonalize.mockResolvedValue("Tip");

    const recs = await getRecommendations(diagnostic, 1);

    expect(recs.length).toBeLessThanOrEqual(3);
  });

  it("returns maintenance tip when no drops but lowestEnergy exists", async () => {
    const diagnostic: DiagnosticResult = {
      hasEnoughData: true,
      drops: [],
      chronicLows: [],
      lowestEnergy: { type: "spiritual" as any, value: 5 },
      latestLog: { physical: 8, mental: 7, emotional: 6, spiritual: 5 },
    };

    mockedGetPractices.mockReturnValue([
      makePractice("spir-1", "Meditation", "spiritual"),
    ]);
    mockedPersonalize.mockResolvedValue("Tip");

    const recs = await getRecommendations(diagnostic, 1);

    expect(recs.length).toBe(1);
    expect(recs[0].energyType).toBe("spiritual");
  });

  it("returns empty array when no data at all", async () => {
    const diagnostic: DiagnosticResult = {
      hasEnoughData: false,
      drops: [],
      chronicLows: [],
      lowestEnergy: null,
      latestLog: null,
    };

    const recs = await getRecommendations(diagnostic, 1);

    expect(recs).toEqual([]);
  });
});

describe("formatRecommendations", () => {
  it("returns empty string for empty recommendations", () => {
    expect(formatRecommendations([])).toBe("");
  });

  it("formats recommendations with energy type and practice name", () => {
    const recs: Recommendation[] = [
      {
        energyType: "physical" as any,
        practice: makePractice("p1", "Sleep", "physical"),
        personalizedTip: "You need more sleep based on your pattern",
        reason: "Физическая энергия упала на 4 пункта",
      },
    ];

    const output = formatRecommendations(recs);

    expect(output).toContain("Sleep");
    expect(output).toContain("Физическая");
    expect(output.length).toBeGreaterThan(0);
  });
});
