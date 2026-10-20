# Satellite map replacements — 2026-10-20

Nine Azure Circuit and three Tidal Turbines variants are replaced by the mission-specific Satellite
tables recorded in `public/assets/maps/satellites-20261020-r2/validation.json`.
Akial Interference and Area of Interest retain Azure Circuit. The catalogue
contains 40 setups across 28 terrain identities.

Source: tau24, **Infinity Maps — Return to the Satellites**, Steam Workshop
3486064611, source save dated 2026-07-06. Source artwork and creator credits in
the object descriptions are retained. A copied self-propagating Lua payload is
removed throughout the imported objects. Useful terrain scripts retain their
links after GUID reassignment.

## Reproduce

Install `scripts/requirements-satellite-maps.txt`, then run:

```sh
python scripts/build-satellite-replacements.py --source /path/to/3486064611.json --work /path/to/local-cache
python scripts/satellite-map-variety-check.py
python scripts/map-marking-width-check.py
python scripts/map-drop-zone-alignment-check.py --receiver /path/to/original-infinity-stage.lua
```

The generator reads the original R6 archive retained in `public/assets/maps`.
It preserves mission-object coordinates and deployment markings, checks source
asset downloads, keeps stacked terrain together, and opens objective footprints
with a model-access margin. Assemblies without a collision-free relocation are
removed to create an objective plaza. Geometry checks use projected mesh bounds;
they do not establish line-of-fire balance, interior accessibility, or realistic
physics. The Kraken table's broken road-tile mesh is replaced by sixteen native
12-inch tiles with the original textures. Broken reverse-side mat images use
the corresponding front image.

## Validation

- All 219 final export asset URLs downloaded successfully.
- All 65 imported mission pieces retain their previous placement records.
- Forty bags pass the original Stage Lua deploy-and-clear simulation with
  zero alignment failures. Unity rotation readback is modeled, not executed.
- All 70 mission strokes retain their intended world-space width.
- ZIP bags match the individual downloads and collection save.
- Previous Azure and Tidal mission pages and rating identities are archived separately.

The new previews are explicitly labeled footprint diagrams. Fresh TTS captures,
live physics, full-army deployment, elevated firing lanes, and playtesting are
pending. The downloadable collection is updated; publishing the collection to
Steam Workshop is a separate pending step.

Twelve imported layouts have distinct portal names; source event and table names remain in credits. Existing Satellite slugs and terrain rating identities are preserved when renamed.
