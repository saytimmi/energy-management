import { EnergyType, type Practice } from "../knowledge/types.js";
import { getRecoveryPractices } from "../knowledge/index.js";
import { personalizeRecommendation } from "./ai.js";
import prisma from "../db.js";
import type { DiagnosticResult } from "./diagnostics.js";

const ENERGY_TYPE_LABELS: Record<EnergyType, string> = {
  [EnergyType.physical]: "Физическая",
  [EnergyType.mental]: "Ментальная",
  [EnergyType.emotional]: "Эмоциональная",
  [EnergyType.spiritual]: "Духовная",
};

const MAX_RECOMMENDATIONS = 3;

export interface Recommendation {
  energyType: EnergyType;
  practice: Practice;
  personalizedTip: string;
  reason: string;
}

async function buildUserContext(userId: number): Promise<string> {
  const recentLogs = await prisma.energyLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  if (recentLogs.length === 0) return "";

  const lines = recentLogs.map(
    (log) =>
      `Физ: ${log.physical}, Мент: ${log.mental}, Эмоц: ${log.emotional}, Дух: ${log.spiritual}`
  );

  return `Последние ${lines.length} записей энергии:\n${lines.join("\n")}`;
}

async function personalizePractice(
  practice: Practice,
  userContext: string
): Promise<string> {
  try {
    const tip = await personalizeRecommendation(
      practice.name,
      practice.description,
      userContext
    );
    return tip;
  } catch {
    return practice.description;
  }
}

export async function getRecommendations(
  diagnosticResult: DiagnosticResult,
  userId: number
): Promise<Recommendation[]> {
  if (!diagnosticResult.hasEnoughData) {
    return [];
  }

  const recommendations: Recommendation[] = [];
  const userContext = await buildUserContext(userId);
  const coveredTypes = new Set<EnergyType>();

  // 1. Recommendations for detected drops
  for (const drop of diagnosticResult.drops) {
    if (recommendations.length >= MAX_RECOMMENDATIONS) break;

    const practices = getRecoveryPractices(drop.energyType);
    const topPractices = practices.slice(0, 1); // top 1 per drop

    for (const practice of topPractices) {
      if (recommendations.length >= MAX_RECOMMENDATIONS) break;

      const personalizedTip = await personalizePractice(practice, userContext);

      recommendations.push({
        energyType: drop.energyType,
        practice,
        personalizedTip,
        reason: `${ENERGY_TYPE_LABELS[drop.energyType]} энергия упала на ${Math.abs(drop.delta)} пункта`,
      });
    }

    coveredTypes.add(drop.energyType);
  }

  // 2. Chronic lows not already covered by drops
  for (const type of diagnosticResult.chronicLows) {
    if (recommendations.length >= MAX_RECOMMENDATIONS) break;
    if (coveredTypes.has(type)) continue;

    const practices = getRecoveryPractices(type);
    if (practices.length === 0) continue;

    const practice = practices[0];
    const personalizedTip = await personalizePractice(practice, userContext);

    recommendations.push({
      energyType: type,
      practice,
      personalizedTip,
      reason: `${ENERGY_TYPE_LABELS[type]} энергия хронически низкая`,
    });

    coveredTypes.add(type);
  }

  // 3. Maintenance tip for lowest energy if nothing else
  if (
    recommendations.length === 0 &&
    diagnosticResult.lowestEnergy
  ) {
    const { type } = diagnosticResult.lowestEnergy;
    const practices = getRecoveryPractices(type);
    if (practices.length > 0) {
      const practice = practices[0];
      const personalizedTip = await personalizePractice(practice, userContext);

      recommendations.push({
        energyType: type,
        practice,
        personalizedTip,
        reason: `${ENERGY_TYPE_LABELS[type]} — наиболее уязвимая область`,
      });
    }
  }

  return recommendations.slice(0, MAX_RECOMMENDATIONS);
}

export function formatRecommendations(recommendations: Recommendation[]): string {
  if (recommendations.length === 0) return "";

  const lines: string[] = [];

  for (const rec of recommendations) {
    lines.push(
      `<b>${ENERGY_TYPE_LABELS[rec.energyType]}:</b> ${rec.reason}`
    );
    lines.push(`  ${rec.practice.name}: ${rec.personalizedTip}`);
    lines.push("");
  }

  return lines.join("\n").trim();
}
