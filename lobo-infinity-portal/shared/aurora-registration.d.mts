export const AURORA_DISCORD_GUILD_ID: string
export const AURORA_REGISTRATION_FACTIONS: readonly { id: string; name: string }[]
export type RegistrationSummary = { cap: number; total: number; available: boolean; issue: string; factions: { id: string; name: string; count: number; locked: boolean }[] }
