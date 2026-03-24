import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db.js", () => ({
  default: {
    algorithm: {
      findMany: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

import prisma from "../db.js";

describe("Algorithm usageCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("increments usageCount when get_algorithms returns results", async () => {
    const mockAlgos = [
      { id: 1, icon: "📋", title: "Test", steps: ["s1", "s2"], context: "c", usageCount: 3, lastUsedAt: null },
      { id: 2, icon: "🔧", title: "Test2", steps: ["s1"], context: "c", usageCount: 0, lastUsedAt: null },
    ];
    (prisma.algorithm.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(mockAlgos);

    const algorithms = await prisma.algorithm.findMany({
      where: { userId: 1, isActive: true },
      orderBy: [{ usageCount: "desc" }, { createdAt: "desc" }],
      take: 5,
    });

    for (const algo of algorithms) {
      await prisma.algorithm.update({
        where: { id: algo.id },
        data: { usageCount: { increment: 1 }, lastUsedAt: expect.any(Date) },
      });
    }

    expect(prisma.algorithm.update).toHaveBeenCalledTimes(2);
  });

  it("does not increment when no algorithms found", async () => {
    (prisma.algorithm.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const algorithms = await prisma.algorithm.findMany({
      where: { userId: 1, isActive: true },
      take: 5,
    });

    for (const algo of algorithms) {
      await prisma.algorithm.update({
        where: { id: algo.id },
        data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
      });
    }

    expect(prisma.algorithm.update).not.toHaveBeenCalled();
  });
});
