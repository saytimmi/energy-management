import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db.js", () => ({
  default: {
    energyLog: { findFirst: vi.fn(), count: vi.fn() },
    habit: { findMany: vi.fn(), count: vi.fn() },
    balanceRating: { findFirst: vi.fn() },
    mission: { findUnique: vi.fn() },
    goal: { findMany: vi.fn() },
    balanceGoal: { findMany: vi.fn() },
    reflection: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

import prisma from "../db.js";
import { getAwarenessGaps } from "../services/awareness.js";

describe("awareness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.energyLog.findFirst as any).mockResolvedValue(null);
    (prisma.energyLog.count as any).mockResolvedValue(0);
    (prisma.habit.findMany as any).mockResolvedValue([]);
    (prisma.habit.count as any).mockResolvedValue(0);
    (prisma.balanceRating.findFirst as any).mockResolvedValue(null);
    (prisma.mission.findUnique as any).mockResolvedValue(null);
    (prisma.goal.findMany as any).mockResolvedValue([]);
    (prisma.balanceGoal.findMany as any).mockResolvedValue([]);
    (prisma.reflection.findFirst as any).mockResolvedValue(null);
    (prisma.user.findUnique as any).mockResolvedValue({ id: 1, createdAt: new Date() });
  });

  it("detects no_energy gap when no energy logs exist", async () => {
    const gaps = await getAwarenessGaps(1);
    const noEnergy = gaps.find(g => g.type === "no_energy");
    expect(noEnergy).toBeDefined();
    expect(noEnergy!.priority).toBe(100);
  });

  it("detects no_habits gap when user has 0 habits", async () => {
    (prisma.energyLog.findFirst as any).mockResolvedValue({ id: 1, createdAt: new Date() });
    (prisma.energyLog.count as any).mockResolvedValue(3);
    const gaps = await getAwarenessGaps(1);
    const noHabits = gaps.find(g => g.type === "no_habits");
    expect(noHabits).toBeDefined();
    expect(noHabits!.priority).toBe(90);
  });

  it("detects stale_balance when ratings are older than 14 days", async () => {
    (prisma.energyLog.findFirst as any).mockResolvedValue({ id: 1, createdAt: new Date() });
    (prisma.energyLog.count as any).mockResolvedValue(5);
    (prisma.habit.count as any).mockResolvedValue(3);
    const staleDate = new Date(Date.now() - 18 * 24 * 60 * 60 * 1000);
    (prisma.balanceRating.findFirst as any).mockResolvedValue({ id: 1, createdAt: staleDate });
    const gaps = await getAwarenessGaps(1);
    const stale = gaps.find(g => g.type === "stale_balance");
    expect(stale).toBeDefined();
    expect(stale!.priority).toBe(70);
  });

  it("returns gaps sorted by priority descending", async () => {
    const gaps = await getAwarenessGaps(1);
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i - 1].priority).toBeGreaterThanOrEqual(gaps[i].priority);
    }
  });

  it("detects empty_meaning when habits have no whyToday", async () => {
    (prisma.energyLog.findFirst as any).mockResolvedValue({ id: 1, createdAt: new Date() });
    (prisma.energyLog.count as any).mockResolvedValue(5);
    (prisma.habit.count as any).mockResolvedValue(2);
    (prisma.habit.findMany as any).mockResolvedValue([
      { id: 1, name: "Test", whyToday: null, whyIdentity: null, type: "build", lifeArea: "health" },
    ]);
    (prisma.balanceRating.findFirst as any).mockResolvedValue({ id: 1, createdAt: new Date() });
    const gaps = await getAwarenessGaps(1);
    const empty = gaps.find(g => g.type === "empty_meaning");
    expect(empty).toBeDefined();
  });

  it("detects goal_without_habits", async () => {
    (prisma.energyLog.findFirst as any).mockResolvedValue({ id: 1, createdAt: new Date() });
    (prisma.energyLog.count as any).mockResolvedValue(5);
    (prisma.habit.count as any).mockResolvedValue(1);
    (prisma.habit.findMany as any).mockResolvedValue([
      { id: 1, name: "Test", lifeArea: "career", whyToday: "x", type: "build" },
    ]);
    (prisma.balanceRating.findFirst as any).mockResolvedValue({ id: 1, createdAt: new Date() });
    (prisma.goal.findMany as any).mockResolvedValue([
      { id: 1, lifeArea: "health", title: "Run", status: "active" },
    ]);
    const gaps = await getAwarenessGaps(1);
    const gwh = gaps.find(g => g.type === "goal_without_habits");
    expect(gwh).toBeDefined();
    expect(gwh!.area).toBe("health");
  });
});
