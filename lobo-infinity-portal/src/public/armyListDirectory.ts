import { normalizeArmyForDisplay } from '../services/armyIdentity.ts'
import type { PublicArmyList } from './snapshotTypes'

export type ArmyListSort = 'date' | 'player' | 'faction' | 'mission' | 'opponent' | 'result'
export function armyListValue(list: PublicArmyList, key: ArmyListSort): string {
  if (key === 'player') return list.playerDisplayName || list.player || ''
  if (key === 'faction') return normalizeArmyForDisplay(list.sectorial || list.faction)
  if (key === 'opponent') return list.opponentDisplayName || list.opponent || ''
  return list[key] || ''
}
export function filterAndSortArmyLists(lists: PublicArmyList[], query: string, faction: string, mission: string, sort: ArmyListSort, direction: 'asc' | 'desc') {
  const search = query.trim().toLocaleLowerCase()
  const armySearch = normalizeArmyForDisplay(query).toLocaleLowerCase()
  return lists.filter(list => (!faction || armyListValue(list, 'faction') === normalizeArmyForDisplay(faction))
    && (!mission || list.mission === mission)
    && (!search || ['player', 'faction', 'mission', 'opponent', 'result'].some(key => armyListValue(list, key as ArmyListSort).toLocaleLowerCase().includes(search)) || armyListValue(list, 'faction').toLocaleLowerCase().includes(armySearch) || (list.armyName || '').toLocaleLowerCase().includes(search)))
    .sort((a, b) => {
      const left = armyListValue(a, sort).trim(), right = armyListValue(b, sort).trim()
      if (!left || !right) return left ? -1 : right ? 1 : a.id.localeCompare(b.id)
      const comparison = sort === 'date'
        ? (Date.parse(left) || 0) - (Date.parse(right) || 0)
        : left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
      return (direction === 'asc' ? comparison : -comparison) || a.id.localeCompare(b.id)
    })
}
