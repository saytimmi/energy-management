import { getInitData } from "../telegram";
import type { DashboardData, ObservationsResponse, HistoryPoint, AnalyticsData, HabitData, HabitsGrouped, HabitStats, HeatmapDay, CreateHabitPayload, HabitCorrelation, BalanceOverview, RadarData, BalanceAreaDetail } from "./types";

const BASE = "";

async function post<T>(path: string, body: unknown): Promise<T> {
  const initData = getInitData();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (initData) headers["Authorization"] = `tma ${initData}`;
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const initData = getInitData();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (initData) headers["Authorization"] = `tma ${initData}`;
  const res = await fetch(`${BASE}${path}`, { method: "PATCH", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

async function del<T>(path: string): Promise<T> {
  const initData = getInitData();
  const headers: Record<string, string> = {};
  if (initData) headers["Authorization"] = `tma ${initData}`;
  const res = await fetch(`${BASE}${path}`, { method: "DELETE", headers });
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json();
}

async function request<T>(path: string): Promise<T> {
  const initData = getInitData();
  const headers: Record<string, string> = {};
  if (initData) {
    headers["Authorization"] = `tma ${initData}`;
  }
  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

export const api = {
  dashboard: () => request<DashboardData>("/api/dashboard"),
  observations: () => request<ObservationsResponse>("/api/observations"),
  history: (period: "week" | "month") => request<HistoryPoint[]>(`/api/history?period=${period}`),
  analytics: () => request<AnalyticsData>("/api/analytics"),
  triggerCheckin: () => request<{ ok: boolean }>("/api/checkin-trigger"),
  habits: () => request<HabitsGrouped>("/api/habits"),
  createHabit: (data: CreateHabitPayload) => post<HabitData>("/api/habits", data),
  startHabit: (id: number) => post<{ ok: boolean }>(`/api/habits/${id}/start`, {}),
  completeHabit: (id: number, note?: string) => post<{ ok: boolean }>(`/api/habits/${id}/complete`, note ? { note } : {}),
  uncompleteHabit: (id: number) => del<{ ok: boolean }>(`/api/habits/${id}/complete`),
  habitStats: (id: number) => request<HabitStats>(`/api/habits/${id}/stats`),
  habitsHeatmap: () => request<HeatmapDay[]>("/api/habits/heatmap"),
  habitCorrelation: (id: number) => request<HabitCorrelation>(`/api/habits/${id}/correlation`),
  updateHabit: (id: number, data: Partial<CreateHabitPayload>) => patch<HabitData>(`/api/habits/${id}`, data),
  deleteHabit: (id: number) => del<{ ok: boolean }>(`/api/habits/${id}`),
  pauseHabit: (id: number, days: number) => post<HabitData>(`/api/habits/${id}/pause`, { days }),
  resumeHabit: (id: number) => post<HabitData>(`/api/habits/${id}/resume`, {}),
  balance: () => request<BalanceOverview>("/api/balance"),
  balanceRadar: () => request<RadarData>("/api/balance/radar"),
  balanceArea: (area: string) => request<BalanceAreaDetail>(`/api/balance/${area}`),
  setBalanceGoal: (data: { area: string; targetScore?: number; identity?: string; isFocus?: boolean }) =>
    post<{ ok: boolean }>("/api/balance/goals", data),
};
