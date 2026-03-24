export type Severity = "critical" | "moderate" | "mild" | "stable" | "improved";

export interface EnergyValues {
  physical: number;
  mental: number;
  emotional: number;
  spiritual: number;
}

export interface SeverityChange {
  type: string;
  severity: Severity;
  current: number;
  prev: number;
  drop: number;
}

export interface SeverityResult {
  drops: SeverityChange[];
  improvements: SeverityChange[];
  stable: boolean;
}

export function getSeverity(current: number, previous: number): Severity {
  const drop = previous - current;
  if (current <= 3 && drop >= 3) return "critical";
  if (drop >= 4) return "critical";
  if (current <= 3 && drop >= 1) return "moderate";
  if (drop >= 2) return "moderate";
  if (drop === 1) return "mild";
  if (drop <= -2) return "improved";
  return "stable";
}

export const CRITICAL_TRIGGERS: Record<string, string[]> = {
  physical: ["Не спал", "Болезнь", "Перетренировка", "Голод", "Алкоголь"],
  mental: ["Выгорание", "Дедлайн", "Инфо-перегрузка", "Конфликт на работе"],
  emotional: ["Ссора", "Потеря", "Одиночество", "Тревога", "Подавленность"],
  spiritual: ["Всё бесполезно", "Кризис смысла", "Выгорание", "Пустота"],
};

export const MODERATE_TRIGGERS: Record<string, string[]> = {
  physical: ["Плохой сон", "Нет движения", "Плохая еда", "Устал"],
  mental: ["Долго за экраном", "Много задач", "Нет фокуса"],
  emotional: ["Конфликт", "Одиночество", "Стресс"],
  spiritual: ["Потеря смысла", "Рутина", "Нет прогресса"],
};

export const IMPROVED_TRIGGERS: Record<string, string[]> = {
  physical: ["Хороший сон", "Тренировка", "Здоровая еда", "Прогулка"],
  mental: ["Отдых от экранов", "Медитация", "Интересная задача"],
  emotional: ["Хорошее общение", "Смех", "Природа"],
  spiritual: ["Помог кому-то", "Осмысленная работа", "Благодарность"],
};

export function getTriggersForSeverity(severity: Severity, energyType: string): string[] {
  const map: Record<string, Record<string, string[]>> = {
    critical: CRITICAL_TRIGGERS,
    moderate: MODERATE_TRIGGERS,
    improved: IMPROVED_TRIGGERS,
  };
  return map[severity]?.[energyType] || [];
}

export function analyzeSeverity(
  current: EnergyValues,
  previous: EnergyValues | null,
): SeverityResult {
  if (!previous) return { drops: [], improvements: [], stable: true };

  const types = ["physical", "mental", "emotional", "spiritual"] as const;
  const drops: SeverityChange[] = [];
  const improvements: SeverityChange[] = [];

  for (const type of types) {
    const severity = getSeverity(current[type], previous[type]);
    const drop = previous[type] - current[type];
    if (severity === "critical" || severity === "moderate") {
      drops.push({ type, severity, current: current[type], prev: previous[type], drop });
    } else if (severity === "improved") {
      improvements.push({ type, severity, current: current[type], prev: previous[type], drop });
    }
  }

  return { drops, improvements, stable: drops.length === 0 && improvements.length === 0 };
}
