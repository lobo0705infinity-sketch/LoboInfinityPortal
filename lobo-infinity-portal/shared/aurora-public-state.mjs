import { AURORA_CONQUEST_FACTIONS, AURORA_FACTIONS, AURORA_TERRITORIES } from './aurora-public.mjs'

export function emptyAuroraState() {
  return { schemaVersion: 1, eventId: '', turn: 0, deadline: '', reportUrl: '', campaignEvent: null, narrativeMission: null,
    territories: AURORA_TERRITORIES.map(item => ({ id: item.id, controller: '', vulnerable: false, ruin: false, infiltrated: false })),
    standings: [], totals: [], story: [] }
}

function record(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new Error(`${label} contains unsupported fields.`)
  return value
}
function text(value, max, label) {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new Error(`Invalid ${label}.`)
  return value.trim()
}
function number(value, max, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new Error(`Invalid ${label}.`)
  return value
}
function list(value, max, label) { if (!Array.isArray(value) || value.length > max) throw new Error(`Invalid ${label}.`); return value }
function flag(value) { if (typeof value !== 'boolean') throw new Error('Territory tags must be true or false.'); return value }
function url(value, label) {
  const result = text(value, 1000, label)
  if (result) { const parsed = new URL(result); if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error(`${label} must be a public HTTPS link.`) }
  return result
}

// Reject unsupported fields before storage; private records never reach public Blob.
export function validateAuroraPublicState(raw) {
  const value = record(raw, ['schemaVersion', 'eventId', 'turn', 'deadline', 'reportUrl', 'campaignEvent', 'narrativeMission', 'territories', 'standings', 'totals', 'story'], 'Campaign publication')
  if (value.schemaVersion !== 1) throw new Error('Unsupported campaign version.')
  const turn = number(value.turn, 6, 'Campaign Turn')
  const eventId = text(value.eventId, 120, 'campaign event')
  if (eventId && !/^event-[a-z0-9-]+$/.test(eventId)) throw new Error('Invalid campaign event.')
  const deadline = text(value.deadline, 80, 'deadline')
  if (deadline && (!/(?:Z|[+-]\d{2}:\d{2})$/.test(deadline) || !Number.isFinite(Date.parse(deadline)))) throw new Error('Include a timezone in the deadline.')
  const territories = list(value.territories, 12, 'territories').map(raw => {
    const item = record(raw, ['id', 'controller', 'vulnerable', 'ruin', 'infiltrated'], 'Territory')
    const id = text(item.id, 80, 'territory identity')
    if (!AURORA_TERRITORIES.some(territory => territory.id === id)) throw new Error('Unknown territory.')
    const controller = text(item.controller, 30, 'controller')
    if (controller && !AURORA_CONQUEST_FACTIONS.includes(controller)) throw new Error('Only Conquest factions control territories.')
    return { id, controller, vulnerable: flag(item.vulnerable), ruin: flag(item.ruin), infiltrated: flag(item.infiltrated) }
  })
  if (territories.length !== 12 || new Set(territories.map(item => item.id)).size !== 12) throw new Error('Publish all 12 territories once.')
  if ((turn === 0 && territories.some(item => item.vulnerable)) || (turn > 0 && territories.filter(item => item.vulnerable).length !== 4)) throw new Error('An active Turn requires exactly four Vulnerable Territories; pre-launch requires none.')
  const standings = list(value.standings, 11, 'standings').map(raw => {
    const item = record(raw, ['faction', 'vp'], 'Standing')
    if (!AURORA_FACTIONS.includes(item.faction)) throw new Error('Unknown faction.')
    return { faction: item.faction, vp: number(item.vp, 1000, 'Campaign VP') }
  })
  if (new Set(standings.map(item => item.faction)).size !== standings.length) throw new Error('Duplicate faction standings.')
  const totals = list(value.totals, 143, 'public totals').map(raw => {
    const item = record(raw, ['location', 'faction', 'tp', 'op'], 'Public total')
    if (item.location !== 'narrative' && !territories.some(territory => territory.id === item.location && territory.vulnerable)) throw new Error('Totals must belong to a current Vulnerable Territory or the Narrative Mission.')
    if (!AURORA_FACTIONS.includes(item.faction)) throw new Error('Unknown total faction.')
    return { location: item.location, faction: item.faction, tp: number(item.tp, 100000, 'TP'), op: number(item.op, 100000, 'OP') }
  })
  if (new Set(totals.map(item => `${item.location}:${item.faction}`)).size !== totals.length) throw new Error('Duplicate location/faction totals.')
  const story = list(value.story, 7, 'published chapters').map(raw => {
    const item = record(raw, ['turn', 'title', 'body'], 'Published chapter')
    const chapterTurn = number(item.turn, turn, 'published chapter Turn')
    const title = text(item.title, 200, 'chapter title'), body = text(item.body, 20000, 'released chapter')
    if (!title || !body) throw new Error('Published chapters require a title and text.')
    return { turn: chapterTurn, title, body }
  })
  if (new Set(story.map(item => item.turn)).size !== story.length) throw new Error('Publish one chapter per Turn.')
  let campaignEvent = null, narrativeMission = null
  if (value.campaignEvent !== null) {
    const item = record(value.campaignEvent, ['title', 'rules'], 'Current Campaign Event')
    campaignEvent = { title: text(item.title, 200, 'Campaign Event title'), rules: text(item.rules, 5000, 'announced Campaign Event rules') }
    if (!campaignEvent.title || !campaignEvent.rules) throw new Error('Announce the Campaign Event title and complete rules together.')
  }
  if (value.narrativeMission !== null) {
    const item = record(value.narrativeMission, ['title', 'briefing', 'reward', 'sheetUrl'], 'Current Narrative Mission')
    narrativeMission = { title: text(item.title, 200, 'Narrative Mission title'), briefing: text(item.briefing, 8000, 'current briefing'), reward: text(item.reward, 2000, 'announced reward'), sheetUrl: url(item.sheetUrl, 'mission sheet') }
    if (!narrativeMission.title || !narrativeMission.briefing) throw new Error('A Narrative Mission requires a current player-facing title and briefing.')
  }
  if (turn === 0 && (campaignEvent || narrativeMission || totals.length)) throw new Error('Current Turn material requires an active Campaign Turn.')
  return { schemaVersion: 1, eventId, turn, deadline, reportUrl: url(value.reportUrl, 'reporting link'), campaignEvent, narrativeMission, territories, standings, totals, story: story.sort((a, b) => a.turn - b.turn) }
}
