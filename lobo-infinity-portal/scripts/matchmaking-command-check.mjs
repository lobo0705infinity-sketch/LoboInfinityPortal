import assert from 'node:assert/strict'
import {
  AVAILABILITY_COMMAND_DEFINITION,
  FIND_GAME_COMMAND_DEFINITION,
  WEEKDAY_SELECTION_CHOICES,
  buildAvailabilityRecords,
  buildDailyMatchmakingDigest,
  buildFindGameMessage,
  createMatchmakingAutocompleteHandler,
  ensureMatchmakingCommands,
  expandWeekdaySelection,
  matchmakingDigestAlreadyPosted,
  parseAvailabilityRecord,
  parseFindGameMarker,
  serializeAvailabilityRecord,
  startMatchmakingScheduler,
} from '../bot/matchmaking-command.mjs'

assert.equal(AVAILABILITY_COMMAND_DEFINITION.name, 'availability')
assert.deepEqual(AVAILABILITY_COMMAND_DEFINITION.options.map((option) => option.name), ['set', 'clear', 'show'])
assert.equal(FIND_GAME_COMMAND_DEFINITION.name, 'find-game')
assert.deepEqual(FIND_GAME_COMMAND_DEFINITION.options.map((option) => option.name), ['now', 'close'])
assert.deepEqual(expandWeekdaySelection('weekdays'), ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
assert.deepEqual(expandWeekdaySelection('weekends'), ['saturday', 'sunday'])
assert.equal(WEEKDAY_SELECTION_CHOICES.some((choice) => choice.value === 'weekdays'), true)
assert.equal(WEEKDAY_SELECTION_CHOICES.some((choice) => choice.value === 'weekends'), true)

const groupedAvailabilityInteraction = {
  user: { id: '100', username: 'Lobo' },
  member: { displayName: 'Lobo' },
  options: {
    getString(name) {
      return {
        weekday: 'weekdays',
        start: '7pm',
        end: '2230',
        timezone: 'Eastern',
        format: null,
        need: null,
        note: null,
      }[name]
    },
    getInteger: () => null,
    getBoolean: () => null,
  },
}
const groupedAvailability = buildAvailabilityRecords(groupedAvailabilityInteraction)
assert.deepEqual(groupedAvailability.map((record) => record.weekday), ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
assert.equal(groupedAvailability.every((record) => record.start === '19:00' && record.end === '22:30'), true)
assert.equal(new Set(groupedAvailability.map((record) => record.updatedAt)).size, 1)

let autocompleteChoices = []
const autocomplete = createMatchmakingAutocompleteHandler({ logger: { error() {} } })
const autocompleteInteraction = (value) => ({
  commandName: 'availability',
  isAutocomplete: () => true,
  options: { getFocused: () => ({ name: 'timezone', value }) },
  async respond(choices) { autocompleteChoices = choices },
})
assert.equal(await autocomplete(autocompleteInteraction('')), true)
assert.equal(autocompleteChoices.some((choice) => choice.name === 'Eastern Time (New York / Atlanta)'), true)
assert.equal(autocompleteChoices.some((choice) => choice.name.startsWith('Africa/')), false)
assert.equal(await autocomplete(autocompleteInteraction('Atlanta')), true)
assert.equal(autocompleteChoices[0].value, 'America/New_York')

const lobo = {
  version: 1,
  userId: '100',
  displayName: 'Lobo',
  weekday: 'tuesday',
  start: '19:00',
  end: '23:00',
  timeZone: 'Europe/Warsaw',
  format: 'tts',
  points: 300,
  need: 'tournament',
  note: 'ITS practice',
  mention: true,
}
const challenger = {
  ...lobo,
  userId: '200',
  displayName: 'Challenger',
  start: '20:00',
  end: '22:00',
  timeZone: 'Europe/London',
  need: 'competitive',
  note: '',
}
assert.deepEqual(parseAvailabilityRecord(serializeAvailabilityRecord(lobo)), lobo)
assert.equal(parseAvailabilityRecord('not-a-record'), null)

const now = Date.parse('2026-09-22T05:00:00.000Z')
const digest = buildDailyMatchmakingDigest([lobo, challenger], now, { timeZone: 'Europe/Warsaw', hour: 7 })
assert.equal(digest.status, 'READY')
assert.equal(digest.matches.length, 1)
assert.deepEqual(digest.payload.allowedMentions.users, ['100', '200'])
const digestEmbed = digest.payload.embeds[0].toJSON()
assert.equal(digestEmbed.title, '🎲 Today’s Infinity scheduling board')
assert.match(digestEmbed.description, /1 compatible overlap/)
assert.match(digestEmbed.fields[0].value, /<@100> and <@200>/)
assert.equal(digestEmbed.footer.text, 'matchmaking-digest:v1:2026-09-22:Europe/Warsaw')

const oneOff = {
  id: 'request1',
  userId: '100',
  displayName: 'Lobo',
  startMs: Date.parse('2026-09-25T20:00:00.000Z'),
  endMs: Date.parse('2026-09-25T22:00:00.000Z'),
  timeZone: 'America/New_York',
  format: 'tts',
  points: 300,
  need: 'casual',
  note: 'New list test',
}
const oneOffPayload = buildFindGameMessage(oneOff)
const oneOffMessage = { embeds: [oneOffPayload.embeds[0].toJSON()] }
assert.deepEqual(parseFindGameMarker(oneOffMessage), { id: 'request1', userId: '100', status: 'open' })
assert.match(oneOffMessage.embeds[0].fields[0].value, /<t:\d+:F>/)
assert.equal(oneOffPayload.components[0].components.length, 2)

const registeredCommands = []
let commandEdits = 0
const commandClient = {
  application: { commands: { fetch: async () => [] } },
  guilds: { cache: new Map([['guild-1', { id: 'guild-1', commands: {
    fetch: async () => registeredCommands,
    create: async (definition) => {
      const command = {
        ...definition,
        id: `${definition.name}-id`,
        applicationId: 'app-1',
        guildId: 'guild-1',
        async edit(replacement) { commandEdits += 1; Object.assign(this, replacement); return this },
      }
      registeredCommands.push(command)
      return command
    },
  } }]]) },
}
assert.equal((await ensureMatchmakingCommands(commandClient)).length, 2)
assert.equal((await ensureMatchmakingCommands(commandClient)).length, 2)
assert.deepEqual(registeredCommands.map((command) => command.name), ['availability', 'find-game'])
registeredCommands[0].options = registeredCommands[0].options.map((option) => option.name === 'set'
  ? { ...option, options: option.options.map((nested) => nested.name === 'timezone' ? { ...nested, description: 'Old time-zone help' } : nested) }
  : option)
await ensureMatchmakingCommands(commandClient)
assert.equal(commandEdits, 1)

const sentMessages = new Map()
const channel = {
  id: 'channel-1',
  messages: { fetch: async () => sentMessages },
  async send(payload) {
    const message = {
      id: `message-${sentMessages.size + 1}`,
      author: { id: 'bot-1' },
      embeds: payload.embeds.map((embed) => embed.toJSON()),
    }
    sentMessages.set(message.id, message)
    return message
  },
}
const scheduler = startMatchmakingScheduler({
  user: { id: 'bot-1' },
  guilds: { cache: new Map([['guild-1', { id: 'guild-1' }]]) },
}, {
  resolveChannel: async () => channel,
  createStore: async () => ({ load: async () => [lobo, challenger] }),
  now: () => now,
  intervalMs: 60 * 60 * 1000,
  digestOptions: { timeZone: 'Europe/Warsaw', hour: 7 },
  logger: { error() {} },
})
const firstRun = await scheduler.runNow()
assert.equal(firstRun.guilds[0].status, 'POSTED')
assert.equal(await matchmakingDigestAlreadyPosted(channel, digest.marker, 'bot-1'), true)
const secondRun = await scheduler.runNow()
assert.equal(secondRun.guilds[0].status, 'ALREADY_POSTED')
scheduler.stop()

console.log('Matchmaking command checks passed.')
