# Kestrel Lunar Base — Data Harvest

R13 adds two 8-inch pressure-hull biospheres, bringing the layout to 22 lunar
facilities and 15 glass domes. Each new biosphere has four furnished rooms,
four entrances, a clear two-inch cross hall and opaque pressure shielding.
Horizontal ray checks confirm the hull and bulkheads block low lines of fire;
the transparent roof is not counted as opaque cover.

Dome orientations now vary across eight directions. A few smaller facilities
and the lander receiving yard move to accommodate the new domes. The solar
field remains two rows of three; equipment stays in organized service areas.

Glazing is a native local `ChildObjects` attachment of the building's highest
state. It is no longer an independent payload or scripted parked object.
The supplied/default state is the complete glazed building. State 1 exposes
the ground floor, upper floors follow in ascending order, and the state just
below the complete dome retains the structural roof frame with its glass off.
The opaque building material remains separate from the transparent glazing.

The approved fine lunar material, six recessed craters, eighteen higher
ridgelines, clear objective/template areas and normal Infinity rules remain.
Terrain pads are regraded around the revised layout. Booty/Metachemistry,
independent DZ/+4/+8 and individual day/night Earth-and-Sun backgrounds remain.

Checks cover native state structure, local attachment transforms, unique GUIDs,
actual entrance and opaque-hull ray intersections, level pads, crater depths,
UV stretch, collider limits, 40 mm routes, controls and original Stage deploy/
Clear Table behavior in default and changed states. Previews render the actual
exported meshes. Live TTS physics and multiplayer playtesting remain pending.

Both installers put `Kestrel Lunar Base - Data Harvest.json` and its thumbnail
directly into the main Saved Objects folder. The full installer also updates
the local collection save, preserving unrelated maps. Steam Workshop upload
remains a separate manual action.

Reproducible source: `kestrel-r13-authoring-source.zip`, entry point
`update_domes.py`, with the R12 native baseline and layout included. Material
provenance remains in `MATERIAL-PROMPT.txt` and the original generated source
scan. The diffuse atlas and unchanged model blobs are reused from R12.
