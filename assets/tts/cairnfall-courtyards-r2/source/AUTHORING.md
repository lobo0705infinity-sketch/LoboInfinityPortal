# Cairnfall Sanctuary, Courtyards R2

The general ITS18 Battleground bag and the Top 40 Losers Round 4 bag carry the same layout. Their independent object IDs and mission bindings are preserved.

Run the Python scripts from this source directory with NumPy, Pillow, SciPy and Shapely installed. The artwork uses DejaVu and Lato fonts.

1. Run `python prepare_sources.py` to retrieve the immutable R1 inputs and their original hosted materials.
2. Run `python finishes.py`, `python fittings.py`, `python roofs.py`, and `python grounds.py`. Publish the generated assets directory under the path in `package_table.py`.
3. Run `python package_table.py ASSET_COMMIT_SHA` with the full public Git commit for the assets. This writes the standalone ready room and both Stage bags.
4. Run `blender -b -P render.py -- overview laundry refectory clinic-roof archive-roof shrine`. The overview includes the whole table. Detail views isolate the pictured objects.
5. From the installer directory, run `GOOS=windows GOARCH=amd64 go build -buildvcs=false -trimpath -o ../../qa/Cairnfall-Setup.exe .`. Run `python make_installer.py` in the source directory to build the Windows review ZIP and its thumbnails.

The two rooftop planters are transformed from their original deployed poses into the local coordinates of their supporting roof models and colliders. The ladder and its mounts are removed from both Archive upper states. Existing convex building hulls are combined only when their convex union has the same occupied volume as the two input hulls, accounting for any overlap.
