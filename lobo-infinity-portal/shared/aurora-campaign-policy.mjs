import { AURORA_CONQUEST_FACTIONS, AURORA_TERRITORIES } from './aurora-public.mjs'
export const AURORA_CAMPAIGN_REVISION = '2026-11-15-audit'
export const hasCampaignCorrections = state => state?.campaignRevision === AURORA_CAMPAIGN_REVISION
export const hasTurnThreeRules = state => hasCampaignCorrections(state) && state.turn >= 3
export function projectedStandings(state) {
  return AURORA_CONQUEST_FACTIONS.map(faction => {
    const territoryVP = state.territories.filter(t => t.controller === faction).reduce((sum, t) => sum + AURORA_TERRITORIES.find(x => x.id === t.id).vp, 0)
    const published = state.standings.find(s => s.faction === faction)?.vp || 0
    const earnedVP = state.finalStandings?.length ? published - territoryVP : published
    return { faction, earnedVP, territoryVP, projectedVP: earnedVP + territoryVP }
  }).sort((a, b) => b.projectedVP - a.projectedVP || a.faction.localeCompare(b.faction))
}
export function ownerAdvantageStatus(state, id) {
  const t = state.territories.find(t => t.id === id)
  const controller = state.ownerAdvantages?.owners?.[id] ?? t?.controller
  if (!controller || !t?.vulnerable) return 'inactive'
  if (!hasTurnThreeRules(state)) return 'active'
  if (state.ownerAdvantages?.status === 'locked') return state.ownerAdvantages.active.includes(id) ? 'active' : 'inactive'
  return state.territories.filter(v => v.vulnerable && v.controller === controller).length <= 2 ? 'active' : 'pending'
}
