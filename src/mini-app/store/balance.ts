import { signal } from "@preact/signals";
import { api } from "../api/client";
import type { BalanceOverview, RadarData, BalanceAreaDetail } from "../api/types";

export const balanceOverview = signal<BalanceOverview | null>(null);
export const radarData = signal<RadarData | null>(null);
export const balanceDetail = signal<BalanceAreaDetail | null>(null);
export const balanceLoading = signal(false);
export const balanceError = signal(false);

let lastFetchedAt = 0;
const CACHE_TTL = 30_000;

export async function loadBalanceOverview(): Promise<void> {
  const now = Date.now();
  if (lastFetchedAt && now - lastFetchedAt < CACHE_TTL && balanceOverview.value) return;

  if (!balanceOverview.value) balanceLoading.value = true;
  balanceError.value = false;
  try {
    const [overview, radar] = await Promise.all([
      api.balance(),
      api.balanceRadar(),
    ]);
    balanceOverview.value = overview;
    radarData.value = radar;
    lastFetchedAt = Date.now();
  } catch {
    balanceError.value = true;
  } finally {
    balanceLoading.value = false;
  }
}

export async function loadBalanceArea(area: string): Promise<void> {
  balanceLoading.value = true;
  balanceError.value = false;
  try {
    balanceDetail.value = await api.balanceArea(area);
  } catch {
    balanceError.value = true;
  } finally {
    balanceLoading.value = false;
  }
}

export function resetBalanceCache(): void {
  lastFetchedAt = 0;
  balanceOverview.value = null;
  radarData.value = null;
  balanceDetail.value = null;
}
