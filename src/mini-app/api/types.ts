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
  strength: number;
  gracePeriod: number;
  gracesUsed: number;
  isDuration: boolean;
  completedToday: boolean;
  inProgress?: boolean;
  startedAt?: string | null;
  isPaused?: boolean;
  pausedUntil?: string | null;
  minimalDose?: string | null;
  whyToday: string | null;
  whyMonth: string | null;
  whyYear: string | null;
  whyIdentity: string | null;
  isItBeneficial: string | null;
  breakTrigger: string | null;
  replacement: string | null;
  triggerAction: string | null;
  microActionId: string | null;
  sortOrder: number;
  stageUpdatedAt: string;
  createdAt: string;
}

export interface HabitStats {
  streakCurrent: number;
  streakBest: number;
  consistency30d: number;
  freezesRemaining: number;
  gracePeriod: number;
  gracesUsed: number;
  strength: number;
  stage: string;
  pausedAt: string | null;
  pausedUntil: string | null;
  heatmap: { date: string; completed: boolean }[];
}

export interface CreateHabitPayload {
  name: string;
  icon: string;
  type: 'build' | 'break';
  routineSlot: string;
  duration?: number;
  isDuration?: boolean;
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
  minimalDose?: string;
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

// --- Balance ---

export interface BalanceAreaSummary {
  area: string;
  label: string;
  icon: string;
  score: number | null;
  targetScore: number | null;
  identity: string | null;
  isFocus: boolean;
  habitCount: number;
  lastRatedAt: string | null;
  assessmentType: string | null;
}

export interface BalanceOverview {
  areas: BalanceAreaSummary[];
  avgScore: number | null;
  ratedCount: number;
  totalCount: number;
  lastAssessmentDate: string | null;
}

export interface RadarPoint {
  area: string;
  label: string;
  icon: string;
  score: number;
  targetScore: number | null;
  isFocus: boolean;
}

export interface RadarData {
  points: RadarPoint[];
}

export interface BalanceAspect {
  key: string;
  label: string;
  score: number | null;
}

export interface BalanceAreaHabit {
  id: number;
  name: string;
  icon: string;
  streakCurrent: number;
  consistency30d: number;
  stage: string;
  isDuration: boolean;
}

export interface BalanceHistoryEntry {
  score: number;
  note: string | null;
  subScores: Record<string, number> | null;
  assessmentType: string;
  createdAt: string;
}

export interface BalanceAreaDetail {
  area: string;
  label: string;
  icon: string;
  score: number | null;
  subScores: Record<string, number> | null;
  aspects: BalanceAspect[];
  assessmentType: string | null;
  note: string | null;
  lastRatedAt: string | null;
  targetScore: number | null;
  identity: string | null;
  isFocus: boolean;
  habits: BalanceAreaHabit[];
  autoMetrics: Record<string, number | null>;
  history: BalanceHistoryEntry[];
}

// --- Kaizen ---

export interface AlgorithmData {
  id: number;
  title: string;
  icon: string;
  lifeArea: string | null;
  steps: string[];
  context: string | null;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  sourceReflection?: {
    id: number;
    date: string;
    summary: string;
  } | null;
}

export interface ReflectionData {
  id: number;
  date: string;
  summary: string;
  insights: string[] | null;
  energyContext?: string | null;
  habitsContext?: string | null;
  algorithms: { id: number; title: string; icon: string }[];
  createdAt: string;
}

export interface ReflectionStatusData {
  done: boolean;
  reflection: {
    id: number;
    summary: string;
    insights: string[] | null;
    createdAt: string;
  } | null;
  context: {
    date: string;
    energy: {
      physical: number;
      mental: number;
      emotional: number;
      spiritual: number;
      logType: string;
      createdAt: string;
    }[];
    habits: {
      completed: { name: string; icon: string; slot: string }[];
      total: number;
    };
    observations: {
      energyType: string;
      direction: string;
      trigger: string | null;
      context: string | null;
    }[];
  };
}

export interface ReflectionsPaginated {
  reflections: ReflectionData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// --- Strategy types ---

export interface MissionData {
  identity: string | null;
  purpose: string | null;
  legacy: string | null;
  statement: string | null;
  updatedAt?: string;
}

export interface GoalData {
  id: number;
  lifeArea: string;
  title: string;
  description: string | null;
  timeHorizon: "year" | "quarter";
  period: string;
  status: "active" | "completed" | "dropped";
  createdAt: string;
  updatedAt: string;
}

export interface StrategyHabit {
  id: number;
  name: string;
  icon: string;
  streak: number;
  consistency: number;
}

export interface StrategyGoal {
  id: number;
  title: string;
  description: string | null;
  period: string;
  status: string;
}

export interface StrategyArea {
  area: string;
  label: string;
  icon: string;
  score: number | null;
  targetScore: number | null;
  identity: string | null;
  isFocus: boolean;
  yearGoals: StrategyGoal[];
  quarterGoals: StrategyGoal[];
  habits: StrategyHabit[];
}

export interface StrategyData {
  mission: MissionData | null;
  focusAreas: StrategyArea[];
  otherAreas: StrategyArea[];
}

// --- Energy Checkin ---

export interface SeverityChange {
  type: string;
  severity: string;
  current: number;
  prev: number;
  drop: number;
}

export interface EnergyCheckinResponse {
  logId: number;
  severity: {
    drops: SeverityChange[];
    improvements: SeverityChange[];
    stable: boolean;
  };
  recommendations: Array<{ name: string; duration: number }>;
  triggerInfo: {
    energyType: string;
    direction: string;
    triggers: string[];
  } | null;
}

export interface AppConfig {
  botUsername: string;
  webappUrl: string;
}
