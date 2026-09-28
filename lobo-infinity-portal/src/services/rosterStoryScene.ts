import type { ArmyIntelligenceDecodedEntry as Model, ArmyIntelligenceList, RecentGame } from './api.ts'
import type { GameStoryTemplate } from './gameStoryTemplate.ts'

// These are capabilities in a submitted profile, not a guess based on the
// faction name. A scene can only describe a weapon or screen that exists in
// one of the two decoded lists linked to this particular game.
const longGun = /sniper rifle|missile launcher|rocket launcher|panzerfaust|feuerbach|autocannon|flammenspeer|heavy machine gun|\bHMG\b/i
const rangedGun = /sniper rifle|missile launcher|rocket launcher|panzerfaust|feuerbach|autocannon|heavy machine gun|\bHMG\b|spitfire|thunderbolt|marksman rifle|red fury|combi rifle|plasma rifle|plasma carbine|submachine gun|boarding shotgun|viral tactical bow/i
const meleeSkill = /^(?:Martial Arts|Berserk|Natural Born Warrior|CC Attack|Protheion)(?:\b|\s*[\[(])/i
const meleeWeapon = /CC Weapon|Trench-Hammer|Monofilament/i
const screenWeapon = /smoke grenades?|smoke grenade launcher|disco\s*baller|(?:pt|pheroware tactics)\s*:\s*mirro?rball|eclipse grenades?/i

type Entry = Model | null
type Cast = { hero: Model; allyGun: Entry; enemyGun: Entry; allyAro: Entry; enemyAro: Entry;
  allyVision: Entry; enemyVision: Entry; allyMelee: Entry; enemyMelee: Entry; enemyObjective: Entry }

function entries(list: ArmyIntelligenceList): Model[] {
  return list.decoded?.combatGroups.flatMap((group) => group.entries) ?? []
}

function weapon(model: Entry, test: RegExp): string | null {
  return model?.weapons.find((name) => test.test(name))
    ?.replace(/\s*\([^)]*\)/g, '').trim() ?? null
}

function screen(model: Entry): string | null {
  return model ? [...model.weapons, ...model.equipment].find((name) => screenWeapon.test(name)) ?? null : null
}

function key(model: Entry): string {
  return model?.combinedId || `${model?.canonicalUnitId ?? ''}:${model?.profile ?? ''}`
}

function choose(models: Model[], qualifies: (model: Model) => boolean, used: readonly Entry[] = [],
  score: (model: Model) => number = (model) => model.points): Entry {
  const eligible = models.filter(qualifies).sort((a, b) => score(b) - score(a) || key(a).localeCompare(key(b)))
  return eligible.find((entry) => !used.some((selected) => selected && key(selected) === key(entry))) ?? eligible[0] ?? null
}

function isObjective(model: Model): boolean {
  return model.specialist || model.doctor || model.engineer || model.hacker || model.forwardObserver ||
    model.skills.some((skill) => /^(?:Doctor|Engineer|Hacker|Forward Observer|Paramedic|Specialist Operative)(?:\b|\s*[\[(])/i.test(skill))
}

function canWorkObjective(model: Model, template: GameStoryTemplate): boolean {
  if (!isObjective(model)) return false
  if (template.objectiveSkill === 'infectedCare') {
    return model.doctor || model.skills.some((skill) => /^(?:Doctor|Paramedic|Specialist Operative)(?:\b|\s*[\[(])/i.test(skill))
  }
  if (template.objectiveSkill === 'civilianEscort') {
    return !['REM', 'VH'].includes(String(model.troopType).toUpperCase()) &&
      !model.skills.some((skill) => /^(?:Impetuous|Peripheral)(?:\b|\s*[\[(])/i.test(skill)) &&
      !model.orderTypes?.some((order) => /impetuous/i.test(order))
  }
  return true
}

function isMelee(model: Model): boolean {
  return model.weapons.some((item) => meleeWeapon.test(item)) && model.skills.some((item) => meleeSkill.test(item))
}

function hasGun(model: Model): boolean {
  return (model.bs ?? 0) >= 10 && Boolean(weapon(model, rangedGun))
}

function hasAro(model: Model): boolean {
  return (model.bs ?? 0) >= 10 && (Boolean(weapon(model, longGun)) ||
    model.skills.some((skill) => /^(?:Total Reaction|Neurocinetics)(?:\b|\s*[\[(])/i.test(skill)) && hasGun(model))
}

function gunScore(model: Model): number {
  return (weapon(model, /heavy machine gun|\bHMG\b|spitfire|sniper rifle|thunderbolt|marksman rifle|red fury/i)
    ? 100 : weapon(model, /missile launcher|rocket launcher|feuerbach|autocannon|panzerfaust/i) ? 80 : 0) + model.points
}

function aroScore(model: Model): number {
  return (weapon(model, /sniper rifle|missile launcher|rocket launcher|panzerfaust|feuerbach|autocannon|flammenspeer/i)
    ? 100 : model.skills.some((skill) => /Total Reaction|Neurocinetics/i.test(skill)) ? 85 : 0) + model.points
}

function buildCast(ally: ArmyIntelligenceList, enemy: ArmyIntelligenceList, hero: Model): Cast {
  const a = entries(ally)
  const b = entries(enemy)
  const allyGun = choose(a, hasGun, [hero], gunScore)
  const enemyGun = choose(b, hasGun, [], gunScore)
  const allyAro = choose(a, hasAro, [hero, allyGun], aroScore)
  const enemyAro = choose(b, hasAro, [enemyGun], aroScore)
  return {
    hero, allyGun, enemyGun, allyAro, enemyAro,
    allyVision: choose(a, (model) => Boolean(screen(model)), [hero, allyGun, allyAro]),
    enemyVision: choose(b, (model) => Boolean(screen(model)), [enemyGun, enemyAro]),
    allyMelee: choose(a, isMelee, [hero, allyGun, allyAro]),
    enemyMelee: choose(b, isMelee, [enemyGun, enemyAro]),
    enemyObjective: choose(b, isObjective, [enemyGun], (model) => model.points -
      (enemyGun && model.unit === enemyGun.unit ? 50 : 0)),
  }
}

function upper(value: string): string { return value.charAt(0).toUpperCase() + value.slice(1) }
function indefinite(value: string): string { return /^(?:[aeiou]|AP\b|E\/M\b)/i.test(value) ? 'an' : 'a' }
function count(value: string): number { return value.trim().split(/\s+/).length }
function tidy(value: string): string { return value.replace(/(^|[.!?]\s+)(the|a|an)\b/g,
  (_, lead: string, article: string) => lead + upper(article)) }

function namedSeed(sentence: string, ally: string, enemy: string): string {
  // Only replace a role when the actor has the corresponding qualification.
  // The remaining neutral nouns in a mission prompt describe troops, not a
  // claimed specialist or named member of a player's roster.
  return sentence
    .replace(/\b[Aa] specialist CivEvacing a civilian (approached|sheltered|stopped)\b/g,
      (_, verb: string) => `${ally}, who was escorting a civilian, ${verb}`)
    .replace(/\b[Bb]oth specialists\b/g, `${ally} and ${enemy}`)
    .replace(/\b[Rr]ival specialists?\b/g, enemy)
    .replace(/\b[Tt]he rival (?:specialist|operator)\b/g, enemy)
    .replace(/\b[Aa] specialist\b/g, ally)
    .replace(/\b[Tt]he (?:first |nearest |friendly )?specialist\b/g, ally)
    .replace(/\b[Aa]n operator\b/g, ally)
    .replace(/\b[Tt]he operator\b/g, ally)
}

// Each mission has a different contested consequence. This sentence closes
// the fictional encounter without turning the overall score into an
// invented claim that a particular console, object, or patient was secured.
function missionCounter(mission: string, opponent: string): string {
  switch (mission) {
    case 'Area of Interest': return `${opponent} closed on the relay from the far side; the switch and the ground around it remained two separate problems.`
    case 'Akial Interference': return `${opponent} watched the public cards while the filter request could still be interrupted at the aerial.`
    case 'B-Pong': return `${opponent} turned toward the beacon, with the far console still able to alter its course.`
    case 'Corporate Appropriation': return `${opponent} moved to block the exit; the prototype still had to leave the bay.`
    case 'Critical Intervention': return `${opponent} held the server-room threshold, leaving the data pack's way out under fire.`
    case 'Crossing Lines': return `${opponent} held the far dead zone while the crossing route remained exposed.`
    case "Dead Man's Switch": return `${opponent} contested the Objective Room door as the Quantum Core changed the route through the room.`
    case 'Evacuation': return `${opponent} guarded the Extraction Console, leaving the civilian escort to find a safer angle.`
    case 'Hardlock': return `${opponent} faced the beacon as the last accessible console became the other way to affect its course.`
    case 'Last Launch': return `${opponent} watched the tower checker; an ID Token still had to make it across the room.`
    case 'Neutralization': return `${opponent} held the zone boundary; a recovered token still had to cross it.`
    case 'Outbreak': return `${opponent} stayed beside the patient, threatening the path needed for both the scan and treatment.`
    case 'Panic Room': return `${opponent} covered the Panic Room door while the essential personnel looked for a way inside.`
    case 'Provisioning': return `${opponent} blocked the safety boundary, with the supply box still short of a clear deposit.`
    case 'Annihilation': return `${opponent} guarded the lieutenant's route as both sides tried to protect their remaining troops.`
    case 'Battleground': return `${opponent} entered from the far side; neither patrol could yet leave the future central sector unchallenged.`
    case 'Cutthroat': return `${opponent} stayed near the opposing lieutenant, turning the exposed lane into a danger for both command groups.`
    case 'Superiority': return `${opponent} moved toward the far quadrant while the console and its approach remained under fire.`
    case 'Uplink Center': return `${opponent} reached for the coffin as the antennas blinked, splitting attention between contact and control.`
    case 'Double Bind': return `${opponent} pressed toward the ground beyond the aerial, forcing a choice between the switch and the nearby zone.`
    case 'The Dig': return `${opponent} pressed for the controls; neither side could neutralize the buried unit in contact without a successful analysis.`
    case 'Data Harvest': return `${opponent} neared the designated zone while the harvester still needed a clear place wholly inside it.`
    default: throw new Error(`Missing roster scene consequence for ${mission}`)
  }
}

function tacticalSetting(template: GameStoryTemplate): string | null {
  const source = template.scene!
  if (template.mission === 'The Dig' && /unfinished analysis prompt/i.test(source.turn)) {
    return /stones/i.test(source.turn)
      ? 'Grit fell from a buried contact as rounds struck the edge of the shaft.'
      : 'A rock slipped off the reader and exposed its contact beneath the dust.'
  }
  return source.turn.replace(/\bshifted\b/gi, 'moved')
}

function arrange(parts: string[], extras: string[], minimum = 40): string | null {
  const result = parts.filter(Boolean)
  for (const sentence of extras) {
    if (count(result.join(' ')) >= minimum) break
    if (count([...result, sentence].join(' ')) <= 75) result.push(sentence)
  }
  // Drop the last optional sentence if a real player handle or unit name
  // takes the paragraph over the maximum. Never truncate a model identity.
  while (result.length > 2 && count(result.join(' ')) > 75) result.pop()
  const paragraph = tidy(result.join(' '))
  return count(paragraph) >= minimum && count(paragraph) <= 75 ? paragraph : null
}

export function renderRosterStoryScene(template: GameStoryTemplate, game: RecentGame,
  ally: ArmyIntelligenceList, enemy: ArmyIntelligenceList, hero: Model,
  allyPlayer: string, enemyPlayer: string, ending: string,
  modelName: (model: Model) => string): string | null {
  const source = template.scene
  if (!source) return null
  if (!entries(ally).length || !entries(enemy).length) return null
  const cast = buildCast(ally, enemy, hero)
  const allyNames = new Set(entries(ally).map(modelName))
  const shared = new Set(entries(enemy).map(modelName).filter((value) => allyNames.has(value)))
  const name = (model: Entry, side: 'ally' | 'enemy' = 'ally') => {
    if (!model) return ''
    const display = modelName(model)
    return shared.has(display) ? `${side === 'ally' ? allyPlayer : enemyPlayer}'s ${display.replace(/^the\s+/i, '')}` : display
  }
  const allyObjective = template.role === 'objective' ? hero
    : choose(entries(ally), (model) => canWorkObjective(model, template), [hero])
  const enemyObjective = cast.enemyObjective
  const narrated = (value: string) => cast.allyVision || cast.enemyVision ? value
    : value.replace(/\bsmoke\b/gi, (word) => word === 'Smoke' ? 'Dust' : 'dust')
  const seed = (value: string) => namedSeed(narrated(value),
    allyObjective ? name(allyObjective) : 'an advancing fighter',
    enemyObjective ? name(enemyObjective, 'enemy') : 'an opposing fighter')
  const ground = source.ground
  const position = source.position
  const allyAro = cast.allyAro
  const enemyAro = cast.enemyAro
  const aroActor = allyAro ?? enemyAro
  const aroName = name(aroActor, aroActor === allyAro ? 'ally' : 'enemy')
  const aroWeapon = weapon(aroActor, longGun) ?? weapon(aroActor, rangedGun)
  const aroFaction = aroActor && aroActor === allyAro
    ? ally.sectorial || ally.faction : enemy.sectorial || enemy.faction
  const aroPlayer = aroActor && aroActor === allyAro
    ? allyPlayer : enemyPlayer
  const settingParts = source.setting?.split(/(?<=[.!?])\s+/) ?? []
  const opening = arrange([
    source.setting ? settingParts[0] : seed(source.opening),
    settingParts[1] ?? '',
    seed(source.complication),
    aroActor && aroWeapon
      ? `${aroPlayer}'s ${aroFaction} posted ${aroName} on the route to ${ground} with ${indefinite(aroWeapon)} ${aroWeapon}.`
      : `${upper(name(hero))} entered ${ground} as ${name(enemyObjective ?? entries(enemy)[0], 'enemy')} approached ${position} from the far side.`,
  ], [])

  const aGun = cast.allyGun ?? (hasGun(hero) ? hero : null)
  const bGun = cast.enemyGun
  const contestedPosition = template.mission === 'The Dig' ? 'the reader' : ground
  const objectiveApproach = template.mission === 'The Dig' ? 'the exposed controls' : position
  const meleeApproach = template.mission === 'The Dig' ? 'the excavation lip' : ground
  const variant = (Array.from(template.mission).reduce((sum, char) => sum + char.charCodeAt(0), Number(game.id) || 0)) % 4
  const fire = aGun && bGun
    ? [
      `${upper(name(aGun))} fired ${indefinite(weapon(aGun, rangedGun)!)} ${weapon(aGun, rangedGun)} toward ${position}; ${name(bGun, 'enemy')} answered with ${indefinite(weapon(bGun, rangedGun)!)} ${weapon(bGun, rangedGun)} from the other side.`,
      `${upper(name(bGun, 'enemy'))}'s ${weapon(bGun, rangedGun)} cut across the approach to ${position}; ${name(aGun)} returned fire with ${indefinite(weapon(aGun, rangedGun)!)} ${weapon(aGun, rangedGun)}.`,
      `${upper(name(aGun))} sighted ${position} with ${indefinite(weapon(aGun, rangedGun)!)} ${weapon(aGun, rangedGun)}; ${name(bGun, 'enemy')} met the burst with ${indefinite(weapon(bGun, rangedGun)!)} ${weapon(bGun, rangedGun)}.`,
      `Fire from ${name(aGun)}'s ${weapon(aGun, rangedGun)} struck near ${position}. ${upper(name(bGun, 'enemy'))} fired back across ${ground} with ${indefinite(weapon(bGun, rangedGun)!)} ${weapon(bGun, rangedGun)}.`,
    ][variant]
    : aGun ? `${upper(name(aGun))} fired ${indefinite(weapon(aGun, rangedGun)!)} ${weapon(aGun, rangedGun)} toward ${position}, looking for a gap in the return line.`
      : bGun ? `${upper(name(bGun, 'enemy'))} sent fire from ${indefinite(weapon(bGun, rangedGun)!)} ${weapon(bGun, rangedGun)} along ${ground}, keeping the approach exposed.`
        : `${upper(name(hero))} tested a way through ${ground} while ${name(enemyObjective ?? cast.enemyMelee ?? entries(enemy)[0], 'enemy')} watched the far side.`
  const preferAllyVision = Number(game.id) % 2 === 0
  const visionActor = preferAllyVision
    ? cast.allyVision ?? cast.enemyVision : cast.enemyVision ?? cast.allyVision
  const screenTool = screen(visionActor)
  const visionName = name(visionActor, preferAllyVision
    ? cast.allyVision ? 'ally' : 'enemy' : cast.enemyVision ? 'enemy' : 'ally')
  const vision = visionActor && screenTool
    ? /disco\s*baller/i.test(screenTool)
      ? [
        `${upper(visionName)} set a Disco Baller near ${objectiveApproach}, putting an Eclipse screen between the firing positions.`,
        `${upper(visionName)} sent a Disco Baller toward ${objectiveApproach}; its Eclipse screen cut off the return sightline.`,
        `${upper(visionName)} used a Disco Baller to hide the route to ${objectiveApproach} behind an Eclipse screen.`,
        `An Eclipse screen from ${visionName}'s Disco Baller interrupted the exchange near ${objectiveApproach}.`,
      ][variant]
      : /mirro?rball/i.test(screenTool)
        ? `${upper(visionName)} laid Mirrorball over ${objectiveApproach}, breaking sight across the approach.`
        : `${upper(visionName)} threw a smoke grenade toward ${objectiveApproach}, blocking sight long enough for the next move.`
    : ''
  const meleeActor = cast.enemyMelee ?? cast.allyMelee
  const melee = meleeActor && (cast.enemyMelee || key(meleeActor) !== key(hero))
    ? `${upper(name(meleeActor, cast.enemyMelee ? 'enemy' : 'ally'))} advanced ${vision ? `around the screen toward ${meleeApproach}` : `past ${meleeApproach}`} to threaten ${name(hero)} at close quarters.`
    : ''
  const defender = enemyAro && aroActor === allyAro && weapon(enemyAro, longGun)
    ? `${upper(name(enemyAro, 'enemy'))} covered ${contestedPosition} with ${indefinite(weapon(enemyAro, longGun)!)} ${weapon(enemyAro, longGun)}, waiting for an exposed target.`
    : allyAro && aroActor === enemyAro && weapon(allyAro, longGun)
      ? `${upper(name(allyAro))} kept ${indefinite(weapon(allyAro, longGun)!)} ${weapon(allyAro, longGun)} trained on the return lane.` : ''
  const meleeRelevant = template.role === 'closeCombat' ||
    ['The Dig', 'Cutthroat', 'Panic Room', 'B-Pong', 'Area of Interest', 'Annihilation'].includes(template.mission)
  const opposingObserver = !bGun && entries(enemy)[0]
    ? `${upper(name(entries(enemy)[0], 'enemy'))} watched from ${position} as the opposing shot opened a path to the objective.` : ''
  const middle = arrange([fire, defender, opposingObserver,
    variant % 3 !== 0 || template.mission === 'The Dig' ? vision : '',
    meleeRelevant ? melee : ''], [
    `The opposing fire made the route past ${position} too exposed for an uncontested rush.`,
    `${upper(name(hero))} stayed below the line of fire as ${name(enemyObjective ?? entries(enemy)[0], 'enemy')} searched for another way past ${position}.`,
  ])

  const action = template.role === 'objective' ? source.objectiveAction
    : template.role === 'gunfighting' ? source.gunfighting : source.closeCombat
  const opponent = name(enemyObjective ?? cast.enemyMelee ?? cast.enemyGun ?? cast.enemyAro ?? entries(enemy)[0], 'enemy')
  const enemyMove = missionCounter(template.mission, upper(opponent || `${enemyPlayer}'s remaining fighters`))
  const turn = tacticalSetting(template) ?? seed(source.turn)
  const actionText = template.mission === 'The Dig'
    ? action.replace(/the analysis console input/gi, 'the reader').replace(/the hyperthermal tech/gi, 'the buried unit')
    : action.replace(/\bthe specialist escorting a civilian\b/gi,
      `${name(allyObjective ?? hero)}, who was escorting a civilian`)
      .replace(/\bthe specialist\b/gi, name(allyObjective ?? hero))
  const closing = arrange([seed(turn), `${upper(name(hero))} ${narrated(actionText)}.`, enemyMove], [
    `Across from ${position}, the other force could still make its own attempt.`,
  ])
  if (!opening || !middle || !closing) return null
  const players: Record<string, string> = {
    '{{heroPlayer}}': allyPlayer, '{{otherPlayer}}': enemyPlayer,
    '{{hero}}': name(hero),
  }
  const outcome = Object.entries(players).reduce((value, [tag, player]) => value.replaceAll(tag, player), ending)
  if (/\{\{\w+\}\}/.test(outcome)) return null
  // The game result chooses an ending; the body is a fictional encounter
  // shaped by the mission and decoded rosters, not a turn-by-turn game log.
  return [opening, middle, closing, outcome].join('\n\n')
}
