# Seven-map portal update — November 2, 2026

The portal now publishes the map payloads from the Seven Map Update R1 installer.
All 40 general bag downloads match that collection, including the current floor,
collision and control repairs. Stable mission slots and existing links remain.

| Map | General mission | Top 40 |
| --- | --- | --- |
| Asterion Research Campus | Corporate Appropriation | Winners 1 |
| Frostline Relay | Superiority | Winners 2 |
| Verdant Exchange R5 | Uplink Center | Winners 3 |
| Old Quarter Excavation | The Dig | Winners 4 |
| Canopy Blacksite R4 | Annihilation | Losers 1 |
| Approved Kestrel Lunar Base R14 | Data Harvest | Additional collection entry; no assigned round |
| Nereid Deep R7 public terrain | Aurora VII / Azure Coast | Not in Top 40 |

Kestrel does not replace an unrelated mission in the tournament schedule.
Unannounced round maps remain TBD. The four earlier assignments are retained.
Nereid's future GM mission objectives, scoring and briefing remain unpublished.
The older general Outbreak Nereid R3 remains a separate setup.

The installer is byte-identical to the delivered seven-map installer and installs
13 named bags in the main Saved Objects folder. Its full collection contains
40 general, 50 Aurora VII and 6 Top 40 setups. Installation is separate from
updating Steam Workshop item 3719263238; a portal deployment does not publish Steam.

Actual mesh renders were refreshed for Asterion, Frostline and Old Quarter;
asset-bundle mission markers are omitted from those terrain previews. Supplied
approved geometry previews are used for Canopy, Verdant, Kestrel and Nereid.
Native TTS physics and playtesting are not claimed.

Validation: TypeScript, Vite production build, general catalogue/rating checks,
Top 40 map/API/score checks, public metadata and sitemap checks, exact comparison
of all 40 downloaded bags with the installer collection, and ZIP verification.
The release inventory under public/assets/maps/seven-map-update-20261102-r1
records each bag's SHA-256 and the installer SHA-256.

## Kestrel tournament listing correction

Kestrel Lunar Base belongs only in the general Data Harvest pool. It is removed
from the Top 40 catalogue, preparation page, and search/sitemap entries; its old
tournament URL redirects to the general map. The tournament has no Data Harvest
mission. The original installer described above remains an archived release.
