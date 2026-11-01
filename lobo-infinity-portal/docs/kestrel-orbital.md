# Kestrel Lunar Base — Data Harvest

R5 revises the former pressure-block architecture with a purpose-built lunar
base: five transparent domes, an inflatable crew habitat, a photovoltaic
fabrication capsule, a tripod lander module, a radiator spindle, a thermal
sunshield, a communications dish and a clamshell shuttle cradle. Photovoltaic collector hardware replace the bridges. The ground is continuous regolith;
all rectangular ditches, ramps and bridge objects have been removed.

The 48 × 48 inch setup keeps bag GUID `1008da`, save 19, its stable portal URL
and layout key. Fourteen structures have twenty exposed-interior/floor states.
Glass shells use the glass material and alpha tint. Their actual Lua scripts
park them outside the playable area while their habitat is open, restoring
them for roof-on states. This keeps invisible roof colliders away from
miniatures. Partitions and furniture remain inside; ladders persist.
Complete building heights are rounded upward to quarter-inch values.

The real ground anchor owns the controls. There is no separate hidden map
controller to miss during loading. A physical MAP CONTROLS button at the board
corner and an anchor context-menu entry reopen the right-side drawer, and can
restart its UI service when needed. Loading this setup upgrades an older
shared UI writer to the compatible V4 service, retaining its API for other maps.
Startup tests include delayed broker scripts, delayed UI readiness and a stale
V4 writer. No Global script is edited.

Booty and Metachemistry remain independent per player. DZ / DZ +4 / DZ +8
remain independent, initially off, with X=±12 / ±8 / ±4 boundaries and
0.025-inch outlines / 0.015-inch colored centers. Six mission/reference tabs
remain per player. Lunar Day shows Earth and Sun; Lunar Night shows Earth
and stars with the Sun below the horizon. Clear Table restores the previous
environment and removes changed states and parked glazing.

Three 40 mm Tech-Coffins remain at (0,-20), (0,0), (0,20), without supplied Data-Harvester tokens. The invalid `Chip` records are removed.
A failed older deployment can leave the Stage busy; reload the table once
before deploying the corrected bag. The actual Stage update loop is tested
to release its busy flag without a forced reset, followed by normal Clear Table. Designated Zones are player-placed Circular Templates. No
vacuum, gravity or other special gameplay rule is added.

Checks cover all Lua scripts, actual controller and glazing script execution
with mocked engine APIs, exported collision geometry, route connectivity,
objective access, template locations, vertex/collider limits, native Stage
deployment and cleanup, and the PowerShell installer. Actual exported models
were rendered for exterior and exposed-interior review. A running TTS client
was not available, so live rendering, physics and multiplayer QA remain pending.

The standalone installer writes Kestrel Lunar Base - Data Harvest.json and its
matching PNG directly to main Saved Objects, verifies hashes and makes backups.
It retains the Windows PowerShell JSON-array compatibility fix. The full
collection package preserves every unrelated object. Public downloads use a
new versioned path and preserve the latest unrelated bags from the current
published forty-map bundle. Steam publication uses Update Workshop in TTS on
existing item 3719263238.

The large research biosphere has four furnished rooms and four entrances
connected by a two-inch-wide cross hallway. An oxygen-reclamation dome and
four-way transit node add two more buildings. Photovoltaic hub and lander
floors use nonoverlapping floor/rim regions and consistent story heights
across states. Their consoles and roof panels leave ladder landings clear.

R6 adds three sculpted impact basins with recessed bowls, raised ejecta rims
and low approach saddles. Three continuous, curved ridgelines vary up to
2.5 inches above the original ground. The crater floor is actual depressed
geometry. Four terrain sections share matching edges and the original
regolith texture, with buried render faces removed and flat collider cells
merged. Facility pads, ladder feet, Tech-Coffins and optional template areas
remain level. Three nearby scatter pieces move to maintain safe approaches.
40 mm routes are checked conservatively around all six landforms.

R7 encodes the world-space ground through the inverse native OBJ X reflection
and reverses triangle winding. The renderer and collision checks decode that
import transform, keeping craters and ridgelines aligned with the level pads.

R8 replaces the faint below-grade crater basins with three distinct models: a
darker recessed bowl and raised ejecta rim for each impact site. All visible
bowl surfaces remain above the base/table plane. Irregular rim crests stand
roughly 1.2–1.4 inches above each bowl, with low access saddles. Three more
ridgelines bring the total to six; a redundant barrier is replaced by geology.
Forty-millimetre routes, flat facility pads, objective access and the original
controls remain checked. A dedicated actual-geometry crater close-up is included.
