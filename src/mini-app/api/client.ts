import { getInitData } from "../telegram";
import type { DashboardData, ObservationsResponse, HistoryPoint, AnalyticsData, HabitData, HabitsGrouped, HabitStats, HeatmapDay, CreateHabitPayload, HabitCorrelation, BalanceOverview, RadarData, BalanceAreaDetail, AlgorithmData, ReflectionStatusData, ReflectionsPaginated, MissionData, GoalData, StrategyData, EnergyCheckinResponse, AppConfig, SettingsData, NotificationPrefs } from "./types";

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

async function put<T>(path: string, body: unknown): Promise<T> {
  const initData = getInitData();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (initData) headers["Authorization"] = `tma ${initData}`;
  const res = await fetch(`${BASE}${path}`, { method: "PUT", headers, body: JSON.stringify(body) });
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
  // Kaizen
  reflectionStatus: () => request<ReflectionStatusData>("/api/reflection/status"),
  algorithms: (params?: { lifeArea?: string; q?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.lifeArea) searchParams.set("lifeArea", params.lifeArea);
    if (params?.q) searchParams.set("q", params.q);
    const qs = searchParams.toString();
    return request<{ algorithms: AlgorithmData[] }>(`/api/algorithms${qs ? `?${qs}` : ""}`);
  },
  algorithm: (id: number) => request<AlgorithmData>(`/api/algorithms/${id}`),
  updateAlgorithm: (id: number, data: { title?: string; steps?: string[]; isActive?: boolean }) =>
    patch<AlgorithmData>(`/api/algorithms/${id}`, data),
  deleteAlgorithm: (id: number) => del<{ ok: boolean }>(`/api/algorithms/${id}`),
  reflections: (page?: number, limit?: number) =>
    request<ReflectionsPaginated>(`/api/reflections?page=${page || 1}&limit=${limit || 20}`),
  // Strategy
  strategy: () => request<StrategyData>("/api/strategy"),
  mission: () => request<MissionData>("/api/mission"),
  updateMission: (data: Partial<MissionData>) => put<MissionData>("/api/mission", data),
  goals: (params?: { lifeArea?: string; timeHorizon?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.lifeArea) qs.set("lifeArea", params.lifeArea);
    if (params?.timeHorizon) qs.set("timeHorizon", params.timeHorizon);
    if (params?.status) qs.set("status", params.status);
    const query = qs.toString();
    return request<GoalData[]>(`/api/goals${query ? `?${query}` : ""}`);
  },
  createGoal: (data: { lifeArea: string; title: string; description?: string; timeHorizon: string; period: string }) =>
    post<GoalData>("/api/goals", data),
  updateGoal: (id: number, data: { title?: string; description?: string; status?: string; progress?: number; currentValue?: number }) =>
    patch<GoalData>(`/api/goals/${id}`, data),
  updateGoalProgress: (id: number, data: { progress?: number; currentValue?: number }) =>
    patch<GoalData>(`/api/goals/${id}`, data),
  // Energy checkin
  submitEnergy: (data: { physical: number; mental: number; emotional: number; spiritual: number; logType: string }) =>
    post<EnergyCheckinResponse>("/api/energy", data),
  submitTriggers: (logId: number, data: { triggers: string[]; context?: string; energyType: string; direction: string }) =>
    post<{ ok: boolean; observationIds: number[] }>(`/api/energy/${logId}/triggers`, data),
  // Balance quick rate
  rateBalance: (ratings: Array<{ area: string; score: number; subScores?: Record<string, number> }>) =>
    post<{ ok: true; updated: number }>("/api/balance/rate", { ratings }),
  // Config
  appConfig: () => request<AppConfig>("/api/config"),
  // Settings
  settings: () => request<SettingsData>("/api/settings"),
  updateSettings: (data: Partial<{ timezone: string; notificationPrefs: Partial<NotificationPrefs>; vacationUntil: string | null; vacationReason: string | null }>) =>
    put<SettingsData>("/api/settings", data),
};
