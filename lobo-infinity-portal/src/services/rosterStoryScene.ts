import type { ArmyIntelligenceDecodedEntry as Model, ArmyIntelligenceList, RecentGame } from './api.ts'
import type { GameStoryTemplate } from './gameStoryTemplate.ts'

// These are capabilities in a submitted profile, not a guess based on the
// faction name. A scene can only describe a weapon or screen that exists in
// one of the two decoded lists linked to this particular game.
const longGun = /sniper rifle|missile launcher|rocket launcher|panzerfaust|feuerbach|autocannon|flammenspeer|heavy machine gun|\bHMG\b/i
const rangedGun = /sniper rifle|missile launcher|rocket launcher|panzerfaust|feuerbach|autocannon|heavy machine gun|\bHMG\b|spitfire|thunderbolt|marksman rifle|red fury|combi rifle|plasma rifle|plasma carbine|submachine gun|boarding shotgun|viral tactical bow/i
const meleeSkill = /^(?:Martial Arts|Berserk|Natural Born Warrior|CC Attack|Protheion)(?:\b|\s*[[(])/i
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
    model.skills.some((skill) => /^(?:Doctor|Engineer|Hacker|Forward Observer|Paramedic|Specialist Operative)(?:\b|\s*[[(])/i.test(skill))
}

function canWorkObjective(model: Model, template: GameStoryTemplate): boolean {
  if (!isObjective(model)) return false
  if (template.objectiveSkill === 'infectedCare') {
    return model.doctor || model.skills.some((skill) => /^(?:Doctor|Paramedic|Specialist Operative)(?:\b|\s*[[(])/i.test(skill))
  }
  if (template.objectiveSkill === 'civilianEscort') {
    return !['REM', 'VH'].includes(String(model.troopType).toUpperCase()) &&
      !model.skills.some((skill) => /^(?:Impetuous|Peripheral)(?:\b|\s*[[(])/i.test(skill)) &&
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
    model.skills.some((skill) => /^(?:Total Reaction|Neurocinetics)(?:\b|\s*[[(])/i.test(skill)) && hasGun(model))
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
  const heroUnit = a.filter((model) => model.canonicalUnitId === hero.canonicalUnitId ||
    Boolean(model.unit && model.unit === hero.unit))
  const allyGun = choose(a, hasGun, heroUnit, gunScore)
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
    .replace(/\b[Aa] specialist carrying a Data Pack\b/g, `${ally}, carrying a Data Pack,`)
    .replace(/\b[Aa] specialist CivEvacing a civilian (approached|sheltered|stopped)\b/g,
      (_, verb: string) => `${ally}, who was escorting a civilian, ${verb}`)
    .replace(/\b[Bb]oth specialists\b/g, `${ally} and ${enemy}`)
    .replace(/\b[Rr]ival specialists?\b/g, enemy)
    .replace(/\b[Tt]he rival (?:specialist|operator)\b/g, enemy)
    .replace(/\b[Aa] specialist\b/g, ally)
    .replace(/\b[Tt]he (?:first |nearest |friendly )?specialist\b/g, ally)
    .replace(/\b[Aa]n operator\b/g, ally)
    .replace(/\b[Tt]he operator\b/g, ally)
    .replace(/\b[Aa] rival fighter\b/g, enemy)
    .replace(/\b[Aa] bodyguard\b/g, enemy)
}

// Every mission and location now carries its own incident aftermath and
// result. Reusing a mission-wide counter borrowed props from other scenes.
function missionCounter(template: GameStoryTemplate, opponent: string, hero: string,
  route: string, variant: number): string {
  const beat = template.scene?.incidentBeat
  if (!beat) throw new Error(`Missing incident consequence for ${template.mission}`)
  const aftermath = beat.aftermath.replace(/[.!?]\s*$/, '')
  const crossing = template.mission === 'Area of Interest'
    ? `${route} beside ${template.scene!.ground}, which remained contested` : route
  const rival = opponent.replace(/^The /, 'the ')
  return [
    `${aftermath}; ${rival} closed on ${hero} at ${crossing}.`,
    `${aftermath}; ${rival} held ${crossing} against ${hero}.`,
    `${aftermath}. ${opponent} pressed ${hero} back at ${crossing}.`,
    `${aftermath}; ${rival} challenged ${hero} along ${crossing}.`,
  ][variant]
}

function rosterResolution(template: GameStoryTemplate, ending: string,
  hero: string, opponent: string, allyPlayer: string, enemyPlayer: string,
  route: string, variant: number): string | null {
  const { mission, scene } = template
  const beat = scene?.incidentBeat
  if (!beat) throw new Error(`Missing incident resolution for ${mission}`)
  // The result chooses the direction of this fictional encounter. The feed
  // does not identify which individual objective was scored in the game.
  const result = ending === scene.endings.heroWins ? 'heroWins'
    : ending === scene.endings.heroLoses ? 'heroLoses'
      : ending === scene.endings.draw ? 'draw' : null
  if (!result) return null
  const a = `${allyPlayer}’s crew`
  const b = `${enemyPlayer}’s crew`
  const h = upper(hero)
  const o = upper(opponent)
  const resultSites: Record<string, string> = {
    'The Dig': 'the buried tech',
    'B-Pong': 'the tracking beacon',
    'Corporate Appropriation': 'the enemy prototype',
    Evacuation: 'the Extraction Console',
    Outbreak: 'the Infected patient',
    Provisioning: 'the supply box',
    Battleground: 'the central sector',
  }
  const location = mission === 'Neutralization' ? storyGoal(template) : resultSites[mission] ?? route
  const winner = beat.winner.replaceAll('{winner}', a)
  const loser = beat.winner.replaceAll('{winner}', b)
  return ({
    heroWins: [
      `${h} cut across ${opponent}’s path at ${location}; ${winner}.`,
      `${h} held ${opponent} back near ${location}, while ${winner}.`,
      `${upper(winner)} as ${hero} kept ${opponent} from ${location}.`,
      `${h} forced ${opponent} off the approach to ${location}, and ${winner}.`,
    ][variant],
    heroLoses: [
      `${o} cut across ${hero}’s path at ${location}; ${loser}.`,
      `${o} got past ${hero} near ${location}, while ${loser}.`,
      `${upper(loser)} as ${opponent} kept ${hero} from ${location}.`,
      `${o} forced ${hero} off the approach to ${location}, and ${loser}.`,
    ][variant],
    draw: [
      `${h} and ${opponent} watched ${location} as ${beat.draw}; neither ${a} nor ${b} could break through.`,
      `${h} and ${opponent} held opposite sides of ${location} as ${beat.draw}; neither ${a} nor ${b} could force a clear approach.`,
      `${upper(beat.draw)}; neither ${a} nor ${b} could get past ${hero} and ${opponent} at ${location}.`,
      `${h} faced ${opponent} across ${location} while ${beat.draw}; neither ${a} nor ${b} broke the deadlock.`,
    ][variant],
  })[result]
}

function tacticalSetting(template: GameStoryTemplate): string | null {
  const source = template.scene!
  if (template.mission === 'The Dig' && /unfinished analysis prompt/i.test(source.turn)) {
    return /stones/i.test(source.turn)
      ? 'A fresh volley jarred the rim, shaking grit from the buried contact.'
      : 'A rock broke loose from the reader and exposed its contact beneath the dust.'
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
    case 'Provisioning': return /carry|carried|safe area/i.test(action)
      && template.scene?.incidentIndex === 2 ? 'the safe-area boundary' : 'the supply box at the Tech-Coffin'
    case 'Battleground': return 'the central sector'
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
    case 'Outbreak': return 'the patient'
    case 'Panic Room': return 'the doorway'
    case 'Provisioning': return 'the box'
    case 'The Dig': return 'the console'
    case 'Data Harvest': return goal.endsWith('zone') ? 'the zone' : 'the harvester'
    default: return goal
  }
}

// A crossing is a place in the encounter, rather than another name for the
// objective. Keep it broad enough to hold for every incident in the mission.
function missionApproach(mission: string, ground: string, incidentIndex?: number): string {
  switch (mission) {
    case 'Area of Interest': return 'the foot of the relay mast'
    case 'Akial Interference': return 'the aerial service walk'
    case 'B-Pong': return 'the console end of the beacon lane'
    case 'Corporate Appropriation': return ground
    case 'Critical Intervention': return 'the server-room threshold'
    case 'Crossing Lines': return 'the dead-zone boundary'
    case "Dead Man's Switch": return 'the Objective Room doorway'
    case 'Evacuation': return 'the extraction passage'
    case 'Hardlock': return 'the beacon lane'
    case 'Last Launch': return /approach to/i.test(ground) ? 'the ID Scanner' : ground
    case 'Neutralization': return 'the box-side crossing'
    case 'Outbreak': return 'the patient’s side of the corridor'
    case 'Panic Room': return 'the Panic Room doorway'
    case 'Provisioning': return incidentIndex === 2 ? 'the safe-area boundary' : 'the Tech-Coffin'
    case 'Annihilation': return 'the edge of the ruined street'
    case 'Battleground': return 'the disputed center'
    case 'Cutthroat': return 'the gap between the lieutenants'
    case 'Superiority': return 'the quadrant boundary'
    case 'Uplink Center': return 'the space between the Tech-Coffin and the antennas'
    case 'Double Bind': return 'the aerial’s base'
    case 'The Dig': return 'the excavation lip'
    case 'Data Harvest': return 'the designated zone boundary'
    default: return ground
  }
}

// Live roster scenes can use longer paragraphs than the archived, hand-edited
// catalog. Keep complete actors and consequences instead of dropping the last
// beat merely to satisfy the catalog's separate 75-word template limit.
function arrange(parts: string[], extras: string[], minimum = 40, maximum = 100): string | null {
  const result = parts.filter(Boolean)
  for (const sentence of extras) {
    if (count(result.join(' ')) >= minimum) break
    if (count([...result, sentence].join(' ')) <= maximum) result.push(sentence)
  }
  // Drop the last optional sentence if a real player handle or unit name
  // takes the paragraph over the maximum. Never truncate a model identity.
  while (result.length > 2 && count(result.join(' ')) > maximum) result.pop()
  const paragraph = tidy(result.join(' '))
  return count(paragraph) >= minimum && count(paragraph) <= maximum ? paragraph : null
}

function familiarName(value: string): string {
  // Named characters can be addressed by surname after their introduction.
  // A generic unit like "the Field Engineer" retains its full designation.
  return /^the\s/i.test(value) || /['’]s\s/.test(value)
    ? value : value.split(/\s+/).at(-1) ?? value
}

function joinTurningPoint(turn: string, actor: string, action: string,
  mission: string, variant: number, properNames: readonly string[] = []): string {
  const event = turn.replace(/[.!?]\s*$/, '')
  if (mission === 'The Dig' && /(?:volley jarred|rock broke loose)/i.test(event)) {
    return `${event} as ${actor} ${action}.`
  }
  // A simple physical change is clearer as the cause of the attempt. Longer
  // clauses already contain their own timing and need their own sentence.
  if (count(event) <= 22 && !/\b(?:as|while|when)\b/i.test(event)) {
    const beginsWithName = properNames.some((name) => name && !/^(?:the|a|an)\s/i.test(name) && event.startsWith(name))
    const changed = beginsWithName ? event : event.charAt(0).toLowerCase() + event.slice(1)
    if (variant === 0) return `When ${changed}, ${actor} ${action}.`
    if (variant === 1) return `As ${changed}, ${actor} ${action}.`
    if (variant === 2) return `${turn} ${upper(actor)} ${action}.`
    return `${event}; ${actor} ${action}.`
  }
  return `${turn} ${upper(actor)} ${action}.`
}

export function renderRosterStoryScene(template: GameStoryTemplate, game: RecentGame,
  ally: ArmyIntelligenceList, enemy: ArmyIntelligenceList, hero: Model,
  allyPlayer: string, enemyPlayer: string, ending: string,
  modelName: (model: Model) => string): string | null {
  const source = template.scene
  if (!source) return null
  if (!entries(ally).length || !entries(enemy).length) return null
  const cast = buildCast(ally, enemy, hero)
  const mirror = Boolean(game.winnerFaction && game.winnerFaction === game.loserFaction)
  const allyNames = new Set(entries(ally).map(modelName))
  const shared = new Set(entries(enemy).map(modelName).filter((value) => allyNames.has(value)))
  const name = (model: Entry, side: 'ally' | 'enemy' = 'ally') => {
    if (!model) return ''
    const display = modelName(model)
    return mirror || shared.has(display)
      ? `${side === 'ally' ? allyPlayer : enemyPlayer}'s ${display.replace(/^the\s+/i, '')}` : display
  }
  const allyObjective = template.role === 'objective' ? hero
    : choose(entries(ally), (model) => canWorkObjective(model, template),
      entries(ally).filter((model) => model.canonicalUnitId === hero.canonicalUnitId ||
        Boolean(model.unit && model.unit === hero.unit)))
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
  const firstLine = source.setting ? settingParts[0] : seed(source.opening)
  const secondLine = settingParts[1] ?? ''
  const complication = seed(source.complication).replaceAll(heroName,
    firstLine.includes(heroName) || secondLine.includes(heroName) ? heroLater : heroName)
  const variant = (Array.from(template.mission).reduce((sum, letter) => sum + letter.charCodeAt(0),
    Number(game.id) || 0)) % 4
  const route = missionApproach(template.mission, ground, source.incidentIndex)
  const obstruction = threat && threatWeapon
    ? template.mission === 'The Dig'
      ? `Between ${introducedHero ? heroLater : heroName} and ${goal}, ${threatName} held the crossing with ${indefinite(threatWeapon)} ${threatWeapon}.`
      : [
        `${upper(threatName)} trained ${indefinite(threatWeapon)} ${threatWeapon} on the approach to ${goal}, keeping ${introducedHero ? heroLater : heroName} behind cover.`,
        `${upper(introducedHero ? heroLater : heroName)} could see ${goal}, but ${threatName}'s ${threatWeapon} covered the open ground between them.`,
        `The route to ${firstLine.includes(goal) ? shorterGoal : goal} lay in view of the ${threatWeapon} carried by ${threatName}; ${introducedHero ? heroLater : heroName} paused at its edge.`,
        `As ${introducedHero ? heroLater : heroName} worked toward ${goal}, ${threatName} swung ${indefinite(threatWeapon)} ${threatWeapon} across the approach.`,
      ][variant]
    : `${upper(heroName)} had to cross ${ground} before ${enemyObjective} closed off ${goal}.`
  const opening = arrange([
    firstLine,
    secondLine,
    complication,
    obstruction,
  ], [`The exposed approach gave both crews a view of anyone trying to reach ${goal}.`])

  const supportingGun = cast.allyGun ?? (hasGun(hero) ? hero : cast.allyAro)
  const supportingName = name(supportingGun)
  const supportingWeapon = weapon(supportingGun, rangedGun)
  const selfCovering = supportingGun && key(supportingGun) === key(hero)
  const shot = supportingGun && supportingWeapon && threat
    ? [
      `${upper(supportingName)} opened fire with ${indefinite(supportingWeapon)} ${supportingWeapon}, drawing ${threatName} away from the route between ${heroLater} and ${shorterGoal}.`,
      `${upper(supportingName)} fired at ${threatName} with ${indefinite(supportingWeapon)} ${supportingWeapon}, drawing the guard's eye away from ${shorterGoal}.`,
      `${upper(threatName)} watched ${heroLater} work toward ${shorterGoal} until ${supportingName}'s ${supportingWeapon} drew fire across the gap.`,
      `${upper(supportingName)} fired ${indefinite(supportingWeapon)} ${supportingWeapon} at ${threatName}; the return fire broke the guard's watch on ${shorterGoal}.`,
    ][variant]
    : supportingGun && supportingWeapon
      ? selfCovering
        ? `${upper(heroLater)} fired ${indefinite(supportingWeapon)} ${supportingWeapon} toward ${enemyObjective} before moving toward ${goal}.`
        : `${upper(supportingName)} sent fire from ${indefinite(supportingWeapon)} ${supportingWeapon} across ${ground}, giving ${heroLater} room to move toward ${goal}.`
      : `${upper(heroLater)} held back while ${enemyObjective} watched the route to ${goal} from the opposite side.`
  // An opposing smoke screen is a tactical obstacle, not cover supplied to
  // the hero. When the ally has no screening model, keep the firefight in
  // view instead of silently turning enemy equipment into allied support.
  const visionActor = cast.allyVision && key(cast.allyVision) !== key(supportingGun)
    ? cast.allyVision : null
  const visionTool = screen(visionActor)
  const allyScreen = Boolean(visionActor)
  const visionName = name(visionActor)
  const screening = visionActor && visionTool
    ? /disco\s*baller/i.test(visionTool)
      ? [
        `${upper(visionName)} rolled a Disco Baller across the firing lane, laying Eclipse between ${heroLater} and ${route}.`,
        `${upper(visionName)} rolled a Disco Baller into the gap, spreading Eclipse across the exposed route while the guns answered each other.`,
        `${upper(visionName)} rolled a Disco Baller past the exchange, letting Eclipse cover the last steps toward ${route}.`,
        `${upper(visionName)} sent a Disco Baller into the gap; Eclipse swallowed the exposed route to ${route}.`,
      ][variant]
      : /mirro?rball/i.test(visionTool)
        ? `${upper(visionName)} spread Mirrorball across ${route} while the return fire was still searching for an angle.`
        : /launcher/i.test(visionTool)
          ? `${upper(visionName)} fired a smoke grenade across ${route}, cutting the return sightline before the next crossing.`
          : `${upper(visionName)} threw a smoke grenade across ${route}, cutting the return sightline before the next crossing.`
    : ''
  const openingInFire = screening
    ? allyScreen
      ? [
        `Behind the screen, ${heroLater} reached ${route} as ${enemyObjective} moved in from the other side.`,
        `${upper(heroLater)} took the blind stretch toward ${route}; the reprieve lasted only until ${enemyObjective} appeared on the far side.`,
        `The screen gave ${heroLater} a route to ${route}, but ${enemyObjective} cut across it from the opposite flank.`,
        `${upper(heroLater)} slipped along the obscured edge toward ${route}; ${enemyObjective} turned in time to contest the last few steps.`,
      ][variant]
      : `${upper(heroLater)} waited for the far edge of the screen to clear, then pushed toward ${route} as ${enemyObjective} came through the haze.`
    : supportingGun && supportingWeapon
      ? threat
        ? `${upper(heroLater)} crossed toward ${route} while ${threatName} answered the supporting fire; ${enemyObjective} moved to meet them there.`
        : `${upper(heroLater)} moved toward ${route} before ${enemyObjective} could close the gap from the far side.`
      : `${upper(heroLater)} edged toward ${route} under watch; ${enemyObjective} came in from the other side.`
  const middle = arrange([shot, screening, openingInFire], [
    `The brief advantage ended wherever the two approaches met near ${goal}.`,
  ])

  const action = template.role === 'objective' ? source.objectiveAction
    : template.role === 'gunfighting' ? source.gunfighting : source.closeCombat
  const opponent = enemyObjective
  const enemyMove = missionCounter(template, upper(opponent || `${enemyPlayer}'s remaining fighters`),
    heroLater, route, variant)
  const turn = tacticalSetting(template) ?? seed(source.turn)
  const actionText = template.mission === 'The Dig'
    ? action.replace(/the analysis console input/gi, 'the reader')
      .replace(/the hyperthermal tech/gi, 'the buried unit')
      .replace(/attempted a WIP (?:reading|analysis) of/gi, 'tried to analyze')
      .replace(/began a reading of/gi, 'began analyzing')
    : action.replace(/\bthe specialist escorting a civilian\b/gi,
      `${name(allyObjective ?? hero)}, who was escorting a civilian`)
      .replace(/\bthe specialist\b/gi, name(allyObjective ?? hero))
  // A gunfighter can shoot at the distant firing position; a melee fighter
  // can only reach the defender who came through the crossing in this scene.
  const encounter = template.role !== 'objective'
    ? seed(actionText).replace(/\b(?:the|a|an)\s+(?:(?:analysis-console|Akial Antenna|lift|wreck|transport|tower|supply-box|antenna|prototype cradle)\s+)?(?:guard|defender)\b/gi,
      template.role === 'closeCombat' ? enemyObjective : threatName)
    : actionText
  const turningPoint = joinTurningPoint(seed(turn), heroLater, narrated(encounter),
    template.mission, variant, [enemyObjective, heroName, heroLater])
  // Give a nearby fighter time to enter before the hero grapples them.
  // Shooting and objective actions retain their existing cause and response.
  const closing = arrange(template.role === 'closeCombat'
    ? [`${seed(turn)} ${enemyMove}`, `${upper(heroLater)} ${narrated(encounter)}.`]
    : [turningPoint, enemyMove], [
    `Neither side could leave ${ground} undefended while the other force was still approaching.`,
  ])
  if (!opening || !middle || !closing) return null
  const players: Record<string, string> = {
    '{{heroPlayer}}': allyPlayer, '{{otherPlayer}}': enemyPlayer,
    '{{hero}}': name(hero),
  }
  const narrativeEnding = rosterResolution(template, ending,
    heroLater, enemyObjective, allyPlayer, enemyPlayer, route, variant) ?? ending
  const outcome = Object.entries(players).reduce((value, [tag, player]) => value.replaceAll(tag, player), narrativeEnding)
  if (/\{\{\w+\}\}/.test(outcome)) return null
  // The game result chooses an ending; the body is a fictional encounter
  // shaped by the mission and decoded rosters, not a turn-by-turn game log.
  return [opening, middle, closing, outcome].join('\n\n')
}
