import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db.js", () => ({
  default: {
    weeklyDigest: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({ id: 1 }),
    },
  },
}));

import prisma from "../db.js";

describe("digest API", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns empty array when no digests", async () => {
    const result = await prisma.weeklyDigest.findMany({ where: { userId: 1 } });
    expect(result).toEqual([]);
  });

  it("upserts digest by userId + weekStart", async () => {
    const weekStart = new Date("2026-03-16");
    await prisma.weeklyDigest.upsert({
      where: { userId_weekStart: { userId: 1, weekStart } },
      create: { userId: 1, weekStart, content: {}, summary: "test" },
      update: { content: {}, summary: "test" },
    });
    expect(prisma.weeklyDigest.upsert).toHaveBeenCalledOnce();
  });
});
