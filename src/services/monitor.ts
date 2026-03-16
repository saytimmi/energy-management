import prisma from "../db.js";

/**
 * Track errors with deduplication (same source+message within 1 hour increments count)
 */
export async function trackError(source: string, error: unknown, context?: Record<string, unknown>): Promise<void> {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack?.slice(0, 500) : undefined;

    // Deduplicate: if same error in last hour, increment count
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const existing = await prisma.errorLog.findFirst({
      where: { source, message, createdAt: { gte: oneHourAgo } },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      await prisma.errorLog.update({
        where: { id: existing.id },
        data: { count: existing.count + 1 },
      });
    } else {
      await prisma.errorLog.create({
        data: {
          source,
          message,
          stack,
          context: context ? JSON.stringify(context) : undefined,
        },
      });
    }
  } catch {
    // Don't let monitoring break the app
  }
}

/**
 * Track a performance metric
 */
export async function trackMetric(name: string, value: number, tags?: Record<string, string>): Promise<void> {
  try {
    await prisma.metric.create({
      data: {
        name,
        value,
        tags: tags ? JSON.stringify(tags) : undefined,
      },
    });
  } catch {
    // Don't let monitoring break the app
  }
}

/**
 * Measure async operation duration and track it
 */
export async function measured<T>(name: string, fn: () => Promise<T>, tags?: Record<string, string>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    await trackMetric(name, Date.now() - start, tags);
    return result;
  } catch (error) {
    await trackMetric(name + "_error", Date.now() - start, tags);
    throw error;
  }
}
