# Lobo Infinity Map Controls Standard

Approved by Lobo on 18 November 2026. Applies to every existing and future Infinity map, campaign variant, Top 40 setup and archived community setup released from this collection.

The canonical UI is `standard-broker.lua`. Update its shared source, regenerate all affected maps, and pass `validate_release.py` and the runtime control tests before publishing. Never replace the whole panel with an older map's menu. Terrain, model, texture and mission updates must preserve this standard.

Fixed order:
1. Map Controls heading and per-player Close / reopen tab.
2. Mission; Map Rules alongside it when applicable.
3. Turn 180, always visible near the top; battlefield terrain and pieces rotate together, with a second click returning them.
4. Deployment Zones: Off, Normal, +4 in, +8 in. Preserve each map's authored zone shape and mission depth. Only one deployment mode is active.
5. Separate DZ Color and Exclusion Color controls. Each offers bright Red, Orange, Yellow, Green, Blue, Indigo and Violet. Changing one does not change the other.
6. Exclusion Zone; Grid; Quadrants / Scoring Zones. Exclusion is N/A when the mission has none; preserve mission-specific scoring geometry.
7. Background: Day, Night, Off; retain the map's approved default.
8. Expandable map-specific options, preserving approved foliage, lighting, traffic, mission guides and special scenery controls where applicable.
9. Booty, Metachemistry and Speedball reference tables.
10. Clear Table, removing map-owned objects while preserving unrelated player pieces.

Do not include Building Floors / Roofs, My View - Floors, or Shared Interiors in the panel. This includes Port Meridian. Existing building object states remain available through the objects themselves.

Use ASCII for rendered labels and messages: `Close`, `Turn 180`, `+4 in`, `+8 in`, and plain `+` / `-`. Do not use symbol-font arrows, degree signs or decorative glyphs. Preserve meaningful punctuation safely inside embedded Lua and JSON strings.

Release checks must confirm:
- Every map embeds the exact canonical broker and exposes all core actions.
- Lua compiles; menus, mission panels and controls render without missing callbacks or corrupted text.
- Actual rendered buttons perform deployment selection, independent colors, rotation and background selection.
- Rotation preserves locks, supports saved orientation and keeps regenerated overlays aligned.
- Both colors survive save/reload; map-specific options remain; removed building menus stay absent.
- Approved terrain, models, object states, transforms, artwork URLs and placements are unchanged by a controls-only release.
- The full collection and exported map bags use the same version.
- Installer checksums pass, existing saves remain untouched, and a new numbered TTS save is created.

The automated harness executes the Lua 5.2 scripts with simulated TTS APIs. It does not substitute for visual and physics verification in a running Tabletop Simulator client. Steam Workshop publication is performed in TTS after loading the installed save.
