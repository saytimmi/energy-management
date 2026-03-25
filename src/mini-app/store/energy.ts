import { signal } from "@preact/signals";
import { api } from "../api/client";
import type { DashboardData, Observation, AnalyticsData } from "../api/types";

export const dashboardData = signal<DashboardData | null>(null);
export const observations = signal<Observation[]>([]);
export const analyticsData = signal<AnalyticsData | null>(null);
export const isLoading = signal(true);
export const hasError = signal(false);
export const hasNoData = signal(false);

let lastFetchedAt = 0;
const CACHE_TTL = 30_000; // 30 seconds

export function resetEnergyCache(): void {
  lastFetchedAt = 0;
  dashboardData.value = null;
  hasNoData.value = false;
}

export async function loadInitialData(): Promise<void> {
  // Stale-while-revalidate: show cached data, refresh in background
  const now = Date.now();
  if (lastFetchedAt && now - lastFetchedAt < CACHE_TTL && dashboardData.value) return;

  // Only show loading spinner on first load
  if (!dashboardData.value) isLoading.value = true;
  hasError.value = false;

  try {
    const [dashboard, obsData] = await Promise.all([
      api.dashboard().catch(() => null),
      api.observations().catch(() => ({ observations: [], stats: { total: 0 } })),
    ]);
    lastFetchedAt = Date.now();
    const noData = (!dashboard || "error" in dashboard) && obsData.stats.total === 0;
    if (noData) { hasNoData.value = true; isLoading.value = false; return; }
    if (dashboard && !("error" in dashboard)) { dashboardData.value = dashboard; }
    observations.value = obsData.observations;
    if (obsData.stats.total >= 3 && !analyticsData.value) {
      api.analytics().then((data) => { analyticsData.value = data; }).catch(() => {});
    }
    isLoading.value = false;
  } catch {
    hasError.value = true;
    isLoading.value = false;
  }
}
