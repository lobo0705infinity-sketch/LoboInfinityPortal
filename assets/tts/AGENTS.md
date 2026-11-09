# Lobo TTS delivery requirements

These are standing user requirements. Preserve them across revisions without requiring the user to repeat them.

- Deliver public hosted HTTPS assets for TTS meshes, textures and colliders. Never replace a working hosted delivery with local paths or file:// URLs. Local-only artifacts are not acceptable substitutes.
- Preserve previously working features and approved dimensions when making requested changes. Do not regress loading, textures, controls or model detail.
- Roman Hastati unit: twelve figures total, ten troopers plus one recognizable officer and one standard bearer; varied poses; distinct front and rear artwork; two ranks of six on a three-inch square scenic base. Flat cutouts are the current implementation.
- Before delivery, download every exact final asset URL, require successful responses, compare bytes or SHA256 hashes with the source, fully decode textures, parse mesh and collider geometry, verify model limits and footprint, and check the actual final installer/JSON for local paths and placeholder URLs.
- Keep final asset URLs pinned to an immutable commit. Installers copy ready-to-use saved-object JSON and thumbnail; they must not generate local asset paths.
- State precisely whether live TTS import was tested. Offline validation must never be described as successful in-game import.
- A delivered broken installer is a failure even if artwork looks good. Investigate the cause and correct the delivery; do not simply issue another unverified version.
