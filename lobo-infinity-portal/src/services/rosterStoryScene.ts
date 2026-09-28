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
    case "Dead Man's Switch": return `${opponent} held the Objective Room door; reaching the Quantum Core or a Data Pack meant crossing under that watch.`
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
    case 'The Dig': return `${opponent} closed in; even a completed reading would leave someone to get a hand on the marked unit and neutralize it.`
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

function storyGoal(template: GameStoryTemplate): string {
  const action = template.scene!.objectiveAction
  switch (template.mission) {
    case 'Area of Interest': return 'the antenna switch'
    case 'Akial Interference': return 'the Akial Antenna controls'
    case 'B-Pong': return /console/i.test(action) ? 'the beacon console' : 'the tracking beacon'
    case 'Corporate Appropriation': return 'the enemy prototype'
    case 'Critical Intervention': return 'the server-room entrance'
    case 'Evacuation': return 'the Extraction Console'
    case 'Last Launch': return /download|ID Scanner/i.test(action) ? 'the ID Scanner' : 'the ID Checker'
    case 'Neutralization': return /carry the Hyperthermal Tech/i.test(action)
      ? 'the Neutralization Area boundary' : 'the Hyperthermal Tech Box'
    case 'Outbreak': return 'the Infected patient'
    case 'Panic Room': return 'the Panic Room entrance'
    case 'Provisioning': return 'the Tech-Coffin'
    case 'The Dig': return 'the reader'
    case 'Data Harvest': return /carried|deposit|place it/i.test(action)
      ? 'the designated zone' : 'the data-harvester'
    default: return template.scene!.position
  }
}

function goalReferent(mission: string, goal: string): string {
  switch (mission) {
    case 'Area of Interest': return 'the switch'
    case 'Akial Interference': return 'the aerial'
    case 'Evacuation': return 'the console'
    case 'Neutralization': return goal.endsWith('Box') ? 'the box' : 'the boundary'
    case 'Panic Room': return 'the doorway'
    case 'Data Harvest': return goal.endsWith('zone') ? 'the zone' : 'the harvester'
    default: return goal
  }
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

function familiarName(value: string): string {
  // Named characters can be addressed by surname after their introduction.
  // A generic unit like "the Field Engineer" retains its full designation.
  return /^the\s/i.test(value) || /['’]s\s/.test(value)
    ? value : value.split(/\s+/).at(-1) ?? value
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
  const opposingObjectiveActor = cast.enemyObjective
  const narrated = (value: string) => cast.allyVision || cast.enemyVision ? value
    : value.replace(/\bsmoke\b/gi, (word) => word === 'Smoke' ? 'Dust' : 'dust')
  const seed = (value: string) => namedSeed(narrated(value),
    allyObjective ? name(allyObjective) : 'an advancing fighter',
    opposingObjectiveActor ? name(opposingObjectiveActor, 'enemy') : 'an opposing fighter')
  const ground = source.ground
  const goal = storyGoal(template)
  const shorterGoal = goalReferent(template.mission, goal)
  const heroName = name(hero)
  const heroLater = familiarName(heroName)
  const enemyObjective = name(cast.enemyObjective ?? entries(enemy)[0], 'enemy')
  // Choose one opposing firing position for the scene. The supporting cast
  // answers that obstacle; they are not a roll call of every roster role.
  const threat = cast.enemyAro ?? cast.enemyGun
  const threatName = name(threat, 'enemy')
  const threatWeapon = weapon(threat, longGun) ?? weapon(threat, rangedGun)
  const settingParts = source.setting?.split(/(?<=[.!?])\s+/) ?? []
  const introducedHero = [source.opening, source.complication].some((part) =>
    seed(part).includes(heroName))
  const opening = arrange([
    source.setting ? settingParts[0] : seed(source.opening),
    settingParts[1] ?? '',
    seed(source.complication),
    threat && threatWeapon
      ? introducedHero
        ? `${upper(threatName)} covered the crossing with ${indefinite(threatWeapon)} ${threatWeapon}; the way to ${goal} had no safe angle.`
        : `${upper(threatName)} covered the crossing with ${indefinite(threatWeapon)} ${threatWeapon}; ${heroName} needed that lane quiet to reach ${goal}.`
      : `${upper(heroName)} had to cross ${ground} before ${enemyObjective} closed off ${goal}.`,
  ], [`Neither crew could reach ${goal} without exposing its lead fighter.`])

  const supportingGun = cast.allyGun ?? (hasGun(hero) ? hero : cast.allyAro)
  const supportingName = name(supportingGun)
  const supportingWeapon = weapon(supportingGun, rangedGun)
  const variant = (Array.from(template.mission).reduce((sum, letter) => sum + letter.charCodeAt(0),
    Number(game.id) || 0)) % 4
  const shot = supportingGun && supportingWeapon && threat
    ? [
      `${upper(supportingName)} answered ${threatName}'s fire with ${indefinite(supportingWeapon)} ${supportingWeapon}, drawing the return shots away from ${goal}.`,
      `For a moment ${threatName} had to face ${supportingName}'s ${supportingWeapon} instead of watching ${goal}.`,
      `${upper(threatName)} kept watch over ${goal} until ${supportingName} fired ${indefinite(supportingWeapon)} ${supportingWeapon} from the other side.`,
      `The answer to ${threatName}'s fire came from ${supportingName}'s ${supportingWeapon}; the route to ${goal} opened for a moment.`,
    ][variant]
    : supportingGun && supportingWeapon
      ? `${upper(supportingName)} fired ${indefinite(supportingWeapon)} ${supportingWeapon} across ${ground}, easing the pressure on the route to ${goal}.`
      : `${upper(heroLater)} waited behind cover until the fighting broke the watch on ${goal}.`
  const visionActor = cast.allyVision && key(cast.allyVision) !== key(supportingGun)
    ? cast.allyVision : cast.enemyVision
  const visionTool = screen(visionActor)
  const allyScreen = Boolean(visionActor && visionActor === cast.allyVision)
  const visionName = name(visionActor, allyScreen ? 'ally' : 'enemy')
  const screening = visionActor && visionTool
    ? /disco\s*baller/i.test(visionTool)
      ? [
        `${upper(visionName)} sent a Disco Baller toward ${shorterGoal}; its Eclipse screen cut the firing lane in two.`,
        `An Eclipse screen spilled from ${visionName}'s Disco Baller across the approach to ${shorterGoal}.`,
        `${upper(visionName)} rolled a Disco Baller between the firing positions; Eclipse hid ${shorterGoal} from the far side.`,
        `${upper(visionName)} sent a Disco Baller across the approach to ${shorterGoal}, leaving the return sightline lost in Eclipse.`,
      ][variant]
      : /mirro?rball/i.test(visionTool)
        ? `${upper(visionName)} spread Mirrorball across the route to ${shorterGoal}, breaking sight between the firing positions.`
        : /launcher/i.test(visionTool)
          ? `${upper(visionName)} fired a smoke grenade toward ${shorterGoal}, hiding the next few steps from the far side.`
          : `${upper(visionName)} threw a smoke grenade toward ${shorterGoal}, hiding the next few steps from the far side.`
    : ''
  const openingInFire = screening
    ? allyScreen
      ? [
        `${upper(heroLater)} gained a few steps, not safety: ${enemyObjective} was already nearing ${shorterGoal} from the other side.`,
        `${upper(heroLater)} used the blind stretch to approach ${shorterGoal}; ${enemyObjective} was coming from the far side.`,
        `The cover bought ${heroLater} a short crossing, but ${enemyObjective} was heading for ${shorterGoal} too.`,
        `${upper(enemyObjective)} appeared beyond ${shorterGoal} before ${heroLater} could use all of the cover.`,
      ][variant]
      : `${upper(heroLater)} had to find another angle while ${enemyObjective} moved toward ${shorterGoal} behind the screen.`
    : `${upper(heroLater)} saw an opening, but ${enemyObjective} had begun to move toward ${shorterGoal} too.`
  const middle = arrange([shot, screening, openingInFire], [
    `From either side, the gap toward ${goal} seemed smaller than it had before the exchange.`,
  ])

  const action = template.role === 'objective' ? source.objectiveAction
    : template.role === 'gunfighting' ? source.gunfighting : source.closeCombat
  const opponent = enemyObjective
  const enemyMove = missionCounter(template.mission, upper(opponent || `${enemyPlayer}'s remaining fighters`))
  const turn = tacticalSetting(template) ?? seed(source.turn)
  const actionText = template.mission === 'The Dig'
    ? action.replace(/the analysis console input/gi, 'the reader').replace(/the hyperthermal tech/gi, 'the buried unit')
    : action.replace(/\bthe specialist escorting a civilian\b/gi,
      `${name(allyObjective ?? hero)}, who was escorting a civilian`)
      .replace(/\bthe specialist\b/gi, name(allyObjective ?? hero))
  // If a role action confronts a guard, use the rostered defender already
  // holding the lane. This keeps the same conflict alive into the last beat.
  const encounter = template.role !== 'objective' && threat
    ? actionText.replace(/\b(?:the|a|an)\s+(?:(?:analysis-console|Akial Antenna|lift|wreck|transport|tower|supply-box|antenna|prototype cradle)\s+)?(?:guard|defender)\b/gi,
      threatName)
    : actionText
  const closing = arrange([seed(turn), `${upper(heroLater)} ${narrated(encounter)}.`, enemyMove], [
    `Neither side could leave ${ground} undefended while the other force was still approaching.`,
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
