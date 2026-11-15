# Aurora VII: 24-location visual refresh — 14 November 2026

This asset release supplies a distinct generated material and artwork atlas for each of the 24 Aurora VII locations, applied to both Frontline and Supremacy. Coverage and mesh manifests contain the exact counts and source assets.

The baseline is the approved Lobo Infinity All 104 Visual Update Stage Fix installer. Source save SHA-256: `f7cf4c04ae11fcf9222af6ae86232c25811c7c4b9ab1e751eb6440b659c200c5`.

## Artwork

Each RGB atlas was generated with imagegen and visually reviewed. It contains sixteen material fields, four designed signs and four illustration/control-display panels. `design-themes.json` defines each location's palette, setting and sign text; `atlas-layout.json` records the actual material/artwork boundaries. Building exteriors, room-facing walls, floors, fittings and furnishings are remapped by the original atlas's semantic material arrangement. Existing furniture geometry is retained. New panels are fitted inside solid wall surfaces, with a clearance margin around openings.

## Geometry and saved game

The build script preserves original geometry, collision models, transforms, state keys, scripts, map controls and raised platforms. Changes are material UVs, diffuse textures, neutral object tint, fitted flat wall artwork and the save title. Inherited bundled texture files are rehosted byte-for-byte so that the ready save contains public HTTPS URLs only. Each final asset URL is pinned to the exact published commit.

`build-selection.json` identifies the 48 target bags and 492 building instances. `source-assets.json` records retrieved immutable source URLs and hashes; `mesh-validation.json` records every new mesh and source pairing. The source save plus these inputs and the two scripts in `scripts/` are retained for traceability.

## Validation limits

Offline checks cover all generated meshes, original triangle coordinates, index/UV bounds, effective vertex counts, decoded textures, typed JSON colors, mission coverage and an allowlisted comparison with the approved save. All 24 locations have representative roof-on and roof-off model renders. Published assets are downloaded from their exact final URLs and hash-checked before packaging.

The polar representative models retain pre-existing open-shell geometry that is also visible when rendering the approved source models. This material/artwork refresh does not rebuild those shells.

Live Tabletop Simulator import, fresh-cache loading, state switching with miniatures, multiplayer loading and Windows installer execution require that environment and have not been observed here. Steam Workshop publication is a separate user action after the installer loads the ready save.
