import { EnergyType } from '../knowledge/types.js';
import type { MicroAction, EnergyFact, TimeOfDay } from '../knowledge/types.js';
import { getMicroActions } from '../knowledge/micro-actions.js';
import { ENERGY_FACTS } from '../knowledge/energy-facts.js';

export interface EnergyValues {
  physical: number;
  mental: number;
  emotional: number;
  spiritual: number;
}

interface RecommendationResult {
  recommendations: MicroAction[];
  fact: EnergyFact | null;
  allGood: boolean;
  suggestIds: string[]; // MicroAction IDs for deep link
}

const THRESHOLD = 6;
const MAX_TYPES = 2;
const MAX_PER_TYPE = 2;

// In-memory fact dedup (resets on deploy — acceptable)
const shownFacts = new Map<number, string[]>();

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

function pickFact(
  category: 'low' | 'high',
  dominantType: EnergyType,
  telegramId?: number,
): EnergyFact | null {
  let pool = ENERGY_FACTS.filter(
    f => f.category === category && f.energyTypes.includes(dominantType),
  );
  if (pool.length === 0) {
    pool = ENERGY_FACTS.filter(f => f.category === category);
  }
  if (pool.length === 0) return null;

  // Dedup
  const shown = telegramId ? (shownFacts.get(telegramId) ?? []) : [];
  const unseen = pool.filter(f => !shown.includes(f.id));
  const candidates = unseen.length > 0 ? unseen : pool;

  const picked = candidates[Math.floor(Math.random() * candidates.length)];

  if (telegramId) {
    const updated = [...shown, picked.id].slice(-20); // keep last 20
    shownFacts.set(telegramId, updated);
  }

  return picked;
}

export function getInstantRecommendations(
  values: EnergyValues,
  timeOfDay?: TimeOfDay,
  telegramId?: number,
): RecommendationResult {
  const tod = timeOfDay ?? getTimeOfDay();

  const energyEntries: { type: EnergyType; value: number }[] = [
    { type: EnergyType.physical, value: values.physical },
    { type: EnergyType.mental, value: values.mental },
    { type: EnergyType.emotional, value: values.emotional },
    { type: EnergyType.spiritual, value: values.spiritual },
  ];

  const lowEnergies = energyEntries
    .filter(e => e.value <= THRESHOLD)
    .sort((a, b) => a.value - b.value)
    .slice(0, MAX_TYPES);

  if (lowEnergies.length === 0) {
    const lowestType = energyEntries.sort((a, b) => a.value - b.value)[0].type;
    return {
      recommendations: [],
      fact: pickFact('high', lowestType, telegramId),
      allGood: true,
      suggestIds: [],
    };
  }

  const recommendations: MicroAction[] = [];
  const suggestIds: string[] = [];

  for (const low of lowEnergies) {
    const actions = getMicroActions(low.type, { timeOfDay: tod });

    // Prioritize cross-type bonus
    const otherLowTypes = lowEnergies
      .filter(e => e.type !== low.type)
      .map(e => e.type);

    const sorted = [...actions].sort((a, b) => {
      const aBonus = a.crossTypeBonus?.some(t => otherLowTypes.includes(t)) ? -1 : 0;
      const bBonus = b.crossTypeBonus?.some(t => otherLowTypes.includes(t)) ? -1 : 0;
      return aBonus - bBonus;
    });

    const picked = sorted.slice(0, MAX_PER_TYPE);
    recommendations.push(...picked);
    suggestIds.push(...picked.filter(a => a.canBeHabit).map(a => a.id));
  }

  const dominantType = lowEnergies[0].type;

  return {
    recommendations,
    fact: pickFact('low', dominantType, telegramId),
    allGood: false,
    suggestIds,
  };
}
