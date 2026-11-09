# Lobo TTS delivery requirements

These are standing user requirements. Preserve them across revisions without requiring the user to repeat them.

- Deliver public hosted HTTPS assets for TTS meshes, textures and colliders. Never replace a working hosted delivery with local paths or file:// URLs. Local-only artifacts are not acceptable substitutes.
- Preserve previously working features and approved dimensions when making requested changes. Do not regress loading, textures, controls or model detail.
- Roman Hastati unit: twelve figures total, ten troopers plus one recognizable officer and one standard bearer; varied poses; distinct front and rear artwork; three ranks of four, with officer and standard bearer occupying the two middle positions of the front rank, at the original figure height on a three-inch square scenic base. Flat cutouts are the current implementation.
- Before delivery, download every exact final asset URL, require successful responses, compare bytes or SHA256 hashes with the source, fully decode textures, parse mesh and collider geometry, verify model limits and footprint, and check the actual final installer/JSON for local paths and placeholder URLs.
- Keep final asset URLs pinned to an immutable commit. Installers copy ready-to-use saved-object JSON and thumbnail; they must not generate local asset paths.
- State precisely whether live TTS import was tested. Offline validation must never be described as successful in-game import.
- A delivered broken installer is a failure even if artwork looks good. Investigate the cause and correct the delivery; do not simply issue another unverified version.

## Ancients game classifications and battle archives
- Unit class and figures per base: Heavy 12, Medium 8, Light 6, Skirmisher 4. Medium and light cavalry use eight and six figures respectively; skirmishing cavalry use four.
- Quality is independent: Levy, Regular, Veteran, Elite. Formation data: Rigid, Flexible, Skirmisher. Weapon type is also recorded.
- Rear plaque: a large L/R/V/E on the left, unit name on the upper right, then the unit class, Cavalry where applicable, and weapons below. Example: V | Macedonian Pike / Heavy Pike. Example: E | Alexander's Companions / Medium Cavalry Lance/Javelin.
- Preserve stout, detailed miniature anatomy and the source art's aspect ratio. Never stretch sprites taller or narrower to fit a rank. Heavy infantry use three ranks of four.
- The dedicated game tabletop has a 96 x 72 inch playing area (8 x 6 feet), with the battle archive outside it. Store complete battles with map, armies, placements and notes together; preserve current piece positions when archiving an active battle.

## Save-format regression checks
- Validate field types against the official TTS save schema, not only JSON syntax. TabStates entries have a string `color` label, a numeric RGB ColourState object in `visibleColor`, and an integer `id`. Never put a player-color string such as `Grey` in a ColourState field.
- Walk nested saved objects and validate numeric RGB structures in all typed color fields before packaging. Keep a regression check for the notebook visibleColor load failure.

## Granicus R2 requirements
- Rotate only the battlefield map when requested, never the table itself. Keep the original table orientation at 96 inches wide by 72 inches deep, with the archive on the right. Fit the rotated battlefield and deployment to that surface without changing figure or base scales.
- Use source-led deployment: Alexander and his Companion/hypaspist/light-troop group on the Macedonian right; Thessalians/allied horse on the left; Persian horse along the far bank and Greek mercenaries behind. Mark contingents with unrecorded exact positions as unassigned rather than presenting guessed reserve grids as historical.
- Every visible figure, horse, shield and weapon must stay inside its three-inch base in plan view. Preserve sprite aspect ratios and figure heights; arrange mounted files/ranks to fit. Check actual mesh bounds, not just collider dimensions.
- Base ground must match the battlefield mat's material and palette. Avoid the old golden/desert ground when the mat is grass/soil.
- Represent the uneven banks and higher Persian-side ground as well as the river. Treat exact relief and bank geometry as an interpretive tabletop reconstruction, not a measured historical survey. Do not add unsupported major terrain obstacles.


## Workshop design goal
- The user wants a premier Ancients wargaming workshop. Terrain affecting play must be genuinely modeled in 3D with matching collision: banks, river channels, rising ground, hills, rocky ground, woods, bridges and buildings where appropriate to the scenario. Ground textures provide surface appearance; figures may remain detailed 2D standees. Keep terrain historically justified in each complete battle pack.
