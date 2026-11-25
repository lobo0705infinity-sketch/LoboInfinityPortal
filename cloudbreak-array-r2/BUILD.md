# Rebuilding Cloudbreak Array

The exported models, colliders, texture atlas and two spherical backgrounds live in `assets`. The saved object in `Cloudbreak-Array.json` uses immutable public asset URLs. The two table saves and the Windows installer are distributed together in the Workshop installer ZIP.

## Inputs

Place the three saves from the R1 installer's `Files/payload.zip` in `base/r1`. Run `python src/fetch_base.py` to fetch the R1 models and the shared control tests. The saved console template in `base` comes from the standard Infinity collection and includes its 40 mm base. The source bundle stays on its original public Steam host.

Python dependencies are Pillow, NumPy, SciPy, Shapely, UnityPy and lupa. The table previews use Blender 4.3. The Windows installer builds with Go 1.23 or later.

## Building

1. Run `python src/design.py` and `python src/clouds.py` to reproduce the floor arrangements and cloud placements.
2. Run `python src/build.py` to bake the fixtures and glass façades into the cumulative TTS states. The supplied atlas and panoramas are complete production textures.
3. After publishing the asset directory, put its immutable commit SHA in `work/assets-commit.txt` and pass that SHA to `python src/package.py`. The script updates the R1 standalone table, stage bag and collection.
4. Run `python src/verify_geometry.py`, `python src/verify_release.py`, `python src/verify_host.py` and `python standard/validate_release.py out/Workshop-Save.json` to check the saved geometry, routes, hosted assets and controls.
5. For previews, use `python src/render_console.py` followed by Blender in background mode with `--python src/render_table.py --` and each of `roofs`, `interiors`, `detail-green` and `detail-interior`. The background review is a projection of the two released sky textures in four directions.
6. Build the Go executable from `src/installer` for windows/amd64 into `work/Cloudbreak-Array-Setup.exe`. Build the native Linux test executable there as `work/install-test`. Run `python src/zip_release.py` and `python src/verify_install.py`.

The collection layout, stock tools and all 105 other setups come from the R1 Workshop save. The Lua stage manifest is generated from the same object transforms as the immediately playable save.
