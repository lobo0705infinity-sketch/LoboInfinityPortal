# Kestrel Lunar Base — Sample Station R2

This Data Harvest playtest starts from the pinned R1 room and Stage bag. Four matching ground quadrants carry the station and its outcrops. The former basins are level. The crew maintenance apron and sample cartway are graded directly into the surface.

Run the R1 build in the parent directory to prepare the source bag, room and asset cache. Save its pinned native map layout as `../data/layout.json` from `lobo-infinity-portal/public/assets/maps/kestrel-lunar-20261102-r13/layout.json` at base commit `732fc9377335d0c626b7a00e2f586014162cd229`.

From this directory, run:

```sh
python station_art.py
python cartway.py
python ground.py
python assemble_r2.py a02de7763ccb9573e6c445943d9a4c7438da1f39
python verify_ground.py
```

The finished OBJ/texture set is available under `assets/tts/kestrel-sample-station-r2/` at that same asset commit. To run the save validation, place the commit ID in `work/asset-pin.txt` and its published asset checksums from `qa/public-assets.json` in `work/public-qa.json`, then run `python verify_save_r2.py`.

Use the parent UnityPy objective export, then run `python render_r2.py` and `blender -b -P work/blender-r2.py`. Build the Go installer in `installer/` to `work/Kestrel-Setup.exe` for Windows and, for the disposable-folder installer test, to `work/test-setup` on Linux. Run `python package_r2.py` and `python verify_installer.py`.

`qa/geometry.json` covers the four quadrants, former crater footprints, collision/visible agreement, edge sightlines, doorway clearances and base contact with all three objectives. `qa/save.json` covers stateful fittings and the original table scripts.
