import { randomBytes, randomUUID } from 'node:crypto'
import { mkdir, readFile, open, rename } from 'node:fs/promises'
import { dirname } from 'node:path'

export const exchangeCode = value => String(value || '').trim().toUpperCase()
export const validExchangeCode = value => /^LLH-[A-F0-9]{16}$/.test(value)
const normalizedName = value => String(value || '').normalize('NFKC').trim().toLocaleLowerCase('en-US')
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
      code: game.code, title: game.title, status: game.status, lockedAt: game.lockedAt,
      reportId: game.report?.id, issue: game.issue || '',
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
      const state = await read()
      if (state.games.filter(game => ['open', 'locked'].includes(game.status) && game.players.some(player => player.id === input.userId)).length >= 20) fail('You already have 20 pending games. Cancel an unused open exchange first.')
      let code
      do { code = `LLH-${randomBytes(8).toString('hex').toUpperCase()}` } while (state.games.some(game => game.code === code))
      const game = { code, guildId: input.guildId, title, status: 'open', createdAt: now(),
        players: [input.userId, input.opponentId].map(id => ({ id, name: '', armyCode: '', ready: false })), deliveries: {} }
      state.games.push(game); await write(state); return view(game, input.userId)
    }),
    status: (code, userId, guildId) => run(async () => view(find(await read(), code, userId, guildId), userId)),
    submit: (code, userId, guildId, name, armyCode) => run(async () => {
      const state = await read(), game = find(state, code, userId, guildId)
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
