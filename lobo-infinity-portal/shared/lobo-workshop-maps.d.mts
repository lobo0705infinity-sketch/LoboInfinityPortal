export type LoboWorkshopMap = {
  index: number
  id: string
  guid: string
  slug: string
  name: string
  workshopName: string
  workshopBagName: string
  collectionTitle: string
  family: string
  layoutKey: number
  missionSetups: string[]
  exactDuplicateOf: number | null
  objectCount: number
  sourceNote: string
  overhead: string
  angled: string
  isCurrent?: boolean
  previewKind?: string
  diagram?: string
  download?: string
  sourceOverhead?: string | null
  sourceAngled?: string | null
  missionUrl?: string
}

export const LOBO_WORKSHOP_URL: string
export const LOBO_WORKSHOP_UPDATED_AT: string
export const LOBO_WORKSHOP_DOWNLOAD_URL: string
export const archivedLoboWorkshopMaps: LoboWorkshopMap[]
export const loboWorkshopMaps: LoboWorkshopMap[]
export const loboWorkshopMapBySlug: Map<string, LoboWorkshopMap>
export const resolveLoboWorkshopMapLabel: (label: string) => LoboWorkshopMap | undefined
export type LoboWorkshopMapSection = {
  id: string
  title: string
  description: string
  eventUrl: string | null
  layouts: { layoutKey: number; name: string; saves: LoboWorkshopMap[] }[]
}
export const loboWorkshopMapSections: LoboWorkshopMapSection[]

export const resolveLoboWorkshopMissionMap: (label: string, mission: string) => LoboWorkshopMap | undefined
