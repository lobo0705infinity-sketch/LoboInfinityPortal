// Commissioner-only rules engine. Never import this module into a client bundle.
import { randomUUID, createHash } from 'node:crypto'
import { AURORA_FACTIONS as FACTIONS, AURORA_CONQUEST_FACTIONS as CONQUEST, AURORA_TERRITORIES, AURORA_DOCTRINES } from '../shared/aurora-public.mjs'
import { campaignTotals, campaignText, factionName } from '../shared/aurora-games.mjs'

const fail = message => { throw Object.assign(Error(message), { code: 'CAMPAIGN_RULE' }) }
const integer = (value, min, max, label) => { if (!Number.isSafeInteger(value) || value < min || value > max) fail(`Enter a valid ${label}.`); return value }
const faction = value => { if (!FACTIONS.includes(value)) fail('Choose a campaign faction.'); return value }
const text = (value, label, max = 2000) => campaignText(value, max, label, true)
const copy = value => structuredClone(value)
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const serviceCosts = { preparation: 2, dossier: 1, insurance: 2, logistics: 2 }
const confirmed = g => g.status === 'confirmed' && (!g.late || g.lateApproved) && (!g.duplicateOf || g.duplicateApproved)
export const emptyOperations = () => ({ version: 1, revision: 0, commanders: {}, turns: {}, awards: [], objectives: [], journal: [], credits: Object.fromEntries(FACTIONS.map(f => [f, f === 'NA2' ? 0 : 6])) })
export function validOperations(ops) {
  return Boolean(ops && ops.version === 1 && Number.isSafeInteger(ops.revision) && ops.revision >= 0
    && ops.commanders && typeof ops.commanders === 'object' && !Array.isArray(ops.commanders)
    && ops.turns && typeof ops.turns === 'object' && !Array.isArray(ops.turns)
    && Array.isArray(ops.awards) && ops.awards.every(a => FACTIONS.includes(a.faction) && Number.isSafeInteger(a.vp) && typeof a.source === 'string')
    && Array.isArray(ops.objectives) && Array.isArray(ops.journal) && ops.journal.length === ops.revision
    && ops.credits && FACTIONS.every(f => Number.isSafeInteger(ops.credits[f]) && ops.credits[f] >= 0)
    && Object.values(ops.turns).every(t => ['choices', 'open', 'closed', 'resolved'].includes(t.phase) && t.start && Array.isArray(t.start.territories) && Array.isArray(t.offers)))
}
export const campaignVP = ops => Object.fromEntries(FACTIONS.map(f => [f, ops.awards.filter(a => a.faction === f).reduce((sum, a) => sum + a.vp, 0)]))
const turnGames = (ledger, turn) => ledger.games.filter(g => g.turn === turn)
function award(ops, turn, f, vp, category, source, reason, at) {
  faction(f); integer(vp, -1000, 1000, 'VP award')
  if (ops.awards.some(a => a.source === source)) fail('This reward has already been recorded.')
  if ((campaignVP(ops)[f] + vp) < 0) fail('Campaign VP cannot be negative.')
  ops.awards.push({ id: randomUUID(), turn, faction: f, vp, category, source, reason, at, actor: 'commissioner' })
}
function evidence(input, ops, f, players) {
  const sender = text(input.sender, 'Discord sender', 30), reps = ops.commanders[f]
  if (!reps || ![reps.commander, reps.deputy].includes(sender)) fail('Choose the recorded Commander or deputy as sender.')
  if (!players.some(p => p.userId === sender && factionName(p.faction) === f)) fail('This representative is no longer registered for that faction.')
  const messageUrl = campaignText(input.messageUrl || '', 300, 'Discord message link')
  if (messageUrl && !/^https:\/\/(?:www\.)?discord\.com\/channels\/(?:@me|\d+)\/\d+\/\d+$/.test(messageUrl)) fail('Enter a valid Discord message link.')
  return { sender, messageUrl, note: campaignText(input.note || '', 2000, 'private note') }
}
function target(turn, id) {
  if (!turn.start.territories.some(t => t.id === id && t.vulnerable)) fail('Choose a Vulnerable Territory in this Turn.')
  return id
}
function getTurn(ops, n) { const t = ops.turns[n]; if (!t) fail('This Turn has not been prepared in campaign operations.'); return t }
function editable(turn) { if (turn.phase !== 'choices') fail('This Turn’s choices are locked.'); }
function addRank(rows) { return rows.toSorted((a, b) => b.tp - a.tp || b.op - a.op) }
function uniqueLeader(rows) { const sorted = addRank(rows); return sorted[0]?.tp > 0 && !(sorted[1] && sorted[0].tp === sorted[1].tp && sorted[0].op === sorted[1].op) ? sorted[0].faction : '' }

export function resolveOperations(ledger, turnNumber) {
  const ops = ledger.operations || emptyOperations(), turn = getTurn(ops, turnNumber)
  const games = turnGames(ledger, turnNumber).filter(confirmed), totals = campaignTotals(games, turnNumber)
  const earned = (location, f) => totals.find(r => r.location === location && r.faction === f) || { tp: 0, op: 0 }
  const tohaa = turn.tohaa, ca = turn.ca, contract = turn.offers.find(o => o.id === turn.accepted), service = turn.service
  const naTP = contract ? earned(contract.location, 'NA2').tp : 0, naSupport = Math.floor(naTP / 2)
  const tohaaSupport = tohaa ? Math.floor(earned(tohaa.location, 'Tohaa').tp / 5) : 0
  const territories = copy(turn.start.territories), control = []
  for (const territory of territories.filter(t => t.vulnerable)) {
    const rows = CONQUEST.map(f => {
      const score = earned(territory.id, f)
      const hidden = tohaa?.location === territory.id && tohaa.beneficiary === f ? tohaaSupport : 0
      const merc = contract?.location === territory.id && (contract.employer === f || (contract.employer === 'Tohaa' && tohaa?.beneficiary === f)) ? naSupport : 0
      return { faction: f, earnedTP: score.tp, op: score.op, tohaa: hidden, na2: merc, influence: score.tp + hidden + merc }
    }).toSorted((a, b) => b.influence - a.influence || b.op - a.op)
    const leaders = rows.filter(r => r.influence === rows[0].influence && r.op === rows[0].op)
    const controller = rows[0].influence === 0 || leaders.length > 1 ? territory.controller : leaders[0].faction
    control.push({ location: territory.id, before: territory.controller, after: controller, reason: rows[0].influence === 0 ? 'No Influence; controller retains' : leaders.length > 1 ? 'Influence and OP tied; controller retains' : 'Highest Influence, then OP', rows })
    territory.controller = controller
  }
  let infiltration = null
  if (ca) {
    const score = earned(ca.location, 'Combined Army'), hired = contract?.employer === 'Combined Army'
    const comparisonTP = score.tp + (hired ? naSupport : 0)
    const rivals = FACTIONS.filter(f => f !== 'Combined Army' && !(hired && f === 'NA2')).map(f => ({ faction: f, ...earned(ca.location, f) }))
    const success = comparisonTP > 0 && rivals.every(r => comparisonTP > r.tp || (comparisonTP === r.tp && score.op > r.op))
    infiltration = { location: ca.location, earnedTP: score.tp, op: score.op, support: hired ? naSupport : 0, comparisonTP, success, rivals }
    if (success) territories.find(t => t.id === ca.location).infiltrated = true
  }
  const hiddenHand = tohaa ? { ...tohaa, support: tohaaSupport, success: territories.find(t => t.id === tohaa.location).controller === tohaa.beneficiary && (tohaa.outcome === 'PRESERVE' || turn.start.territories.find(t => t.id === tohaa.location).controller !== tohaa.beneficiary) } : null
  const contractResult = contract ? { ...contract, earnedTP: naTP, support: naSupport, threshold: service?.kind === 'preparation' ? 3 : 5,
    outcome: contract.employer === 'Tohaa' ? Boolean(hiddenHand?.success) : contract.employer === 'Combined Army' ? Boolean(infiltration?.success) : territories.find(t => t.id === contract.location).controller === contract.employer } : null
  if (contractResult) { contractResult.success = naTP >= contractResult.threshold && contractResult.outcome; contractResult.insured = !contractResult.success && !contractResult.outcome && naTP >= 5 && service?.kind === 'insurance' }
  const narrative = FACTIONS.map(f => ({ faction: f, tp: earned('narrative', f).tp + (f === 'NA2' && service?.kind === 'logistics' ? 2 : 0) + (turn.narrativeBonuses?.filter(b => b.faction === f).reduce((s, b) => s + b.tp, 0) || 0), op: earned('narrative', f).op }))
  const narrativeWinner = turn.start.narrativeMission ? uniqueLeader(narrative) : ''
  const won = control.filter(c => c.after && (c.before !== c.after || totals.some(t => t.location === c.location && t.tp > 0)))
  const startCount = Object.fromEntries(CONQUEST.map(f => [f, turn.start.territories.filter(t => t.controller === f).length]))
  const most = Math.max(...Object.values(startCount)), firstRuin = turn.start.territories.some(t => t.ruin)
  const locationTP = id => totals.filter(t => t.location === id).reduce((s, t) => s + t.tp, 0)
  const maxTP = Math.max(0, ...control.map(c => locationTP(c.location)))
  const doctrines = AURORA_DOCTRINES.map(d => {
    const successes = won.filter(c => c.after === d.faction), captures = successes.filter(c => c.before !== d.faction)
    let eligible = false
    if (d.faction === 'PanOceania') eligible = successes.some(c => AURORA_TERRITORIES.find(t => t.id === c.location).vp === 3)
    if (d.faction === 'Yu Jing') eligible = captures.length > 0 && !control.some(c => c.before === d.faction && c.after !== d.faction)
    if (d.faction === 'Ariadna') eligible = successes.some(c => AURORA_TERRITORIES.find(t => t.id === c.location).vp === 1)
    if (d.faction === 'Haqqislam') eligible = successes.some(c => firstRuin ? turn.start.territories.find(t => t.id === c.location).ruin : AURORA_TERRITORIES.find(t => t.id === c.location).vp === 3)
    if (d.faction === 'Nomads') eligible = captures.some(c => c.before && startCount[c.before] === most)
    if (d.faction === 'JSA') eligible = captures.some(c => c.before && turn.startVP[c.before] > turn.startVP.JSA)
    if (d.faction === 'O-12') eligible = successes.length > 0 && new Set(control.map(c => c.after).filter(Boolean)).size >= 3
    if (d.faction === 'ALEPH') eligible = maxTP > 0 && control.some(c => c.after === 'ALEPH' && locationTP(c.location) === maxTP)
    const scored = ops.awards.filter(a => a.faction === d.faction && a.category === 'doctrine').length
    return { ...d, eligible, scored, canAward: eligible && scored < 3 && !ops.awards.some(a => a.category === 'doctrine' && a.faction === d.faction && a.turn === turnNumber) }
  })
  const awards = []
  if (hiddenHand?.success) awards.push({ faction: 'Tohaa', vp: 2, category: 'hidden-hand', source: `hidden-hand:${turnNumber}`, reason: 'Hidden Hand outcome achieved' })
  if (infiltration?.success) awards.push({ faction: 'Combined Army', vp: 2, category: 'infiltration', source: `infiltration:${turnNumber}`, reason: 'Infiltration achieved' })
  if (contractResult?.success || contractResult?.insured) awards.push({ faction: 'NA2', vp: contractResult.success ? 2 : 1, category: 'contract', source: `contract:${turnNumber}`, reason: contractResult.success ? 'Contract completed' : 'Failure Insurance' })
  if (narrativeWinner) awards.push({ faction: narrativeWinner, vp: turnNumber === 6 ? 2 : 1, category: 'narrative', source: `narrative:${turnNumber}`, reason: 'Narrative contest winner' })
  if (turnNumber === 6) for (const f of CONQUEST) { const vp = territories.filter(t => t.controller === f).reduce((s, t) => s + AURORA_TERRITORIES.find(v => v.id === t.id).vp, 0); if (vp) awards.push({ faction: f, vp, category: 'territory', source: `territory:${f}:6`, reason: 'Final controlled territory VP' }) }
  const unresolved = turnGames(ledger, turnNumber).filter(g => !confirmed(g) && g.status !== 'rejected').map(g => ({ id: g.id, status: g.status }))
  return { turn: turnNumber, totals, control, territories, hiddenHand, infiltration, contract: contractResult, narrative, narrativeWinner, doctrines, awards, unresolved }
}

export function operationsView(ledger) {
  const ops = ledger.operations || emptyOperations()
  const current = Object.values(ops.turns).at(-1)
  return { ...copy(ops), vp: campaignVP(ops), preview: current && current.phase !== 'resolved' ? resolutionPreview(ledger, current.start.turn) : null }
}

export function mutateOperations(ledger, input, players, publication, now = new Date()) {
  const ops = ledger.operations ||= emptyOperations()
  if (input.revision !== ops.revision) fail('This campaign ledger changed. Reload before saving.')
  const at = now.toISOString(), action = input.action, reason = text(input.reason, 'commissioner explanation')
  const n = integer(input.turn ?? publication.turn, 0, 6, 'Campaign Turn')
  if (action === 'representatives') {
    const f = faction(input.faction), commander = text(input.commander, 'Commander Discord ID', 30), deputy = campaignText(input.deputy || '', 30, 'deputy Discord ID')
    if (commander === deputy || ![commander, deputy].filter(Boolean).every(id => players.some(p => p.userId === id && factionName(p.faction) === f))) fail('Choose distinct registered players from this faction.')
    ops.commanders[f] = { commander, deputy, at }
  } else if (action === 'clear-representatives') {
    delete ops.commanders[faction(input.faction)]
  } else if (action === 'prepare') {
    if (!publication.turn || n !== publication.turn) fail('Choose the currently announced Turn.')
    if (ops.turns[n]) fail('This Turn has already been prepared.')
    if (n > 1 && ops.turns[n - 1]?.phase !== 'resolved') fail('This campaign requires the previous Turn to be resolved first.')
    if (publication.territories.filter(t => t.vulnerable).length !== 4 || !publication.deadline || !Number.isFinite(Date.parse(publication.deadline))) fail('This Turn requires four Vulnerable Territories and a deadline.')
    if (!Object.keys(ops.turns).length) for (const s of publication.standings) if (s.vp) award(ops, 0, s.faction, s.vp, 'opening', `opening:${s.faction}`, 'Opening published balance', at)
    ops.turns[n] = { phase: 'choices', start: copy(publication), startVP: campaignVP(ops), startCredits: copy(ops.credits), offers: [], accepted: '', service: null, tohaa: null, ca: null, narrativeBonuses: [], preparedAt: at }
  } else {
    const turn = getTurn(ops, n)
    if (turn.phase === 'resolved' && action !== 'adjustment') fail('This Turn is resolved and its ledger is locked.')
    if (action === 'hidden-hand') {
      editable(turn); if (turn.offers.some(o => o.employer === 'Tohaa')) fail('This selection is committed by an offer; withdraw that offer first.')
      const location = target(turn, input.location), beneficiary = faction(input.beneficiary), outcome = input.outcome
      if (!CONQUEST.includes(beneficiary) || !['INSTALL', 'PRESERVE'].includes(outcome)) fail('Choose a Conquest beneficiary and INSTALL or PRESERVE.')
      const controller = turn.start.territories.find(t => t.id === location).controller
      if (outcome === 'PRESERVE' ? controller !== beneficiary : !controller || controller === beneficiary) fail('This desired outcome is incompatible with the starting controller.')
      turn.tohaa = { location, beneficiary, outcome, ...evidence(input, ops, 'Tohaa', players) }
    } else if (action === 'infiltration') {
      editable(turn); if (turn.offers.some(o => o.employer === 'Combined Army')) fail('This target is committed by an offer; withdraw that offer first.')
      const location = target(turn, input.location)
      if (turn.start.territories.find(t => t.id === location).infiltrated) fail('Choose a territory not already Infiltrated.')
      turn.ca = { location, ...evidence(input, ops, 'Combined Army', players) }
    } else if (action === 'offer') {
      editable(turn); const employer = faction(input.faction), location = target(turn, input.location), bid = integer(input.bid, 1, 3, 'Credit bid')
      if (employer === 'NA2' || turn.offers.some(o => o.employer === employer)) fail('Choose an employer with no existing offer this Turn.')
      if (ops.credits[employer] < bid) fail('This employer cannot afford the offer.')
      if (employer === 'Tohaa' && (!turn.tohaa || turn.tohaa.location !== location)) fail('Choose the committed Hidden Hand territory.')
      if (employer === 'Combined Army' && (!turn.ca || turn.ca.location !== location)) fail('Choose the committed Infiltration target.')
      turn.offers.push({ id: randomUUID(), employer, location, bid, ...evidence(input, ops, employer, players) })
    } else if (action === 'withdraw-offer') {
      editable(turn); if (turn.accepted === input.id) fail('This offer has been accepted and cannot change.')
      if (!turn.offers.some(o => o.id === input.id)) fail('Choose an existing offer.')
      turn.offers = turn.offers.filter(o => o.id !== input.id)
    } else if (action === 'accept') {
      editable(turn); if (turn.accepted || turn.service) fail('This contract decision is already committed.')
      const offer = turn.offers.find(o => o.id === input.id); if (!offer) fail('Choose an existing offer.')
      turn.acceptance = evidence(input, ops, 'NA2', players)
      ops.credits[offer.employer] -= offer.bid; turn.accepted = offer.id
    } else if (action === 'service') {
      editable(turn); if (turn.service) fail('Only one NA2 service is allowed per Turn.')
      const cost = serviceCosts[input.kind]
      if (!cost || ops.credits.NA2 < cost || turn.startCredits.NA2 < cost) fail('Choose an affordable NA2 service using start-of-Turn Credits.')
      if (['preparation', 'insurance'].includes(input.kind) && !turn.accepted) fail('This service requires an accepted contract.')
      const location = input.kind === 'dossier' ? target(turn, input.location) : ''
      turn.service = { kind: input.kind, cost, location, ...evidence(input, ops, 'NA2', players) }; ops.credits.NA2 -= cost
    } else if (action === 'begin') {
      editable(turn)
      if (publication.turn !== n || JSON.stringify(publication.territories) !== JSON.stringify(turn.start.territories) || publication.deadline !== turn.start.deadline) fail('This Turn’s public territory state or deadline changed after preparation. Restore the prepared state before opening games.')
      if (turnGames(ledger, n).length) fail('This Turn already has game records; choices cannot be locked retrospectively.')
      if ((!turn.tohaa && !turn.waived?.includes('Tohaa')) || (!turn.ca && !turn.waived?.includes('Combined Army'))) fail('This Turn requires recorded Tohaa and CA selections, or explicit commissioner waivers, before games begin.')
      turn.phase = 'open'; turn.lockedAt = at
      if (turn.service?.kind === 'dossier') turn.dossier = { location: turn.service.location, tohaa: turn.tohaa.location === turn.service.location, ca: turn.ca.location === turn.service.location }
    } else if (action === 'waive-selection') {
      editable(turn); if (!['Tohaa', 'Combined Army'].includes(input.faction)) fail('Choose Tohaa or Combined Army.')
      if (input.faction === 'Tohaa' ? turn.tohaa : turn.ca) fail('This faction already has a selection.')
      turn.waived = [...new Set([...(turn.waived || []), input.faction])]
    } else if (action === 'close') {
      if (turn.phase !== 'open') fail('This Turn is not open for reporting.'); turn.phase = 'closed'; turn.closedAt = at
    } else if (action === 'reopen') {
      if (turn.phase !== 'closed') fail('This Turn is not closed.'); turn.phase = 'open'
    } else if (action === 'assign-objective') {
      if (n < 2) fail('Secret Objectives begin in Turn 2.')
      const f = faction(input.faction), title = text(input.title, 'objective title', 200), requirement = text(input.requirement, 'objective requirement', 4000)
      if (ops.objectives.some(o => o.faction === f && o.title === title && o.status !== 'rejected')) fail('This objective is already assigned to the faction.')
      ops.objectives.push({ id: randomUUID(), faction: f, title, requirement, assignedTurn: n, status: 'assigned', at })
    } else if (action === 'objective') {
      if (turn.phase !== 'closed') fail('Close reporting before awarding objectives.')
      const objective = ops.objectives.find(o => o.id === input.id)
      if (!objective || objective.status !== 'assigned' || objective.assignedTurn > n) fail('Choose an active assigned objective.')
      if (input.claimId) {
        const claim = ledger.claims.find(c => c.id === input.claimId)
        if (!claim || claim.status !== 'approved' || factionName(claim.faction) !== objective.faction || claim.turn !== n || ops.objectives.some(o => o.claimId === input.claimId)) fail('Choose an approved, unused claim from this faction and Turn.')
      }
      if (input.approve === true) {
        const already = ops.awards.filter(a => a.faction === objective.faction && a.category === 'objective').reduce((s, a) => s + a.vp, 0)
        if (already + 2 > 6) fail('This faction has reached the six-VP Secret Objective limit.')
        award(ops, n, objective.faction, 2, 'objective', `objective:${objective.id}`, reason, at)
      } else if (input.approve !== false) fail('Choose approval or rejection.')
      Object.assign(objective, { status: input.approve ? 'completed' : 'rejected', completedTurn: n, reason, claimId: input.claimId || '', evidence: text(input.evidence, 'objective evidence', 4000) })
    } else if (action === 'narrative-bonus') {
      editable(turn); if (!turn.start.narrativeMission) fail('This Turn has no announced Narrative Mission.')
      const f = faction(input.faction), source = text(input.source, 'reward reference', 200), tp = integer(input.tp, 1, 10, 'Narrative TP bonus')
      if (Object.values(ops.turns).some(t => t.narrativeBonuses.some(b => b.source === source))) fail('This reward reference has already been used.')
      turn.narrativeBonuses.push({ faction: f, source, tp, reason })
    } else if (action === 'adjustment') {
      if (!['closed', 'resolved'].includes(turn.phase)) fail('Close reporting before recording a VP adjustment.')
      if (Object.keys(ops.turns).some(key => Number(key) > n)) fail('This Turn has a successor. Record the explained correction in the latest Turn instead.')
      award(ops, n, faction(input.faction), integer(input.vp, -100, 100, 'VP adjustment'), 'adjustment', `adjustment:${randomUUID()}`, reason, at)
      if (turn.resolution) turn.resolution.publicPatch.standings = FACTIONS.map(f => ({ faction: f, vp: campaignVP(ops)[f] }))
    } else if (action === 'resolve') {
      if (turn.phase !== 'closed') fail('Close reporting before resolving the Turn.')
      const result = resolveOperations(ledger, n)
      if (input.previewHash !== fingerprint(result)) fail('This resolution preview changed. Review it again before committing.')
      if (result.unresolved.length) fail('This Turn has pending, disputed, late or duplicate games. Resolve or reject them first.')
      const selected = input.doctrines || []
      if (!Array.isArray(selected) || new Set(selected).size !== selected.length || selected.some(f => !result.doctrines.some(d => d.faction === f && d.canAward))) fail('Choose only eligible Doctrines below their scoring limits.')
      for (const f of selected) result.awards.push({ faction: f, vp: 1, category: 'doctrine', source: `doctrine:${n}:${f}`, reason: 'Commissioner approved Doctrine completion' })
      for (const a of result.awards) award(ops, n, a.faction, a.vp, a.category, a.source, a.reason, at)
      if (result.contract) { if (result.contract.success) ops.credits.NA2 += result.contract.bid; else ops.credits[result.contract.employer] += result.contract.bid }
      const publicPatch = { territories: copy(result.territories), standings: FACTIONS.map(f => ({ faction: f, vp: campaignVP(ops)[f] })) }
      turn.phase = 'resolved'; turn.resolution = { ...result, at, reason, publicPatch }; turn.resolvedAt = at
    } else fail('Choose a valid campaign operation.')
  }
  ops.revision++
  ops.journal.push({ id: randomUUID(), at, turn: n, action, reason, actor: 'commissioner', input: copy(input) })
  return operationsView(ledger)
}

export function resolutionPreview(ledger, turn) {
  const result = resolveOperations(ledger, turn)
  return { ...result, previewHash: fingerprint(result) }
}

export function guardCampaignGame(ledger, turn, mutation) {
  const phase = ledger.operations?.turns[turn]?.phase
  if (phase === 'resolved') fail('This Turn is resolved; game records are locked. Contact Lobo.')
  if (mutation === 'submit' && ledger.operations && !phase) fail('This Turn has not been prepared for campaign reporting. Contact Lobo.')
  if (mutation === 'submit' && phase && phase !== 'open') fail('This Turn is not open for campaign reporting.')
}
