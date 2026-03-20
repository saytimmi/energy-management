import { describe, it, expect } from 'vitest';
import { EnergyType } from '../knowledge/types';
import { getMicroActions, getEnergyFacts } from '../knowledge/micro-actions';
import { ENERGY_FACTS } from '../knowledge/energy-facts';

describe('MicroActions', () => {
  it('has 10 actions per energy type', () => {
    for (const type of Object.values(EnergyType)) {
      const actions = getMicroActions(type);
      expect(actions.length).toBe(10);
      actions.forEach(a => expect(a.energyType).toBe(type));
    }
  });

  it('every action has required fields', () => {
    for (const type of Object.values(EnergyType)) {
      for (const action of getMicroActions(type)) {
        expect(action.id).toBeTruthy();
        expect(action.name).toBeTruthy();
        expect(action.description).toBeTruthy();
        expect(action.science).toBeTruthy();
        expect(action.timeOfDay.length).toBeGreaterThan(0);
        expect(action.context.length).toBeGreaterThan(0);
        expect([1, 2, 5, 15, 30]).toContain(action.duration);
        expect(['micro', 'regular', 'deep']).toContain(action.intensity);
      }
    }
  });

  it('filters by time of day', () => {
    const morning = getMicroActions(EnergyType.physical, { timeOfDay: 'morning' });
    expect(morning.length).toBeGreaterThan(0);
    morning.forEach(a => {
      const matchesMorning = a.timeOfDay.includes('morning') || a.timeOfDay.includes('anytime');
      expect(matchesMorning).toBe(true);
    });
  });

  it('sorts micro intensity first', () => {
    const actions = getMicroActions(EnergyType.physical);
    const microIdx = actions.findIndex(a => a.intensity === 'micro');
    const deepIdx = actions.findIndex(a => a.intensity === 'deep');
    if (microIdx !== -1 && deepIdx !== -1) {
      expect(microIdx).toBeLessThan(deepIdx);
    }
  });
});

describe('EnergyFacts', () => {
  it('has at least 10 low and 5 high facts', () => {
    const low = ENERGY_FACTS.filter(f => f.category === 'low');
    const high = ENERGY_FACTS.filter(f => f.category === 'high');
    expect(low.length).toBeGreaterThanOrEqual(10);
    expect(high.length).toBeGreaterThanOrEqual(5);
  });

  it('every fact has required fields', () => {
    for (const fact of ENERGY_FACTS) {
      expect(fact.id).toBeTruthy();
      expect(fact.text).toBeTruthy();
      expect(['low', 'high']).toContain(fact.category);
      expect(fact.energyTypes.length).toBeGreaterThan(0);
    }
  });
});
