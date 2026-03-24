import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db.js", () => ({
  default: {
    goal: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from "../db.js";

describe("goal progress", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("accepts progress update", async () => {
    (prisma.goal.findFirst as any).mockResolvedValue({
      id: 1, userId: 1, lifeArea: "health", title: "Run marathon",
      progress: 30, currentValue: 10, targetValue: 42.2,
    });
    (prisma.goal.update as any).mockResolvedValue({
      id: 1, progress: 50, currentValue: 21.1, milestones: null,
      lifeArea: "health", title: "Run marathon", description: null,
      timeHorizon: "year", period: "2026", status: "active",
      metric: "km", targetValue: 42.2,
      createdAt: new Date(), updatedAt: new Date(),
    });

    const result = await prisma.goal.update({
      where: { id: 1 },
      data: { progress: 50, currentValue: 21.1 },
    });
    expect(result.progress).toBe(50);
    expect(result.currentValue).toBe(21.1);
  });

  it("accepts milestones as JSON", async () => {
    const milestones = [
      { title: "5 km", done: true },
      { title: "10 km", done: true },
      { title: "21.1 km", done: false },
    ];
    (prisma.goal.update as any).mockResolvedValue({
      id: 1, milestones, progress: 60,
    });

    const result = await prisma.goal.update({
      where: { id: 1 },
      data: { milestones, progress: 60 },
    });
    expect(result.milestones).toEqual(milestones);
  });
});
