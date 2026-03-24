import { signal } from "@preact/signals";
import { api } from "../api/client";
import type { StrategyData, MissionData } from "../api/types";

export const strategyData = signal<StrategyData | null>(null);
export const strategyLoading = signal(false);
export const strategyError = signal(false);
export const botUsername = signal<string>("energy_coach_bot");

export async function loadAppConfig() {
  try {
    const cfg = await api.appConfig();
    botUsername.value = cfg.botUsername;
  } catch {}
}

export async function loadStrategy() {
  strategyLoading.value = true;
  strategyError.value = false;
  try {
    const data = await api.strategy();
    strategyData.value = data;
  } catch {
    strategyError.value = true;
  } finally {
    strategyLoading.value = false;
  }
}

export async function updateMission(data: Partial<MissionData>) {
  try {
    const updated = await api.updateMission(data);
    if (strategyData.value) {
      strategyData.value = { ...strategyData.value, mission: updated };
    }
    return updated;
  } catch (err) {
    console.error("Failed to update mission:", err);
    throw err;
  }
}
