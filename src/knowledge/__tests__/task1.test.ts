/**
 * TDD RED: Tests for types.ts and data.ts
 * These tests verify the knowledge base data structure and completeness.
 */
import { EnergyType, Practice, DrainFactor, SubstitutionRule } from '../types.js';
import { RECOVERY_PRACTICES, DRAIN_FACTORS, SUBSTITUTION_RULES } from '../data.js';

let passed = 0;
let failed = 0;

function check(name: string, fn: () => boolean) {
  try {
    if (fn()) {
      console.log(`  PASS: ${name}`);
      passed++;
    } else {
      console.log(`  FAIL: ${name}`);
      failed++;
    }
  } catch (e) {
    console.log(`  FAIL: ${name} — ${e}`);
    failed++;
  }
}

console.log('Task 1 Tests: Types and Data\n');

// EnergyType enum
console.log('--- EnergyType enum ---');
check('EnergyType has physical', () => EnergyType.physical === 'physical');
check('EnergyType has mental', () => EnergyType.mental === 'mental');
check('EnergyType has emotional', () => EnergyType.emotional === 'emotional');
check('EnergyType has spiritual', () => EnergyType.spiritual === 'spiritual');
check('EnergyType has exactly 4 values', () => Object.values(EnergyType).length === 4);

// RECOVERY_PRACTICES
console.log('\n--- Recovery Practices ---');
check('Has entries for all 4 types', () =>
  RECOVERY_PRACTICES.has(EnergyType.physical) &&
  RECOVERY_PRACTICES.has(EnergyType.mental) &&
  RECOVERY_PRACTICES.has(EnergyType.emotional) &&
  RECOVERY_PRACTICES.has(EnergyType.spiritual)
);
check('Physical recovery >= 10 practices', () => (RECOVERY_PRACTICES.get(EnergyType.physical)?.length ?? 0) >= 10);
check('Mental recovery >= 9 practices', () => (RECOVERY_PRACTICES.get(EnergyType.mental)?.length ?? 0) >= 9);
check('Emotional recovery >= 10 practices', () => (RECOVERY_PRACTICES.get(EnergyType.emotional)?.length ?? 0) >= 10);
check('Spiritual recovery >= 9 practices', () => (RECOVERY_PRACTICES.get(EnergyType.spiritual)?.length ?? 0) >= 9);

// DRAIN_FACTORS
console.log('\n--- Drain Factors ---');
check('Has entries for all 4 types', () =>
  DRAIN_FACTORS.has(EnergyType.physical) &&
  DRAIN_FACTORS.has(EnergyType.mental) &&
  DRAIN_FACTORS.has(EnergyType.emotional) &&
  DRAIN_FACTORS.has(EnergyType.spiritual)
);
check('Physical drains >= 11', () => (DRAIN_FACTORS.get(EnergyType.physical)?.length ?? 0) >= 11);
check('Mental drains >= 9', () => (DRAIN_FACTORS.get(EnergyType.mental)?.length ?? 0) >= 9);
check('Emotional drains >= 9', () => (DRAIN_FACTORS.get(EnergyType.emotional)?.length ?? 0) >= 9);
check('Spiritual drains >= 8', () => (DRAIN_FACTORS.get(EnergyType.spiritual)?.length ?? 0) >= 8);

// SUBSTITUTION_RULES
console.log('\n--- Substitution Rules ---');
check('SUBSTITUTION_RULES is an array with entries', () => Array.isArray(SUBSTITUTION_RULES) && SUBSTITUTION_RULES.length > 0);
check('Has rule: physical->emotional NOT allowed', () =>
  SUBSTITUTION_RULES.some(r => r.fromType === EnergyType.physical && r.toType === EnergyType.emotional && !r.allowed)
);
check('Has spiritual exception rule (allowed=true)', () =>
  SUBSTITUTION_RULES.some(r => r.fromType === EnergyType.spiritual && r.allowed === true)
);

// Practice shape
console.log('\n--- Type shapes ---');
check('Practice has correct shape', () => {
  const p = RECOVERY_PRACTICES.get(EnergyType.physical)?.[0];
  return p !== undefined && typeof p.id === 'string' && typeof p.name === 'string' &&
    typeof p.description === 'string' && p.energyType === EnergyType.physical;
});
check('DrainFactor has correct shape', () => {
  const d = DRAIN_FACTORS.get(EnergyType.physical)?.[0];
  return d !== undefined && typeof d.id === 'string' && typeof d.name === 'string' &&
    typeof d.description === 'string' && d.energyType === EnergyType.physical;
});

console.log(`\n${passed}/${passed + failed} checks passed`);
process.exit(failed > 0 ? 1 : 0);
