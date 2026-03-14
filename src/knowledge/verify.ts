/**
 * Verification script for the knowledge base module.
 * Run: npx tsx src/knowledge/verify.ts
 * Exits 0 if all pass, 1 if any fail.
 */

import {
  getRecoveryPractices,
  getDrainFactors,
  validateRecovery,
  getAllEnergyTypes,
  getEnergyOverview,
  getSubstitutionRules,
  EnergyType,
} from './index.js';

let passed = 0;
let failed = 0;
const total = 12;

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

console.log('Knowledge Base Verification\n');

// 1-4: Each type has recovery practices
check('1. Physical has recovery practices', () => getRecoveryPractices(EnergyType.physical).length > 0);
check('2. Mental has recovery practices', () => getRecoveryPractices(EnergyType.mental).length > 0);
check('3. Emotional has recovery practices', () => getRecoveryPractices(EnergyType.emotional).length > 0);
check('4. Spiritual has recovery practices', () => getRecoveryPractices(EnergyType.spiritual).length > 0);

// 5-6: Each type has drain factors (spot check 2)
check('5. Each type has drain factors', () =>
  getAllEnergyTypes().every(t => getDrainFactors(t).length > 0)
);

// Practice counts
check('6. Physical practices >= 10', () => getRecoveryPractices(EnergyType.physical).length >= 10);
check('7. Mental practices >= 9', () => getRecoveryPractices(EnergyType.mental).length >= 9);

// Substitution validation
check('8. Same-type recovery allowed (physical->physical)', () => {
  const r = validateRecovery(EnergyType.physical, EnergyType.physical);
  return r.allowed === true;
});

check('9. Cross-type rejected (emotional drain + physical recovery)', () => {
  const r = validateRecovery(EnergyType.emotional, EnergyType.physical);
  return r.allowed === false && typeof r.reason === 'string' && r.reason.length > 0;
});

check('10. Same-type allowed (spiritual->spiritual)', () => {
  const r = validateRecovery(EnergyType.spiritual, EnergyType.spiritual);
  return r.allowed === true;
});

check('11. Spiritual converts to any (physical drain + spiritual recovery)', () => {
  const r = validateRecovery(EnergyType.physical, EnergyType.spiritual);
  return r.allowed === true;
});

check('12. Cross-type rejected (mental drain + emotional recovery)', () => {
  const r = validateRecovery(EnergyType.mental, EnergyType.emotional);
  return r.allowed === false;
});

console.log(`\n${passed}/${total} checks passed`);
process.exit(failed > 0 ? 1 : 0);
