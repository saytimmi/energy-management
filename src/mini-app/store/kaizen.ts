import { signal, computed } from "@preact/signals";
import { api } from "../api/client";
import type { AlgorithmData, ReflectionData, ReflectionStatusData, Observation, WeeklyDigestData } from "../api/types";

// Reflection status
export const reflectionStatus = signal<ReflectionStatusData | null>(null);
export const reflectionStatusLoading = signal(false);

// Algorithms
export const algorithms = signal<AlgorithmData[]>([]);
export const algorithmsLoading = signal(false);
export const algorithmsSearch = signal("");

// Reflections feed
export const reflections = signal<ReflectionData[]>([]);
export const reflectionsLoading = signal(false);
export const reflectionsPage = signal(1);
export const reflectionsTotal = signal(0);
export const reflectionsHasMore = computed(() => {
  return reflections.value.length < reflectionsTotal.value;
});

// Observations (migrated from journal)
export const kaizenObservations = signal<Observation[]>([]);

// Weekly digests
export const digests = signal<WeeklyDigestData[]>([]);
export const digestsLoading = signal(false);

// Errors
export const kaizenError = signal(false);

// Combined loading state
export const kaizenLoading = computed(() =>
  reflectionStatusLoading.value || algorithmsLoading.value || reflectionsLoading.value
);

export async function loadReflectionStatus(): Promise<void> {
  reflectionStatusLoading.value = true;
  try {
    reflectionStatus.value = await api.reflectionStatus();
  } catch {
    console.error("Failed to load reflection status");
  } finally {
    reflectionStatusLoading.value = false;
  }
}

export async function loadAlgorithms(search?: string): Promise<void> {
  algorithmsLoading.value = true;
  try {
    const params = search ? { q: search } : undefined;
    const data = await api.algorithms(params);
    algorithms.value = data.algorithms;
  } catch {
    console.error("Failed to load algorithms");
  } finally {
    algorithmsLoading.value = false;
  }
}

export async function loadReflections(page = 1): Promise<void> {
  reflectionsLoading.value = true;
  try {
    const data = await api.reflections(page, 20);
    if (page === 1) {
      reflections.value = data.reflections;
    } else {
      reflections.value = [...reflections.value, ...data.reflections];
    }
    reflectionsPage.value = data.pagination.page;
    reflectionsTotal.value = data.pagination.total;
  } catch {
    console.error("Failed to load reflections");
  } finally {
    reflectionsLoading.value = false;
  }
}

export async function loadMoreReflections(): Promise<void> {
  if (!reflectionsHasMore.value || reflectionsLoading.value) return;
  await loadReflections(reflectionsPage.value + 1);
}

export async function loadObservations(): Promise<void> {
  try {
    const data = await api.observations();
    kaizenObservations.value = data.observations;
  } catch {
    console.error("Failed to load observations");
  }
}

export async function deleteAlgorithm(id: number): Promise<boolean> {
  try {
    await api.deleteAlgorithm(id);
    algorithms.value = algorithms.value.filter((a) => a.id !== id);
    return true;
  } catch {
    console.error("Failed to delete algorithm");
    return false;
  }
}

export async function loadDigests(): Promise<void> {
  digestsLoading.value = true;
  try {
    digests.value = await api.digests();
  } catch (err) {
    console.error("Failed to load digests:", err);
  } finally {
    digestsLoading.value = false;
  }
}

export async function loadKaizenData(): Promise<void> {
  kaizenError.value = false;
  try {
    await Promise.all([
      loadReflectionStatus(),
      loadAlgorithms(),
      loadReflections(),
      loadObservations(),
      loadDigests(),
    ]);
  } catch {
    kaizenError.value = true;
  }
}
