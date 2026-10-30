import { AURORA_TERRITORIES } from './aurora-public.mjs'
import references from './aurora-terrain-references.json' with { type: 'json' }
import rules from './aurora-territory-rules.json' with { type: 'json' }
import bags from './aurora-workshop-bags.json' with { type: 'json' }

export const AURORA_MISSIONS = ['Frontline', 'Supremacy']
const slugify = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const auroraMapRegions = AURORA_TERRITORIES.map(region => ({
  ...region,
  rule: rules[region.name],
  locations: region.layouts.map((name, index) => ({
    name,
    slug: `aurora-vii-${region.id}-${slugify(name)}`,
    image: references[region.number][index],
    setups: AURORA_MISSIONS.map(mission => {
      const bag = bags.find(item => item.region === region.name && item.location === name && item.mission === mission)
      if (!bag) throw new Error(`Missing Aurora VII Workshop bag: ${region.name} / ${name} / ${mission}`)
      return { ...bag, mission }
    }),
  })),
}))
export const auroraMapLocations = auroraMapRegions.flatMap(region => region.locations.map(location => ({ ...location, region })))
export const auroraMapLocationBySlug = new Map(auroraMapLocations.map(location => [location.slug, location]))
// Keep existing shared links usable after Workshop location renames.
const previousLocationSlugs = {
  'aurora-vii-echo-shores-freeport-echo-market-district': 'aurora-vii-echo-shores-freeport-echo',
  'aurora-vii-harmony-province-government-plaza': 'aurora-vii-harmony-province-civic-gardens',
  'aurora-vii-harmony-province-o-12-security-district': 'aurora-vii-harmony-province-courtyard-district',
  'aurora-vii-ember-highlands-geothermal-badlands': 'aurora-vii-ember-highlands-geothermal-works',
}
for (const [previous, current] of Object.entries(previousLocationSlugs)) {
  auroraMapLocationBySlug.set(previous, auroraMapLocationBySlug.get(current))
}
