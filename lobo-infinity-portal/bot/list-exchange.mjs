import { createHash, timingSafeEqual } from 'node:crypto'
import { join } from 'node:path'
import { ApplicationCommandOptionType as Type } from 'discord.js'
import { decodeArmyCode, normalizeArmyCodeInput } from '../scripts/infinity-army-decode.mjs'
import { createListExchangeStore, ExchangeError, exchangeCode, validExchangeCode } from './list-exchange-store.mjs'

const codeOption = { name: 'game', description: 'The LLH game code shared by the two players', type: Type.String, required: true, minLength: 20, maxLength: 20 }
export const LIST_GAME_COMMAND = {
  description: 'Privately commit lists for one game and exchange them after its accepted report',
  options: [
    { name: 'create', description: 'Start a private exchange for one game; share the returned code with your opponent', type: Type.Subcommand, options: [
      { name: 'opponent', description: 'Your opponent’s Discord account', type: Type.User, required: true },
      { name: 'description', description: 'Identify this game, such as Top 40 W2 or Tuesday casual game', type: Type.String, required: true, maxLength: 100 },
    ] },
    { name: 'submit', description: 'Privately submit or replace your list before both players lock', type: Type.Subcommand, options: [codeOption,
      { name: 'player', description: 'Your exact portal player name, as it appears on your game report', type: Type.String, required: true, maxLength: 80 },
      { name: 'army-code', description: 'Your full Infinity Army code or Army link', type: Type.String, required: true, maxLength: 4000 },
    ] },
    ...[
      ['ready', 'Confirm your submitted list; both players being ready locks the lists'],
      ['status', 'Privately see submission, locking and delivery status, or retrieve a released list'],
      ['cancel', 'Cancel an unused exchange before the lists lock'],
    ].map(([name, description]) => ({ name, description, type: Type.Subcommand, options: [codeOption] })),
  ],
}

export function normalizeExchangeArmyCode(input) {
  try {
    const code = decodeURIComponent(normalizeArmyCodeInput(input)).replace(/\s+/g, '')
    if (code.length > 4000 || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(code)) throw Error()
    const decoded = decodeArmyCode(code)
    if (!decoded.combatGroups?.some(group => group.members?.length)) throw Error()
    return code
  } catch { throw new ExchangeError('Enter a full, decodable Infinity Army code or Army link. List legality is still the players’ responsibility.') }
}

const clean = value => String(value || '').replace(/[\u0000-\u001f<>@`*_]/g, ' ').trim()
const armyLink = code => `https://infinitytheuniverse.com/army/list/${encodeURIComponent(code)}`
function fullListPayload(code) {
  return {
    text: code.length <= 1000 ? armyLink(code) : 'The full Army code is attached. Import it in Infinity Army.',
    files: [{ attachment: Buffer.from(code), name: 'opponent-army-code.txt' }],
  }
}
export function exchangeStatusMessage(game) {
  const lines = [
    `**Private list exchange · ${clean(game.title)}**`,
    `Game code: \`${game.code}\` · **${game.status}**`,
    `Your list: ${game.own.armyCode ? 'submitted' : 'missing'} · ${game.own.ready ? 'ready' : 'not ready'}`,
    `Opponent’s list: ${game.opponent.submitted ? 'submitted' : 'missing'} · ${game.opponent.ready ? 'ready' : 'not ready'}`,
  ]
  if (game.status === 'open') lines.push('Both players use `/list game submit`, then `/list game ready`. Replacing either list resets both ready confirmations.')
  if (game.status === 'locked') lines.push('Lists are locked. Enter this code in the portal’s **LLH game code** field when reporting this game. Both lists stay private until the accepted report matches.')
  const list = game.status === 'released' ? fullListPayload(game.opponent.armyCode) : null
  if (list) lines.push(`Report: ${clean(game.reportId)}`, `**${clean(game.opponent.name)}’s full list:** ${list.text}`, `DM delivery: ${game.delivery}. You can always retrieve the list here.`)
  if (game.issue) lines.push(game.issue)
  return { content: lines.join('\n'), files: list?.files || [], allowedMentions: { parse: [] } }
}

// Read only receipts for currently locked codes; the endpoint never returns
// army lists and authenticates with the existing background-worker credential.
export function createListExchangeReportSource({
  apiUrl = process.env.LIST_EXCHANGE_API_URL || process.env.VITE_API_URL,
  workerToken = process.env.ARMY_INTELLIGENCE_WORKER_TOKEN,
  fetchObject = fetch,
  campaignReports = async () => [],
} = {}) {
  return {
    configured: Boolean(apiUrl && workerToken),
    async load(codes) {
      if (!apiUrl || !workerToken) throw Error('Private list exchange report verification is not configured.')
      const reports = []
      for (let offset = 0; offset < codes.length; offset += 50) {
        const batch = codes.slice(offset, offset + 50)
        const response = await fetchObject(apiUrl, { method: 'POST', redirect: 'follow',
          body: new URLSearchParams({ action: 'getListExchangeReports', workerToken, codes: JSON.stringify(batch) }),
          signal: AbortSignal.timeout(20_000) })
        const payload = await response.json()
        if (!response.ok || payload.success !== true || !Array.isArray(payload.reports)) throw Error('Private list exchange report verification is unavailable.')
        reports.push(...payload.reports, ...await campaignReports(batch))
      }
      return reports
    },
  }
}

// Before retrying a send, cover the whole history since the first attempt.
// An unavailable/incomplete history defers delivery rather than duplicating it.
export async function findExchangeDelivery(channel, marker, botId, since) {
  let before
  for (let page = 0; page < 25; page++) {
    const messages = [...(await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) })).values()]
    const found = messages.find(message => message.author?.id === botId && String(message.content || '').includes(marker))
    if (found) return found.id
    if (messages.length < 100 || messages.some(message => message.createdTimestamp < since - 5000)) return null
    const next = messages.at(-1)?.id
    if (!next || next === before) throw Error('Private list delivery history is incomplete.')
    before = next
  }
  throw Error('Private list delivery history is incomplete.')
}

export function createListExchangeService({
  store = createListExchangeStore(join(process.env.RAILWAY_VOLUME_MOUNT_PATH || '/data', 'llh-list-exchanges.json')),
  reports = createListExchangeReportSource(), logger = console, workerToken = process.env.ARMY_INTELLIGENCE_WORKER_TOKEN,
} = {}) {
  let client, timer, running
  async function tickInner() {
    const codes = await store.pending()
    if (codes.length) await store.reconcile(await reports.load(codes))
    for (const delivery of await store.deliveries()) {
      try {
        const user = await client.users.fetch(delivery.userId)
        if (user.bot) throw Error('Player account is unavailable.')
        const channel = await user.createDM()
        const attempt = await store.attempt(delivery.code, delivery.userId)
        const marker = `llh-list:${delivery.code}:${delivery.userId}`
        const previous = await findExchangeDelivery(channel, marker, client.user.id, attempt.firstAttemptAt)
        const list = fullListPayload(delivery.armyCode)
        const message = previous ? { id: previous } : await channel.send({
          content: `**Your opponent’s list · ${clean(delivery.title)}**\n${clean(delivery.opponentName)}’s full list: ${list.text}\nGame report: ${clean(delivery.reportId)}\n-# ${marker}`,
          files: list.files,
          allowedMentions: { parse: [] },
          nonce: createHash('sha256').update(marker).digest('hex').slice(0, 24), enforceNonce: true,
        })
        await store.delivered(delivery.code, delivery.userId, message.id)
      } catch { logger.error?.('Private list exchange: a DM is pending; the player can retrieve it with /list game status.') }
    }
  }
  const tick = () => {
    if (!running) running = tickInner().catch(() => logger.error?.('Private list exchange verification is unavailable; unreleased lists remain private.')).finally(() => { running = null })
    return running
  }
  async function handler(interaction) {
    if (!interaction.isChatInputCommand?.() || interaction.commandName !== 'list-game') return false
    await interaction.deferReply({ flags: 64 })
    const reply = payload => interaction.editReply(typeof payload === 'string' ? { content: payload, allowedMentions: { parse: [] } } : payload)
    try {
      if (!interaction.guildId) throw new ExchangeError('Use this command in the server where you arranged your game. Responses are private.')
      if (reports.configured === false) throw new ExchangeError('Private list exchanges are awaiting game-report verification setup. Please contact Lobo.')
      const command = interaction.options.getSubcommand(), userId = interaction.user.id, guildId = interaction.guildId
      let game
      if (command === 'create') {
        const opponent = interaction.options.getUser('opponent', true)
        const member = await interaction.guild.members.fetch(opponent.id)
        if (opponent.bot || member.user.bot) throw new ExchangeError('Choose another human player in this server.')
        game = await store.create({ userId, opponentId: opponent.id, guildId, title: interaction.options.getString('description', true) })
      } else {
        const code = exchangeCode(interaction.options.getString('game', true))
        if (!validExchangeCode(code)) throw new ExchangeError('Enter the full LLH game code.')
        // Check ownership before decoding private inputs or changing any state.
        await store.status(code, userId, guildId)
        if (command === 'submit') game = await store.submit(code, userId, guildId, interaction.options.getString('player', true), normalizeExchangeArmyCode(interaction.options.getString('army-code', true)))
        else if (command === 'ready') game = await store.ready(code, userId, guildId)
        else if (command === 'cancel') game = await store.cancel(code, userId, guildId)
        else if (command === 'status') { await tick(); game = await store.status(code, userId, guildId) }
        else throw new ExchangeError('Choose a list exchange action.')
      }
      await reply(exchangeStatusMessage(game))
    } catch (error) {
      await reply(error instanceof ExchangeError ? error.message : 'Private list exchange is temporarily unavailable. Existing lists remain private; try again shortly.')
    }
    return true
  }
  return {
    handler, tick,
    async resolveRequest(request, response) {
      response.setHeader('cache-control', 'no-store')
      const json = (status, value) => { response.writeHead(status); response.end(JSON.stringify(value)) }
      const expected = Buffer.from(String(workerToken || '')), supplied = Buffer.from(String(request.headers.authorization || '').replace(/^Bearer /, ''))
      if (!expected.length || supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) return json(401, { success: false, error: 'Background worker authentication is required.' })
      if (request.method !== 'POST') return json(405, { success: false, error: 'Use POST.' })
      try {
        let body = ''
        for await (const chunk of request) { body += chunk; if (Buffer.byteLength(body) > 2048) return json(413, { success: false, error: 'Request is too large.' }) }
        const input = JSON.parse(body)
        if (!Number.isFinite(input.submittedAt)) throw new ExchangeError('A valid game report timestamp is required.')
        const armyCodes = await store.resolveLocked(input.code, input.players, input.submittedAt)
        return json(200, { success: true, armyCodes })
      } catch (error) { return json(400, { success: false, error: error instanceof ExchangeError ? error.message : 'Private lists could not be verified.' }) }
    },
    async start(discordClient) { client = discordClient; await tick(); timer = setInterval(() => void tick(), 60_000); timer.unref() },
    stop() { clearInterval(timer) },
  }
}
