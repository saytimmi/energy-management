import { describe, it, expect } from 'vitest';
import {
  getRecoveryPractices,
  getDrainFactors,
  validateRecovery,
  getAllEnergyTypes,
  getSubstitutionRules,
  EnergyType,
} from '../knowledge/index.js';

describe('Knowledge Base Verification', () => {
  it('each type has recovery practices', () => {
    for (const type of getAllEnergyTypes()) {
      expect(getRecoveryPractices(type).length).toBeGreaterThan(0);
    }
  });

  it('each type has drain factors', () => {
    for (const type of getAllEnergyTypes()) {
      expect(getDrainFactors(type).length).toBeGreaterThan(0);
    }
  });

  it('has enough practices per type', () => {
    expect(getRecoveryPractices(EnergyType.physical).length).toBeGreaterThanOrEqual(10);
    expect(getRecoveryPractices(EnergyType.mental).length).toBeGreaterThanOrEqual(9);
  });

  it('same-type recovery is allowed', () => {
    expect(validateRecovery(EnergyType.physical, EnergyType.physical).allowed).toBe(true);
    expect(validateRecovery(EnergyType.spiritual, EnergyType.spiritual).allowed).toBe(true);
  });

  it('cross-type recovery is rejected with reason', () => {
    const r = validateRecovery(EnergyType.emotional, EnergyType.physical);
    expect(r.allowed).toBe(false);
    expect(r.reason).toBeTruthy();
  });

  it('spiritual converts to any type', () => {
    expect(validateRecovery(EnergyType.physical, EnergyType.spiritual).allowed).toBe(true);
  });

  it('cross-type mental->emotional is rejected', () => {
    expect(validateRecovery(EnergyType.mental, EnergyType.emotional).allowed).toBe(false);
  });

  it('substitution rules exist', () => {
    expect(getSubstitutionRules().length).toBeGreaterThan(0);
  });
});
