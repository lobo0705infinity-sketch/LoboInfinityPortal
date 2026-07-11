const minimumLikelyGoogleJwtLength = 100

export function isLikelyGoogleJwt(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }

  const token = value.trim()
  const parts = token.split('.')

  return (
    token.length > minimumLikelyGoogleJwtLength &&
    token.startsWith('eyJ') &&
    parts.length === 3 &&
    !/\s/.test(token)
  )
}
