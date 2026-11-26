# Cairnfall Sanctuary Courtyards R3

This playtest revises the Gardeners Workshop in the general ITS18 Battleground bag, Top 40 Losers Round 4 bag and deployed play table. Geometry uses the original building atlas and the TTS Y-up coordinate system, in table inches.

1. Run `python prepare_sources.py` for the pinned R2 saves and original model assets.
2. Run `python workshop.py`, then publish the four files from `assets` in `assets/tts/cairnfall-workshop-roof-r3/`.
3. Run `python package_table.py ASSET_SHA` with the 40-character commit that serves the four files.
4. Render the comparison and table thumbnail with `blender -b -P render.py -- overview roof-before roof-after`.
5. In `installer`, build with `GOOS=windows GOARCH=amd64 go build -trimpath -buildvcs=false -ldflags="-s -w" -o ../../qa/Cairnfall-Setup.exe .`. Run `python make_installer.py` to assemble the ZIP.

The roof sheet, its seams, and its solid wedge have been removed. The roof landing is part of the closed state. The ladder is attached to the exterior wall in both states. Its handrails have 30.2 mm of clearance and the parapet opening is 39.6 mm wide. The stone perimeter uses mitered joints and the rainwater pipe faces the potting yard.
