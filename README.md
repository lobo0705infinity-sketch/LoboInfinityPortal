# Clash of Empires — Original 13 Audit, R12

The original 13 battles have been rebuilt across all 16 saved layouts. The full collection retains 37 scenario bags. The 21 other bags, table objects and Global script are unchanged.

## Changes

- Replaced the original battle figure meshes and texture sheets with matched infantry, cavalry, commander, elephant and chariot families from the retained audit artwork. Two standing poses per troop family are used where a stand has multiple figures.
- Standardized rear labels to the Megiddo layout: quality, unit name, classification and CV/CB/MD. Commanders display only their names. Army colors were adjusted for readable white text.
- Applied the approved figure counts. Troops have Full/Disordered/Shaken states; commanders have Normal/Wounded. Elephants and chariots remain one model per stand.
- Separated casualties from standing ranks and kept every figure footprint within its base.
- Rebuilt the terrain render mesh and collision mesh from the same height grid used by the placement script. The largest original mismatch was approximately 2.961 inches on Issus.
- Corrected scenery grounding and moved obstructing scenery clear of deployed stands. Corrected the native-X direction of river overlays.
- Updated the packed native layouts and all 15 Hydaspes Turn 2 reserve stands.

## Validation

| Layout | Stands | Commanders | Base overlaps | Terrain/grid match |
|---|---:|---:|---:|---|
| Granicus — Arrian strengths | 85 | 6 | 0 | <0.0000001 inch |
| Granicus — reduced Persians | 60 | 6 | 0 | <0.0000001 inch |
| Zama — 202 BC — Terrain-rich | 81 | 6 | 0 | <0.0000001 inch |
| Gaugamela — 331 BC — Terrain-rich | 116 | 6 | 0 | <0.0000001 inch |
| Hydaspes — 326 BC | 86 | 6 | 0 | <0.0000001 inch |
| Issus — 333 BC | 107 | 6 | 0 | <0.0000001 inch |
| Cannae — 216 BC | 132 | 6 | 0 | <0.0000001 inch |
| Zama — 202 BC — Historical open ground | 81 | 6 | 0 | <0.0000001 inch |
| Gaugamela — 331 BC — Historical open ground | 116 | 6 | 0 | <0.0000001 inch |
| Trebia — 218 BC | 74 | 6 | 0 | <0.0000001 inch |
| Cynoscephalae — 197 BC | 62 | 6 | 0 | <0.0000001 inch |
| Raphia — 217 BC | 85 | 6 | 0 | <0.0000001 inch |
| Magnesia — 190 BC | 73 | 6 | 0 | <0.0000001 inch |
| Adrianople — AD 378 | 60 | 6 | 0 | <0.0000001 inch |
| Pharsalus — 48 BC | 82 | 6 | 0 | <0.0000001 inch |
| Teutoburg Forest — AD 9 | 59 | 6 | 0 | <0.0000001 inch |

Total: **1359 stands, 96 commanders, 191 model identities and 517 model states**.

- All 1,080 original referenced model/image assets downloaded successfully.
- All generated OBJ vertex and face indices are valid; no model exceeds 65,000 vertices. Maximum observed: 13,544 vertices and 13,840 triangles.
- Builder checks found zero overlaps between figure footprints and zero figures extending outside their bases in all 517 states.
- An independent reader verified saved transforms, state counts, packed-layout data, reserve poses, table bounds and terrain vertices/triangle centroids.
- Independent serialized-rotation checks found no base edges below the terrain. Minimum designed clearance is 0.012 inch. A rigid base can have an edge gap on curved ground; the largest reported edge gap is approximately 0.292 inch.
- Representative final models and casualty states were rendered with single-sided face culling. All 69 distinct full-state artwork/count combinations were reviewed; the final larger commander arrangement was also rendered.

## Publication and installation

New model and terrain URLs are pinned to an immutable public GitHub commit. The installer caches referenced assets, verifies their SHA-256 hashes and writes a new save slot. Existing saves remain in place. All 37 scenario bags are available; remaining assets load from public URLs on demand.

**Live Tabletop Simulator behavior and Windows installation have not been tested in this workspace.** Static checks and renders do not verify TTS importer behavior, runtime physics, load times or the Steam Workshop upload. The existing scenario rosters, rules and briefings were retained; this was a model, label, layout and terrain audit, not a new historical-source audit.

To update Steam Workshop: install, load the R12 save, then use **Update Workshop** on the existing entry. GitHub publication alone does not update Steam Workshop.

## Published asset verification

All **836 referenced public assets** returned HTTP 200 and matched their local SHA-256 hashes, including **791 new asset paths**.

Asset commit: [00ae124dd0d398b08fb16081ceb2cceada654f1e](https://github.com/lobo0705infinity-sketch/LoboInfinityPortal/commit/00ae124dd0d398b08fb16081ceb2cceada654f1e).
