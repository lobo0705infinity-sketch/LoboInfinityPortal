function cleanIdentityValue(value: string | null | undefined) {
  return String(value ?? '').trim()
}

export function resolveSubmitGamePlayer(
  authenticated: boolean,
  leaguePlayer: string | null | undefined,
  playerDisplayName: string | null | undefined,
  displayName: string | null | undefined,
) {
  if (!authenticated) {
    return cleanIdentityValue(displayName) || 'Guest'
  }

  const player =
    cleanIdentityValue(leaguePlayer) ||
    cleanIdentityValue(playerDisplayName) ||
    cleanIdentityValue(displayName)

  return player.toLowerCase() === 'guest' ? '' : player
}
