# Aurora VII visual refresh — RC1 validation

24 locations, 48 mission setups, 492 building instances and 1047 states updated. The save retains the full 104-map collection.

- 24 distinct RGB material/artwork atlases; exterior and interior materials remapped; wall illustrations, controls and signs added.
- 472 mesh variants checked; 2599 panels across all saved states.
- Original triangles and vertex identity retained. Collider URLs, transforms, state keys, scripts, raised platforms and controls compared unchanged against the approved baseline.
- All meshes triangulated with valid indices and finite coordinates/UVs. Maximum effective vertex count: 24697 (under 25,000).
- 147 textures decoded. 22767 numeric color structures checked; 15010 nested objects inspected.
- 619 exact public release URLs downloaded, returned HTTP 200 and matched local SHA-256 hashes. Includes inherited texture bytes relocated to public hosting. Unchanged legacy assets were not republished.
- No local file URLs, local drive asset paths or unresolved asset placeholders remain in the ready save.
- Representative building renders, with roofs present and removed, reviewed for all 24 locations. Canopy vertex welding and coastal atlas alignment defects found during review were corrected.
- ZIP integrity and packaged save SHA-256 verified. Installer copies into a free save slot and verifies the save hash.

## Remaining runtime checks

Live Tabletop Simulator import, a clean-cache load, state switching with miniatures, multiplayer access, performance timings and Windows installer execution have not been observed here. Do not treat offline checks as proof of those runtime behaviors. Steam Workshop publication has not been performed.

The polar representative buildings retain pre-existing open-shell geometry also visible in the approved source models. That geometry is outside this material/artwork refresh and remains present; it should be checked in TTS. Existing furniture geometry was retained, not replaced with new furniture models.

## Release identity

Asset commit: `24fb8e31099fcc668daf39e02d68c9453fd7f9a9`

Ready save SHA-256: `DE34E3BE8D1BE7E1BC220FF81B2C460D0B102291A7DCF70DA397F3FB4DA3A33B`

Workshop item: https://steamcommunity.com/sharedfiles/filedetails/?id=3719263238

## Full collection asset check

All 8,519 distinct serialized asset URLs in the final save were downloaded successfully over HTTPS. The 619 refresh assets matched the recovered source SHA-256 hashes; 7,900 unchanged asset URLs were downloaded and hashed, with image decoding and mesh parsing where applicable. The original source files were checked against their recorded Git blob hashes.

Typed color and notebook checks follow the official save format: https://kb.tabletopsimulator.com/custom-content/save-file-format/
