# Aurora VII Workshop catalogue

The map library offers ITS18 and Aurora VII collections. Aurora VII contains 12 regions, 24 location pages and 48 mission setups. Each location owns one approved concept reference, shared by Frontline and Supremacy. Region thumbnails reuse those references. The concepts are labelled as construction guides, not TTS screenshots.

`shared/aurora-map-catalog.mjs` supplies both the React browser and the server-generated public pages. Mission selections use the `mission` query parameter, so reloads and shared URLs preserve the choice. The exact bag name and clipboard action follow that selection. Mission rules and deployment diagrams use the existing public Mission Geist catalogue resolver; unavailable references leave the local catalogue usable.

## Source data

- `aurora-workshop-bags.json`: the 48 exact labels and GUIDs from the approved `Lobo88-Map-Rules-Fix.zip` v7 save, exported October 22, 2026. No TTS objects or cloud asset URLs are changed by this portal update.
- `aurora-territory-rules.json`: the 26 October 2026 battlefield rules and owner advantages from `Lobo88-Map-Rules-Fix.zip` v8, matching the current rules PDF. Includes terrain-based descriptive context for all twelve territories. Azure Coast owns the aquatic rules; Echo Shores uses Black-Market Arsenal. The shared rules component appears on the Player Rules page, territory detail pages and all 24 map location pages. Server-generated map text uses the same descriptions and rules.
- `aurora-terrain-references.json`: the portal's existing approved October 21 concept references, including the Ember Highlands and Frostreach revisions. Both campaign guides and map pages read this single mapping.
- Existing campaign region IDs remain unchanged. Azure Coast location labels match Coastal Access and Tidal Infrastructure.

The catalogue does not assign campaign reports or ratings to individual locations: existing campaign data identifies the territory, not the exact location. It links to campaign battle reports instead. ITS18 IDs, ratings and historical detail links retain their existing behavior.

## Verification

Run the normal build, then `npm run test:aurora-map-library` with Playwright Chromium installed. `CAMPAIGN_TEST_CHROMIUM` can point to an existing Chromium executable. The browser check visits every location and verifies both missions, shared images, reloads, copied bag labels, filters, unavailable mission references and mobile width. `node scripts/public-search-page-check.mjs` validates the catalogue and all 24 direct public detail pages.
