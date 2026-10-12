export type AuroraTerritory = { id: string; name: string; settlement: string; vp: number; description: string; layouts: string[]; notes: string[]; x: number; y: number; number: number }
export const AURORA_TERRITORIES: readonly AuroraTerritory[]
export const AURORA_TURNS: readonly { turn: number; title: string; missions: { name: string; reference: string }[] }[]
export const AURORA_DOCTRINES: readonly { faction: string; name: string; requirement: string }[]
export const AURORA_FACTIONS: readonly string[]
export const AURORA_CONQUEST_FACTIONS: readonly string[]
