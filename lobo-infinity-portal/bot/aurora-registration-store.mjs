import { mkdir, readFile, open, rename } from 'node:fs/promises'
import { dirname } from 'node:path'
import { randomUUID } from 'node:crypto'
import { advanceRegistrationCap, publicRegistration, validateRegistrationState, AURORA_REGISTRATION_FACTIONS } from '../shared/aurora-registration.mjs'

// One Railway replica owns this volume. Serialize every read/modify/write and
// persist by atomic rename; never reset an unreadable existing ledger.
export function createRegistrationStore(path) {
  let queue = Promise.resolve()
  const serialized = action => {
    const result = queue.then(action)
    queue = result.catch(() => {})
    return result
  }
  async function read() {
    try { return validateRegistrationState(JSON.parse(await readFile(path, 'utf8'))) }
    catch (error) { if (error.code === 'ENOENT') return { version: 1, cap: 5, players: [] }; throw error }
  }
  async function write(state) {
    validateRegistrationState(state)
    await mkdir(dirname(path), { recursive: true, mode: 0o700 })
    const temporary = `${path}.${randomUUID()}.tmp`
    const file = await open(temporary, 'wx', 0o600)
    try { await file.writeFile(JSON.stringify(state)); await file.sync() } finally { await file.close() }
    await rename(temporary, path)
    const directory = await open(dirname(path), 'r')
    try { await directory.sync() } finally { await directory.close() }
  }
  return {
    summary: () => serialized(async () => publicRegistration(advanceRegistrationCap(await read()))),
    pending: () => serialized(async () => (await read()).players.filter(player => player.roleStatus === 'pending')),
    player: userId => serialized(async () => (await read()).players.find(player => player.userId === userId)),
    register: input => serialized(async () => {
      const state = advanceRegistrationCap(await read())
      const previous = state.players.find(player => player.userId === input.userId)
      if (previous) {
        if (previous.faction !== input.faction) throw Error('You are already registered for another faction. Withdraw first if you want to change factions.')
        return previous
      }
      if (!/^\d{17,20}$/.test(input.userId) || !AURORA_REGISTRATION_FACTIONS.some(faction => faction.id === input.faction)) throw Error('Choose one of the ten eligible campaign factions.')
      const name = String(input.name || '').normalize('NFKC').trim()
      if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) throw Error('Enter a player name between 1 and 80 characters.')
      if (state.players.some(player => player.name.toLocaleLowerCase('en-US') === name.toLocaleLowerCase('en-US'))) throw Error('That player name is already registered. Contact Lobo if it belongs to you.')
      if (state.players.filter(player => player.faction === input.faction).length >= state.cap) throw Error(`That faction has reached ${state.cap} players. It reopens when every faction reaches ${state.cap}.`)
      const player = { userId: input.userId, name, faction: input.faction, registeredAt: new Date().toISOString(), roleStatus: 'pending' }
      state.players.push(player); advanceRegistrationCap(state); await write(state)
      return player
    }),
    assigned: userId => serialized(async () => {
      const state = await read(); const player = state.players.find(player => player.userId === userId)
      if (player) { player.roleStatus = 'assigned'; await write(state) }
    }),
    remove: userId => serialized(async () => {
      const state = await read(); state.players = state.players.filter(player => player.userId !== userId)
      // A withdrawal never lowers an already-opened registration tier.
      await write(state)
    }),
  }
}
