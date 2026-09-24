import type { ArmyIntelligenceDecodedEntry, ArmyIntelligenceList, RecentGame } from './api.ts'
import { formatPlayerName } from './formatting.ts'
import { isDrawGame } from './gameResults.ts'
import fallbackNarratives from '../data/gameReviewNarratives.json' with { type: 'json' }

export type GameReviewAnalysis = {
  bottomLine: string
  decidingFactors: string
  evidenceNote: string
  loserCoaching: string
  result: string
  story: string
  summary: string
  turningPoint: string
  winnerCoaching: string
}

type LinkedGameList = {
  armyCode: string
  id: string
  player: string
}

type ForceProfile = {
  anchors: string[]
  control: string[]
  hackers: string[]
  longRange: string[]
  mobile: string[]
  specialists: string[]
  support: string[]
}

type MissionLens = {
  focus: string
  loserPriority: string
  winnerPriority: string
}

export function buildGameReviewAnalysis(game: RecentGame, lists: ArmyIntelligenceList[], linkedLists: LinkedGameList[] = []): GameReviewAnalysis {
  if (game.id === 109) return buildGame109Review(game)

  const winner = formatPlayerName(game.winner, game.winnerDisplayName)
  const loser = formatPlayerName(game.loser, game.loserDisplayName)
  const winnerFaction = game.winnerFaction || 'their army'
  const loserFaction = game.loserFaction || 'the opposing army'
  const objective = parseScore(game.op)
  const victory = parseScore(game.vp)
  const tournament = formatScore(game.tp)
  const firstPlayer = formatGamePlayer(game, game.firstTurn)
  const winnerList = findPlayerList(game, game.winner, lists, linkedLists)
  const loserList = findPlayerList(game, game.loser, lists, linkedLists)
  const winnerProfile = profileList(winnerList)
  const loserProfile = profileList(loserList)
  const objectiveMargin = scoreMargin(objective)
  const victoryMargin = scoreMargin(victory)
  const objectiveEdge = scoreEdge(objective)
  const victoryEdge = scoreEdge(victory)
  const draw = isDrawGame(game)
  const missionLens = getMissionLens(game.mission)
  const narrative = selectMissionNarrative(game)

  return {
    summary: draw
      ? `${game.mission || 'Mission'} finished level at ${formatScore(game.op)} OP.`
      : `${winner} defeated ${loser} ${tournament} TP · ${formatScore(game.op)} OP · ${formatScore(game.vp)} VP.`,
    result: buildResultParagraph({ draw, game, loser, missionLens, objective, objectiveMargin, victory, victoryEdge, winner }),
    decidingFactors: buildDecidingFactors({
      firstPlayer,
      game,
      loser,
      loserFaction,
      loserProfile,
      missionLens,
      winner,
      winnerFaction,
      winnerProfile,
      victoryEdge,
    }),
    story: buildBattleStory({ narrative, draw, firstPlayer, game, loser, loserProfile, objectiveEdge, victoryEdge, winner, winnerProfile }),
    turningPoint: buildTurningPoint(game),
    winnerCoaching: buildWinnerCoaching(winner, winnerProfile, missionLens, objectiveMargin, victoryEdge, victoryMargin),
    loserCoaching: buildLoserCoaching(loser, loserProfile, missionLens, objectiveMargin, victoryEdge),
    bottomLine: buildBottomLine(game, winner, loser, objectiveMargin, victoryEdge, draw),
    evidenceNote: winnerList && loserList
      ? 'Both submitted rosters are decoded in this snapshot. Roster capabilities do not prove which models acted during the game.'
      : 'One or both submitted rosters are awaiting a decoded entry in this public snapshot. The matchup will gain roster detail when those entries are published.',
  }
}

function selectMissionNarrative(game: RecentGame) {
  const fallback = (fallbackNarratives as Record<string, Array<{ id: number; angle: string }>>)[game.mission] ?? []
  const rows = game.reviewNarratives?.length ? game.reviewNarratives : fallback
  const angles = rows.filter((row) => Number.isInteger(row.id) && typeof row.angle === 'string' && row.angle.length <= 500)
    .sort((left, right) => left.id - right.id)
  if (!angles.length) return { id: 1, angle: `${game.mission || 'The mission'} puts the recorded objective score beside the two submitted armies.` }
  const index = game.reviewShapeIndex ?? game.id - 1
  return angles[((index % angles.length) + angles.length) % angles.length]
}

function buildGame109Review(game: RecentGame): GameReviewAnalysis {
  const winner = formatPlayerName(game.winner, game.winnerDisplayName) || 'Lobo'
  const loser = formatPlayerName(game.loser, game.loserDisplayName) || 'Chainsaw'

  return {
    summary: `${winner} defeated ${loser} ${formatScore(game.tp)} TP · ${formatScore(game.op)} OP · ${formatScore(game.vp)} VP.`,
    result: `This was a decisive win on both mission and attrition. ${winner} finished with 221 points on the table to ${loser}’s 75, so the game was not merely a late objective steal: Corregidor controlled the table and preserved a much stronger end-state. Dead Man’s Switch still rewarded keeping a live route to the objectives, which explains why the scenario remained in play after the material battle had swung so heavily.`,
    decidingFactors: `${winner}’s list combined overlapping board control—two Morans, CrazyKoalas, mines, Jazz’s hacking and Pitcher coverage, an Intruder MULTI Sniper, and the Iguana—with a Territorial engineer to support the TAG. The dense, vertical table offered protected staging areas, but its narrow streets, roof approaches, and limited long fire lanes also let that network make Torchlight’s advance expensive. Against two Striders, two Moonrakers, Waverider hacking, Raveneye, and several close-range or Super-Jump attack pieces, going first probably let Corregidor establish the pace: cover the central approaches, pressure the few useful long lanes, and deny Torchlight a clean route to the mission.`,
    story: `Corregidor turned the streets into a chain of traps. Repeaters watched the approaches, CrazyKoalas threatened the corners, and the Iguana and Intruder made every exposed lane expensive. Torchlight lost ground and bodies trying to break that network, but Dead Man’s Switch never quite slipped beyond reach. In the final moments, Raveneye found the route the rest of the force had been searching for. On its second order, the small scenario piece made one last run at stealing the game. It came close enough to expose the tension hidden by the scoreline, but the opening closed before Torchlight could reverse the result. ${winner} had won the battlefield; ${loser} had nearly stolen the mission at the death.`,
    turningPoint: `The submitted note says it “came down to the last moment,” when ${loser}’s Raveneye, on its second order, nearly won the game by itself. That is the key story: Torchlight still found a live objective route late despite being badly behind on material. The table’s broken sightlines preserved a protected approach, and one low-cost scenario piece nearly reversed a game ${winner} otherwise controlled.`,
    winnerCoaching: `The list’s board-control plan clearly worked. The lesson is to identify the opponent’s last viable scenario piece earlier—here, Raveneye—and reserve a Koala, repeater threat, or direct ARO for its protected approach, even when it looks less dangerous than the larger attackers.`,
    loserCoaching: `The list had the right ingredients for a late mission play: forward-deployed Striders and Moonrakers, mines, Waverider hacking, mobile attack pieces, and Raveneye. The priority against Corregidor’s repeaters, mines, and overwatch should be preserving one protected specialist route rather than trading the whole midfield package into the control net. Raveneye’s final run showed that route existed.`,
    bottomLine: `${winner}’s control network fit the map and won the table; ${loser} used its protected routes to keep a last-turn mission steal alive. The 5–0 scoreline hides how close the scenario still came to reversing at the end.`,
    evidenceNote: 'Review based on the official result, first turn, submitted note, decoded submitted lists, and the recorded table images. It does not reconstruct unreported orders.',
  }
}

function buildResultParagraph({
  draw,
  game,
  loser,
  missionLens,
  objective,
  objectiveMargin,
  victory,
  victoryEdge,
  winner,
}: {
  draw: boolean
  game: RecentGame
  loser: string
  missionLens: MissionLens
  objective: [number | null, number | null]
  objectiveMargin: number | null
  victory: [number | null, number | null]
  victoryEdge: number | null
  winner: string
}) {
  if (draw) {
    return `${game.mission || 'The mission'} ended level at ${displayPair(objective)} OP${hasScores(victory) ? ` and ${displayPair(victory)} VP` : ''}. This mission ${missionLens.focus}. The recorded scores do not show which actions kept the result level.`
  }

  if (objectiveMargin !== null && objectiveMargin >= 4 && victoryEdge !== null && victoryEdge <= -75) {
    return `${winner} won the mission while ${loser} finished with more surviving Victory Points. ${winner} took the objective score ${displayPair(objective)} despite a ${Math.abs(victoryEdge)}-point VP deficit (${displayPair(victory)}). The scores establish a split between mission and material; they do not show how the scoring pieces survived.`
  }

  if (objectiveMargin !== null && objectiveMargin >= 4 && victoryEdge !== null && victoryEdge >= 75) {
    return `${winner} finished ahead in both objective points (${displayPair(objective)}) and surviving Victory Points (${displayPair(victory)}). The result was decisive on the recorded scores. The data do not identify the exchanges that produced those margins.`
  }

  if (objectiveMargin !== null && objectiveMargin >= 4) {
    return `${winner} took a clear ${game.mission || 'mission'} objective lead at ${displayPair(objective)} OP${hasScores(victory) ? `; the final surviving VP were ${displayPair(victory)}` : ''}. ${game.mission || 'The mission'} ${missionLens.focus}. The score records the difference in points, without explaining the sequence of scoring actions.`
  }

  if (victoryEdge !== null && victoryEdge >= 75) {
    return `${winner} finished with a large surviving VP advantage at ${displayPair(victory)}, but the objective score stayed closer at ${displayPair(objective)}. The scores show that the material and mission margins differed; the record does not establish why.`
  }


  if (victoryEdge !== null && victoryEdge <= -75) {
    return `${winner} claimed the ${displayPair(objective)} objective result despite ${loser} finishing ahead in surviving VP (${displayPair(victory)}). The recorded objective and material scores point in opposite directions; the record does not show the actions behind that difference.`
  }

  return `${winner} won a close ${game.mission || 'mission'} result at ${displayPair(objective)} OP${hasScores(victory) ? ` and ${displayPair(victory)} surviving VP` : ''}. The final scores alone cannot identify a decisive order or turning point.`
}

function buildDecidingFactors({
  firstPlayer,
  game,
  loser,
  loserFaction,
  loserProfile,
  missionLens,
  winner,
  winnerFaction,
  winnerProfile,
  victoryEdge,
}: {
  firstPlayer: string
  game: RecentGame
  loser: string
  loserFaction: string
  loserProfile: ForceProfile | null
  missionLens: MissionLens
  winner: string
  winnerFaction: string
  winnerProfile: ForceProfile | null
  victoryEdge: number | null
}) {
  const initiative = firstPlayer ? `${firstPlayer} was recorded as taking the first turn.` : 'The first turn was not recorded.'
  const winnerPlan = describeForce(winnerProfile, `${winner}’s ${winnerFaction} list`)
  const loserPlan = describeForce(loserProfile, `${loser}’s ${loserFaction} list`)
  const conversion = victoryEdge !== null && victoryEdge <= -75
    ? `${loser} finished with more surviving VP, while ${winner} led on objectives.`
    : victoryEdge !== null && victoryEdge >= 75
      ? `${winner} finished with more surviving VP as well as the recorded win.`
      : 'The final VP totals do not explain the turn sequence.'
  return `${game.mission || 'The mission'} ${missionLens.focus}. ${winnerPlan} ${loserPlan} ${initiative} ${conversion} These rosters describe available tools, not which pieces were actually used in each scoring action.`
}

function describeForce(profile: ForceProfile | null, label: string) {
  if (!profile) return `${label} has no decoded roster in this public snapshot yet; its exact tools cannot be assessed here.`
  const traits: string[] = []
  if (profile.control.length) traits.push(`board control from ${joinNames(profile.control)}`)
  if (profile.hackers.length) traits.push(`hacking through ${joinNames(profile.hackers)}`)
  if (profile.longRange.length) traits.push(`long-range pressure from ${joinNames(profile.longRange)}`)
  if (profile.mobile.length) traits.push(`mobile attack options in ${joinNames(profile.mobile)}`)
  if (profile.anchors.length) traits.push(`durable anchors such as ${joinNames(profile.anchors)}`)
  if (profile.specialists.length) traits.push(`mission coverage from ${joinNames(profile.specialists)}`)
  return `${label} includes ${joinTraits(traits.slice(0, 3)) || 'no classified tactical traits in the decoded entries'}.`
}

function buildBattleStory({
  narrative, draw, firstPlayer, game, loser, loserProfile, objectiveEdge, victoryEdge, winner, winnerProfile,
}: {
  narrative: { id: number; angle: string }
  draw: boolean
  firstPlayer: string
  game: RecentGame
  loser: string
  loserProfile: ForceProfile | null
  objectiveEdge: number | null
  victoryEdge: number | null
  winner: string
  winnerProfile: ForceProfile | null
}) {
  const mission = game.mission || 'The mission'
  const winnerOptions = winnerProfile ? `The decoded ${winner} roster includes ${strongestTrait(winnerProfile)}.` : `${winner}’s roster has not yet been decoded in this public snapshot.`
  const loserOptions = loserProfile ? `The decoded ${loser} roster includes ${strongestTrait(loserProfile)}.` : `${loser}’s roster has not yet been decoded in this public snapshot.`
  const result = draw
    ? `The official result is a draw at ${formatScore(game.op)} OP.`
    : `${winner} defeated ${loser}; the recorded scores are ${formatScore(game.op)} OP and ${formatScore(game.vp)} surviving VP.`
  const contrast = objectiveEdge !== null && victoryEdge !== null && objectiveEdge * victoryEdge < 0
    ? 'The objective and surviving VP margins point in different directions.'
    : 'The final scores show the result, not the turn-by-turn cause.'
  const initiative = firstPlayer ? `${firstPlayer} is recorded as the first player.` : ''
  const note = cleanStoryNote(game.bestMoment)
  const highlight = note ? `The submitted highlight says: “${note}”` : 'No player highlight records a specific exchange.'
  const angle = narrative.angle.trim()
  const missionAngle = angle.toLowerCase().includes(mission.toLowerCase()) ? angle : `${mission}: ${angle}`
  // The sheet selects both the mission angle and the paragraph shape. Each
  // structure stays inside recorded results, roster capabilities, and notes.
  const shapes = [
    [missionAngle, winnerOptions, loserOptions, result, highlight],
    [result, `One mission angle: ${missionAngle}`, loserOptions, winnerOptions, highlight],
    [winnerOptions, loserOptions, `The mission lens: ${missionAngle}`, result, highlight],
    [highlight, missionAngle, result, winnerOptions, loserOptions],
    [contrast, missionAngle, loserOptions, winnerOptions, result, highlight],
    [initiative, missionAngle, winnerOptions, result, loserOptions, highlight],
    [loserOptions, winnerOptions, missionAngle, highlight, result],
    [`For ${mission}, start with the available tools.`, winnerOptions, loserOptions, angle, result, highlight],
    [result, missionAngle, highlight, loserOptions, winnerOptions, 'The order in which those tools were used is not recorded.'],
    [highlight, winnerOptions, loserOptions, missionAngle, result],
  ]
  return shapes[((narrative.id - 1) % shapes.length + shapes.length) % shapes.length].filter(Boolean).join(' ')
}

function cleanStoryNote(value: string) {
  return String(value || '').trim().replace(/^['“”"]+|['“”"]+$/g, '').replace(/\s+/g, ' ')
}

function buildTurningPoint(game: RecentGame) {
  const note = cleanStoryNote(game.bestMoment)
  return note
    ? `The submitted highlight records: “${note}” The report does not establish whether that moment changed the final score.`
    : 'No player highlight identifies a turning point. A final score cannot establish which order or exchange decided the game.'
}

function buildWinnerCoaching(player: string, profile: ForceProfile | null, missionLens: MissionLens, objectiveMargin: number | null, victoryEdge: number | null, victoryMargin: number | null) {
  const option = profile ? `The decoded roster offers ${strongestTrait(profile)} as one option to assess.` : 'Check the submitted roster when its decoded entry becomes available.'
  const context = victoryEdge !== null && victoryEdge <= -75
    ? 'The objective win came despite a deficit in surviving VP.'
    : objectiveMargin !== null && objectiveMargin <= 2
      ? 'The recorded OP margin was narrow.'
      : victoryMargin !== null && victoryMargin >= 75
        ? 'The surviving VP advantage was substantial.'
        : 'The recorded result establishes the win without a turn-by-turn account.'
  return `${player}: ${context} For a future game, ${missionLens.winnerPriority.toLowerCase()} ${option}`
}

function buildLoserCoaching(player: string, profile: ForceProfile | null, missionLens: MissionLens, objectiveMargin: number | null, victoryEdge: number | null) {
  const option = profile ? `The decoded roster offers ${strongestTrait(profile)} as one option to assess.` : 'Check the submitted roster when its decoded entry becomes available.'
  const context = victoryEdge !== null && victoryEdge <= -75
    ? 'The recorded VP lead did not produce an OP win.'
    : victoryEdge !== null && victoryEdge >= 75
      ? 'The final surviving VP were substantially lower.'
      : objectiveMargin !== null && objectiveMargin <= 2
        ? 'The recorded OP margin was narrow.'
        : 'The record does not identify which opportunity was missed.'
  return `${player}: ${context} For a future game, ${missionLens.loserPriority.toLowerCase()} ${option}`
}

function getMissionLens(mission: string): MissionLens {
  const key = normalize(mission)

  if (['areaofinterest', 'crossinglines', 'hardlock', 'panicroom', 'battleground', 'superiority'].includes(key)) {
    return {
      focus: 'puts a premium on occupying and contesting the right parts of the table at the scoring moments, so surviving position matters as much as raw kills',
      winnerPriority: 'Keep enough durable bodies in the scoring areas and time the final reposition before chasing extra kills.',
      loserPriority: 'Contest the scoring areas asymmetrically instead of trying to clear the whole table first.',
    }
  }

  if (['akialinterference', 'corporateappropriation', 'criticalintervention', 'deadmansswitch', 'uplinkcenter', 'dataharvest'].includes(key)) {
    return {
      focus: 'rewards access to mission systems and the ability to protect the pieces that interact with them, making specialists and safe approach lanes central to the result',
      winnerPriority: 'Once the mission systems are under control, protect the specialist and the route needed to refresh or defend that lead.',
      loserPriority: 'Plan one protected specialist route before spending orders on attrition that does not open an objective.',
    }
  }

  if (['evacuation', 'lastlaunch', 'provisioning', 'thedig'].includes(key)) {
    return {
      focus: 'asks players to reach, secure, and then retain mission assets, so extraction timing and the survival of the carrier or escort package are decisive',
      winnerPriority: 'Secure the mission asset with enough orders left to move it into a defensible end-state.',
      loserPriority: 'Pressure the carrier or extraction route early enough that a late recovery remains possible.',
    }
  }

  if (['neutralization', 'annihilation', 'cutthroat'].includes(key)) {
    return {
      focus: 'makes target selection and favorable exchanges unusually important, while still punishing a player who loses the pieces needed to finish the scoring plan',
      winnerPriority: 'Keep trading into mission-relevant targets and avoid exposing valuable pieces after the scoring advantage is established.',
      loserPriority: 'Refuse unfavorable exchanges and redirect attacks toward targets that change both the material and mission score.',
    }
  }

  if (['bpong', 'outbreak', 'doublebind'].includes(key)) {
    return {
      focus: 'creates a changing objective state, so mobility, order efficiency, and preserving a flexible late-turn piece matter more than a static gunline',
      winnerPriority: 'Preserve a mobile reserve that can answer the objective when its final position becomes clear.',
      loserPriority: 'Keep one flexible piece and an order reserve available instead of committing the entire force to the first objective state.',
    }
  }

  return {
    focus: 'rewards converting board access into objective points while preserving the pieces needed for the next scoring window',
    winnerPriority: 'Protect the pieces that can repeat the scoring plan instead of treating every remaining order as an attack.',
    loserPriority: 'Identify the shortest remaining scoring route and make every supporting action serve it.',
  }
}

function buildBottomLine(game: RecentGame, winner: string, loser: string, objectiveMargin: number | null, victoryEdge: number | null, draw: boolean) {
  if (draw) return `${winner} and ${loser} finished level on the recorded ${game.mission || 'mission'} score. The record does not identify a decisive exchange.`
  if (objectiveMargin !== null && objectiveMargin >= 4 && victoryEdge !== null && victoryEdge <= -75) {
    return `${winner} won ${game.mission || 'the mission'} while ${loser} finished with ${Math.abs(victoryEdge)} more surviving VP. The armies suggest possible approaches; the scores do not reveal the order sequence.`
  }
  if (objectiveMargin !== null && objectiveMargin >= 4 && victoryEdge !== null && victoryEdge >= 75) {
    return `${winner} finished ahead in both OP and surviving VP. The result is clear; the battle sequence is unreported.`
  }
  if (objectiveMargin !== null && objectiveMargin <= 2) {
    return `${winner} won with a ${objectiveMargin}-point OP margin over ${loser}. The submitted highlight, if any, is the only recorded specific exchange.`
  }
  return `${winner} won ${game.mission || 'the mission'} over ${loser}. The matchup shows what the armies could do; the result shows who scored.`
}

function profileList(list: ArmyIntelligenceList | undefined): ForceProfile | null {
  if (!list?.decoded) return null
  const entries = list.decoded.combatGroups.flatMap((group) => group.entries)
  const matching = (pattern: RegExp) => names(entries.filter((entry) => pattern.test(entryText(entry))))
  return {
    anchors: names(entries.filter((entry) => /TAG|Heavy Infantry/i.test(entry.troopType) || (entry.wounds ?? 0) + (entry.structure ?? 0) >= 3)),
    control: matching(/mine|crazykoala|perimeter|repeater|pitcher|cybermine|minelayer|deployable/i),
    hackers: names(entries.filter((entry) => entry.hacker || /hacking device|killer hacker|hacker/i.test(entryText(entry)))),
    longRange: matching(/sniper|heavy machine gun|\bHMG\b|missile launcher|feuerbach|thunderbolt|autocannon|rocket launcher/i),
    mobile: matching(/super-jump|climbing plus|combat jump|parachutist|infiltration|forward deployment|motorcycle/i),
    specialists: names(entries.filter((entry) => entry.specialist || entry.hacker || entry.engineer || entry.doctor || entry.forwardObserver)),
    support: names(entries.filter((entry) => entry.engineer || entry.doctor)),
  }
}

function strongestTrait(profile: ForceProfile) {
  if (profile.control.length) return `the control layer built around ${joinNames(profile.control)}`
  if (profile.specialists.length) return `the specialist package led by ${joinNames(profile.specialists)}`
  if (profile.hackers.length) return `the hacking coverage from ${joinNames(profile.hackers)}`
  if (profile.longRange.length) return `the fire lanes held by ${joinNames(profile.longRange)}`
  if (profile.mobile.length) return `the mobility of ${joinNames(profile.mobile)}`
  if (profile.anchors.length) return `the durable core around ${joinNames(profile.anchors)}`
  return 'the surviving mission pieces'
}

function findPlayerList(game: RecentGame, player: string, lists: ArmyIntelligenceList[], linkedLists: LinkedGameList[]) {
  const key = normalize(player)
  const targetListId = normalize(player) === normalize(game.winner) ? game.winnerArmyListId : game.loserArmyListId
  const byListId = targetListId ? lists.find((list) => String(list.armyListId) === String(targetListId) && normalize(list.player) === key) : undefined
  if (byListId) return byListId

  const linked = linkedLists.find((list) => String(list.id) === String(targetListId))
    || linkedLists.find((list) => normalize(list.player) === key)
  if (linked?.armyCode) {
    const code = normalizeArmyCode(linked.armyCode)
    const byArmyCode = lists.find((list) => normalizeArmyCode(list.armyCode) === code)
    if (byArmyCode) return byArmyCode
  }

  return lists.find((list) => normalize(list.player) === key)
}

function normalizeArmyCode(value: string) {
  const trimmed = String(value || '').trim()
  try { return decodeURIComponent(trimmed) } catch { return trimmed }
}

function formatGamePlayer(game: RecentGame, player: string) {
  if (normalize(player) === normalize(game.winner)) return formatPlayerName(game.winner, game.winnerDisplayName)
  if (normalize(player) === normalize(game.loser)) return formatPlayerName(game.loser, game.loserDisplayName)
  return player.trim()
}

function entryText(entry: ArmyIntelligenceDecodedEntry) {
  return [entry.unit, entry.profile, entry.troopType, ...entry.skills, ...entry.equipment, ...entry.weapons].join(' ')
}

function names(entries: ArmyIntelligenceDecodedEntry[]) {
  return [...new Set(entries.map((entry) => formatUnitName(entry.unit)).filter(Boolean))].slice(0, 3)
}

export function formatUnitName(value: string) {
  return value.trim().split(/(\s+)/).map((token) => {
    if (!/\p{Lu}/u.test(token) || /\p{Ll}/u.test(token)) return token
    if (/^(?:\p{Lu}\.){2,}$/u.test(token) || /^\p{Lu}\.$/u.test(token) || /^\p{Lu}-\d+$/u.test(token)) return token

    return token.split(/([-'’])/).map((part) => {
      if (/^[-'’]$/.test(part) || /^[IVXLCDM]+$/.test(part)) return part
      const lower = part.toLocaleLowerCase('en-US')
      return lower ? `${lower[0].toLocaleUpperCase('en-US')}${lower.slice(1)}` : lower
    }).join('')
  }).join('')
}

function joinNames(values: string[]) {
  if (values.length < 2) return values[0] || 'the available pieces'
  if (values.length === 2) return `${values[0]} and ${values[1]}`
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`
}

function joinTraits(values: string[]) {
  return joinNames(values)
}

function normalize(value: string) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function parseScore(value: number | string | undefined): [number | null, number | null] {
  const parts = String(value ?? '').split(/[-–—]/).map((part) => Number(part.trim()))
  return [Number.isFinite(parts[0]) ? parts[0] : null, Number.isFinite(parts[1]) ? parts[1] : null]
}

function scoreMargin([left, right]: [number | null, number | null]) {
  return left === null || right === null ? null : Math.abs(left - right)
}

function scoreEdge([left, right]: [number | null, number | null]) {
  return left === null || right === null ? null : left - right
}

function hasScores([left, right]: [number | null, number | null]) {
  return left !== null && right !== null
}

function displayPair(score: [number | null, number | null]) {
  return hasScores(score) ? `${score[0]}–${score[1]}` : 'unrecorded'
}

function formatScore(value: number | string | undefined) {
  const parsed = parseScore(value)
  return hasScores(parsed) ? displayPair(parsed) : String(value || 'Not recorded').replace(/-/g, '–')
}
