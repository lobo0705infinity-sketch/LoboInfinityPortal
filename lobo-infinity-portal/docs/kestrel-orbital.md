# Kestrel Lunar Base — Data Harvest

Kestrel Lunar Base replaces Concrete Labyrinth in the current ITS18 Data Harvest
slot (save 19, bag GUID `1008da`). The prior setup remains available through
its historical portal URL; Kestrel has its own layout key so ratings remain
separate. The other Concrete Labyrinth mission variants remain available.

R3 sets the research base on the Moon, with regolith ground and day/night
Earth-view backgrounds. Day shows Earth and the Sun in black sky; night shows
Earth and stars with the Sun below the horizon. Habitat shapes include
chamfered pressure hulls, a hexagonal archive, an L-shaped observation lab,
airlock portals, recessed viewports and curved laboratories.
The shuttle hangar has segmented structural ribs and a roof service spine.

The 48 × 48 inch lunar research base contains eleven structures with
seventeen interior/floor states, a grounded shuttle and open service bay,
two genuinely recessed maintenance channels, four ramps and two bridges.
Doors/windows are openings in the visual meshes and colliders. Exterior
ladders and their roof access openings survive state changes. Full building
heights, including equipment and parapets, are quarter-inch values.

Three 40 mm Tech-Coffins occupy `(0,-20)`, `(0,0)`, `(0,20)`. Each contains two
Data-Harvesters, represented by six 25 mm reserve tokens. Designated Zones
remain player-placed Circular Templates, following the official mission.
The selected map does not add vacuum, gravity or other terrain rules.

Controls reuse the existing map UI/background lifecycle broker. The drawer
starts open, grid/snapping start off, deployment boundaries are at `X=±12`,
and 16/20-inch depth selections are optional measuring aids. Markings use
0.025-inch outlines and 0.015-inch colored centers. Six reference tabs are
selected separately by each player. The right-hand drawer additionally provides
Booty and Metachemistry reference tables with independent player visibility,
and separate DZ / DZ +4 / DZ +8 toggles. All three guides start off; they
correspond to X=±12, ±8 and ±4 for this mission.
Map-specific Lunar Day and Lunar Night panoramas restore the original environment when the map is cleared.

Validation covers native loader records, all Lua syntax, actual controller and
embedded broker execution with engine mocks, unique GUIDs across the current
collection, terrain overlap/bounds, four circular-template locations, objective
access and conservative 40 mm base routes. Minimum scenery clearance from
Tech-Coffin centers is 2.721 inches. Maximum sampled distance to nearby cover
is 5.736 inches. This proximity metric does not certify cover from every angle.
Hardware uses metal material with restrained specularity; regolith is matte.
Physical UV projection replaces stretched per-triangle atlas mapping. A thin
custom-mesh ground anchor replaces the native tile; collision rays confirm
the recessed floor is unobstructed and the bridge stays above it. Hidden
controller helpers remain above the table within the Stage clear zone.
Actual terrain geometry was rendered for overhead, angled and interior review.
Live TTS physics and multiplayer playtesting remain pending.

The public forty-bag download uses a new versioned path to avoid immutable
asset caches. The complete collection installer updates the same local Workshop
slot and preserves every unrelated top-level object. Steam publication still
uses TTS's Update Workshop action on existing item `3719263238`.
