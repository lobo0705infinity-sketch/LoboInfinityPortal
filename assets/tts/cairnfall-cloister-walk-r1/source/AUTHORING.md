# Cairnfall Sanctuary, Cloister Walk R1

The general Battleground Stage bag and Top 40 Losers Round 4 bag retain their individual map identities. Both deploy the same physical layout. The ready room uses the general map.

## Rebuild

Use Python with Pillow, NumPy, SciPy and Shapely. The model coordinates in the source are tabletop inches. The artwork uses DejaVu and Lato fonts on Linux. Run the following from the directory containing this file.

1. Run `python prepare_sources.py` to download the pinned upstream maps, room template and materials.
2. Run `python materials.py`, `python paving.py`, `python crafts.py` and `python architecture.py`, in order.
3. Publish the runtime files from the generated assets directory. The two files beginning with `receiving-canopy` are intermediate geometry combined into the clinic roof state.
4. Run `python package_table.py ASSET_COMMIT_SHA` with the full Git commit that hosts those files. The general Stage save, Top 40 Stage save and ready room are generated in the release directory.
5. Run `blender -b -P render.py -- overview herbs clinic gate` to render the review images from the actual models. The clinic detail view isolates the clinic and terrace. The overview shows all terrain.
6. From `installer/`, build the Windows setup program with `GOOS=windows GOARCH=amd64 go build -trimpath -o ../../qa/Cairnfall-Setup.exe .`. Run `python make_installer.py` in the parent source directory to write the thumbnail, review sheet and ZIP.

The original active and alternate building GUIDs, private floor control, foliage states, Stage placements, mission links and sideboard launchers are preserved. The new permanent equipment and the state-specific canopy have separate collision geometry.
