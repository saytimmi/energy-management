import prisma from "../db.js";
import { EnergyType } from "../knowledge/types.js";

export interface EnergyDrop {
  energyType: EnergyType;
  currentValue: number;
  previousAvg: number;
  delta: number;
}

export interface DiagnosticResult {
  hasEnoughData: boolean;
  drops: EnergyDrop[];
  chronicLows: EnergyType[];
  lowestEnergy: { type: EnergyType; value: number } | null;
  latestLog: {
    physical: number;
    mental: number;
    emotional: number;
    spiritual: number;
  } | null;
}

const ENERGY_TYPES: EnergyType[] = [
  EnergyType.physical,
  EnergyType.mental,
  EnergyType.emotional,
  EnergyType.spiritual,
];

const ENERGY_TYPE_LABELS: Record<EnergyType, string> = {
  [EnergyType.physical]: "Физическая",
  [EnergyType.mental]: "Ментальная",
  [EnergyType.emotional]: "Эмоциональная",
  [EnergyType.spiritual]: "Духовная",
};

function getEnergyValue(
  log: { physical: number; mental: number; emotional: number; spiritual: number },
  type: EnergyType
): number {
  return log[type];
}

function levelIndicator(value: number): string {
  if (value >= 7) return "\u{1F7E2}"; // green circle
  if (value >= 4) return "\u{1F7E1}"; // yellow circle
  return "\u{1F534}"; // red circle
}

export async function analyzeEnergyHistory(
  userId: number
): Promise<DiagnosticResult> {
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const logs = await prisma.energyLog.findMany({
    where: {
      userId,
      createdAt: { gte: fourteenDaysAgo },
    },
    orderBy: { createdAt: "desc" },
  });

  if (logs.length < 2) {
    return {
      hasEnoughData: false,
      drops: [],
      chronicLows: [],
      lowestEnergy: null,
      latestLog: null,
    };
  }

  const latest = logs[0];
  const previousLogs = logs.slice(1, 6); // up to 5 prior logs

  // Compute previous averages
  const drops: EnergyDrop[] = [];

  for (const type of ENERGY_TYPES) {
    const currentValue = getEnergyValue(latest, type);
    const prevValues = previousLogs.map((l) => getEnergyValue(l, type));
    const previousAvg = Math.round(
      (prevValues.reduce((sum, v) => sum + v, 0) / prevValues.length) * 10
    ) / 10;

    const delta = currentValue - previousAvg;

    if (delta <= -2) {
      drops.push({
        energyType: type,
        currentValue,
        previousAvg: Math.round(previousAvg),
        delta: Math.round(delta),
      });
    }
  }

  // Chronic lows: 7-day average below 5 (relative to latest log)
  const latestDate = logs.length > 0 ? logs[0].createdAt : new Date();
  const sevenDaysAgo = new Date(latestDate);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentLogs = logs.filter((l) => l.createdAt >= sevenDaysAgo);

  const chronicLows: EnergyType[] = [];

  if (recentLogs.length > 0) {
    for (const type of ENERGY_TYPES) {
      const values = recentLogs.map((l) => getEnergyValue(l, type));
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
      if (avg < 5) {
        chronicLows.push(type);
      }
    }
  }

  // Find lowest energy type in latest log
  let lowestType = ENERGY_TYPES[0];
  let lowestValue = getEnergyValue(latest, ENERGY_TYPES[0]);

  for (const type of ENERGY_TYPES.slice(1)) {
    const val = getEnergyValue(latest, type);
    if (val < lowestValue) {
      lowestType = type;
      lowestValue = val;
    }
  }

  return {
    hasEnoughData: true,
    drops,
    chronicLows,
    lowestEnergy: { type: lowestType, value: lowestValue },
    latestLog: {
      physical: latest.physical,
      mental: latest.mental,
      emotional: latest.emotional,
      spiritual: latest.spiritual,
    },
  };
}

export function formatDiagnostic(result: DiagnosticResult): string {
  if (!result.hasEnoughData) {
    return "Пока мало данных для анализа. Продолжай отмечать энергию!";
  }

  const lines: string[] = [];
  lines.push("<b>Анализ энергии</b>\n");

  // Current levels
  if (result.latestLog) {
    lines.push("Текущие уровни:");
    for (const type of ENERGY_TYPES) {
      const value = getEnergyValue(result.latestLog, type);
      lines.push(`${levelIndicator(value)} ${ENERGY_TYPE_LABELS[type]}: ${value}/10`);
    }
    lines.push("");
  }

  // Drops
  if (result.drops.length > 0) {
    lines.push("<b>Снижение энергии:</b>");
    for (const drop of result.drops) {
      lines.push(
        `${ENERGY_TYPE_LABELS[drop.energyType]}: ${drop.currentValue} (было ~${drop.previousAvg}, ${drop.delta})`
      );
    }
    lines.push("");
  }

  // Chronic lows
  if (result.chronicLows.length > 0) {
    lines.push("<b>Хронически низкие (за 7 дней):</b>");
    for (const type of result.chronicLows) {
      lines.push(`\u{1F534} ${ENERGY_TYPE_LABELS[type]}`);
    }
    lines.push("");
  }

  // Lowest
  if (result.lowestEnergy) {
    lines.push(
      `Наиболее уязвимая область: <b>${ENERGY_TYPE_LABELS[result.lowestEnergy.type]}</b> (${result.lowestEnergy.value}/10)`
    );
  }

  return lines.join("\n");
}
