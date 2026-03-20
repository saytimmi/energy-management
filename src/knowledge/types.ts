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

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'anytime';
export type ActionContext = 'home' | 'work' | 'outside' | 'anywhere';
export type ActionIntensity = 'micro' | 'regular' | 'deep';

export interface MicroAction {
  id: string;
  name: string;
  description: string;
  energyType: EnergyType;
  duration: 1 | 2 | 5 | 15 | 30;
  timeOfDay: TimeOfDay[];
  context: ActionContext[];
  intensity: ActionIntensity;
  science: string;
  crossTypeBonus?: EnergyType[];
  canBeHabit: boolean;
  habitSuggestion?: string;
}

export interface EnergyFact {
  id: string;
  text: string;
  category: 'low' | 'high';
  energyTypes: EnergyType[];
}
