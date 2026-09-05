import { InfListRenderError, renderInfListPng, validateArmyCode } from '../scripts/inf-list-render-poc.mjs'

export const INF_LIST_COMMAND = '!!inf-list'
export const SUCCESS_TEXT = 'Here is a link to your army list'
export const USAGE_TEXT = 'Usage: !!inf-list <army code>'

const malformedCodes = new Set([
  'army_code_too_long',
  'invalid_army_code',
  'url_not_allowed',
])
const unavailableRenderer = new Set([
  'invalid_render',
  'renderer_invalid_redirect',
  'renderer_timeout',
  'renderer_unavailable',
])

export function parseInfListCommand(content) {
  const match = String(content ?? '').match(/^!!inf-list(?:\s+([\s\S]*))?$/)
  if (!match) return null
  return { armyCode: match[1]?.trim() || '' }
}

export function createConcurrencyLimiter(limit = 2) {
  if (!Number.isInteger(limit) || limit < 1) throw new RangeError('Concurrency limit must be a positive integer.')
  let active = 0
  const waiting = []

  async function acquire() {
    if (active < limit) {
      active += 1
      return
    }
    await new Promise((resolve) => waiting.push(resolve))
    active += 1
  }

  function release() {
    active -= 1
    waiting.shift()?.()
  }

  return async function withSlot(task) {
    await acquire()
    try {
      return await task()
    } finally {
      release()
    }
  }
}

export function createInfListMessageHandler({
  render = renderInfListPng,
  withRenderSlot = createConcurrencyLimiter(2),
} = {}) {
  return async function handleInfListMessage(message) {
    if (message?.author?.bot) return false

    const command = parseInfListCommand(message?.content)
    if (!command) return false
    if (!command.armyCode) {
      await message.reply(USAGE_TEXT)
      return true
    }

    let armyCode
    try {
      armyCode = validateArmyCode(command.armyCode)
    } catch (error) {
      await message.reply(messageForError(error))
      return true
    }

    try {
      const result = await withRenderSlot(() => render({ input: armyCode }))
      await message.reply({
        allowedMentions: { repliedUser: false },
        content: `${SUCCESS_TEXT}\n\n[Open in Infinity Army](${result.officialArmyUrl})`,
        files: [{ attachment: result.imageBuffer, name: 'infinity-army-list.png' }],
      })
    } catch (error) {
      await message.reply(messageForError(error))
    }

    return true
  }
}

function messageForError(error) {
  if (error instanceof InfListRenderError) {
    if (malformedCodes.has(error.code)) return "That doesn't look like a valid Infinity Army code."
    if (error.code === 'renderer_rejected') return 'That Army code could not be rendered.'
    if (unavailableRenderer.has(error.code)) {
      return 'The Army list renderer is temporarily unavailable. Try again shortly.'
    }
  }
  return 'The Army list renderer is temporarily unavailable. Try again shortly.'
}
