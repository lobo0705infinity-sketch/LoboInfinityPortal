// Private preparation records. Never import this module into a client bundle.
import { randomInt, randomUUID } from 'node:crypto'
import { AURORA_CONQUEST_FACTIONS as CONQUEST, AURORA_FACTIONS, AURORA_TERRITORIES } from '../shared/aurora-public.mjs'
import { campaignText, factionName } from '../shared/aurora-games.mjs'
import { AURORA_CAMPAIGN_REVISION, hasTurnThreeRules, hasCampaignCorrections } from '../shared/aurora-campaign-policy.mjs'

const fail = message => { throw Object.assign(Error(message), { code: 'CAMPAIGN_RULE' }) }
const canonical = s => String(s).trim().toLowerCase().replace(/\s+/g, ' ')
const vp = (ops, f) => ops.awards.filter(a => a.faction === f).reduce((s, a) => s + a.vp, 0)
const copy = x => structuredClone(x)
const ownerSnapshot = territories => Object.fromEntries(territories.filter(t => t.vulnerable).map(t => [t.id, t.controller]))
const ids = (value, max = 12) => {
  if (!Array.isArray(value) || value.length > max || new Set(value).size !== value.length || value.some(id => !AURORA_TERRITORIES.some(t => t.id === id))) fail('Choose distinct campaign territories.')
  return [...value]
}
const future = (value, now) => {
  if (typeof value !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value)) || Date.parse(value) <= +now) fail('Enter a future selection deadline including its timezone.')
  return new Date(value).toISOString()
}
export const objectiveCompleted = (ops, f, title) => ops.objectives.some(o => o.faction === f && o.status === 'completed' && canonical(o.title) === canonical(title))
export const objectiveCapReached = (ops, f) => ops.awards.filter(a => a.faction === f && a.category === 'objective').reduce((s, a) => s + a.vp, 0) >= 6
export const failedPreviousObjective = (ops, n, f) => n >= 3 && ops.objectives.some(o => o.faction === f && o.assignedTurn === n - 1 && ['expired', 'rejected'].includes(o.status)) && !ops.objectives.some(o => o.faction === f && o.assignedTurn === n - 1 && o.status === 'completed') && !objectiveCapReached(ops, f)
export function expireObjectives(ops, n, at) {
  for (const o of ops.objectives.filter(o => o.assignedTurn === n && ['assigned', 'review'].includes(o.status))) Object.assign(o, { status: 'expired', expiredAt: at })
}
function assign(ops, n, faction, option, at, extra = {}) {
  if (objectiveCapReached(ops, faction) || objectiveCompleted(ops, faction, option.title)) fail('This faction cannot receive that objective again.')
  if (ops.objectives.some(o => o.faction === faction && o.assignedTurn === n && ['assigned', 'review', 'completed'].includes(o.status))) fail('This faction already has an objective for this Turn.')
  const objective = { id: randomUUID(), faction, title: option.title, requirement: option.requirement, assignedTurn: n, status: 'assigned', at, ...extra }
  ops.objectives.push(objective)
  return objective
}
function offerNomination(prep, now) {
  const next = prep.queue[prep.offers.length]
  if (!next) { prep.status = 'ready'; prep.exhausted = true; return }
  prep.offers.push({ faction: next.faction, offeredAt: now.toISOString(), deadline: new Date(+now + 24 * 60 * 60 * 1000).toISOString(), status: 'offered' })
}
// Persisted clock transitions run on reads and writes; each successor gets a full 24 hours.
export function advancePreparation(ops, now = new Date()) {
  let changed = false
  for (const prep of Object.values(ops.preparations || {})) {
    if (prep.status !== 'nomination') continue
    const offer = prep.offers.at(-1)
    if (offer?.status === 'offered' && +now >= Date.parse(offer.deadline)) {
      offer.status = 'expired'; offer.closedAt = now.toISOString(); offerNomination(prep, now); changed = true
    }
  }
  if (changed) {
    ops.revision++
    ops.journal.push({ id: randomUUID(), at: now.toISOString(), action: 'nomination-timeout', reason: '24-hour nomination window expired; next eligible faction offered the choice.', actor: 'system', turn: Math.max(...Object.keys(ops.preparations).map(Number)), input: {} })
  }
  return changed
}
export function preparationPatch(ops, n) {
  const p = ops.preparations?.[n]
  if (!p || p.status !== 'published-ready') return null
  const history = Object.values(ops.preparations).filter(x => x.turn <= n && x.status === 'published-ready' && x.nomination).map(x => ({ turn: x.turn, faction: x.nomination.faction, territory: x.nomination.territory }))
  return { turn: n, campaignRevision: AURORA_CAMPAIGN_REVISION, territories: p.territories.map(t => ({ ...t, vulnerable: p.vulnerable.includes(t.id) })), standings: p.standings, totals: [], selectionDeadline: p.selectionDeadline, ownerAdvantages: { status: 'pending', active: [], owners: Object.fromEntries(p.territories.filter(t => p.vulnerable.includes(t.id)).map(t => [t.id, t.controller])) }, nominationHistory: history }
}
export function mutatePreparation(ops, input, publication, now) {
  const n = input.turn
  if (input.action === 'prepare-nomination') {
    if (!Number.isInteger(n) || n < 3 || n > 6 || ops.preparations?.[n] || ops.turns[n]) fail('Choose an unprepared Turn from 3 to 6.')
    const previous = ops.turns[n - 1]
    if (previous?.phase !== 'resolved' || Object.keys(ops.turns).some(t => +t > n - 1)) fail('Resolve the preceding Turn before preparing its successor.')
    const required = ids(input.required || [], 4), excluded = ids(input.excluded || [])
    if (required.some(id => excluded.includes(id)) || AURORA_TERRITORIES.length - excluded.length < 4) fail('Required and excluded reward selections must permit four legal territories.')
    const territories = copy(previous.resolution.territories)
    const rows = CONQUEST.map(faction => ({ faction, earnedVP: vp(ops, faction), territoryVP: territories.filter(t => t.controller === faction).reduce((s, t) => s + AURORA_TERRITORIES.find(x => x.id === t.id).vp, 0), nominations: Object.values(ops.preparations || {}).filter(p => p.status === 'published-ready' && p.nomination?.faction === faction).length }))
    // A persisted random permutation resolves only equal projected VP / nomination counts.
    const draw = [...CONQUEST]; for (let i = draw.length - 1; i > 0; i--) { const j = randomInt(i + 1); [draw[i], draw[j]] = [draw[j], draw[i]] }
    const queue = rows.map(r => ({ ...r, projectedVP: r.earnedVP + r.territoryVP })).sort((a, b) => a.projectedVP - b.projectedVP || a.nominations - b.nominations || draw.indexOf(a.faction) - draw.indexOf(b.faction))
    const prep = { turn: n, fromTurn: n - 1, territories, standings: AURORA_FACTIONS.map(faction => ({ faction, vp: vp(ops, faction) })), required, excluded, rewardReason: campaignText(input.rewardReason || 'No mandatory rewards', 2000, 'reward priority record', true), queue, draw, offers: [], nomination: null, status: required.length === 4 ? 'ready' : 'nomination', skipped: required.length === 4, createdAt: now.toISOString() }
    ops.preparations ||= {}; ops.preparations[n] = prep
    if (!prep.skipped) offerNomination(prep, now)
    return true
  }
  if (input.action === 'nominate') {
    const p = ops.preparations?.[n], offer = p?.offers.at(-1)
    if (p?.status !== 'nomination' || offer?.status !== 'offered' || offer.faction !== input.faction || +now >= Date.parse(offer.deadline)) fail('This faction does not have an open nomination window.')
    const [territory] = ids([input.territory], 1)
    if (p.excluded.includes(territory) || p.required.includes(territory)) fail('Choose a territory for a remaining slot; existing required or excluded rewards take priority.')
    p.nomination = { faction: input.faction, territory, at: now.toISOString() }; offer.status = 'accepted'; p.status = 'ready'
    return true
  }
  if (input.action === 'finalize-territories') {
    const p = ops.preparations?.[n]
    if (p?.status !== 'ready') fail('Finish the nomination before announcing vulnerable territories.')
    const vulnerable = ids(input.territories, 4)
    if (vulnerable.length !== 4 || p.required.some(id => !vulnerable.includes(id)) || p.nomination && !vulnerable.includes(p.nomination.territory) || vulnerable.some(id => p.excluded.includes(id))) fail('Select exactly four territories honoring mandatory rewards and the nomination.')
    p.vulnerable = vulnerable; p.selectionDeadline = future(input.deadline, now); p.status = 'published-ready'; p.finalizedAt = now.toISOString()
    return true
  }
  return false
}
export function mutateTurnChoices(ops, turn, input, now) {
  if (!hasTurnThreeRules(turn.start)) fail('These preparation choices begin in Turn 3.')
  if (turn.phase !== 'choices') fail('This Turn’s choices are locked.')
  const f = input.faction, n = turn.start.turn, at = now.toISOString()
  if (!AURORA_FACTIONS.includes(f) && input.action !== 'lock-owner-advantages') fail('Choose a campaign faction.')
  if (input.action === 'offer-objectives') {
    if (!failedPreviousObjective(ops, n, f)) fail('Two-objective choice requires a failed objective in the preceding Turn and remaining objective VP capacity.')
    if (+now >= Date.parse(turn.start.selectionDeadline)) fail('This Turn’s selection deadline has passed.')
    if (turn.objectiveOffers?.[f] || ops.objectives.some(o => o.faction === f && o.assignedTurn === n && !['withdrawn', 'rejected'].includes(o.status))) fail('This faction already has an objective or offer for this Turn.')
    if (!Array.isArray(input.options) || ![1, 2].includes(input.options.length) || input.options.length === 1 && input.onlyOneEligible !== true) fail('Offer two eligible objectives, or explicitly record that only one remains.')
    const options = input.options.map(o => ({ title: campaignText(o.title, 200, 'objective title', true), requirement: campaignText(o.requirement, 4000, 'objective requirement', true) }))
    if (new Set(options.map(o => canonical(o.title))).size !== options.length || options.some(o => objectiveCompleted(ops, f, o.title))) fail('Use distinct objectives that this faction has not completed.')
    if (!Number.isInteger(input.defaultIndex) || !options[input.defaultIndex]) fail('Choose a default objective.')
    const review = campaignText(input.eligibilityReview, 2000, 'eligibility and comparable-difficulty review', true)
    turn.objectiveOffers ||= {}; turn.objectiveOffers[f] = { options, defaultIndex: input.defaultIndex, eligibilityReview: review, offeredAt: at, selectedIndex: null, deadline: turn.start.selectionDeadline }
    if (options.length === 1) selectObjective(ops, turn, f, 0, at, 'only-eligible')
    return
  }
  if (input.action === 'select-objective') {
    const offer = turn.objectiveOffers?.[f]
    if (!offer || +now >= Date.parse(offer.deadline)) fail('This objective choice window has closed.')
    selectObjective(ops, turn, f, input.index, at, 'selected'); return
  }
  if (input.action === 'select-owner-advantages') {
    if (turn.ownerAdvantages || +now >= Date.parse(turn.start.selectionDeadline)) fail('Owner-advantage selections are locked or past their deadline.')
    const eligible = turn.start.territories.filter(t => t.vulnerable && t.controller === f).map(t => t.id), selected = ids(input.territories, 2)
    if (!CONQUEST.includes(f) || eligible.length <= 2 || selected.some(id => !eligible.includes(id))) fail('Choose up to two of this faction’s three or four owned vulnerable territories.')
    turn.ownerChoices ||= {}; turn.ownerChoices[f] = { territories: selected, at }; return
  }
  if (input.action === 'lock-owner-advantages') {
    if (turn.ownerAdvantages) fail('Owner advantages have already been locked.')
    const active = [], selections = []
    for (const faction of CONQUEST) {
      const eligible = turn.start.territories.filter(t => t.vulnerable && t.controller === faction)
      let chosen = eligible.map(t => t.id), source = 'automatic'
      if (eligible.length > 2) {
        const choice = turn.ownerChoices?.[faction]
        if (!choice && +now < Date.parse(turn.start.selectionDeadline)) fail('Wait for owner selections or their published deadline before applying defaults.')
        chosen = choice ? choice.territories : eligible.toSorted((a, b) => AURORA_TERRITORIES.find(t => t.id === b.id).vp - AURORA_TERRITORIES.find(t => t.id === a.id).vp || AURORA_TERRITORIES.find(t => t.id === a.id).name.localeCompare(AURORA_TERRITORIES.find(t => t.id === b.id).name)).slice(0, 2).map(t => t.id)
        source = choice ? 'selected' : 'deadline-default'
      }
      active.push(...chosen); selections.push({ faction, territories: chosen, source })
    }
    turn.ownerAdvantages = { status: 'locked', active: active.sort(), owners: ownerSnapshot(turn.start.territories) }; turn.ownerSelectionHistory = selections; return
  }
  fail('Choose a valid preparation action.')
}
function selectObjective(ops, turn, f, index, at, source) {
  const offer = turn.objectiveOffers?.[f]
  if (!offer || offer.selectedIndex !== null || !Number.isInteger(index) || !offer.options[index]) fail('Choose one unselected offered objective.')
  const objective = assign(ops, turn.start.turn, f, offer.options[index], at, { choiceSource: source })
  Object.assign(offer, { selectedIndex: index, selectedAt: at, assignmentId: objective.id, source })
}
export function lockObjectiveChoices(ops, turn, now) {
  if (!hasTurnThreeRules(turn.start)) return
  for (const f of AURORA_FACTIONS) {
    if (!failedPreviousObjective(ops, turn.start.turn, f)) continue
    const offer = turn.objectiveOffers?.[f]
    if (!offer) fail(`This Turn requires the failed-objective choice for ${f}.`)
    if (offer.selectedIndex === null) {
      if (+now < Date.parse(offer.deadline)) fail('Wait for objective choices or their published deadline before applying defaults.')
      selectObjective(ops, turn, f, offer.defaultIndex, now.toISOString(), 'deadline-default')
    }
  }
}
export function factionPreparationView(ledger, player) {
  const ops = ledger.operations, f = factionName(player.faction)
  if (!ops) return { revision: 0, faction: f, canChoose: false, nomination: null, turn: null, objectives: [], nominationHistory: [] }
  const canChoose = [ops.commanders[f]?.commander, ops.commanders[f]?.deputy].includes(player.userId)
  const prep = Object.values(ops.preparations || {}).find(p => p.status === 'nomination' && p.offers.at(-1)?.faction === f)
  const current = Object.values(ops.turns).at(-1)
  const turn = current && hasTurnThreeRules(current.start) && current.phase === 'choices' ? { turn: current.start.turn, deadline: current.start.selectionDeadline, objectives: copy(current.objectiveOffers?.[f] || null), ownerEligible: current.start.territories.filter(t => t.vulnerable && t.controller === f).map(t => t.id), ownerSelected: copy(current.ownerChoices?.[f]?.territories ?? null), ownerLocked: Boolean(current.ownerAdvantages) } : null
  return { revision: ops.revision, faction: f, canChoose, nomination: prep ? { turn: prep.turn, deadline: prep.offers.at(-1).deadline, eligible: AURORA_TERRITORIES.filter(t => !prep.required.includes(t.id) && !prep.excluded.includes(t.id)).map(t => t.id) } : null, turn, objectives: ops.objectives.filter(o => o.faction === f).map(({ id, title, requirement, assignedTurn, status }) => ({ id, title, requirement, assignedTurn, status })), nominationHistory: Object.values(ops.preparations || {}).filter(p => p.nomination?.faction === f).map(p => ({ turn: p.turn, territory: p.nomination.territory })) }
}
export function validatePreparedPublication(ledger, state) {
  if (!hasCampaignCorrections(state)) return
  const frozen = ledger.operations?.turns[state.turn]
  if (frozen && frozen.phase !== 'choices' && state.deadline !== frozen.start.deadline) fail('The reporting deadline is locked once games open.')
  if (!hasTurnThreeRules(state)) return
  const ops = ledger.operations, p = ops?.preparations?.[state.turn], turn = ops?.turns[state.turn]
  if (!p || p.status !== 'published-ready') fail('Finish the nomination and four-territory preparation before publishing this Turn.')
  const vulnerable = state.territories.filter(t => t.vulnerable).map(t => t.id).sort()
  if (JSON.stringify(vulnerable) !== JSON.stringify([...p.vulnerable].sort()) || state.selectionDeadline !== p.selectionDeadline) fail('Publish the prepared vulnerable territories and selection deadline unchanged.')
  const expected = turn?.phase === 'resolved' ? turn.resolution.territories : p.territories
  if (state.territories.some(t => t.controller !== expected.find(v => v.id === t.id).controller)) fail('Publish the prepared ownership snapshot or the resolved ownership outcome.')
  const patch = preparationPatch(ops, state.turn)
  if (JSON.stringify(state.nominationHistory || []) !== JSON.stringify(patch.nominationHistory)) fail('Publish the recorded nomination history unchanged.')
  const owner = turn?.ownerAdvantages || patch.ownerAdvantages
  if (JSON.stringify(state.ownerAdvantages) !== JSON.stringify(owner)) fail('Publish the recorded owner-advantage selections unchanged.')
  if (turn && turn.phase !== 'choices' && state.deadline !== turn.start.deadline) fail('The reporting deadline is locked once games open.')
  if (state.finalStandings && JSON.stringify(state.finalStandings) !== JSON.stringify(turn?.resolution?.publicPatch?.finalStandings)) fail('Publish only the resolved final campaign standings.')
}
