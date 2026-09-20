export type MobileGunfighterRating = { score: number; gunfighter: number; mobility: number; gunfighterNormalized: number; gunfighterPercentile: number; mobilityPercentile: number }
export type MobileGunfighterCatalog = { version: string; fingerprint: string; mobilityWeight: number; gunfighterAnchor: number; gunfighterFingerprint: string; mobilityFingerprint: string; coverage: { normal: number; fireteam: number }; profiles: Array<{ normal: MobileGunfighterRating | null; fireteam: MobileGunfighterRating | null }>; keys: Record<string, number> }
export const MOBILE_GUNFIGHTER_VERSION: string
export const MOBILE_WEIGHT: number
export const GUNFIGHTER_ANCHOR: number
export function anchoredGunfighterScore(rating: number): number
export function midrankPercentiles(values: number[]): number[]
export function lookupMobileGunfighter(catalog: MobileGunfighterCatalog | null, combinedId: string, state?: 'normal' | 'fireteam'): MobileGunfighterRating | null
