export type LoboWorkshopMap = {
  index: number
  id: string
  guid: string
  slug: string
  name: string
  family: string
  objectCount: number
  sourceNote: string
  overhead: string
  angled: string
}

export const LOBO_WORKSHOP_URL: string
export const loboWorkshopMaps: LoboWorkshopMap[]
export const loboWorkshopMapBySlug: Map<string, LoboWorkshopMap>
