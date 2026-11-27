# Kestrel Lunar Base · Station Plan R3

ITS18 Data Harvest, 48 × 48 inches. The research biosphere, command observatory, preparation hall and algae lab share a pressure wing. The service hall turns toward the infirmary and crew berths. Both the flight apron and the photovoltaic court have dedicated working areas and separate access.

The native R3 Stage bag is under `assets/tts/kestrel-station-plan-r3/Stage-Bag.json`. Its custom model, collider and diffuse URLs use immutable asset commits. The ready-to-play installer packages the same map on the R2 play table.

## Rebuild

Use the parent R1 pipeline and its R2 directory to populate the source caches, the R2 bag and room, the original grade lattice, and the source render. The Python tooling uses Pillow, NumPy, SciPy, Shapely and Lupa with Lua 5.2. Blender renders the same native models from both saves.

Run these commands from the R3 directory. Publish the assets as one commit and pass its SHA to the save builder. For the checked release, the asset pin is recorded in `qa/asset-pin.txt`.

```sh
mkdir -p assets work dist
python hardware.py
python sills.py
python surface.py mesh
python surface.py art
python build_station.py "$(cat qa/asset-pin.txt)"
cp qa/asset-pin.txt work/asset-pin.txt
python validate.py
python check_public.py
python check_dependencies.py
python check_save.py
python preview.py
blender -b -P work/blender-r3.py
(cd installer && GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -o ../work/Kestrel-Setup.exe .)
(cd installer && go build -trimpath -o ../work/test-setup .)
python package.py
python check_installer.py
```

The geometry checks compare the visual terrain to its collider, trace clear deck seams, measure the two opposing-hatch crossings and check access to all three original objectives with two base sizes. The save checks run the original Stage, 180° rotation and clearing scripts with simulated TTS objects. The installer check uses a disposable save directory.
