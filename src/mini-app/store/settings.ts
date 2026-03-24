import { signal } from "@preact/signals";
import { api } from "../api/client";
import type { SettingsData } from "../api/types";

export const settingsData = signal<SettingsData | null>(null);
export const settingsLoading = signal(false);
export const settingsError = signal(false);

export async function loadSettings(): Promise<void> {
  settingsLoading.value = true;
  settingsError.value = false;
  try {
    settingsData.value = await api.settings();
  } catch {
    settingsError.value = true;
  } finally {
    settingsLoading.value = false;
  }
}

export async function updateSettings(data: Parameters<typeof api.updateSettings>[0]): Promise<boolean> {
  try {
    settingsData.value = await api.updateSettings(data);
    return true;
  } catch {
    return false;
  }
}
