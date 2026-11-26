from pathlib import Path
import shutil,hashlib,zipfile,json,subprocess,sys
r=Path(__file__).resolve().parent;bundle=r/'bundle';d=r/'delivery';files=['Workshop-Save.json','Play-Table.json','Azure-Palace.json','Azure-Palace-Scatter.json','Preview.png']
subprocess.run([sys.executable,str(r/'Source/validate_models.py')],check=True)
with zipfile.ZipFile(bundle/'Files/payload.zip','w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 manifest={}
 for name in files:
  path=r/'Release'/name;z.write(path,name);manifest[name]=hashlib.sha256(path.read_bytes()).hexdigest()
 z.writestr('manifest.json',json.dumps(manifest,sort_keys=True,indent=2))
(bundle/'Readme.txt').write_bytes("""AZURE PALACE R8
Crossing Lines | Lobo Infinity Maps

1. Extract this ZIP.
2. Double-click Install.cmd.
3. In Tabletop Simulator, choose Games > Save & Load and open
   Azure Palace R8 - Crossing Lines - Play Table.

The installer adds two new numbered saves. The play table opens with the resort
already in place. The second save, Lobo Maps - Azure Palace R8 - Workshop
Review, includes the map collection and deploys Azure Palace on first open.
Both Crossing Lines objectives use the approved Micro Art Studio 40 mm console.
The baggage buggy, pool loungers, restaurant table dolly and housekeeping cart
are already on the board. Separate copies are in the optional resort furniture
bag under Objects > Saved Objects.

The collection includes the R7 board-edge corrections. Azure Palace and Veyra
Gate have separate Crossing Lines entries.

Use the building state menu to open each furnished floor. State 1 is the ground
floor. The highest state shows the roof.

For a custom installation path, drag your Tabletop Simulator data folder or
its Saves folder onto Install.cmd. The installer opens the existing Workshop
page after adding the saves. Publishing a reviewed save is a separate action
in Tabletop Simulator.
""".replace('\n','\r\n').encode())
out=d/'Lobo-Azure-Palace-Workshop-Installer-R8.zip'
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in ['Install.cmd','Lobo-Azure-Palace-Setup.exe','Readme.txt','Files/payload.zip']:
  z.write(bundle/p,p,compress_type=zipfile.ZIP_STORED if p.endswith('.zip') else zipfile.ZIP_DEFLATED)
print(out,out.stat().st_size)
