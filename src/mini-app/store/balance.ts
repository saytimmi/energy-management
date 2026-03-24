import { signal } from "@preact/signals";
import { api } from "../api/client";
import type { BalanceOverview, RadarData, BalanceAreaDetail } from "../api/types";

export const balanceOverview = signal<BalanceOverview | null>(null);
export const radarData = signal<RadarData | null>(null);
export const balanceDetail = signal<BalanceAreaDetail | null>(null);
export const balanceLoading = signal(false);
export const balanceError = signal(false);

let overviewLoaded = false;

export async function loadBalanceOverview(): Promise<void> {
  if (overviewLoaded && balanceOverview.value) return;
  balanceLoading.value = true;
  balanceError.value = false;
  try {
    const [overview, radar] = await Promise.all([
      api.balance(),
      api.balanceRadar(),
    ]);
    balanceOverview.value = overview;
    radarData.value = radar;
    overviewLoaded = true;
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
  overviewLoaded = false;
  balanceOverview.value = null;
  radarData.value = null;
  balanceDetail.value = null;
}
