MERIDIAN EXCHANGE R5 — CRITICAL INTERVENTION REVIEW
Lobo Top 40 / Losers Round 8 / 300 points

INSTALL
1. Extract the entire ZIP into a new folder.
2. Run Install.cmd. It adds a Saved Object to the MAIN Saved Objects folder:
   Documents/My Games/Tabletop Simulator/Saves/Saved Objects
3. In your normal Infinity table, clear the old map and deploy this NEW bag:
   SET_ITS18 Critical Intervention — Meridian Exchange R5 REVIEW
4. Drop the bag on STAGE using your usual map deployment method.

Loading your old R3/R4 bag will still load the old map. R5 has its own name,
new asset URLs and a new thumbnail. Nothing must be manually copied into Mods.

The installer also provides a separate Save & Load review scene:
   Meridian Exchange - Critical Intervention R5 REVIEW
That scene is just the map; use the Saved Object on your full Infinity table.

WHAT CHANGED
- Newly generated 4096x2048 spherical Day and Night environments. Distant skyline
  stays near the horizon; no foreground city is stretched beneath the table.
- Detailed limestone mat on one correctly mapped ground slab, with matte finish.
- Distinct floor materials for all ten buildings and the central Server Room:
  civic stone, office stone, warehouse concrete, terracotta, timber, workshop
  epoxy, dark technical stone, terrazzo, pump-room epoxy, courier tile, and
  server panels. Existing floor meshes/colliders are retained, not overlaid.
- Physically mounted, precisely typeset signs with frames and brackets for
  buildings, transit, inspection, directory, civic alcove and server gates.
  Cafe sign hangs from the FRONT of the canopy so the canopy cannot hide it.
- Fitted interior screens, service fittings and small business-specific details.
- Extra identifiers and details for network cabinets and public-service scatter.
- Eleven new shadow-free point lights illuminate building signs. Lighting uses
  the existing TTS light bundle with bounded load retries, no frame update loop.

The starting point is the newer R4 review package, retaining its normal-map
repair, lettering corrections, crockery, baggage trolley, inspection fittings,
atelier tools, server cable trays and four warm entrance lights.

This is a treatment of the existing architecture and layouts. Concept boards
set the visual direction; the review build is not a pixel-exact reconstruction
of those illustrative rooms. See Review for actual exported-geometry renders.
Software renders omit native mission asset bundles and dynamic point lights.

PLAY AND CONTROLS
All native mission pieces and the Server Room mesh/collider remain unchanged:
central console, two turrets, inhibitor antenna and Data Pack. The room retains
its 8x8 inch scoring area and four 55mm gates. Existing building collision,
positions, native state numbers, floor control, ladders and stairs are retained.
State 1 is the lowest floor. Upper floors and roofs use native building states.
The shared deployment/exclusion guides, mission references, defender toggle,
Booty and Metachemistry, tree states and Day/Night/Off controls are preserved.

CHECKS
Every new model checked for import limits, valid faces and indices. Every new
image fully decoded before packaging. JSON state/staging and ownership checks,
Lua compilation and controller behavior mocks passed. Cloud-download SHA256
checks are included in Review. These checks do not substitute for live TTS.

Live TTS appearance, point-light behavior, physics and second-client loading
still need review. Windows installer could not be executed in this Linux runtime.
Existing exact R5 filenames are backed up on reinstall. Earlier versions remain.
This installer does not publish to Steam Workshop or update the portal.

PROVENANCE
Source/build_r5.py creates the textures and fitted geometry using the R2 source
helpers and R4 review scene; it requires those original build inputs and image
source artwork. The Source directory is retained for audit, not a standalone
rebuild kit. New assets are bundled and also use immutable public HTTPS URLs.
