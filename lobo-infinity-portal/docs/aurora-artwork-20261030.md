# Aurora VII current-map artwork

The campaign territory pages, Aurora map catalogue, region previews and downloadable terrain guide use 24 replacement concept illustrations, one per location and shared by Frontline and Supremacy. These are artistic interpretations of the current maps, not TTS screenshots or measurement diagrams.

## Source and generation

- Map source: `Lobo-Workshop-Current-Maps-and-Rules-Installer.zip`, current Library version downloaded 30 October 2026, including Ember R18, Northward R6 and Frostreach R25.
- Freeport layout source: the user's newer `TS_Save_26.json`, including the moved terrain and four continuous dry terraces.
- Geometry reference: downloaded the source maps' actual OBJ meshes, applied saved model scales and Stage deployment transforms, and rendered overhead footprints and oblique geometry for each location. All 2,063 unique reference meshes loaded successfully. Freeport uses its newer live object transforms.
- Generation: built-in image-generation tool, one individual reference-guided generation per location. The common direction is hyperrealistic elevated architectural terrain-board photography with readable layouts, weathered materials, no game pieces, labels or grids. Full final prompts and per-reference/output hashes are recorded in `aurora-artwork-20261030-prompts.json`.
- Project assets: `public/assets/aurora-vii/current-maps-20261030/`, optimized WebP images with explicit dimensions in `shared/aurora-terrain-references.json`.

## Catalogue alignment

All 48 bag labels and GUIDs are read from the current installer. The portal now uses Freeport Echo, Civic Gardens, Courtyard District and Geothermal Works. Old detail-page slugs remain aliases to the corresponding current locations; server-generated canonical URLs identify the current page. Territory IDs, mission selection, campaign scoring and battlefield rules are unchanged.

The downloadable `aurora-vii-terrain-guide-current-maps-20261030.pdf` uses the same 24 illustrations and current location labels, and links to the separately maintained current Territory Special Rules. Historical image and PDF URLs remain available for existing references.

## Validation

The current catalogue is checked against the source installer for all 48 bags. Standard public-page and campaign checks cover the shared data. The existing Aurora map-library browser check visits all 24 detail pages, checks both mission options, decodes every image, verifies exact bag names, clipboard behavior, filters and mobile width. Production verification checks the deployed artwork and guide as well as current and historical location routes.
