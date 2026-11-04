import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir, readFile, open, rename } from 'node:fs/promises'
import { dirname } from 'node:path'

export const exchangeCode = value => String(value || '').trim().toUpperCase()
export const validExchangeCode = value => /^LLH-[A-F0-9]{16}$/.test(value)
const normalizedName = value => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US')
const fail = message => { throw new ExchangeError(message) }
export class ExchangeError extends Error {}

// All mutations, including delivery acknowledgements, use one queue. The file
// lives on the bot's existing persistent volume, never in the community vault.
export function createListExchangeStore(path, { now = Date.now } = {}) {
  let queue = Promise.resolve()
  const run = action => { const result = queue.then(action); queue = result.catch(() => {}); return result }
  async function read() {
    try {
      const state = JSON.parse(await readFile(path, 'utf8'))
      if (state.version !== 1 || !Array.isArray(state.games) || state.games.some(game =>
        !validExchangeCode(game.code) || !Array.isArray(game.players) || game.players.length !== 2 ||
        game.players.some(player => !/^\d{17,20}$/.test(player.id) || typeof player.name !== 'string' || typeof player.armyCode !== 'string' || typeof player.ready !== 'boolean') || game.players[0].id === game.players[1].id ||
        !['open', 'locked', 'released', 'cancelled'].includes(game.status) || !game.deliveries || typeof game.deliveries !== 'object' || Array.isArray(game.deliveries) ||
        (['locked', 'released'].includes(game.status) && (!Number.isFinite(game.lockedAt) || game.players.some(player => !player.name || !player.armyCode || !player.ready))) ||
        (game.status === 'released' && (typeof game.report?.id !== 'string' || !game.report.id)))) {
        throw Error('Invalid private list exchange ledger.')
      }
      if (new Set(state.games.map(game => game.code)).size !== state.games.length) throw Error('Duplicate private exchange identities.')
      return state
    } catch (error) {
      if (error.code === 'ENOENT') return { version: 1, games: [] }
      throw error
    }
  }
  async function write(state) {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })
    const temporary = `${path}.${randomUUID()}.tmp`
    const file = await open(temporary, 'wx', 0o600)
    try { await file.writeFile(JSON.stringify(state)); await file.sync() } finally { await file.close() }
    await rename(temporary, path)
    const directory = await open(dirname(path), 'r')
    try { await directory.sync() } finally { await directory.close() }
  }
  function find(state, code, userId, guildId) {
    const game = state.games.find(game => game.code === exchangeCode(code))
    if (!game || game.guildId !== guildId || !game.players.some(player => player.id === userId)) fail('Only the two selected players can access this game code in its server.')
    return game
  }
  function view(game, userId) {
    const own = game.players.find(player => player.id === userId)
    const opponent = game.players.find(player => player.id !== userId)
    return {
      code: game.code, title: game.title, status: game.status, lockedAt: game.lockedAt, workflow: game.workflow, creatorId: game.players[0].id,
      reportId: game.report?.id, issue: game.issue || '',
      notifications: structuredClone(game.notifications || {}),
      own: { ...own },
      opponent: { id: opponent.id, name: opponent.name, submitted: Boolean(opponent.armyCode), ready: opponent.ready,
        ...(game.status === 'released' ? { armyCode: opponent.armyCode } : {}) },
      delivery: game.deliveries[userId]?.messageId ? 'sent' : 'pending',
    }
  }
  return {
    create: input => run(async () => {
      if (!/^\d{17,20}$/.test(input.userId) || !/^\d{17,20}$/.test(input.opponentId) || input.userId === input.opponentId) fail('Choose another human Discord player.')
      const title = String(input.title || '').trim()
      if (!title || title.length > 100 || /[\u0000-\u001f\u007f]/.test(title)) fail('Enter a game description of 1–100 characters.')
      const name = String(input.name || '').normalize('NFKC').trim()
      if (input.armyCode !== undefined && (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name) || typeof input.armyCode !== 'string' || !input.armyCode || input.armyCode.length > 4000)) fail('A linked portal name and valid Army code are required to create this game.')
      const state = await read()
      if (state.games.filter(game => ['open', 'locked'].includes(game.status) && game.players.some(player => player.id === input.userId)).length >= 20) fail('You already have 20 pending games. Cancel an unused open exchange first.')
      let code
      do { code = `LLH-${randomBytes(8).toString('hex').toUpperCase()}` } while (state.games.some(game => game.code === code))
      const game = { code, guildId: input.guildId, title, status: 'open', createdAt: now(),
        players: [input.userId, input.opponentId].map(id => ({ id, name: '', armyCode: '', ready: false })), deliveries: {} }
      if (input.armyCode !== undefined) {
        game.workflow = 'invite'
        Object.assign(game.players[0], { name, armyCode: input.armyCode, ready: true })
      }
      state.games.push(game); await write(state); return view(game, input.userId)
    }),
    status: (code, userId, guildId) => run(async () => view(find(await read(), code, userId, guildId), userId)),
    invitations: (userId, guildId) => run(async () => (await read()).games
      .filter(game => game.guildId === guildId && game.workflow === 'invite' && game.status === 'open' && game.players[1].id === userId)
      .map(game => ({ code: game.code, title: game.title, creatorId: game.players[0].id }))),
    beginNotification: (code, userId, guildId, kind) => run(async () => {
      const state = await read(), game = find(state, code, userId, guildId)
      if (!['invite', 'joined'].includes(kind) || game.workflow !== 'invite' ||
          (kind === 'invite' ? game.status !== 'open' || game.players[0].id !== userId : game.status !== 'locked' || game.players[1].id !== userId)) {
        fail('Only the creator can resend an invitation for an open game.')
      }
      game.notifications ||= {}
      const previous = game.notifications[kind]
      if (previous && now() - previous.attemptedAt < 60_000) fail('Please wait one minute before resending this invitation.')
      const receipt = { recipientId: game.players.find(player => player.id !== userId).id, attemptedAt: now(), status: 'sending', attemptId: randomUUID() }
      game.notifications[kind] = receipt
      await write(state); return { ...receipt }
    }),
    finishNotification: (code, userId, guildId, kind, attemptId, result) => run(async () => {
      const state = await read(), game = find(state, code, userId, guildId)
      const receipt = game.notifications?.[kind]
      if (!receipt || receipt.attemptId !== attemptId) throw Error('Notification attempt changed.')
      Object.assign(receipt, result, { completedAt: now() })
      await write(state)
    }),
    join: (code, userId, guildId, name, armyCode) => run(async () => {
      const state = await read(), game = find(state, code, userId, guildId)
      if (game.workflow !== 'invite' || game.players[1].id !== userId) fail('Only the invited opponent can join this game. Use /list game status to check your game.')
      if (game.status !== 'open') fail('This game is already submitted or closed. Lists cannot be replaced.')
      name = String(name || '').normalize('NFKC').trim()
      if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) fail('A linked portal player name is required.')
      if (normalizedName(game.players[0].name) === normalizedName(name)) fail('The two players must have different portal names.')
      if (typeof armyCode !== 'string' || !armyCode || armyCode.length > 4000) fail('Enter a valid Infinity Army code.')
      Object.assign(game.players[1], { name, armyCode, ready: true })
      game.status = 'locked'; game.lockedAt = now()
      await write(state); return view(game, userId)
    }),
    submit: (code, userId, guildId, name, armyCode) => run(async () => {
      const state = await read(), game = find(state, code, userId, guildId)
      if (game.workflow === 'invite') fail('For an invited game, the opponent uses /list game join. Submitted lists cannot be replaced; cancel an open game and create a new one if needed.')
      if (game.status !== 'open') fail('These lists are locked or this exchange is closed. They cannot be replaced.')
      name = String(name || '').normalize('NFKC').trim()
      if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) fail('Enter your exact portal player name (1–80 characters).')
      if (game.players.some(player => player.id !== userId && normalizedName(player.name) === normalizedName(name))) fail('The two players must have different portal names.')
      if (typeof armyCode !== 'string' || !armyCode || armyCode.length > 4000) fail('Enter a valid Infinity Army code.')
      Object.assign(game.players.find(player => player.id === userId), { name, armyCode })
      for (const player of game.players) player.ready = false
      await write(state); return view(game, userId)
    }),
    ready: (code, userId, guildId) => run(async () => {
      const state = await read(), game = find(state, code, userId, guildId)
      if (game.workflow === 'invite') fail('No ready command is needed. The invited opponent uses /list game join to submit and lock both lists.')
      if (game.status !== 'open') fail('This exchange is already locked or closed.')
      if (game.players.some(player => !player.armyCode || !player.name)) fail('Both players must submit their lists before confirming ready.')
      game.players.find(player => player.id === userId).ready = true
      if (game.players.every(player => player.ready)) { game.status = 'locked'; game.lockedAt = now() }
      await write(state); return view(game, userId)
    }),
    cancel: (code, userId, guildId) => run(async () => {
      const state = await read(), game = find(state, code, userId, guildId)
      if (game.status !== 'open') fail('A locked or completed exchange cannot be cancelled. Contact Lobo if it needs correction.')
      game.status = 'cancelled'
      for (const player of game.players) { player.armyCode = ''; player.ready = false }
      await write(state); return view(game, userId)
    }),
    pending: () => run(async () => (await read()).games.filter(game => game.status === 'locked').map(game => game.code)),
    resolveLocked: (code, names, submittedAt = now()) => run(async () => {
      const game = (await read()).games.find(game => game.code === exchangeCode(code))
      if (!game || !['locked', 'released'].includes(game.status) || !Number.isFinite(submittedAt) || submittedAt < game.lockedAt || !Array.isArray(names) || names.length !== 2 ||
          JSON.stringify(names.map(normalizedName).sort()) !== JSON.stringify(game.players.map(player => normalizedName(player.name)).sort())) {
        fail('The LLH game code must match two locked lists and the exact portal player names.')
      }
      return names.map(name => game.players.find(player => normalizedName(player.name) === normalizedName(name)).armyCode)
    }),
    reconcile: reports => run(async () => {
      if (!Array.isArray(reports)) throw Error('Invalid game report response.')
      const state = await read()
      for (const game of state.games.filter(game => game.status === 'locked')) {
        const matches = reports.filter(report => report.code === game.code)
        if (!matches.length) continue
        if (matches.length !== 1) { game.issue = 'More than one report uses this game code. Contact Lobo; both lists remain private.'; continue }
        const report = matches[0]
        if (report.accepted !== true) { game.issue = 'The game report is awaiting acceptance; both lists remain private.'; continue }
        const expected = game.players.map(player => normalizedName(player.name)).sort()
        const actual = (report.players || []).map(normalizedName).sort()
        const idsMatch = !report.playerIds || JSON.stringify([...report.playerIds].sort()) === JSON.stringify(game.players.map(player => player.id).sort())
        if (!report.id || report.accepted !== true || !Number.isFinite(report.submittedAt) || report.submittedAt < game.lockedAt ||
            JSON.stringify(actual) !== JSON.stringify(expected) || !idsMatch) {
          game.issue = 'The report does not match the locked players or was submitted before locking. Contact Lobo; both lists remain private.'; continue
        }
        game.status = 'released'; game.releasedAt = now(); game.report = { id: report.id }; game.issue = ''
      }
      await write(state)
    }),
    deliveries: () => run(async () => (await read()).games.filter(game => game.status === 'released')
      .flatMap(game => game.players.filter(player => !game.deliveries[player.id]?.messageId).map(player => ({
        code: game.code, title: game.title, userId: player.id, reportId: game.report.id,
        opponentName: game.players.find(other => other.id !== player.id).name,
        armyCode: game.players.find(other => other.id !== player.id).armyCode,
        firstAttemptAt: game.deliveries[player.id]?.firstAttemptAt,
      })))),
    attempt: (code, userId) => run(async () => {
      const state = await read(), game = state.games.find(game => game.code === code)
      if (!game || game.status !== 'released' || !game.players.some(player => player.id === userId)) throw Error('Delivery is not authorized.')
      game.deliveries[userId] ||= { firstAttemptAt: now() }
      await write(state); return game.deliveries[userId]
    }),
    delivered: (code, userId, messageId) => run(async () => {
      const state = await read(), game = state.games.find(game => game.code === code)
      if (!game || game.status !== 'released' || !game.deliveries[userId] || !messageId) throw Error('Invalid delivery acknowledgement.')
      game.deliveries[userId].messageId = messageId; await write(state)
    }),
  }
}
