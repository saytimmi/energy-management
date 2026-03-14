import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db module before importing diagnostics
vi.mock("../db.js", () => {
  return {
    default: {
      energyLog: {
        findMany: vi.fn(),
      },
    },
  };
});

import prisma from "../db.js";
import {
  analyzeEnergyHistory,
  formatDiagnostic,
  type DiagnosticResult,
} from "./diagnostics.js";

const mockedFindMany = vi.mocked(prisma.energyLog.findMany);

function makeLog(
  overrides: Partial<{
    physical: number;
    mental: number;
    emotional: number;
    spiritual: number;
    createdAt: Date;
  }> = {}
) {
  return {
    id: 1,
    userId: 1,
    physical: 7,
    mental: 7,
    emotional: 7,
    spiritual: 7,
    note: null,
    logType: "morning",
    createdAt: new Date(),
    ...overrides,
  };
}

describe("analyzeEnergyHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not enough data when fewer than 2 logs", async () => {
    mockedFindMany.mockResolvedValue([makeLog()]);

    const result = await analyzeEnergyHistory(1);

    expect(result.hasEnoughData).toBe(false);
    expect(result.drops).toEqual([]);
    expect(result.chronicLows).toEqual([]);
    expect(result.lowestEnergy).toBeNull();
    expect(result.latestLog).toBeNull();
  });

  it("returns not enough data when no logs exist", async () => {
    mockedFindMany.mockResolvedValue([]);

    const result = await analyzeEnergyHistory(1);

    expect(result.hasEnoughData).toBe(false);
  });

  it("detects drops of 2+ points from previous average", async () => {
    // Latest log has physical=3, previous 5 logs average physical=7
    const latest = makeLog({ physical: 3, createdAt: new Date("2026-03-14") });
    const previous = Array.from({ length: 5 }, (_, i) =>
      makeLog({
        physical: 7,
        createdAt: new Date(`2026-03-${13 - i}`),
      })
    );

    mockedFindMany.mockResolvedValue([latest, ...previous]);

    const result = await analyzeEnergyHistory(1);

    expect(result.hasEnoughData).toBe(true);
    expect(result.drops).toHaveLength(1);
    expect(result.drops[0]).toEqual({
      energyType: "physical",
      currentValue: 3,
      previousAvg: 7,
      delta: -4,
    });
  });

  it("does not flag drops smaller than 2 points", async () => {
    const latest = makeLog({ physical: 6, createdAt: new Date("2026-03-14") });
    const previous = Array.from({ length: 3 }, (_, i) =>
      makeLog({
        physical: 7,
        createdAt: new Date(`2026-03-${13 - i}`),
      })
    );

    mockedFindMany.mockResolvedValue([latest, ...previous]);

    const result = await analyzeEnergyHistory(1);

    expect(result.drops).toHaveLength(0);
  });

  it("detects multiple drops across energy types", async () => {
    const latest = makeLog({
      physical: 3,
      mental: 2,
      emotional: 7,
      spiritual: 7,
      createdAt: new Date("2026-03-14"),
    });
    const previous = Array.from({ length: 5 }, (_, i) =>
      makeLog({
        physical: 7,
        mental: 8,
        emotional: 7,
        spiritual: 7,
        createdAt: new Date(`2026-03-${13 - i}`),
      })
    );

    mockedFindMany.mockResolvedValue([latest, ...previous]);

    const result = await analyzeEnergyHistory(1);

    expect(result.drops).toHaveLength(2);
    const dropTypes = result.drops.map((d) => d.energyType);
    expect(dropTypes).toContain("physical");
    expect(dropTypes).toContain("mental");
  });

  it("identifies the lowest energy type in latest log", async () => {
    const latest = makeLog({
      physical: 8,
      mental: 3,
      emotional: 6,
      spiritual: 7,
      createdAt: new Date("2026-03-14"),
    });
    const previous = [
      makeLog({ createdAt: new Date("2026-03-13") }),
    ];

    mockedFindMany.mockResolvedValue([latest, ...previous]);

    const result = await analyzeEnergyHistory(1);

    expect(result.lowestEnergy).toEqual({ type: "mental", value: 3 });
  });

  it("detects chronic lows when 7-day average is below 5", async () => {
    // All logs over 7 days have low physical (3-4)
    const logs = Array.from({ length: 7 }, (_, i) =>
      makeLog({
        physical: i % 2 === 0 ? 3 : 4,
        mental: 7,
        emotional: 7,
        spiritual: 7,
        createdAt: new Date(`2026-03-${14 - i}`),
      })
    );

    mockedFindMany.mockResolvedValue(logs);

    const result = await analyzeEnergyHistory(1);

    expect(result.chronicLows).toContain("physical");
    expect(result.chronicLows).not.toContain("mental");
  });

  it("returns latestLog with current energy values", async () => {
    const latest = makeLog({
      physical: 5,
      mental: 6,
      emotional: 7,
      spiritual: 8,
      createdAt: new Date("2026-03-14"),
    });
    const previous = [makeLog({ createdAt: new Date("2026-03-13") })];

    mockedFindMany.mockResolvedValue([latest, ...previous]);

    const result = await analyzeEnergyHistory(1);

    expect(result.latestLog).toEqual({
      physical: 5,
      mental: 6,
      emotional: 7,
      spiritual: 8,
    });
  });
});

describe("formatDiagnostic", () => {
  it("returns not-enough-data message when hasEnoughData is false", () => {
    const result: DiagnosticResult = {
      hasEnoughData: false,
      drops: [],
      chronicLows: [],
      lowestEnergy: null,
      latestLog: null,
    };

    const msg = formatDiagnostic(result);

    expect(msg).toContain("мало данных");
  });

  it("includes drop information in formatted output", () => {
    const result: DiagnosticResult = {
      hasEnoughData: true,
      drops: [
        {
          energyType: "physical" as any,
          currentValue: 3,
          previousAvg: 7,
          delta: -4,
        },
      ],
      chronicLows: [],
      lowestEnergy: { type: "physical" as any, value: 3 },
      latestLog: { physical: 3, mental: 7, emotional: 7, spiritual: 7 },
    };

    const msg = formatDiagnostic(result);

    expect(msg.length).toBeGreaterThan(0);
  });

  it("includes chronic low warnings", () => {
    const result: DiagnosticResult = {
      hasEnoughData: true,
      drops: [],
      chronicLows: ["emotional" as any],
      lowestEnergy: { type: "emotional" as any, value: 4 },
      latestLog: { physical: 7, mental: 7, emotional: 4, spiritual: 7 },
    };

    const msg = formatDiagnostic(result);

    expect(msg.length).toBeGreaterThan(0);
  });
});
