import { signal } from "@preact/signals";
import { api } from "../api/client";
import type { Observation } from "../api/types";

export const kaizenObservations = signal<Observation[]>([]);
export const kaizenLoading = signal(false);
export const kaizenError = signal(false);

export async function loadKaizenData() {
  kaizenLoading.value = true;
  kaizenError.value = false;
  try {
    const data = await api.observations();
    kaizenObservations.value = data.observations;
  } catch {
    kaizenError.value = true;
  } finally {
    kaizenLoading.value = false;
  }
}
