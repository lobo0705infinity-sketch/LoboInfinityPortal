export type Top40RoundMap = { key: string; bracket: string; round: number; mission: string; name: string; workshopLabel: string; href: string; download: string }
export const TOP40_EVENT_ID: string
export const TOP40_APPROVED_MAPS_INSTALLER: string
export const TOP40_ROUND_MAPS: Top40RoundMap[]
export function getTop40RoundMap(bracket: unknown, round: unknown, mission?: unknown): Top40RoundMap | undefined
export function withTop40RoundMaps<T extends Record<string, unknown>>(records: T[]): T[]
export function applyTop40MapAssignments<T>(projection: T): T
