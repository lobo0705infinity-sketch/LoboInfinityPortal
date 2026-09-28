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
function missionCounter(mission: string, opponent: string, hero: string): string {
  switch (mission) {
    case 'Area of Interest': return `${opponent} pushed back into the courtyard as the mast flickered, closing on the switch while the ground around it remained contested.`
    case 'Akial Interference': return `${opponent} turned toward the aerial as the filter flickered, close enough to cut in before the public cards rotated.`
    case 'B-Pong': return `${opponent} darted across the lane toward the next console, where a single input could send the beacon back the other way.`
    case 'Corporate Appropriation': return `${opponent} reached the lift lip as the carriage dropped, hemming the prototype and its carrier against the bay wall.`
    case 'Critical Intervention': return `${opponent} stepped out from behind the rack with the Data Pack in sight, cutting off the server-room door just as the carrier reached it.`
    case 'Crossing Lines': return `${opponent} stepped into the far dead zone; the antenna was at ${hero}'s back, with only the contested crossing between them.`
    case "Dead Man's Switch": return `${opponent} cut across the Objective Room toward the Quantum Core, separating its carrier from the Data Pack at the doorway.`
    case 'Evacuation': return `${opponent} came around the barrier, pinning the escort beside the civilian just short of contact with the Extraction Console.`
    case 'Hardlock': return `${opponent} came down the beacon lane just as the console face lit up, closing the route to the enemy beacon.`
    case 'Last Launch': return `${opponent} headed for the ID Checker while the download request held at the scanner, leaving the tower between the two crews.`
    case 'Neutralization': return `${opponent} took the gap beside the box; if the token came loose, the route to the Neutralization Area ran straight through that position.`
    case 'Outbreak': return `${opponent} entered the corridor by the stretcher, close enough to interrupt the Infected patient’s stabilization before it could take hold.`
    case 'Panic Room': return `${opponent} was already inside, turning down the inner wall toward Essential Personnel while the broken panel swung behind them.`
    case 'Provisioning': return `${opponent} reached the safe area from the opposite lane as the supply box came through the scattered gear.`
    case 'Annihilation': return `${opponent} came through the wreck after the squad, keeping the enemy lieutenant’s position screened while the survivors traded fire in the gap.`
    case 'Battleground': return `${opponent} followed through the broken barrier, forcing a fight for the ground that would become the central sector at battle’s end.`
    case 'Cutthroat': return `${opponent} slipped through the shutter gap toward the friendly lieutenant while the rival officer withdrew behind the opposite wall.`
    case 'Superiority': return `${opponent} entered from the far quadrant while the console light changed, forcing a fight on both sides of the boundary.`
    case 'Uplink Center': return `${opponent} reached the Tech-Coffin’s far side, threatening the gap between it and the antenna the first squad had just left.`
    case 'Double Bind': return `${opponent} crossed under the aerial toward ${hero}, narrowing the contested zone to the strip of ground between them.`
    case 'The Dig': return `Across the pit, ${opponent.replace(/^The /, 'the ')} slid toward the tech; ${hero} would have to follow into the rubble to neutralize it.`
    case 'Data Harvest': return `${opponent} cut in from the opposite wall, close enough to interrupt the deposit before the harvester could be set down inside the designated zone.`
    default: throw new Error(`Missing roster scene consequence for ${mission}`)
  }
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
    case 'The Dig': return 'the console'
    case 'Data Harvest': return goal.endsWith('zone') ? 'the zone' : 'the harvester'
    default: return goal
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

function joinTurningPoint(turn: string, actor: string, action: string, mission: string): string {
  const event = turn.replace(/[.!?]\s*$/, '')
  if (mission === 'The Dig' && /(?:volley jarred|rock broke loose)/i.test(event)) {
    return `${event} as ${actor} ${action}.`
  }
  // A simple physical change is clearer as the cause of the attempt. Longer
  // clauses already contain their own timing and need their own sentence.
  if (count(event) <= 22 && !/\b(?:as|while|when)\b/i.test(event)) {
    return `When ${event.charAt(0).toLowerCase() + event.slice(1)}, ${actor} ${action}.`
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
  const firstLine = source.setting ? settingParts[0] : seed(source.opening)
  const secondLine = settingParts[1] ?? ''
  const complication = seed(source.complication).replaceAll(heroName,
    firstLine.includes(heroName) || secondLine.includes(heroName) ? heroLater : heroName)
  const opening = arrange([
    firstLine,
    secondLine,
    complication,
    threat && threatWeapon
      ? `Between ${introducedHero ? heroLater : heroName} and ${goal}, ${threatName} held the crossing with ${indefinite(threatWeapon)} ${threatWeapon}.`
      : `${upper(heroName)} had to cross ${ground} before ${enemyObjective} closed off ${goal}.`,
  ], [`The exposed approach gave both crews a view of anyone trying to reach ${goal}.`])

  const supportingGun = cast.allyGun ?? (hasGun(hero) ? hero : cast.allyAro)
  const supportingName = name(supportingGun)
  const supportingWeapon = weapon(supportingGun, rangedGun)
  const variant = (Array.from(template.mission).reduce((sum, letter) => sum + letter.charCodeAt(0),
    Number(game.id) || 0)) % 4
  const shot = supportingGun && supportingWeapon && threat
    ? [
      `${upper(supportingName)} drew ${threatName}'s fire away from ${goal} with ${indefinite(supportingWeapon)} ${supportingWeapon}.`,
      `${upper(supportingName)} fired at ${threatName} with ${indefinite(supportingWeapon)} ${supportingWeapon}, drawing the guard's eye away from ${shorterGoal}.`,
      `A burst from ${supportingName}'s ${supportingWeapon} pulled ${threatName}'s attention off ${goal}.`,
      `The answer came from ${supportingName}'s ${supportingWeapon}; ${threatName} fired back instead of watching ${goal}.`,
    ][variant]
    : supportingGun && supportingWeapon
      ? `${upper(supportingName)} sent fire from ${indefinite(supportingWeapon)} ${supportingWeapon} across ${ground}, giving ${heroLater} room to move toward ${goal}.`
      : `${upper(heroLater)} held back while ${enemyObjective} watched the route to ${goal} from the opposite side.`
  const visionActor = cast.allyVision && key(cast.allyVision) !== key(supportingGun)
    ? cast.allyVision : cast.enemyVision
  const visionTool = screen(visionActor)
  const allyScreen = Boolean(visionActor && visionActor === cast.allyVision)
  const visionName = name(visionActor, allyScreen ? 'ally' : 'enemy')
  const screening = visionActor && visionTool
    ? /disco\s*baller/i.test(visionTool)
      ? [
        `${upper(visionName)} sent a Disco Baller after the shots, and its Eclipse screen swallowed the approach to ${shorterGoal}.`,
        `${upper(visionName)} rolled a Disco Baller into the gap, spreading Eclipse across the exposed route while the guns answered each other.`,
        `${upper(visionName)} rolled a Disco Baller into the gap, letting Eclipse hide ${shorterGoal} behind the exchange of fire.`,
        `Before the lane cleared, ${visionName}'s Disco Baller spread an Eclipse screen across the route to ${shorterGoal}.`,
      ][variant]
      : /mirro?rball/i.test(visionTool)
        ? `${upper(visionName)} spread Mirrorball across the route to ${shorterGoal} while the return fire was still searching for an angle.`
        : /launcher/i.test(visionTool)
          ? `${upper(visionName)} fired a smoke grenade toward ${shorterGoal}, cutting the return sightline before the next crossing.`
          : `${upper(visionName)} threw a smoke grenade toward ${shorterGoal}, cutting the return sightline before the next crossing.`
    : ''
  const route = template.mission === 'The Dig' ? 'the excavation lip'
    : /^the approach to /i.test(ground) ? shorterGoal : ground
  const openingInFire = screening
    ? allyScreen
      ? [
        `Behind that screen, ${heroLater} edged toward ${route}, though ${enemyObjective} was closing from the other side.`,
        `${upper(heroLater)} took the blind stretch toward ${route}; the reprieve lasted only until ${enemyObjective} appeared on the far side.`,
        `That gave ${heroLater} a way into ${route}, but ${enemyObjective} was moving toward the same objective.`,
        `${upper(heroLater)} slipped toward ${route} while ${enemyObjective} tried to close the distance from the opposite side.`,
      ][variant]
      : `${upper(heroLater)} had to find a different angle through ${route} as ${enemyObjective} pressed toward ${shorterGoal} under the screen.`
    : `${upper(heroLater)} used the lull to approach ${route}, but ${enemyObjective} had started toward ${shorterGoal} too.`
  const middle = arrange([shot, screening, openingInFire], [
    `The brief advantage ended wherever the two approaches met near ${goal}.`,
  ])

  const action = template.role === 'objective' ? source.objectiveAction
    : template.role === 'gunfighting' ? source.gunfighting : source.closeCombat
  const opponent = enemyObjective
  const enemyMove = missionCounter(template.mission, upper(opponent || `${enemyPlayer}'s remaining fighters`), heroLater)
  const turn = tacticalSetting(template) ?? seed(source.turn)
  const actionText = template.mission === 'The Dig'
    ? action.replace(/the analysis console input/gi, 'the reader')
      .replace(/the hyperthermal tech/gi, 'the buried unit')
      .replace(/attempted a WIP (?:reading|analysis) of/gi, 'tried to analyze')
      .replace(/began a reading of/gi, 'began analyzing')
    : action.replace(/\bthe specialist escorting a civilian\b/gi,
      `${name(allyObjective ?? hero)}, who was escorting a civilian`)
      .replace(/\bthe specialist\b/gi, name(allyObjective ?? hero))
  // If a role action confronts a guard, use the rostered defender already
  // holding the lane. This keeps the same conflict alive into the last beat.
  const encounter = template.role !== 'objective' && threat
    ? actionText.replace(/\b(?:the|a|an)\s+(?:(?:analysis-console|Akial Antenna|lift|wreck|transport|tower|supply-box|antenna|prototype cradle)\s+)?(?:guard|defender)\b/gi,
      threatName)
    : actionText
  const closing = arrange([joinTurningPoint(seed(turn), heroLater, narrated(encounter), template.mission),
    enemyMove], [
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
