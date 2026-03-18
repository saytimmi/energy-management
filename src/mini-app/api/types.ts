export interface DashboardData {
  physical: number;
  mental: number;
  emotional: number;
  spiritual: number;
  loggedAt: string;
  streak: number;
}

export interface Observation {
  id: number;
  energyType: "physical" | "mental" | "emotional" | "spiritual";
  direction: "drop" | "rise" | "low" | "high" | "stable";
  trigger: string | null;
  recommendation: string | null;
  context: string | null;
  createdAt: string;
}

export interface ObservationsResponse {
  observations: Observation[];
  stats: { total: number };
}

export interface HistoryPoint {
  date: string;
  physical: number;
  mental: number;
  emotional: number;
  spiritual: number;
}

export interface AnalyticsData {
  hasEnoughData: boolean;
  insights: string | string[];
  stats: Record<string, unknown>;
}
