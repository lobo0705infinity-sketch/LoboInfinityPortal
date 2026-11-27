# Kestrel Lunar Base — Station Plan Final

Data Harvest on a 48 × 48 inch board. The final revision puts a four-inch return on the existing shuttle apron blast shield. Its geometry and hull use the Station Plan R3 material atlas.

The Windows installer is under `assets/tts/kestrel-station-plan-final/workshop`. Extract it and open `Install.cmd`. It installs the complete Workshop collection, a ready-to-play table and a Kestrel Stage bag.

The collection starts with the published Lobo’s Infinity Maps Steam item 3719263238, content 12336095962282772549. The original catalogue retains its other 106 map entries. For the Steam update, open the save **Lobo Maps - Kestrel Lunar Base Final - Workshop Collection**.

## Rebuilding

Prepare the R3 play table, Stage bag and render scene using the neighboring R3 sources. Generate the shield with `python shield.py` and publish its two OBJ files at one immutable revision. Run `python final_map.py <asset-commit>` and `python preview.py`. Render the thumbnail and apron view with `blender -b --python work/render-final.py`. The original Steam file is BSON and its decoder is provided by PyMongo.

Build the Go installer in `installer/` for Windows/amd64 as `work/Kestrel-Setup.exe` and for the test host as `work/test-setup`. Run `python package.py`. The shipped file hashes and the exact asset commit are under `qa/`.

The checks in `verify_release.py` accept `network`, `routes`, or `saves`. `blender -b --python-exit-code 1 --python verify_elevation.py` checks the final visible meshes. `python verify_installer.py` exercises the zipped payload and verifies installed copies.
