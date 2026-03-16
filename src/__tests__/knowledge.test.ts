import { describe, it, expect } from 'vitest';
import { EnergyType } from '../knowledge/types.js';
import { RECOVERY_PRACTICES, DRAIN_FACTORS, SUBSTITUTION_RULES } from '../knowledge/data.js';

describe('EnergyType enum', () => {
  it('has all 4 types', () => {
    expect(EnergyType.physical).toBe('physical');
    expect(EnergyType.mental).toBe('mental');
    expect(EnergyType.emotional).toBe('emotional');
    expect(EnergyType.spiritual).toBe('spiritual');
    expect(Object.values(EnergyType)).toHaveLength(4);
  });
});

describe('Recovery Practices', () => {
  it('has entries for all 4 types', () => {
    expect(RECOVERY_PRACTICES.has(EnergyType.physical)).toBe(true);
    expect(RECOVERY_PRACTICES.has(EnergyType.mental)).toBe(true);
    expect(RECOVERY_PRACTICES.has(EnergyType.emotional)).toBe(true);
    expect(RECOVERY_PRACTICES.has(EnergyType.spiritual)).toBe(true);
  });

  it('has enough practices per type', () => {
    expect(RECOVERY_PRACTICES.get(EnergyType.physical)!.length).toBeGreaterThanOrEqual(10);
    expect(RECOVERY_PRACTICES.get(EnergyType.mental)!.length).toBeGreaterThanOrEqual(9);
    expect(RECOVERY_PRACTICES.get(EnergyType.emotional)!.length).toBeGreaterThanOrEqual(10);
    expect(RECOVERY_PRACTICES.get(EnergyType.spiritual)!.length).toBeGreaterThanOrEqual(9);
  });

  it('practice has correct shape', () => {
    const p = RECOVERY_PRACTICES.get(EnergyType.physical)![0];
    expect(p).toBeDefined();
    expect(typeof p.id).toBe('string');
    expect(typeof p.name).toBe('string');
    expect(typeof p.description).toBe('string');
    expect(p.energyType).toBe(EnergyType.physical);
  });
});

describe('Drain Factors', () => {
  it('has entries for all 4 types', () => {
    expect(DRAIN_FACTORS.has(EnergyType.physical)).toBe(true);
    expect(DRAIN_FACTORS.has(EnergyType.mental)).toBe(true);
    expect(DRAIN_FACTORS.has(EnergyType.emotional)).toBe(true);
    expect(DRAIN_FACTORS.has(EnergyType.spiritual)).toBe(true);
  });

  it('has enough drain factors per type', () => {
    expect(DRAIN_FACTORS.get(EnergyType.physical)!.length).toBeGreaterThanOrEqual(11);
    expect(DRAIN_FACTORS.get(EnergyType.mental)!.length).toBeGreaterThanOrEqual(9);
    expect(DRAIN_FACTORS.get(EnergyType.emotional)!.length).toBeGreaterThanOrEqual(9);
    expect(DRAIN_FACTORS.get(EnergyType.spiritual)!.length).toBeGreaterThanOrEqual(8);
  });

  it('drain factor has correct shape', () => {
    const d = DRAIN_FACTORS.get(EnergyType.physical)![0];
    expect(d).toBeDefined();
    expect(typeof d.id).toBe('string');
    expect(typeof d.name).toBe('string');
    expect(typeof d.description).toBe('string');
    expect(d.energyType).toBe(EnergyType.physical);
  });
});

describe('Substitution Rules', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(SUBSTITUTION_RULES)).toBe(true);
    expect(SUBSTITUTION_RULES.length).toBeGreaterThan(0);
  });

  it('physical->emotional is NOT allowed', () => {
    const rule = SUBSTITUTION_RULES.find(r => r.fromType === EnergyType.physical && r.toType === EnergyType.emotional);
    expect(rule).toBeDefined();
    expect(rule!.allowed).toBe(false);
  });

  it('spiritual has an allowed exception rule', () => {
    const rule = SUBSTITUTION_RULES.find(r => r.fromType === EnergyType.spiritual && r.allowed === true);
    expect(rule).toBeDefined();
  });
});
