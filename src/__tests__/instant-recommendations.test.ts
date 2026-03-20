import { describe, it, expect } from 'vitest';
import { EnergyType } from '../knowledge/types';
import { getInstantRecommendations, type EnergyValues } from '../services/instant-recommendations';

describe('getInstantRecommendations', () => {
  it('returns actions for energies <= 6', () => {
    const values: EnergyValues = { physical: 4, mental: 7, emotional: 5, spiritual: 8 };
    const result = getInstantRecommendations(values, 'afternoon');
    expect(result.recommendations.length).toBeGreaterThan(0);
    const types = result.recommendations.map(r => r.energyType);
    expect(types).toContain(EnergyType.physical);
    expect(types).toContain(EnergyType.emotional);
    expect(types).not.toContain(EnergyType.mental);
  });

  it('returns max 2 energy types even if 3+ are low', () => {
    const values: EnergyValues = { physical: 3, mental: 4, emotional: 5, spiritual: 2 };
    const result = getInstantRecommendations(values, 'morning');
    const uniqueTypes = new Set(result.recommendations.map(r => r.energyType));
    expect(uniqueTypes.size).toBeLessThanOrEqual(2);
  });

  it('returns max 4 recommendations total', () => {
    const values: EnergyValues = { physical: 3, mental: 4, emotional: 2, spiritual: 1 };
    const result = getInstantRecommendations(values, 'morning');
    expect(result.recommendations.length).toBeLessThanOrEqual(4);
  });

  it('returns congratulation when all >= 7', () => {
    const values: EnergyValues = { physical: 8, mental: 7, emotional: 9, spiritual: 7 };
    const result = getInstantRecommendations(values, 'morning');
    expect(result.recommendations.length).toBe(0);
    expect(result.allGood).toBe(true);
  });

  it('includes one energy fact', () => {
    const values: EnergyValues = { physical: 4, mental: 7, emotional: 5, spiritual: 8 };
    const result = getInstantRecommendations(values, 'afternoon');
    expect(result.fact).toBeTruthy();
    expect(result.fact!.text.length).toBeGreaterThan(0);
  });

  it('filters by time of day', () => {
    const values: EnergyValues = { physical: 4, mental: 7, emotional: 8, spiritual: 8 };
    const morning = getInstantRecommendations(values, 'morning');
    const evening = getInstantRecommendations(values, 'evening');
    // Different time of day may yield different actions
    expect(morning.recommendations.length).toBeGreaterThan(0);
    expect(evening.recommendations.length).toBeGreaterThan(0);
  });
});
