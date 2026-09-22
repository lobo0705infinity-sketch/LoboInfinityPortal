import type { ArmyIntelligenceDecodedEntry, ArmyIntelligenceList, RecentGame } from './api.ts'
import { formatPlayerName } from './formatting.ts'
import { isDrawGame } from './gameResults.ts'

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
    story: buildBattleStory({ draw, firstPlayer, game, loser, loserProfile, objectiveEdge, victoryEdge, winner, winnerProfile }),
    turningPoint: buildTurningPoint(game, winner, loser, objectiveMargin, victoryEdge, victoryMargin),
    winnerCoaching: buildWinnerCoaching(winner, winnerProfile, missionLens, objectiveMargin, victoryEdge, victoryMargin),
    loserCoaching: buildLoserCoaching(loser, loserProfile, missionLens, objectiveMargin, victoryEdge),
    bottomLine: buildBottomLine(game, winner, loser, objectiveMargin, victoryEdge, draw),
    evidenceNote: winnerList || loserList
      ? 'Review based on the official result, first turn, submitted note, and decoded submitted lists. It does not reconstruct unreported orders.'
      : 'Review based on the official result, first turn, submitted note, and available list metadata. It does not reconstruct unreported orders.',
  }
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
    return `${game.mission || 'The mission'} ended level at ${displayPair(objective)} OP${hasScores(victory) ? ` and ${displayPair(victory)} VP` : ''}. This mission ${missionLens.focus}. Neither player converted that demand into a decisive edge, so the most useful reading is where each side still had a scoring route at the end.`
  }

  if (objectiveMargin !== null && objectiveMargin >= 4 && victoryEdge !== null && victoryEdge <= -75) {
    return `${winner} won the mission while ${loser} won the material battle. ${winner} took the objective score ${displayPair(objective)} despite finishing ${displayPair(victory)} in surviving Victory Points—a ${Math.abs(victoryEdge)}-point deficit. ${game.mission || 'The mission'} ${missionLens.focus}; this was a scenario victory built by preserving the right scoring pieces, not by controlling more of the table at the end.`
  }

  if (objectiveMargin !== null && objectiveMargin >= 4 && victoryEdge !== null && victoryEdge >= 75) {
    return `This was a decisive win on both mission and attrition. ${game.mission || 'The mission'} ${missionLens.focus}, and ${winner} took the objective score ${displayPair(objective)} while finishing ${displayPair(victory)} in surviving Victory Points. The result was more than a late scoring swing: ${winner} controlled the mission while preserving a much stronger end-state than ${loser}.`
  }

  if (objectiveMargin !== null && objectiveMargin >= 4) {
    return `${winner} created a clear ${game.mission || 'mission'} advantage, winning the objective score ${displayPair(objective)}${hasScores(victory) ? ` while the final ${displayPair(victory)} VP count shows how much material remained` : ''}. Because this mission ${missionLens.focus}, the separation is primarily in scenario execution: ${loser} could not turn the surviving force into comparable objective points.`
  }

  if (victoryEdge !== null && victoryEdge >= 75) {
    return `${winner} finished with a large material advantage at ${displayPair(victory)} VP, but the ${displayPair(objective)} objective score stayed comparatively close. ${game.mission || 'The mission'} ${missionLens.focus}; ${loser} kept enough of that scoring pressure alive to stop the attrition gap becoming a runaway objective result.`
  }


  if (victoryEdge !== null && victoryEdge <= -75) {
    return `${winner} claimed the ${displayPair(objective)} objective result despite ${loser} finishing ahead ${displayPair(victory)} in surviving Victory Points. ${game.mission || 'The mission'} ${missionLens.focus}; the result turned on converting the surviving force into points, and ${winner} did that more effectively even while losing the material exchange.`
  }

  return `${winner} won a close ${game.mission || 'mission'}, with a ${displayPair(objective)} objective score${hasScores(victory) ? ` and ${displayPair(victory)} VP remaining` : ''}. Because the mission ${missionLens.focus}, the narrow separation suggests the result hinged on converting one more relevant scoring opportunity, not on one side simply removing the other from the table.`
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
  if (!winnerProfile && !loserProfile) {
    const initiative = firstPlayer
      ? `${firstPlayer} had the first opportunity to establish the engagement pattern.`
      : 'The first player was not recorded, so initiative cannot be weighed confidently.'
    return `${game.mission || 'The mission'} ${missionLens.focus}. ${initiative} Without decoded lists, the safest conclusion is that ${winner} converted those mission demands more efficiently while ${loser} and ${loserFaction} could not recover enough objective tempo.`
  }

  const winnerPlan = describeForce(winnerProfile, `${winner}’s ${winnerFaction} list`)
  const loserPlan = describeForce(loserProfile, `${loser}’s ${loserFaction} list`)
  const initiative = firstPlayer
    ? `${firstPlayer} went first, which likely helped that player set the initial lanes and force the first difficult trades.`
    : 'The first turn was not recorded, so the list interaction matters more than any claim about initiative.'
  const conversion = victoryEdge !== null && victoryEdge <= -75
    ? `${loser} preserved substantially more material, but ${winner} preserved the pieces and orders that could still alter the objective score. The decisive difference was mission conversion, not attrition.`
    : victoryEdge !== null && victoryEdge >= 75
      ? `The result suggests ${winner} kept the relevant pieces functioning longer and forced ${loser} to spend more orders creating safe approaches.`
      : `${winner} converted the available mission tools more efficiently without either final force state completely explaining the result.`
  return `${game.mission || 'The mission'} ${missionLens.focus}. ${winnerPlan} ${loserPlan} ${initiative} ${conversion}`
}

function describeForce(profile: ForceProfile | null, label: string) {
  if (!profile) return `${label} is not decoded, so its exact tactical package cannot be assessed.`
  const traits: string[] = []
  if (profile.control.length) traits.push(`board control from ${joinNames(profile.control)}`)
  if (profile.hackers.length) traits.push(`hacking through ${joinNames(profile.hackers)}`)
  if (profile.longRange.length) traits.push(`long-range pressure from ${joinNames(profile.longRange)}`)
  if (profile.mobile.length) traits.push(`mobile attack options in ${joinNames(profile.mobile)}`)
  if (profile.anchors.length) traits.push(`durable anchors such as ${joinNames(profile.anchors)}`)
  if (profile.specialists.length) traits.push(`mission coverage from ${joinNames(profile.specialists)}`)
  return `${label} brought ${joinTraits(traits.slice(0, 3)) || 'a mixed tactical package'}.`
}

function buildBattleStory({
  draw,
  firstPlayer,
  game,
  loser,
  loserProfile,
  objectiveEdge,
  victoryEdge,
  winner,
  winnerProfile,
}: {
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
  const note = cleanStoryNote(game.bestMoment)
  const rememberedMoment = note ? `The surviving account fixes on one moment: “${note}”` : ''
  const initiative = firstPlayer ? `${firstPlayer} had the first chance to shape the engagement, but the battle would ultimately be measured at the scoring window.` : ''
  const winnerTool = winnerProfile ? strongestTrait(winnerProfile) : 'the pieces still able to reach the mission'
  const loserTool = loserProfile ? strongestTrait(loserProfile) : 'the force still standing at the end'

  if (draw) {
    return `${game.mission || 'The mission'} never produced a clean break. Each side found a route into the scoring fight, and each left enough resistance in place to deny the other a final claim. ${rememberedMoment || 'No single exchange survived as the defining scene; the battle was decided by everything neither side could quite finish.'} When the last scoring window closed, the field remained contested and the result reflected it: neither commander had managed to shut the other out.`
  }

  if (objectiveEdge !== null && objectiveEdge >= 4 && victoryEdge !== null && victoryEdge <= -75) {
    return `By the final scoring window, the battlefield told two different stories. ${loser} still had ${Math.abs(victoryEdge)} more surviving Victory Points, but ${winner} held the advantage that mattered in ${game.mission || 'the mission'}. Rather than trying to repair a losing attrition fight, ${winner} relied on ${winnerTool} and kept the remaining effort tied to the objective. ${rememberedMoment || `${loser} had more force left to answer with, but ${loserTool} could not turn that material edge into enough points.`} When the shooting stopped, ${loser} held more of the army; ${winner} held the result.`
  }

  if (objectiveEdge !== null && objectiveEdge >= 4 && victoryEdge !== null && victoryEdge >= 75) {
    return `${winner} tightened control one exchange at a time. The mission route narrowed, the material gap widened, and ${loser} was forced to search for an increasingly unlikely way back into the game. ${initiative} ${rememberedMoment || `${winnerTool} remained available while ${loserTool} lost the freedom to attack the mission on favorable terms.`} By the end, the objective score and the surviving forces told the same story: ${winner} had denied both the battlefield and the mission.`
  }

  if (objectiveEdge !== null && Math.abs(objectiveEdge) <= 2) {
    return `The battle remained balanced on a single scoring swing. Neither side needed to conquer the entire table; each needed one surviving piece, one safe route, and enough orders to make the final attempt. ${rememberedMoment || `${winner} found that opening before ${loser} could close it.`} The margin stayed narrow because ${loser} never lost every path back into the game. When the last opportunity passed, ${winner} had converted one more meaningful moment—and that was enough.`
  }

  if (victoryEdge !== null && victoryEdge >= 75) {
    return `${winner} emerged from the exchanges with the stronger force, but ${game.mission || 'the mission'} refused to become a simple casualty count. ${loser} kept enough pressure alive to make the surviving material work for every objective point. ${rememberedMoment || `${winnerTool} gradually reduced the options available to ${loserTool}.`} The battle ended with ${winner} in control, though the objective score shows that ${loser} continued fighting for the mission after the wider table had begun to slip away.`
  }

  return `${game.mission || 'The mission'} unfolded as a contest of timing rather than a clean sweep. ${initiative} ${winner} kept ${winnerTool} relevant long enough to create the decisive scoring window, while ${loser} searched for an answer through ${loserTool}. ${rememberedMoment || `The decisive action was not total destruction, but the moment ${winner} turned access to the table into points.`} The final score records the separation; the story is how little room there was before that separation appeared.`
}

function cleanStoryNote(value: string) {
  return String(value || '').trim().replace(/^['“”"]+|['“”"]+$/g, '').replace(/\s+/g, ' ')
}

function buildTurningPoint(game: RecentGame, winner: string, loser: string, objectiveMargin: number | null, victoryEdge: number | null, victoryMargin: number | null) {
  const note = game.bestMoment.trim()
  if (!note) {
    return `No player note identifies a single order or exchange. The score instead points to the decisive phase: ${winner} established an advantage that ${loser} could not convert back into objective points${victoryMargin !== null && victoryMargin >= 75 ? ', while also widening the material gap' : ''}.`
  }

  const consequence = objectiveMargin !== null && objectiveMargin <= 2
    ? 'In a result this close, that moment likely separated the final scoring opportunity from the one that never materialized.'
    : victoryEdge !== null && victoryEdge <= -75
      ? `It captures the central tension of the game: ${winner} was losing the material fight but still found the route that decided the mission.`
    : victoryMargin !== null && victoryMargin >= 75
      ? `It stands out because it remained memorable even though ${winner} had built a substantial material advantage.`
      : `It is the clearest recorded moment where the game’s momentum or scoring path changed.`
  return `The submitted note identifies the turning point: “${note}” ${consequence}`
}

function buildWinnerCoaching(player: string, profile: ForceProfile | null, missionLens: MissionLens, objectiveMargin: number | null, victoryEdge: number | null, victoryMargin: number | null) {
  const strength = profile ? strongestTrait(profile) : 'scoring pieces'
  if (victoryEdge !== null && victoryEdge <= -75) {
    return `${player} correctly treated the objective score as the win condition even while the force was being reduced. ${missionLens.winnerPriority} The next improvement is to protect ${strength} earlier, so the same scoring plan does not have to survive such a severe material deficit.`
  }
  if (objectiveMargin !== null && objectiveMargin <= 2) {
    return `${player} converted the decisive objective opportunity, but the small margin left little room for error. ${missionLens.winnerPriority} Preserve ${strength} for that scoring window and identify the opponent’s last live mission piece before committing orders to optional fights.`
  }
  if (victoryMargin !== null && victoryMargin >= 75) {
    return `${player}’s plan protected its value while steadily removing the opponent’s options. ${missionLens.winnerPriority} Once the material lead was secure, use ${strength} to close every remaining mission route rather than continue trading for attrition alone.`
  }
  return `${player} balanced attrition and mission play well enough to keep the scoring lead. ${missionLens.winnerPriority} Preserve ${strength} until that objective state is safe, then spend the remaining orders denying the opponent’s final route back into the game.`
}

function buildLoserCoaching(player: string, profile: ForceProfile | null, missionLens: MissionLens, objectiveMargin: number | null, victoryEdge: number | null) {
  const strength = profile ? strongestTrait(profile) : 'the surviving specialists'
  if (victoryEdge !== null && victoryEdge <= -75) {
    return `${player} won the material exchange but did not convert that advantage into the mission score. ${missionLens.loserPriority} Once the attrition lead existed, redirect ${strength} toward denying the opponent’s last scoring route instead of continuing exchanges that no longer changed the result.`
  }
  if (victoryEdge !== null && victoryEdge >= 75) {
    return `${player} needed to protect more of the force through the opening exchanges. ${missionLens.loserPriority} Use ${strength} to create that defended scoring lane, and avoid feeding separate pieces into the opponent’s strongest area when the mission can still be attacked from another angle.`
  }
  if (objectiveMargin !== null && objectiveMargin <= 2) {
    return `${player} remained within one meaningful scoring swing. ${missionLens.loserPriority} Reserve ${strength} and enough orders to attempt that objective instead of spending the resource on a trade that does not alter the score.`
  }
  return `${player} had tools to contest the mission but did not convert enough of them into points. ${missionLens.loserPriority} Build the turn around ${strength}, open one safe route first, and make every supporting attack serve that route rather than treating attrition as the objective.`
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
  if (draw) return `${winner} and ${loser} finished level because neither side fully closed the other’s scoring route. The game is best understood as a contested mission, not a failed attrition race.`
  if (objectiveMargin !== null && objectiveMargin >= 4 && victoryEdge !== null && victoryEdge <= -75) {
    return `${loser} won the material battle; ${winner} won ${game.mission || 'the mission'}. A ${Math.abs(victoryEdge)}-point deficit did not matter because ${winner} preserved and converted the pieces that could still score.`
  }
  if (objectiveMargin !== null && objectiveMargin >= 4 && victoryEdge !== null && victoryEdge >= 75) {
    return `${winner} won both the table and the mission. ${loser} needed an earlier protected route to the objectives before the material deficit made recovery too expensive.`
  }
  if (objectiveMargin !== null && objectiveMargin <= 2) {
    return `${winner} found the final scoring edge; ${loser} remained one meaningful objective swing away. The scoreline reflects conversion under pressure more than total table control.`
  }
  return `${winner} executed ${game.mission || 'the mission'} more efficiently and kept ${loser} from turning the available tools into an equal scoring position.`
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
  const bySourceId = targetListId ? lists.find((list) => String(list.sourceId) === String(targetListId)) : undefined
  if (bySourceId) return bySourceId

  const linked = linkedLists.find((list) => String(list.id) === String(targetListId))
    || linkedLists.find((list) => normalize(list.player) === key)
  if (linked?.armyCode) {
    const code = normalizeArmyCode(linked.armyCode)
    const byArmyCode = lists.find((list) => normalizeArmyCode(list.armyCode) === code)
    if (byArmyCode) return byArmyCode
  }

  return lists.find((list) => normalize(list.player) === key || normalize(list.sourcePlayer) === key)
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
