function cleanIdentityValue(value: string | null | undefined) {
  return String(value ?? '').trim()
}

export function resolveSubmitGamePlayer(
  authenticated: boolean,
  canonicalPlayer: string | null | undefined,
  leaguePlayer: string | null | undefined,
  playerDisplayName: string | null | undefined,
  displayName: string | null | undefined,
) {
  if (!authenticated) {
    return cleanIdentityValue(displayName) || 'Guest'
  }

  const player =
    cleanIdentityValue(canonicalPlayer) ||
    cleanIdentityValue(leaguePlayer) ||
    cleanIdentityValue(playerDisplayName) ||
    cleanIdentityValue(displayName)

  return player.toLowerCase() === 'guest' ? '' : player
}
