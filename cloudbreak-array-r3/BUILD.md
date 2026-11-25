# Rebuilding Cloudbreak Array R3

The public saved object is `Cloudbreak-Array.json`. It contains the entire staged district, the standard controls, the mission and the geometry URLs. The installer also carries the deployed table and the full Workshop collection.

## Inputs

Keep this directory alongside `cloudbreak-array-r2` (or a local copy named `r2`). Prepare the R2 base, control tests, console render assets and derived arrangement as described in its BUILD.md. Extract the three R2 save JSONs into the R2 `out` directory. Use Python with NumPy, SciPy, Shapely, Pillow, VTK, trimesh, embreex, rtree, and lupa. For the review renders use Blender 4.3 and Open Sans. Go builds the installer.

## Build and check

1. Create `assets`, `work`, and `out` here. Run `python src/airframes.py`, `python src/high_clouds.py`, `python src/glasshouse.py`, and then `python src/editable_clouds.py`. The last step fits the clickable convex hull to each visible cloud style.
2. Run `python src/sightlines.py` to measure previously clear views from the R2 rooftops. The authored placement is in `work/airspace.json`. Run `python src/sky_placement.py` to regenerate it from the same meshes and placements.
3. Publish the assets and record the immutable asset commit in `work/assets-commit.txt`. Pass the SHA to `python src/release.py` to build all three saves.
4. Run `python src/check_sightlines.py`, `python src/verify_changes.py`, `python src/verify_host.py` and the sibling R2 `standard/validate_release.py` against `out/Workshop-Save.json`. The cloud regression exercises selection geometry, local visibility guides, moves, rotation, deletion, duplication and save/reload.
5. Render each camera with `blender -b --python src/render_shots.py -- MODE` for `roofs`, `detail-green`, `plan`, `eye0` and `eye1`. Then run `python src/sightline_sheet.py`. The two perspective cameras use the actual origin and destination of their rays.
6. In `src/installer`, build the windows/amd64 Go executable into `work/Lobo-Cloudbreak-Array-Setup.exe` and the native Linux executable into `work/install-test`. Run `python src/zip_r3.py` and `python src/verify_install.py` to package and exercise the final ZIP. The Windows installer opens the Workshop listing and installs both saves and the standalone setup bag.

The starts of the 23 visibility volumes and the five airships are recorded in the staged save. Every editable cloud owns its guide in local coordinates, and the map finds live clouds by their map tag. The standard Map Controls broker comes from the previous release.
