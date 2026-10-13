export const AURORA_DISCORD_GUILD_ID = '988549985836601414'
export const AURORA_REGISTRATION_FACTIONS = Object.freeze([
  { id: 'pano', name: 'PanOceania' }, { id: 'yu-jing', name: 'Yu Jing' },
  { id: 'o-12', name: 'O-12' }, { id: 'combined-army', name: 'Combined Army' },
  { id: 'na2', name: 'NA2' }, { id: 'tohaa', name: 'Tohaa' },
  { id: 'jsa', name: 'JSA' }, { id: 'ariadna', name: 'Ariadna' },
  { id: 'aleph', name: 'ALEPH' }, { id: 'haqqislam', name: 'Haqqislam' },
])
export function registrationCounts(state) {
  return AURORA_REGISTRATION_FACTIONS.map(faction => ({ ...faction,
    count: state.players.filter(player => player.faction === faction.id).length,
  }))
}
export function advanceRegistrationCap(state) {
  const counts = registrationCounts(state)
  while (counts.every(faction => faction.count >= state.cap)) state.cap += 5
  return state
}
export function validateRegistrationState(state) {
  if (state?.version !== 1 || !Number.isSafeInteger(state.cap) || state.cap < 5 || state.cap % 5 || !Array.isArray(state.players)) throw Error('Invalid registration ledger.')
  const users = new Set(), names = new Set()
  for (const player of state.players) {
    if (!/^\d{17,20}$/.test(player.userId) || users.has(player.userId) || !AURORA_REGISTRATION_FACTIONS.some(faction => faction.id === player.faction)
      || !['pending', 'assigned'].includes(player.roleStatus) || typeof player.name !== 'string' || !player.name.trim() || player.name.length > 80
      || !Number.isFinite(Date.parse(player.registeredAt))) throw Error('Invalid registration ledger.')
    const key = player.name.normalize('NFKC').trim().toLocaleLowerCase('en-US')
    if (names.has(key)) throw Error('Duplicate player in registration ledger.')
    users.add(player.userId); names.add(key)
  }
  if (registrationCounts(state).some(faction => faction.count > state.cap)) throw Error('Registration limit exceeded.')
  return state
}
export function publicRegistration(state, { available = true, issue = '' } = {}) {
  return { cap: state.cap, total: state.players.length, available, issue,
    factions: registrationCounts(state).map(faction => ({ ...faction, locked: faction.count >= state.cap })),
  }
}
