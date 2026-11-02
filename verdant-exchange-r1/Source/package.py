"""Create the standalone, main-Saved-Objects installer and integrity manifest."""
from pathlib import Path
import json,hashlib,zipfile,shutil,importlib.metadata
ROOT=Path(__file__).resolve().parents[1]
shutil.copy2(ROOT/'Previews/Verdant-Exchange-Overview.png',ROOT/'Map-Bags/Verdant-Exchange-Uplink-Center-R1.png')
manifest=[]
for p in sorted((ROOT/'Map-Bags').iterdir()):
 manifest.append({'path':str(p.relative_to(ROOT)).replace('/','\\'),'sha256':hashlib.sha256(p.read_bytes()).hexdigest().upper()})
(ROOT/'Install-Manifest.json').write_text(json.dumps(manifest,indent=2))
(ROOT/'START-HERE.txt').write_text('''VERDANT EXCHANGE R1 — UPLINK CENTER
Standalone map installer / review build

1. Extract this ZIP into a fresh folder.
2. Run Install.cmd. It places the JSON and matching thumbnail directly in:
   Documents\\My Games\\Tabletop Simulator\\Saves\\Saved Objects
   Existing same-name files are backed up before replacement.
3. In TTS, open Objects > Saved Objects and select:
   Verdant-Exchange-Uplink-Center-R1
4. Drop its bag on STAGE > DROP BAGS HERE in the normal Infinity mod.

For a custom installation location, drag the Tabletop Simulator folder onto
Install.cmd, or pass that folder as its first argument.

59 root components; 14 buildings; 18 alternate interior states; four glazed
conservatories; two covered service walkways; furnished labs; seed vaults;
nutrient tanks; cabinets; irrigation equipment and planted beds.

48 x 48 inches, 300 points. Uplink Center has 16-inch deployment zones from
opposite X edges. Antennas: (0,-12) and (0,+12). Tech-Coffin: (0,0).
All three objectives have 40 mm bases. Coordinates are in inches.

The right-side Map Controls drawer starts open. It provides independent
DZ / DZ +4 / DZ +8 guides, Booty, Metachemistry, per-player mission tabs,
Day / Night / Background Off. Grid and snapping start off.

Building states: 1 roof on; 2 interior or upper floor exposed; 3 ground floor
exposed on two-storey buildings. Glazing follows the greenhouse state.
Exterior ladders remain attached. Hover tooltips show each state's height.
Use normal Infinity terrain rules and the modeled geometry. Planting does
not add a special Difficult Terrain rule. Clear Table removes alternate
states and parked glazing and restores the previous background and lighting.

This package installs one Saved Object. It does not publish or replace the
complete Steam Workshop collection, or release an event round assignment.
The previews were rendered from the exact exported geometry, not concept art.
Models and textures are pinned to an immutable hosted asset revision.

Automated geometry, route, controls, UI-lifecycle, deployment and cleanup
checks passed. Live TTS physics and multiplayer playtesting remain unverified.

Source and validation reports are in Source/. Rebuild instructions: REBUILD.txt.
''')
(ROOT/'REBUILD.txt').write_text('''REBUILD VERDANT EXCHANGE
Use Python 3. Install packages in Source/requirements.txt.
From this extracted package:
  python Source/build_map.py ASSET_COMMIT
  python Source/validate_geometry.py
  python Source/test_controls.py
  python Source/test_lifecycle.py
  python Source/test_stage.py
  python Source/render.py
  python Source/package.py
The immutable asset revision is in Source/asset-revision.txt.
Models use inches, Y up. OBJ X handedness is converted on export for TTS.
Pyrender previews use EGL; tests also need liblua5.4.so.0 for the stage harness.
The source reference bag supplies only established controls and bag metadata;
every active terrain model and objective in Verdant Exchange is newly exported.
''')
packages=['numpy','trimesh','pyrender','Pillow','shapely','lupa']
(ROOT/'Source/requirements.txt').write_text('\n'.join(p+'=='+importlib.metadata.version(p)for p in packages)+'\n')
# An installer dry run checks exact filenames, integrity, reinstallation and
# backups. The PowerShell launcher itself has not been run on Windows here.
import tempfile
with tempfile.TemporaryDirectory() as tmp:
 saved=Path(tmp)/'Saves'/'Saved Objects';saved.mkdir(parents=True)
 backup=Path(tmp)/'backup';backup.mkdir()
 for run in range(2):
  for e in manifest:
   src=ROOT/Path(e['path'].replace('\\','/'));dest=saved/src.name
   assert hashlib.sha256(src.read_bytes()).hexdigest().upper()==e['sha256']
   if dest.exists():shutil.copy2(dest,backup/dest.name)
   shutil.copy2(src,dest)
   assert hashlib.sha256(dest.read_bytes()).hexdigest().upper()==e['sha256']
 assert len(list(saved.iterdir()))==2 and len(list(backup.iterdir()))==2
(ROOT/'Source/installer-validation.json').write_text(json.dumps({'status':'passed','main_saved_objects_destination':True,'manifest_and_payload_hashes':'passed','fresh_install_and_reinstall_dry_run':'passed','backup_dry_run':'passed','PowerShell_executed_on_Windows':False},indent=2))
hashes=[]
for p in sorted(ROOT.rglob('*')):
 if p.is_file() and '__pycache__'not in str(p) and p.name!='SHA256.txt':hashes.append(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.relative_to(ROOT).as_posix())
(ROOT/'SHA256.txt').write_text('\n'.join(hashes)+'\n')
out=ROOT.parent/'Verdant-Exchange-Uplink-Center-Installer.zip'
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(ROOT.rglob('*')):
  if p.is_file() and '__pycache__'not in str(p):z.write(p,p.relative_to(ROOT))
with zipfile.ZipFile(out) as z:assert z.testzip()is None
print(json.dumps({'zip':str(out),'bytes':out.stat().st_size,'installed_payload_files':len(manifest)}))
