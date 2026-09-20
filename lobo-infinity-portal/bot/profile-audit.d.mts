import type { ArmyIntelligenceDecodedEntry, ArmyIntelligenceList } from '../src/services/api'
export function repairArmyProfile<T extends ArmyIntelligenceDecodedEntry>(entry: T): T
export function repairArmyList<T extends ArmyIntelligenceList>(list: T): T
