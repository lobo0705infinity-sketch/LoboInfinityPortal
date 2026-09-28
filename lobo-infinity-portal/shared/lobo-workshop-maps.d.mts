export type LoboWorkshopMap = {
  index: number
  id: string
  guid: string
  slug: string
  name: string
  workshopName: string
  family: string
  layoutKey: number
  missionSetups: string[]
  exactDuplicateOf: number | null
  objectCount: number
  sourceNote: string
  overhead: string
  angled: string
}

export const LOBO_WORKSHOP_URL: string
export const loboWorkshopMaps: LoboWorkshopMap[]
export const loboWorkshopMapBySlug: Map<string, LoboWorkshopMap>
