/**
 * Knowledge base types for the 4-energy methodology.
 */

export enum EnergyType {
  physical = 'physical',
  mental = 'mental',
  emotional = 'emotional',
  spiritual = 'spiritual',
}

export interface Practice {
  id: string;
  name: string;
  description: string;
  energyType: EnergyType;
}

export interface DrainFactor {
  id: string;
  name: string;
  description: string;
  energyType: EnergyType;
}

export interface SubstitutionRule {
  fromType: EnergyType;
  toType: EnergyType;
  allowed: boolean;
  reason: string;
}
