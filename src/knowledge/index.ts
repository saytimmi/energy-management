/**
 * Knowledge base query functions for the 4-energy methodology.
 *
 * This module provides the API for bot logic to query recovery practices,
 * drain factors, and validate that recommendations match the correct energy type.
 */

export { EnergyType, type Practice, type DrainFactor, type SubstitutionRule } from './types.js';
import { EnergyType, type Practice, type DrainFactor, type SubstitutionRule } from './types.js';
import { RECOVERY_PRACTICES, DRAIN_FACTORS, SUBSTITUTION_RULES } from './data.js';

/**
 * Get recovery practices for a given energy type.
 */
export function getRecoveryPractices(type: EnergyType): Practice[] {
  return RECOVERY_PRACTICES.get(type) ?? [];
}

/**
 * Get drain factors for a given energy type.
 */
export function getDrainFactors(type: EnergyType): DrainFactor[] {
  return DRAIN_FACTORS.get(type) ?? [];
}

/**
 * Validate whether applying recovery of one type to a drain of another type is appropriate.
 *
 * Rules:
 * 1. Same type -> always allowed
 * 2. Spiritual recovery -> any drain type: allowed (spiritual energy converts)
 * 3. Any other cross-type -> NOT allowed
 */
export function validateRecovery(
  drainType: EnergyType,
  recoveryType: EnergyType,
): { allowed: boolean; reason?: string } {
  // Same type is always allowed
  if (drainType === recoveryType) {
    return { allowed: true };
  }

  // Spiritual recovery can convert to any type
  if (recoveryType === EnergyType.spiritual) {
    return { allowed: true, reason: 'Духовная энергия может конвертироваться в любую другую' };
  }

  // Check specific substitution rules for a custom reason
  const specificRule = SUBSTITUTION_RULES.find(
    r => !r.allowed && (
      (r.fromType === recoveryType && r.toType === drainType) ||
      (r.fromType === drainType && r.toType === recoveryType)
    ),
  );

  if (specificRule) {
    return { allowed: false, reason: specificRule.reason };
  }

  // General cross-type prohibition
  return {
    allowed: false,
    reason: `Нельзя восстанавливать ${drainType} энергию практиками для ${recoveryType} энергии. Каждый тип требует своего восстановления.`,
  };
}

/**
 * Get all 4 energy types.
 */
export function getAllEnergyTypes(): EnergyType[] {
  return [EnergyType.physical, EnergyType.mental, EnergyType.emotional, EnergyType.spiritual];
}

/**
 * Get a complete overview for one energy type — both practices and drains.
 */
export function getEnergyOverview(type: EnergyType): { practices: Practice[]; drains: DrainFactor[] } {
  return {
    practices: getRecoveryPractices(type),
    drains: getDrainFactors(type),
  };
}

/**
 * Get all substitution rules for reference.
 */
export function getSubstitutionRules(): SubstitutionRule[] {
  return SUBSTITUTION_RULES;
}
