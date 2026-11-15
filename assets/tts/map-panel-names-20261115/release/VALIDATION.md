# Infinity map names on control panels — RC1

Each of the 104 map setups now displays its map name beneath the Map Controls heading and on the collapsed tab. Names follow the approved save's labels, including Vanta Customs Yard and Veyra Gate. All Top 40 copies use their actual map name.

## Verification

- 162 controllers across all 104 setups updated; 61 distinct map names.
- All 8 existing drawer implementations retained and compiled in Lua, along with every changed controller.
- 488 Lua execution checks cover every name on every drawer variant: opening, per-player closing/reopening, two controllers sharing a map, callback routing, switching maps and anchor cleanup. No duplicate or stale title after clearing.
- All names fit both existing panel widths and the collapsed tab in the offline font/layout check. Representative layouts visually reviewed.
- The exact save comparison found only 162 controller Lua edits plus SaveName. All remaining fields — including object transforms, collision, assets, states, bag scripts, Stage and global scripts — are identical to the Aurora VII RC1 baseline.
- 15024 typed color structures checked; notebook color/id types retained. No file URLs or unresolved asset placeholders introduced.
- 8519 exact public asset URLs downloaded successfully and matched the prior source audit's SHA-256 hashes (2,712,257,831 bytes). 535 textures decoded; 7748 meshes/colliders parsed. Existing geometry/footprint validation remains applicable because every asset and transform is unchanged.
- Installer uses a new free save slot, copies the ready save unchanged and checks SHA-256. Packaged ZIP integrity and payload checksum verified.

## Runtime status

Live TTS import, fresh-cache loading, two-client multiplayer, load timings and Windows installer execution remain untested. This is an offline-validated release candidate. Steam Workshop publication has not been performed.

## Source and identity

- Baseline: Aurora VII RC1 installer, repository commit `76b7102294bb70133361625f3297e80852d6ec7e`.
- No asset URL was added, removed or repointed. The baseline's original public asset commits are retained.
- Save: **Lobo Infinity Maps - All 104 Map Names on Controls - RC1**
- Save SHA-256: `9105c79d772b40491d69e07e572216578c5f04b68c1575b8142dda47ce1589ef`
- Workshop item: https://steamcommunity.com/sharedfiles/filedetails/?id=3719263238
