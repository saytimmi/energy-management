import { getInitData } from "../telegram";
import type { DashboardData, ObservationsResponse, HistoryPoint, AnalyticsData } from "./types";

const BASE = "";

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
};
