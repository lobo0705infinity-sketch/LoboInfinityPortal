# Kestrel Lunar Base — Sample Station R1

Data Harvest playtest. The separate Stage bag in this branch is the same object installed with the play table. The full table uses the current order panel and the two on-demand sideboard launchers. Fourteen additional terrain pieces sit among the original lunar facilities.

From this directory, Python 3 with NumPy, SciPy, Shapely, Pillow, Matplotlib and Lupa (Lua 5.2) can reassemble and test the table.

```sh
python src/bootstrap.py
python src/base.py
python src/survey.py
python src/assemble.py "$(cat work/asset-pin.txt)"
python src/check_geometry.py
python src/verify_save.py
```

The OBJ and JPG files in `assets/tts/kestrel-sample-station-r1/` are pinned to the first playtest commit. To edit the art, use `model.py`, `commons.py`, `materials.py` (including `tint_hulls()`), and `surface.py`. Locations and the two pressure links are in `station.py`.

For a new preview, install UnityPy and Blender, run `python src/extract_objective.py` and `python src/render.py`, then `blender -b -P src/blender_scene.py`. Build the Windows setup from the Go source in `installer/` to `work/Kestrel-Setup.exe`. Running `python src/playtest_package.py` produces the new playtest installer and contact sheet.

The geometry report samples perimeter lanes 1.5 inches above grade, checks access from both deployment zones to all three Tech-Coffins, and measures door clearance at four heights.
