import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import vm from 'node:vm'
import { CommandInteractionOptionResolver, ApplicationCommandManager } from 'discord.js'
import { createListExchangeStore } from '../bot/list-exchange-store.mjs'
import { createListExchangeService, createListExchangeReportSource, normalizeExchangeArmyCode, exchangeStatusMessage, linkedExchangePlayerName } from '../bot/list-exchange.mjs'
import { createGroupedCommandHandler, GROUPED_COMMAND_DEFINITIONS } from '../bot/grouped-commands.mjs'
import { createCampaignGameStore } from '../bot/aurora-game-store.mjs'
import { emptyAuroraState } from '../shared/aurora-public-state.mjs'

const directory = await mkdtemp(join(tmpdir(), 'llh-exchange-'))
const A = '111111111111111111', B = '222222222222222222', C = '333333333333333333', guildId = '444444444444444444'
const army = 'gr8Kb3BlcmF0aW9ucwhGb3IgV29ya4EsAgEBAAUAhK0BAgAAhusBAgAAh2oBBQAAgkgBBgAAh1IBAQACAQAKAIJQAQEAAIJTAQEAAIJTAQEAADIBAQAAh28CAQAAh28CAQAAh28BAgAAh0YBAgAAglQBAQAAh2YBAgA='
const quiet = { error() {} }
let now = 1000
const path = join(directory, 'private.json'), store = createListExchangeStore(path, { now: () => now })
async function createLocked(title = 'Game') {
  const game = await store.create({ userId: A, opponentId: B, guildId, title })
  await store.submit(game.code, A, guildId, 'Alice', army)
  await store.submit(game.code, B, guildId, 'Bob', army + 'SECRET-B')
  await store.ready(game.code, A, guildId); await store.ready(game.code, B, guildId)
  return game.code
}
const report = (code, overrides = {}) => ({ code, id: 'portal:5', players: ['Alice', 'Bob'], submittedAt: now + 1, accepted: true, ...overrides })
try {
  assert.equal(normalizeExchangeArmyCode(`https://infinitytheuniverse.com/army/list/${encodeURIComponent(army)}`), army)
  for (const input of ['', 'not-an-army', 'https://example.com/no-list', army + 'bad-suffix']) assert.throws(() => normalizeExchangeArmyCode(input))
  const created = await store.create({ userId: A, opponentId: B, guildId, title: 'Tuesday rematch' })
  const code = created.code
  assert.match(code, /^LLH-[A-F0-9]{16}$/)
  await assert.rejects(store.status(code, C, guildId), /Only the two/)
  await assert.rejects(store.status(code, A, 'other-server'), /Only the two/)
  await assert.rejects(store.ready(code, A, guildId), /Both players/)
  await store.submit(code, A, guildId, 'Alice', 'SECRET-A')
  await store.submit(code, B, guildId, 'Bob', 'SECRET-B')
  await store.ready(code, A, guildId)
  assert.equal((await store.status(code, A, guildId)).own.ready, true)
  await store.submit(code, B, guildId, 'Bob', 'REPLACED-B')
  assert.equal((await store.status(code, A, guildId)).own.ready, false, 'replacement invalidates both confirmations')
  assert(!JSON.stringify(await store.status(code, A, guildId)).includes('REPLACED-B'))
  await store.reconcile([report(code)])
  assert.equal((await store.status(code, A, guildId)).status, 'open', 'report cannot reveal before locking')
  await store.ready(code, A, guildId); await store.ready(code, B, guildId)
  await assert.rejects(store.submit(code, A, guildId, 'Alice', 'changed'), /locked/)
  await assert.rejects(store.cancel(code, B, guildId), /cannot be cancelled/)
  assert.deepEqual(await store.resolveLocked(code, ['Bob', 'Alice']), ['REPLACED-B', 'SECRET-A'])
  await assert.rejects(store.resolveLocked(code, ['Alice', 'Other']), /match two locked/)
  for (const invalid of [report(code, { players: ['Alice', 'Other'] }), report(code, { accepted: false }), report(code, { submittedAt: now - 1 }), report(code, { playerIds: [A, C] })]) {
    await store.reconcile([invalid]); assert.equal((await store.status(code, A, guildId)).status, 'locked')
    assert(!JSON.stringify(await store.status(code, A, guildId)).includes('REPLACED-B'))
  }
  await store.reconcile([report(code), report(code, { id: 'portal:6' })])
  assert.match((await store.status(code, A, guildId)).issue, /More than one/)
  await store.reconcile([report(code)])
  assert.equal((await store.status(code, A, guildId)).opponent.armyCode, 'REPLACED-B')
  const restart = createListExchangeStore(path, { now: () => now })
  assert.equal((await restart.status(code, B, guildId)).opponent.armyCode, 'SECRET-A')
  assert.equal((await stat(path)).mode & 0o777, 0o600)
  assert.equal((await restart.deliveries()).length, 2)
  await store.attempt(code, A); await store.delivered(code, A, 'message-1')
  await store.reconcile([report(code), report(code)])
  assert.equal((await store.deliveries()).length, 1, 'report replay does not recreate delivery obligations')
  await store.attempt(code, B); await store.delivered(code, B, 'message-2')
  assert.equal((await store.deliveries()).length, 0)

  const unstarted = await store.create({ userId: A, opponentId: B, guildId, title: 'Unused' })
  await store.submit(unstarted.code, A, guildId, 'Alice', 'delete-me')
  await store.cancel(unstarted.code, B, guildId)
  assert(!JSON.stringify(await store.status(unstarted.code, A, guildId)).includes('delete-me'))
  await assert.rejects(store.ready(unstarted.code, A, guildId))

  // Actual SDK grouped options and ephemeral responses, with no real Discord.
  const service = createListExchangeService({ store, reports: { configured: true, load: async () => [] }, workerToken: 'test-secret', logger: quiet })
  const route = createGroupedCommandHandler({ handlers: { 'list-game': service.handler }, logger: quiet })
  const interaction = { commandName: 'list', guildId, user: { id: A }, client: { user: { id: 'bot' } }, isChatInputCommand: () => true,
    options: new CommandInteractionOptionResolver({}, [{ name: 'game', type: 2, options: [{ name: 'status', type: 1, options: [{ name: 'game', type: 3, value: code }] }] }], {}),
    async deferReply(options) { assert.equal(options.flags, 64) }, async editReply(payload) { this.payload = payload },
  }
  assert.equal(await route(interaction), true)
  assert(interaction.payload.content.includes('SECRET') === false, 'only the full-list attachment contains raw private codes')
  assert.equal(interaction.payload.files[0].attachment.toString(), 'REPLACED-B')
  const definition = ApplicationCommandManager.transformCommand(GROUPED_COMMAND_DEFINITIONS.find(command => command.name === 'list'))
  assert.equal(definition.options.find(option => option.name === 'game').options.length, 7)
  const gameDefinition = definition.options.find(option => option.name === 'game')
  assert.deepEqual(gameDefinition.options.find(option => option.name === 'create').options.map(option => option.name), ['opponent', 'army-code', 'game-name'])
  assert.deepEqual(gameDefinition.options.find(option => option.name === 'join').options.map(option => option.name), ['game', 'army-code'])
  const submitDefinition = definition.options.find(option => option.name === 'game').options.find(option => option.name === 'submit')
  assert.equal(submitDefinition.options.find(option => option.name === 'player').type, 6, 'Discord account picker replaces free-text names')

  // Resolve stable account IDs, never nicknames; reject missing/conflicting
  // links and submitting as the opponent before any private list is changed.
  assert.equal(linkedExchangePlayerName([{ userId: A, name: 'Alice' }, { userId: A, name: ' ALICE ' }], A), 'Alice')
  assert.throws(() => linkedExchangePlayerName([{ userId: B, name: 'Alice' }], A), /not linked/)
  assert.throws(() => linkedExchangePlayerName([{ userId: A, name: 'Alice' }, { userId: A, name: 'Other' }], A), /conflicting/)
  assert.throws(() => linkedExchangePlayerName([{ userId: A, name: 'Alice' }, { userId: B, name: ' ALICE ' }], A), /conflicting/)
  const pickerStore = createListExchangeStore(join(directory, 'picker.json'), { now: () => now })
  let links = [{ userId: A, name: 'Alice' }, { userId: B, name: 'Bob' }], lookupCount = 0
  const pickerGame = await pickerStore.create({ userId: A, opponentId: B, guildId, title: 'Account picker' })
  const pickerService = createListExchangeService({ store: pickerStore, reports: { configured: true, load: async () => [] }, logger: quiet,
    linkedPlayers: async requestedGuild => { assert.equal(requestedGuild, guildId); lookupCount++; return links } })
  const pickerRoute = createGroupedCommandHandler({ handlers: { 'list-game': pickerService.handler }, logger: quiet })
  async function submitAs(actor, selected, requestedCode = pickerGame.code) {
    const input = { ...interaction, user: { id: actor }, options: new CommandInteractionOptionResolver({}, [
      { name: 'game', type: 2, options: [{ name: 'submit', type: 1, options: [
        { name: 'game', type: 3, value: requestedCode },
        { name: 'player', type: 6, value: selected, user: { id: selected, username: 'MisleadingNickname', bot: false } },
        { name: 'army-code', type: 3, value: army },
      ] }] },
    ], {}) }
    assert.equal(await pickerRoute(input), true)
    return input.payload.content
  }
  assert.match(await submitAs(A, B), /own Discord account/)
  assert.equal(lookupCount, 0)
  assert.equal((await pickerStore.status(pickerGame.code, A, guildId)).own.armyCode, '')
  links = []
  assert.match(await submitAs(A, A), /not linked/)
  links = [{ userId: A, name: 'Alice' }, { userId: A, name: 'Other' }]
  assert.match(await submitAs(A, A), /conflicting/)
  assert.equal((await pickerStore.status(pickerGame.code, A, guildId)).own.armyCode, '')
  links = [{ userId: A, name: 'Alice' }, { userId: B, name: 'Bob' }]
  assert.match(await submitAs(C, C), /Only the two/)
  assert.match(await submitAs(A, A), /Your portal player: \*\*Alice\*\*/)
  assert.equal((await pickerStore.status(pickerGame.code, A, guildId)).own.name, 'Alice')
  assert.match(await submitAs(B, B), /Your portal player: \*\*Bob\*\*/)
  assert(!JSON.stringify(await pickerStore.status(pickerGame.code, B, guildId)).includes('MisleadingNickname'))
  await pickerStore.ready(pickerGame.code, A, guildId); await pickerStore.ready(pickerGame.code, B, guildId)
  assert.deepEqual(await pickerStore.resolveLocked(pickerGame.code, ['Alice', 'Bob']), [army, army])
  assert.match(await submitAs(A, A), /locked/)

  // New invitation flow uses real SDK option parsing and the persistent store.
  // Creation saves A atomically; only invited B can join and lock both lists.
  const invitePath = join(directory, 'invites.json')
  const invites = createListExchangeStore(invitePath, { now: () => now })
  const notifications = []
  let closedDM = false
  const inviteClient = { users: { fetch: async id => ({ bot: false, createDM: async () => ({ send: async payload => {
    if (closedDM) throw Error('DM closed')
    notifications.push({ id, ...payload }); return { id: `invite-${notifications.length}` }
  } }) }) } }
  let inviteLookups = 0
  const inviteService = createListExchangeService({ store: invites, reports: { configured: true, load: async () => [] }, logger: quiet,
    linkedPlayers: async () => { inviteLookups++; return [{ userId: A, name: 'Alice' }, { userId: B, name: 'Bob' }] } })
  const inviteRoute = createGroupedCommandHandler({ handlers: { 'list-game': inviteService.handler }, logger: quiet })
  async function invitationCommand(actor, action, options, requestedGuild = guildId) {
    const input = { ...interaction, user: { id: actor }, client: inviteClient, guildId: requestedGuild,
      guild: { name: 'Test server', members: { fetch: async id => ({ user: { id, bot: false } }) } },
      options: new CommandInteractionOptionResolver({}, [{ name: 'game', type: 2, options: [{ name: action, type: 1, options }] }], {}) }
    assert.equal(await inviteRoute(input), true)
    assert.deepEqual(input.payload.allowedMentions, { parse: [] })
    return input.payload
  }
  const str = (name, value) => ({ name, value, type: 3 })
  const createOptions = code => [{ name: 'opponent', type: 6, value: B, user: { id: B, username: 'Bob', bot: false } }, str('army-code', code), str('game-name', 'Top 40 W2')]
  assert.match((await invitationCommand(A, 'create', createOptions('invalid'))).content, /decodable/)
  const createdInvite = await invitationCommand(A, 'create', createOptions(army))
  assert.match(createdInvite.content, /Game created/)
  const inviteCode = createdInvite.content.match(/LLH-[A-F0-9]{16}/)[0]
  assert.equal(notifications.length, 1); assert.equal(notifications[0].id, B)
  assert(notifications[0].content.includes(`<@${A}>`)); assert(notifications[0].content.includes(inviteCode))
  assert(notifications[0].content.includes('/list game join')); assert(!JSON.stringify(notifications).includes(army))
  assert.match(createdInvite.content, new RegExp(`DM to <@${B}>`))
  assert.equal(createdInvite.components[0].components[0].label, 'Resend invitation')
  assert.equal(gameDefinition.options.find(option => option.name === 'status').options[0].required, false)
  assert.equal(gameDefinition.options.find(option => option.name === 'resend').options[0].required, true)
  const savedReceipt = (await createListExchangeStore(invitePath).status(inviteCode, A, guildId)).notifications.invite
  assert.equal(savedReceipt.messageId, 'invite-1'); assert.equal(savedReceipt.recipientId, B)
  assert.equal(savedReceipt.status, 'sent'); assert(Number.isFinite(savedReceipt.sentAt))
  const inbox = await invitationCommand(B, 'status', [])
  assert(inbox.content.includes(inviteCode)); assert(!inbox.content.includes(army))
  assert(!(await invitationCommand(C, 'status', [])).content.includes(inviteCode))
  assert(!(await invitationCommand(B, 'status', [], 'another-server')).content.includes(inviteCode))
  assert.match((await invitationCommand(A, 'resend', [str('game', inviteCode)])).content, /one minute/)
  assert.match((await invitationCommand(B, 'resend', [str('game', inviteCode)])).content, /Only the creator/)
  assert.equal(notifications.length, 1)
  const beforeJoin = await invites.status(inviteCode, B, guildId)
  assert.equal(beforeJoin.status, 'open'); assert.equal(beforeJoin.opponent.submitted, true)
  assert(!JSON.stringify(beforeJoin).includes(army), 'invited player cannot see creator list')
  assert.equal((await invites.status(inviteCode, A, guildId)).own.armyCode, army)
  const joinOptions = [str('game', inviteCode.toLowerCase()), str('army-code', army)]
  const beforeLookups = inviteLookups
  assert.match((await invitationCommand(C, 'join', joinOptions)).content, /Only the two/)
  assert.match((await invitationCommand(A, 'join', joinOptions)).content, /Only the invited/)
  assert.match((await invitationCommand(B, 'join', joinOptions, 'another-server')).content, /Only the two/)
  assert.equal(inviteLookups, beforeLookups, 'check invitation ownership before identity lookup or list decoding')
  assert.match((await invitationCommand(B, 'join', [str('game', inviteCode), str('army-code', 'invalid')])).content, /decodable/)
  assert.equal((await invites.status(inviteCode, A, guildId)).status, 'open')
  await assert.rejects(invites.submit(inviteCode, A, guildId, 'Alice', army), /invited game/)
  await assert.rejects(invites.ready(inviteCode, A, guildId), /No ready/)
  const joined = await invitationCommand(B, 'join', joinOptions)
  assert.match(joined.content, /Game submitted/)
  assert.equal(notifications.length, 2); assert.equal(notifications[1].id, A)
  assert(notifications[1].content.includes(`<@${B}>`)); assert(!JSON.stringify(notifications).includes(army))
  assert.equal((await invites.status(inviteCode, A, guildId)).status, 'locked')
  assert.equal((await invites.status(inviteCode, B, guildId)).opponent.armyCode, undefined)
  assert.deepEqual(await invites.resolveLocked(inviteCode, ['Alice', 'Bob'], now), [army, army])
  await invitationCommand(B, 'join', joinOptions)
  assert.equal(notifications.length, 2, 'repeated join cannot mutate or notify twice')
  await invites.reconcile([report(inviteCode, { submittedAt: now - 1 })])
  assert.equal((await invites.status(inviteCode, A, guildId)).status, 'locked')
  await invites.reconcile([report(inviteCode)])
  assert.equal((await invites.status(inviteCode, A, guildId)).opponent.armyCode, army)
  assert.equal((await createListExchangeStore(invitePath).status(inviteCode, B, guildId)).status, 'released')

  // Closed DMs leave a saved game, clear fallback instructions and usable code.
  closedDM = true
  const fallback = await invitationCommand(A, 'create', createOptions(army))
  assert.match(fallback.content, /could not DM/)
  const fallbackCode = fallback.content.match(/LLH-[A-F0-9]{16}/)[0]
  const fallbackJoin = await invitationCommand(B, 'join', [str('game', fallbackCode), str('army-code', army)])
  assert.match(fallbackJoin.content, /Game submitted/); assert.match(fallbackJoin.content, /could not DM/)
  assert.equal((await invites.status(fallbackCode, A, guildId)).status, 'locked')
  const race = await invites.create({ userId: A, opponentId: B, guildId, title: 'Concurrent join', name: 'Alice', armyCode: army })
  const raceResults = await Promise.allSettled([invites.join(race.code, B, guildId, 'Bob', army), invites.join(race.code, B, guildId, 'Bob', 'replacement')])
  assert.equal(raceResults.filter(result => result.status === 'fulfilled').length, 1)
  assert.deepEqual(await invites.resolveLocked(race.code, ['Alice', 'Bob'], now), [army, army])
  const cancelledInvite = await invites.create({ userId: A, opponentId: B, guildId, title: 'Cancel invitation', name: 'Alice', armyCode: army })
  await invites.cancel(cancelledInvite.code, A, guildId)
  await assert.rejects(invites.join(cancelledInvite.code, B, guildId, 'Bob', army), /closed/)
  console.log('PASS invitations: atomic create with own list, account-bound join, automatic lock, private DMs, closed-DM fallback, duplicate/concurrent join, cancellation, restart and accepted-report release.')

  // A failed DM is recorded, and the existing invitation can be recovered and resent.
  const missed = await invitationCommand(A, 'create', createOptions(army))
  const missedCode = missed.content.match(/LLH-[A-F0-9]{16}/)[0]
  assert.equal((await invites.status(missedCode, A, guildId)).notifications.invite.status, 'failed')
  assert((await invitationCommand(B, 'status', [])).content.includes(missedCode))
  now += 60_000
  closedDM = false
  const button = { ...interaction, user: { id: A }, client: inviteClient, guildId,
    guild: { name: 'Test server' }, isChatInputCommand: () => false, isButton: () => true,
    customId: `llh-invite-resend:${missedCode}` }
  assert.equal(await inviteService.handler(button), true)
  assert.match(button.payload.content, /Discord accepted/)
  assert.equal((await createListExchangeStore(invitePath).status(missedCode, A, guildId)).notifications.invite.status, 'sent')
  assert(!button.payload.content.includes(army))
  const countBeforeRace = notifications.length
  const raceResends = await Promise.all([invitationCommand(A, 'resend', [str('game', missedCode)]), invitationCommand(A, 'resend', [str('game', missedCode)])])
  assert(raceResends.every(payload => /one minute/.test(payload.content)))
  assert.equal(notifications.length, countBeforeRace)
  now += 60_000
  const concurrentResends = await Promise.all([invitationCommand(A, 'resend', [str('game', missedCode)]), invitationCommand(A, 'resend', [str('game', missedCode)])])
  assert.equal(concurrentResends.filter(payload => /Discord accepted/.test(payload.content)).length, 1)
  assert.equal(notifications.length, countBeforeRace + 1)
  assert.match((await invitationCommand(A, 'resend', [str('game', inviteCode)])).content, /Only the creator/)
  assert(!(await invitationCommand(B, 'status', [])).content.includes(inviteCode), 'joined games leave the inbox')
  assert(!(await invitationCommand(B, 'status', [])).content.includes(cancelledInvite.code), 'cancelled games leave the inbox')
  const whitespace = await invites.create({ userId: A, opponentId: B, guildId, title: 'Names', name: '  Alice   Smith  ', armyCode: army })
  await invites.join(whitespace.code, B, guildId, 'Bob  Jones', army)
  assert.deepEqual(await invites.resolveLocked(whitespace.code, ['alice smith', 'BOB JONES'], now), [army, army])
  await invites.reconcile([report(whitespace.code, { players: ['Alice Smith', 'Bob Jones'] })])
  assert.equal((await invites.status(whitespace.code, B, guildId)).status, 'released')
  assert.equal(linkedExchangePlayerName([{ userId: A, name: 'Alice  Smith' }, { userId: A, name: 'alice smith' }], A), 'Alice  Smith')
  assert.throws(() => linkedExchangePlayerName([{ userId: A, name: 'Alice  Smith' }, { userId: B, name: 'alice smith' }], A), /conflicting/)
  console.log('PASS invitation recovery: durable receipts, private inbox, account/server boundaries, resend button, cooldown, closed/locked games, whitespace names.')

  // Authenticated machine resolution never gives the browser a private list.
  const locked = await createLocked('HTTP test')
  async function resolveRequest(token, input, method = 'POST') {
    const request = Readable.from([JSON.stringify({ submittedAt: now, ...input })])
    Object.assign(request, { method, headers: { authorization: `Bearer ${token}` } })
    const response = { setHeader() {}, writeHead(status) { this.status = status }, end(body) { this.body = JSON.parse(body) } }
    await service.resolveRequest(request, response); return response
  }
  assert.equal((await resolveRequest('wrong', { code: locked, players: ['Alice', 'Bob'] })).status, 401)
  assert.equal((await resolveRequest('test-secret', { code: locked, players: ['Alice', 'Other'] })).status, 400)
  assert.equal((await resolveRequest('test-secret', { code: locked, players: ['Alice', 'Bob'] }, 'GET')).status, 405)
  assert.equal((await resolveRequest('test-secret', { code: locked, players: ['Alice', 'Bob'], submittedAt: now - 1 })).status, 400)
  assert.equal((await resolveRequest('test-secret', { code: locked, players: ['Alice', 'Bob'] })).body.armyCodes[0], army)

  // Partial send failure + a crash after Discord accepted a send. On restart,
  // history finds the first DM, and only the other player receives a retry.
  let failB = true, sends = 0
  const histories = new Map([[A, []], [B, []]])
  const client = { user: { id: 'bot' }, users: { fetch: async id => ({ bot: false, createDM: async () => ({
    messages: { fetch: async () => new Map(histories.get(id).map(message => [message.id, message])) },
    send: async payload => { if (id === B && failB) throw Error('DM closed'); sends++; const message = { id: `dm-${sends}`, author: { id: 'bot' }, content: payload.content, createdTimestamp: now }; histories.get(id).push(message); return message },
  }) }) } }
  const originalDelivered = store.delivered
  let crash = true
  store.delivered = async (...args) => { if (args[1] === A && crash) { crash = false; throw Error('Crash after send') } return originalDelivered(...args) }
  const sender = createListExchangeService({ store, reports: { load: async codes => codes.map(value => report(value)) }, logger: quiet })
  await sender.start(client); sender.stop()
  assert.equal(sends, 1)
  failB = false
  await sender.tick()
  assert.equal(sends, 2, 'history recovery prevents a repeated DM to A')
  assert.equal((await store.deliveries()).length, 0)
  await sender.tick(); assert.equal(sends, 2)
  const long = exchangeStatusMessage({ ...(await store.status(locked, A, guildId)), opponent: { name: 'Bob', armyCode: 'A'.repeat(4000), submitted: true, ready: true } })
  assert(long.content.length < 2000); assert.equal(long.files[0].attachment.length, 4000)

  // Campaign receipts stay private until normal confirmation and approval.
  const campaign = createCampaignGameStore(join(directory, 'campaign.json'), { now: () => new Date('2026-11-02T12:00:00Z') })
  const state = { ...emptyAuroraState(), turn: 1 }
  state.territories[0].vulnerable = true
  const campaignGame = await campaign.submit({ turn: 1, date: '2026-11-02', kind: 'territory', location: state.territories[0].id, mission: 'Claim the Frontier', opA: 9, opB: 3, listExchangeCode: locked },
    { userId: A, name: 'Alice', faction: 'ariadna' }, { userId: B, name: 'Bob', faction: 'pano' }, state)
  assert.equal((await campaign.listExchangeReports([locked]))[0].accepted, false)
  await campaign.act({ id: campaignGame.id, revision: 1, action: 'confirm' }, B, false)
  assert.equal((await campaign.listExchangeReports([locked]))[0].accepted, true)
  assert(!JSON.stringify(await campaign.activity(1)).includes(locked), 'public campaign activity omits exchange codes')
  const source = createListExchangeReportSource({ apiUrl: 'https://example.test/api', workerToken: 'secret', campaignReports: codes => campaign.listExchangeReports(codes), fetchObject: async (_url, request) => {
    assert.equal(request.method, 'POST'); assert.equal(request.body.get('workerToken'), 'secret'); return { ok: true, json: async () => ({ success: true, reports: [] }) }
  } })
  assert.equal((await source.load([locked]))[0].id, `aurora:${campaignGame.id}`)
  await assert.rejects(createListExchangeReportSource({ apiUrl: '', workerToken: '' }).load([locked]))
  await writeFile(path, 'corrupt')
  await assert.rejects(store.status(code, A, guildId)); assert.equal(await readFile(path, 'utf8'), 'corrupt')
  console.log('PASS private list exchange: SDK routing, privacy, ownership, consent reset, immutable locking, exact reports, replay, restart/crash recovery, closed DMs, attachments, machine auth, campaign approval, corrupt storage.')
} finally { await rm(directory, { recursive: true, force: true }) }

// Exercise the real Apps Script durable append and authenticated receipt API.
class Sheet {
  constructor() { this.rows = [Array(25).fill('')]; this.columns = 25 }
  getMaxColumns() { return this.columns }
  insertColumnsAfter(_after, count) { this.columns += count }
  getDataRange() { return { getValues: () => this.rows.map(row => [...row]) } }
  getLastRow() { return this.rows.length }
  appendRow(row) { this.rows.push([...row]) }
  getRange(row, column, height = 1, width = 1) { return {
    getValues: () => Array.from({ length: height }, (_, i) => Array.from({ length: width }, (_, j) => this.rows[row - 1 + i]?.[column - 1 + j] || '')),
    setValues: values => values.forEach((values, i) => { this.rows[row - 1 + i] ||= []; values.forEach((value, j) => { this.rows[row - 1 + i][column - 1 + j] = value }) }),
  } }
}
const sheet = new Sheet(), properties = new Map()
let authenticated = false, fetched
const context = vm.createContext({ Date, JSON, Number, String, Object, Math,
  LockService: { getScriptLock: () => ({ hasLock: () => true }) }, Utilities: { getUuid: () => 'submission' }, SpreadsheetApp: { flush() {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: key => properties.get(key), setProperty: (key, value) => properties.set(key, value) }) },
  lifGetTargetSpreadsheet_: () => ({ getSheetByName: () => sheet }), CONFIG: { SHEETS: { FORM: 'Form' } }, FORM: { PLAYER1: 4, PLAYER2: 5 },
  jsonOutput: value => value, validateGame: row => Boolean(row[4] && row[5]), getApiParameters: event => event,
  isAuthorizedArmyIntelligenceWorkerRequest: () => authenticated,
  UrlFetchApp: { fetch: (_url, request) => { fetched = JSON.parse(request.payload); return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ success: true, armyCodes: ['committed-A', 'committed-B'] }) } } },
})
for (const file of ['GamePipelineReliability.gs', 'ListExchangeApi.gs']) vm.runInContext(await readFile(`backend/${file}`, 'utf8'), context)
const code = 'LLH-0123456789ABCDEF', row = Array(25).fill(''); row[4] = 'Alice'; row[5] = 'Bob'
context.appendCanonicalGameDurably_(sheet, row, 'one', code.toLowerCase())
assert.equal(context.appendCanonicalGameDurably_(sheet, row, 'one', code).duplicate, true)
assert.throws(() => context.appendCanonicalGameDurably_(sheet, row, 'new-report', code), /already belongs/)
assert.equal(sheet.rows[1][28], code); assert.equal(typeof sheet.rows[1][29], 'number')
assert.equal(context.getListExchangeReports({ codes: JSON.stringify([code]) }).success, false)
authenticated = true
const receipts = context.getListExchangeReports({ codes: JSON.stringify([code]) })
assert.equal(receipts.reports[0].id, 'portal:1'); assert.equal(receipts.reports[0].accepted, true)
assert.equal(context.getListExchangeReports({ codes: JSON.stringify(['bad']) }).success, false)
assert.equal(context.getListExchangeReports({ codes: JSON.stringify(Array(51).fill(code)) }).success, false)
assert.throws(() => context.appendCanonicalGameDurably_(sheet, row, 'two', 'invalid'), /valid LLH/)
properties.set('ARMY_INTELLIGENCE_WORKER_TOKEN', 'secret')
const command = { params: { listExchangeCode: code, player: 'Alice', opponent: 'Bob', player1ArmyCode: 'spoofed' } }
context.resolveListExchangeSubmission_(command)
assert.equal(command.params.player1ArmyCode, 'committed-A'); assert.equal(command.params.opponentArmyCode, 'committed-B')
assert.deepEqual(fetched.players, ['Alice', 'Bob'])
console.log('PASS Apps Script: accepted-game association persists atomically, exact code lookup, authentication, bounded queries, committed-code hydration.')

// The production Google Forms keep their existing items and response links.
let nextItem = 0
class TextItem {
  constructor(title = '') { this.title = title; this.id = ++nextItem; this.required = true }
  getTitle() { return this.title }
  getType() { return 'TEXT' }
  asTextItem() { return this }
  setTitle(value) { this.title = value; return this }
  setRequired(value) { this.required = value; return this }
  setHelpText(value) { this.help = value; return this }
  setValidation(value) { this.validation = value; return this }
}
const items = [new TextItem('Player Army Code'), new TextItem('Opponent Army Code'), new TextItem('Unrelated')]
const originalIds = items.map(item => item.id)
context.FormApp = { ItemType: { TEXT: 'TEXT' }, createTextValidation: () => ({ requireTextMatchesPattern: pattern => ({ build: () => pattern }) }) }
context.LIF_FORMS = { FIELDS: { PLAYER_ARMY_CODE: 'Player Army Code', OPPONENT_ARMY_CODE: 'Opponent Army Code', PLAYER: 'Player', OPPONENT: 'Opponent' }, TYPES: { CASUAL: 'casual', LEAGUE: 'league', TEAM: 'team' } }
const form = { getItems: () => items, addTextItem: () => { const item = new TextItem(); items.push(item); return item } }
context.ensureListExchangeFormField_(form); context.ensureListExchangeFormField_(form)
assert.equal(items.length, 4); assert.deepEqual(items.slice(0, 3).map(item => item.id), originalIds)
assert.equal(items[0].required, false); assert.equal(items[1].required, false); assert.equal(items[2].required, true)
assert.equal(items[3].getTitle(), 'LLH Game Code'); assert.equal(items[3].required, false)
items.push(new TextItem('LLH Game Code'))
assert.throws(() => context.ensureListExchangeFormField_(form), /ambiguous/)

vm.runInContext(await readFile('backend/ResponseImporter.gs', 'utf8'), context)
context.lifNormalizeArmyCode_ = value => value
const submittedAt = new Date('2026-11-03T20:00:00Z')
const formSubmission = context.lifReadSubmission_({ Player: ['Alice'], Opponent: ['Bob'], 'LLH Game Code': [code] }, 'casual', submittedAt, {})
assert.equal(formSubmission.listExchangeCode, code); assert.equal(formSubmission.timestamp, submittedAt)

// A Google Form with blank Army Code questions imports the committed codes,
// validates those exact codes, and persists the exchange association together.
vm.runInContext(await readFile('backend/CanonicalSubmissionService.gs', 'utf8'), context)
let validated
context.lifWasImported_ = () => false
context.validateCanonicalGame = input => { validated = input.submission; return { valid: true } }
context.lifEnsureCanonicalSheet_ = () => sheet
context.buildCanonicalGameRow = () => row
context.canonicalSubmissionBuildGoogleFormGameCommand_ = input => input
context.lifWriteImportLog_ = () => {}
context.canonicalSubmissionEnqueueGameAutomation_ = () => {}
context.coordinateCanonicalRebuild = () => {}
context.canonicalSubmissionSuccess_ = () => ({ success: true })
const anotherCode = 'LLH-FEDCBA9876543210'
assert.equal(context.canonicalSubmitGoogleFormGame_({ importLog: {}, responseKey: 'form:2', submission: { ...formSubmission, listExchangeCode: anotherCode } }, 'casual').success, true)
assert.equal(validated.playerArmyCode, 'committed-A'); assert.equal(validated.opponentArmyCode, 'committed-B')
assert.equal(sheet.rows.at(-1)[28], anotherCode); assert.equal(sheet.rows.at(-1)[29], submittedAt.getTime())
console.log('PASS Google Forms: idempotent optional field installation preserves existing IDs and requirements; actual importer resolves, validates and atomically records locked codes with the native report timestamp.')
