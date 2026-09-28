import type { ArmyIntelligenceList, RecentGame } from './api'
import { CANONICAL_ARMY_REGISTRY } from '../config/armies.ts'
import { getGameSides } from './gameResults.ts'

const playerKey = (value: string) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
const armyKey = (value: string) => String(value || '').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
const armyIds = new Map(CANONICAL_ARMY_REGISTRY.flatMap((army) =>
  [army.name, army.id, ...(army.aliases || [])].map((name) => [armyKey(name), army.id] as const)))
const sameArmy = (left: string, right: string) => {
  const a = armyIds.get(armyKey(left))
  const b = armyIds.get(armyKey(right))
  return a && b ? a === b : Boolean(armyKey(left) && armyKey(left) === armyKey(right))
}
const armyCode = (value: string) => {
  try { return decodeURIComponent(String(value || '').trim()).replace(/\s+/g, '') }
  catch { return String(value || '').trim().replace(/\s+/g, '') }
}

export function getGameIntelligenceLists(game: RecentGame, lists: ArmyIntelligenceList[]): ArmyIntelligenceList[] {
  const [left, right] = getGameSides(game)
  const sides = [
    { player: left.player, opponent: right.player, faction: left.faction,
      listId: left.listId, code: game.winnerArmyCode, codeHash: game.winnerRosterFingerprint },
    { player: right.player, opponent: left.player, faction: right.faction,
      listId: right.listId, code: game.loserArmyCode, codeHash: game.loserRosterFingerprint },
  ]
  const matched: ArmyIntelligenceList[] = []

  for (const side of sides) {
    const listId = String(side.listId || '').trim()
    const player = playerKey(side.player)
    const submittedCode = armyCode(side.code)
    const submittedHash = String(side.codeHash || '').trim().toLowerCase()
    if (submittedCode || /^[a-f0-9]{64}$/.test(submittedHash)) {
      // A game's submitted code establishes its roster, even when the same
      // code was previously saved by someone else. Bind its decoded contents
      // to this game's player; never copy the earlier list's player identity.
      const candidates = lists.filter((list) => list.status === 'decoded' && list.decoded &&
        (submittedCode ? armyCode(list.armyCode) === submittedCode
          : String(list.rosterFingerprint || list.armyCodeHash || '').toLowerCase() === submittedHash) &&
        (!list.sectorial && !list.faction || sameArmy(list.sectorial || list.faction, side.faction)))
      const preferred = candidates.filter((list) => listId && String(list.armyListId || '') === listId)
      const selected = preferred.length === 1 ? preferred[0]
        : !preferred.length && candidates.length === 1 ? candidates[0] : null
      if (selected) matched.push({ ...selected, player: side.player, opponent: side.opponent })
      continue
    }
    const byListId = listId && lists.find((list) =>
      list.status === 'decoded' && list.decoded &&
      String(list.armyListId || '') === listId && playerKey(list.player) === player,
    )
    if (byListId) {
      matched.push(byListId)
      continue
    }

    // Older public snapshots omitted the list ID. Only accept an unambiguous
    // match on both participants, mission and day; a shifted sourceId alone is unsafe.
    const candidates = lists.filter((list) =>
      list.status === 'decoded' && list.decoded && !list.armyListId &&
      playerKey(list.player) === player &&
      playerKey(list.opponent) === playerKey(side.opponent) &&
      Boolean(game.mission && list.mission && game.date && list.date) &&
      playerKey(list.mission) === playerKey(game.mission) &&
      list.date.slice(0, 10) === game.date.slice(0, 10),
    )
    if (candidates.length === 1) matched.push(candidates[0])
  }

  return matched
}

// Only known deterministic decoder rejections are terminal. A network error,
// a pending refresh, or an ambiguous roster link must still wait for a decode.
const terminalDecoderError = /^(?:Invalid IDs in Army Code: Infinity-Data deterministically rejected an out-of-date unit option\.|Invalid Army Code: malformed or contaminated source value\.)$/

function matchingStoryList(game: RecentGame, lists: ArmyIntelligenceList[], index: number): ArmyIntelligenceList[] {
  const sides = getGameSides(game)
  const side = sides[index]
  const other = sides[1 - index]
  const code = armyCode(index === 0 ? game.winnerArmyCode : game.loserArmyCode)
  const fingerprint = String((index === 0 ? game.winnerRosterFingerprint : game.loserRosterFingerprint) || '')
    .trim().toLowerCase()
  return lists.filter((list) =>
    (!list.sectorial && !list.faction || sameArmy(list.sectorial || list.faction, side.faction)) &&
    (code ? armyCode(list.armyCode) === code
      : /^[a-f0-9]{64}$/.test(fingerprint)
        ? String(list.rosterFingerprint || list.armyCodeHash || '').toLowerCase() === fingerprint
        : side.listId ? String(list.armyListId || '') === String(side.listId) &&
          playerKey(list.player) === playerKey(side.player)
          : !list.armyListId && playerKey(list.player) === playerKey(side.player) &&
            playerKey(list.opponent) === playerKey(other.player) &&
            Boolean(game.mission && list.mission && game.date && list.date) &&
            playerKey(list.mission) === playerKey(game.mission) &&
            list.date.slice(0, 10) === game.date.slice(0, 10)))
}

// A failed decode is different from an unprocessed list. Do not substitute a
// locally reconstructed profile, a matching list ID, or another player's code.
export function hasFailedGameIntelligenceList(game: RecentGame, lists: ArmyIntelligenceList[]): boolean {
  const sides = getGameSides(game)
  const linked = getGameIntelligenceLists(game, lists)
  return sides.some((side, index) =>
    !linked.some((list) => playerKey(list.player) === playerKey(side.player)) &&
    matchingStoryList(game, lists, index).some((list) => list.status === 'failed'))
}

export type StoryListReadiness = 'decoded' | 'pending' | 'rosterless'

export function getStoryListReadiness(game: RecentGame, lists: ArmyIntelligenceList[]): StoryListReadiness {
  const sides = getGameSides(game)
  const linked = getGameIntelligenceLists(game, lists)
  let unavailable = false
  for (let index = 0; index < sides.length; index++) {
    if (linked.some((list) => playerKey(list.player) === playerKey(sides[index].player))) continue
    const candidates = matchingStoryList(game, lists, index)
    // A decoded but ambiguous match cannot be treated as a missing list.
    if (candidates.some((list) => list.status === 'decoded' && list.decoded)) return 'pending'
    if (candidates.some((list) => list.status === 'pending' ||
      list.status === 'failed' && !terminalDecoderError.test(String(list.error || '')))) return 'pending'
    if (candidates.some((list) => list.status === 'failed')) {
      unavailable = true
      continue
    }
    // A submitted code, hash, or list ID may simply not have reached the
    // read model yet. No such identifier means there is nothing to decode.
    const code = armyCode(index === 0 ? game.winnerArmyCode : game.loserArmyCode)
    const fingerprint = String((index === 0 ? game.winnerRosterFingerprint : game.loserRosterFingerprint) || '')
    if (code || /^[a-f0-9]{64}$/i.test(fingerprint) || sides[index].listId) return 'pending'
    unavailable = true
  }
  return unavailable ? 'rosterless' : linked.length === 2 ? 'decoded' : 'pending'
}
