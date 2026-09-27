import { decodeArmyCode } from '../scripts/infinity-army-decode.mjs'
import { encodeArmyCode } from '../scripts/infinity-army-encode.mjs'
import { assessInfListClassifieds } from './inf-list-classifieds.mjs'
import { buildSubmittedProfiles } from './inf-list-tactical.mjs'
import { ListBuilderError } from './build-list-generator.mjs'

// Army codes represent paired profiles as a single option. Expand their official
// includes before resolving the same exact profile data used by /inf-list.
export function assessGeneratedListClassifieds({ code, payload, metadata }) {
  const decoded = decodeArmyCode(code)
  const units = new Map((payload?.units || []).map(unit => [Number(unit.id), unit]))
  const combatGroups = decoded.combatGroups.map(group => ({
    members: group.members.flatMap(member => {
      if (Number(member.groupId) !== 0) return [member]
      const unit = units.get(Number(member.unitId))
      const option = (unit?.options || []).find(item => Number(item.id) === Number(member.optionId))
      if (!option?.includes?.length) throw new ListBuilderError('The official components of a generated unit could not be verified.')
      return option.includes.flatMap(include => {
        const profileGroup = (unit.profileGroups || []).find(item => Number(item.id) === Number(include.group))
        if (!profileGroup?.profiles?.length || !(profileGroup.options || []).some(item => Number(item.id) === Number(include.option))) {
          throw new ListBuilderError('The official components of a generated unit could not be verified.')
        }
        return Array.from({ length: Number(include.q) || 1 }, () => ({
          unitId: member.unitId, groupId: Number(include.group), optionId: Number(include.option),
        }))
      })
    }),
  }))
  const expandedCode = encodeArmyCode({
    sectorialId: decoded.sectorialId, sectorialSlug: decoded.sectorialSlug,
    maxPoints: decoded.maxPoints, combatGroups,
  })
  const profiles = buildSubmittedProfiles({ armyCode: expandedCode, metadata, officialPayloads: [payload] })
  return assessInfListClassifieds(profiles)
}
