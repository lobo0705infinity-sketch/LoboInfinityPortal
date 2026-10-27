import type { AuroraTerritory } from './aurora-public.mjs'
export type AuroraMission = 'Frontline' | 'Supremacy'
export const AURORA_MISSIONS: readonly AuroraMission[]
export type AuroraMapLocation = { name: string; slug: string; image: { src: string; width: number; height: number }; setups: { region: string; location: string; mission: AuroraMission; bagName: string; guid: string }[] }
export type AuroraMapRegion = AuroraTerritory & { rule: { title: string; description: string; effect: string; details: string; ownerTitle: string; owner: string }; locations: AuroraMapLocation[] }
export const auroraMapRegions: AuroraMapRegion[]
export const auroraMapLocations: (AuroraMapLocation & { region: AuroraMapRegion })[]
export const auroraMapLocationBySlug: Map<string, AuroraMapLocation & { region: AuroraMapRegion }>
