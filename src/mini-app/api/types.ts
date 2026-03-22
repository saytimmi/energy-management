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

export interface HabitData {
  id: number;
  name: string;
  icon: string;
  type: 'build' | 'break';
  routineSlot: 'morning' | 'afternoon' | 'evening';
  duration: number | null;
  energyType: string | null;
  lifeArea: string | null;
  stage: 'seed' | 'growth' | 'autopilot';
  streakCurrent: number;
  streakBest: number;
  consistency30d: number;
  freezesUsedThisWeek: number;
  completedToday: boolean;
  whyToday: string | null;
  whyMonth: string | null;
  whyYear: string | null;
  whyIdentity: string | null;
  isItBeneficial: string | null;
  breakTrigger: string | null;
  replacement: string | null;
  triggerAction: string | null;
  microActionId: string | null;
  stageUpdatedAt: string;
  createdAt: string;
}

export interface HabitStats {
  streakCurrent: number;
  streakBest: number;
  consistency30d: number;
  freezesRemaining: number;
  stage: string;
  heatmap: { date: string; completed: boolean }[];
}

export interface CreateHabitPayload {
  name: string;
  icon: string;
  type: 'build' | 'break';
  routineSlot: string;
  duration?: number;
  energyType?: string;
  lifeArea?: string;
  triggerAction?: string;
  whyToday?: string;
  whyMonth?: string;
  whyYear?: string;
  whyIdentity?: string;
  isItBeneficial?: string;
  breakTrigger?: string;
  replacement?: string;
  microActionId?: string;
}

export interface HabitsGrouped {
  morning: HabitData[];
  afternoon: HabitData[];
  evening: HabitData[];
}

export interface HeatmapDay {
  date: string;
  completedCount: number;
  totalCount: number;
}

export interface HabitCorrelation {
  insufficient?: boolean;
  physical?: number;
  mental?: number;
  emotional?: number;
  spiritual?: number;
  habitName?: string;
  habitIcon?: string;
}
