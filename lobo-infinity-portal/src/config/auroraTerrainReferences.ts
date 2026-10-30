import references from '../../shared/aurora-terrain-references.json'

// Approved artwork, shared by campaign guides and the Workshop catalogue.
export const AURORA_TERRAIN_GUIDE_URL = '/guides/aurora-vii-terrain-guide-current-maps-20261030.pdf'
type TerrainImage = { src: string; width: number; height: number }
export const AURORA_TERRAIN_REFERENCES: Record<number, TerrainImage[]> = references
