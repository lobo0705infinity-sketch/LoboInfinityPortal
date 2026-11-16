import type { AuroraPublicState } from '../src/campaign/auroraTypes'
export const AURORA_CAMPAIGN_REVISION: '2026-11-15-audit'
export function hasCampaignCorrections(state: Partial<AuroraPublicState>): boolean
export function hasTurnThreeRules(state: Partial<AuroraPublicState>): boolean
export function projectedStandings(state: AuroraPublicState): Array<{ faction: string; earnedVP: number; territoryVP: number; projectedVP: number }>
export function ownerAdvantageStatus(state: AuroraPublicState, id: string): 'active' | 'inactive' | 'pending'
