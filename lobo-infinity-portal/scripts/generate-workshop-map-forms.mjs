import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loboWorkshopMaps, loboWorkshopMapSections } from '../shared/lobo-workshop-maps.mjs'

const destination = fileURLToPath(new URL('../backend/WorkshopMapCatalog.gs', import.meta.url))
const scopes = Object.fromEntries(loboWorkshopMapSections.map((section) => [section.id,
  section.layouts.flatMap((layout) => layout.saves.map((save) => save.slug))]))
// Additional tables approved for League submissions, alongside the LL saves.
scopes['event-current-league'].push(...loboWorkshopMaps
  .filter((map) => [8, 19].includes(map.index)).map((map) => map.slug))
const maps = loboWorkshopMaps.map((map) => ({
  slug: map.slug,
  label: `${map.name} — Save ${String(map.index).padStart(2, '0')}`,
}))
const generated = `// Generated from shared/lobo-workshop-maps.mjs by scripts/generate-workshop-map-forms.mjs.\n// Run npm run maps:forms:generate after changing the map names or collection membership.\nconst LIF_WORKSHOP_MAPS = ${JSON.stringify(maps, null, 2)};\nconst LIF_WORKSHOP_MAP_SCOPES = ${JSON.stringify(scopes, null, 2)};\n\nfunction lifWorkshopMapChoices_(formType) {\n  const allowed = formType === LIF_FORMS.TYPES.CASUAL\n    ? LIF_WORKSHOP_MAPS.map(function(map) { return map.slug; })\n    : formType === LIF_FORMS.TYPES.LEAGUE\n      ? LIF_WORKSHOP_MAP_SCOPES["event-current-league"]\n      : formType === LIF_FORMS.TYPES.TEAM\n        ? LIF_WORKSHOP_MAP_SCOPES["event-august-2026-team-tournament"] : [];\n  return LIF_WORKSHOP_MAPS.filter(function(map) { return allowed.indexOf(map.slug) >= 0; })\n    .map(function(map) { return map.label; });\n}\n\nfunction lifWorkshopMapSlug_(formType, label) {\n  const value = String(label || "").trim();\n  if (!value) return "";\n  const map = LIF_WORKSHOP_MAPS.filter(function(candidate) { return candidate.label === value; })[0];\n  if (!map || lifWorkshopMapChoices_(formType).indexOf(value) < 0)\n    throw new Error("Workshop Map is not in this submission form's collection.");\n  return map.slug;\n}\n`

if (process.argv.includes('--check')) {
  if (readFileSync(destination, 'utf8') !== generated) throw new Error('Workshop map form choices are out of sync; run npm run maps:forms:generate.')
} else {
  writeFileSync(destination, generated)
}
