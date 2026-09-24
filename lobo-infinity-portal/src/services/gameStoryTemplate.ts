import { CANONICAL_ARMY_REGISTRY } from '../config/armies.ts'
import { getCanonicalMissionName } from '../config/missions.ts'
import namedCharacters from '../data/storyCharacters.json' with { type: 'json' }
import type { ArmyIntelligenceDecodedEntry, ArmyIntelligenceList, RecentGame } from './api.ts'
import { getGameIntelligenceLists } from './gameIntelligenceLinks.ts'
import { getGameSides, isDrawGame } from './gameResults.ts'

export type HeroRole = 'gunfighting' | 'closeCombat' | 'objective'

export type GameStoryTemplate = {
  mission: string
  factions: readonly [string, string]
  heroFaction: string
  role: HeroRole
  paragraphs: readonly string[]
  endings: { heroWins: string; heroLoses: string; draw: string }
}

const armyByName = new Map(CANONICAL_ARMY_REGISTRY.flatMap((army) =>
  [army.name, army.id, ...(army.aliases ?? [])].map((name) => [normalize(name), army] as const),
))

export function storyTemplateKey(mission: string, factionA: string, factionB: string): string | null {
  const canonicalMission = getCanonicalMissionName(mission)
  const a = armyByName.get(normalize(factionA))
  const b = armyByName.get(normalize(factionB))
  if (!canonicalMission || !a || !b) return null
  return `${canonicalMission}|${[a.id, b.id].sort().join('|')}`
}

export function storyModelReference(entry: ArmyIntelligenceDecodedEntry): string {
  const character = (namedCharacters as Record<string, string>)[entry.canonicalUnitId ?? -1]
  if (character) return character
  const name = String(entry.unit || entry.profile || '').trim().replace(/\s+FTO$/i, '')
  const words = name.split(/\s+/).map((word) =>
    /\p{L}/u.test(word) && word === word.toLocaleUpperCase('en-US')
      ? word.charAt(0) + word.slice(1).toLocaleLowerCase('en-US')
      : word,
  )
  const display = words.join(' ')
  return `the ${display || 'trooper'}`
}

export function selectStoryHero(list: ArmyIntelligenceList | undefined, role: HeroRole): ArmyIntelligenceDecodedEntry | null {
  if (list?.status !== 'decoded' || !list.decoded) return null
  const eligible = list.decoded.combatGroups.flatMap((group) => group.entries).filter((entry) =>
    Number.isFinite(entry.points) && entry.points >= 0 && qualifiesForRole(entry, role),
  )
  return eligible.sort((a, b) => b.points - a.points || String(a.combinedId).localeCompare(String(b.combinedId)))[0] ?? null
}

function qualifiesForRole(entry: ArmyIntelligenceDecodedEntry, role: HeroRole): boolean {
  if (role === 'objective') {
    return Boolean(entry.specialist || entry.hacker || entry.engineer || entry.doctor || entry.forwardObserver ||
      entry.skills.some((skill) => /^(?:Hacker|Engineer|Doctor|Forward Observer|Paramedic|Specialist Operative)(?:\b|\s*\[)/i.test(skill)))
  }
  if (role === 'closeCombat') {
    return entry.weapons.some((weapon) => /(?:CC Weapon|Trench-Hammer|Monofilament|Viral CC)/i.test(weapon)) &&
      entry.skills.some((skill) => /^(?:Martial Arts|Berserk|Natural Born Warrior|CC Attack|Protheion)(?:\b|\s*\[)/i.test(skill))
  }
  return (entry.bs ?? 0) >= 11 && entry.weapons.some((weapon) =>
    /(?:heavy machine gun|\bHMG\b|spitfire|sniper rifle|marksman rifle|thunderbolt|feuerbach|autocannon|red fury|missile launcher|rocket launcher|plasma rifle|plasma carbine)/i.test(weapon),
  )
}

export function renderGameStoryTemplate(template: GameStoryTemplate, game: RecentGame, lists: ArmyIntelligenceList[]): string | null {
  const key = storyTemplateKey(game.mission, game.winnerFaction, game.loserFaction)
  if (!key || key !== storyTemplateKey(template.mission, ...template.factions)) return null
  const sides = getGameSides(game)
  const linked = getGameIntelligenceLists(game, lists)
  const matched = sides.map((side) => {
    const candidates = linked.filter((list) => list.status === 'decoded' && list.decoded &&
      normalize(list.player) === normalize(side.player) &&
      (!list.sectorial && !list.faction || sameArmy(list.sectorial || list.faction, side.faction)))
    return candidates.length === 1 ? candidates[0] : null
  })
  // A story with a roster-selected actor must wait until the game has both
  // decoded sides. It must never pull a similarly named model from another game.
  if (matched.some((list) => !list)) return null
  const index = sides.findIndex((side) => sameArmy(side.faction, template.heroFaction))
  if (index < 0) return null
  const hero = selectStoryHero(matched[index] ?? undefined, template.role)
  if (!hero) return null
  const allyGunfighter = selectStoryHeroExcluding(matched[index] ?? undefined, 'gunfighting', hero.canonicalUnitId)
  const enemyGunfighter = selectStoryHero(matched[1 - index] ?? undefined, 'gunfighting')
  const replacements: Record<string, string> = {
    '{{hero}}': storyModelReference(hero),
    '{{heroPlayer}}': sides[index].displayName || sides[index].player,
    '{{otherPlayer}}': sides[1 - index].displayName || sides[1 - index].player,
    '{{allyGunfighter}}': allyGunfighter ? storyModelReference(allyGunfighter) : 'a covering shooter',
    '{{enemyGunfighter}}': enemyGunfighter ? storyModelReference(enemyGunfighter) : 'an opposing gunfighter',
    '{{winner}}': sides[0].displayName || sides[0].player,
    '{{loser}}': sides[1].displayName || sides[1].player,
  }
  const ending = isDrawGame(game) ? template.endings.draw : index === 0 ? template.endings.heroWins : template.endings.heroLoses
  return [...template.paragraphs, ending].map((paragraph) => Object.entries(replacements).reduce(
    (value, [token, replacement]) => value.replaceAll(token, replacement), paragraph,
  ).replace(/(^|[.!?]\s+)(the|a|an)\b/g, (_, lead: string, article: string) =>
    `${lead}${article[0].toUpperCase()}${article.slice(1)}`)).join('\n\n')
}

function selectStoryHeroExcluding(list: ArmyIntelligenceList | undefined, role: HeroRole, unitId: number | null | undefined): ArmyIntelligenceDecodedEntry | null {
  if (!list?.decoded) return null
  const withoutHeroUnit: ArmyIntelligenceList = {
    ...list,
    decoded: {
      ...list.decoded,
      combatGroups: list.decoded.combatGroups.map((group) => ({
        ...group,
        entries: group.entries.filter((entry) => !unitId || entry.canonicalUnitId !== unitId),
      })),
    },
  }
  return selectStoryHero(withoutHeroUnit, role)
}

function normalize(value: string): string {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function sameArmy(a: string, b: string): boolean {
  const left = armyByName.get(normalize(a))
  return Boolean(left && left.id === armyByName.get(normalize(b))?.id)
}
