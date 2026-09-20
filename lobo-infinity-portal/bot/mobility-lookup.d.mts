export type MobilityRecord = {
  status: string
  score: number | null
  mov: number[] | null
  form: string | null
  travel: number | null
  jump: number | null
  climb: number | null
  dodge: number | null
}
export type MobilityCatalog = { version: string; fingerprint: string; profiles: MobilityRecord[]; keys: Record<string, number> }
export function mobilityKey(combinedId: string): string | null
export function lookupMobility(catalog: MobilityCatalog | null, combinedId: string): MobilityRecord | null
