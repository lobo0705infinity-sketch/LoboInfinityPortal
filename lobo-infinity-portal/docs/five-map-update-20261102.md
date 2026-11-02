# Five approved maps — November 2, 2026

| Approved map | General pool replacement | Mission | Top 40 assignment |
| --- | --- | --- | --- |
| Redline Interchange | Dustline Outpost | Cutthroat | Losers Round 3 |
| Cairnfall Sanctuary | Foundry Blocks | Battleground | Losers Round 4 |
| Vesper Glassworks | Emberfall Station | Neutralization | Losers Round 5 |
| Halcyon Thermal Baths | Nereid Deep R3 Outbreak | Outbreak | Losers Round 6 |
| Ironveil Complex | Older Ironveil Complex | Hardlock | Losers Round 7 |

The collection contains 40 general maps, 50 Aurora VII setups and 10 Top 40 bags. Each mission keeps its other existing map. Neon Exchange stays in Outbreak. The separate Aurora VII Nereid R7 public terrain and its upper-deck controls remain unchanged. Kestrel remains in the general Data Harvest pool only, preserving the latest portal correction. Provisioning is still Losers Round 2; Hardlock is Round 7.

Approved sources are the user's TS_Save_35 (Redline), TS_Save_36 with approved controls (Ironveil), approved TS_Save_37 with the archive stair correction (Cairnfall), TS_Save_38 (Vesper), and TS_Save_39 (Halcyon). Terrain geometry, active transforms, scales and selected building states are preserved. Vesper's appended self-propagating script suffix was removed in the earlier four-map release. Halcyon had one duplicated alternate-state GUID after a building was copied: that alternate-state identity and copied grid attachment identities are normalized so it does not collide with the copied active building. Its geometry and placement are unchanged.

The update installer installs the full collection plus 22 named map bags and thumbnails directly into the main Saved Objects folder. Existing targets and verified GUID-named old copies are backed up. Installation and old-file retirement roll back on failure. The prior seven-map updates and Sirocco R7 are retained. The portal publishes matching bags, actual terrain renders, a forty-map download ZIP, and the current installer. Release inventory hashes identify all 51 public map payloads.

Validation covers exact approval preservation, independent general/event ownership, current control behavior, original Stage deployment and cleanup across building states, catalogue counts/search, referenced Halcyon file downloads, public map assignments and unchanged score ownership, and real PowerShell fresh/reinstall/backup/corruption/rollback tests. Software terrain previews omit native mission asset-bundle markers. Native Windows execution and live TTS physics/rendering/multiplayer remain unverified.

Installing the package and publishing the portal do not publish Steam Workshop item 3719263238. In TTS load “Lobo's Infinity Maps - Five Map Update R1”, then use Workshop Upload → Update Workshop for the existing item and confirm success in Steam.
