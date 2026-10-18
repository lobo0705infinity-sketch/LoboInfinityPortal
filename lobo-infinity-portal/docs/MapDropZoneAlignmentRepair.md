# Map drop-zone alignment repair — October 18, 2026

The normal Infinity mod's Stage compares each saved rotation directly to
`getRotation()`, with a tolerance of 0.0005 degrees. A signed angle such as
-0.18 is physically equivalent to 359.82, but fails this comparison. Each failed
object consumes 100 alignment attempts, printing `Failed Alignment.` before the
Stage moves to the next object. The Stage remains busy during the process.

The repaired exports use canonical angles in [0, 360), four decimal places,
and native CRLF-delimited SET_ placement records. Individual downloads are
Saved Objects bags; the ZIP also includes a collection game save and instructions.
Versioned download paths avoid serving older immutable cached files.

34 spare mission tokens were previously staged at z=29, beyond the Stage's
|z|<26 clear area. They now use x=32, z=their previous x, outside the 48-inch
play area and inside the clear area. Playable terrain, mission contents, GUIDs,
asset references and alternate states are preserved.

Rebuild the 40 portal bags from the retained source archive:

```bash
python3 scripts/repair-map-alignment.py --portal-root .
python3 scripts/map-drop-zone-alignment-check.py
npm run test:workshop-current-collection
```

To repair another existing table without replacing its catalogue or UI:

```bash
python3 scripts/repair-map-alignment.py --table source.json --output fixed.json
```

The deeper regression check executes the actual Stage Lua from the current
[Infinity the Game Workshop mod](https://steamcommunity.com/sharedfiles/filedetails/?id=2986970635),
retrieved October 18, 2026. Pass its extracted Stage Lua as `--receiver PATH`.
This optional check needs `lupa`; it translates only TTS's `!=` syntax to Lua's
`~=`, mocks TTS objects and float32 rotation reads, reproduces the original error,
then exercises deployment, alignment, busy release and clearing for every bag.
All 40 portal bags and all 41 bags in the organized table completed with zero
alignment failures. This is a script compatibility test, not live TTS rendering
or physics verification.

The existing `updatedAt` catalogue field remains the original Workshop timestamp.
`downloadRevision` identifies this repaired export; publication here does not
update the Steam Workshop item automatically.
