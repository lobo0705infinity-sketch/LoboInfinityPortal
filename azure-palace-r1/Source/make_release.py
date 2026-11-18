from pathlib import Path
import hashlib,json,zipfile,shutil,subprocess,os
R=Path(__file__).resolve().parents[1];release=R/'Release';bundle=release/'Lobo-Azure-Palace-Workshop-Installer-R1';(bundle/'Files').mkdir(parents=True,exist_ok=True)
files={n:(release/n).read_bytes()for n in ['Workshop-Save.json','Play-Table.json','Azure-Palace.json','Azure-Palace-Scatter.json']};files['Preview.png']=(R/'Review/Azure-Palace-overview.png').read_bytes();manifest={n:hashlib.sha256(b).hexdigest()for n,b in files.items()}
with zipfile.ZipFile(bundle/'Files/payload.zip','w',zipfile.ZIP_DEFLATED,9)as z:
 for n,b in files.items():z.writestr(n,b)
 z.writestr('manifest.json',json.dumps(manifest,indent=2))
installer=R/'Source/installer';env=os.environ.copy();env.update(GOOS='windows',GOARCH='amd64',CGO_ENABLED='0');subprocess.run(['go','build','-trimpath','-ldflags=-s -w','-o',str(bundle/'Lobo-Azure-Palace-Setup.exe'),'.'],cwd=installer,env=env,check=True)
subprocess.run(['go','build','-o',str(release/'azure-installer-linux'),'.'],cwd=installer,check=True)
(bundle/'INSTALL-AZURE-PALACE.cmd').write_bytes(b'@echo off\r\ncd /d "%~dp0"\r\n"%~dp0Lobo-Azure-Palace-Setup.exe" %*\r\n')
readme='''AZURE PALACE R1 - CROSSING LINES REVIEW BUILD
November 18, 2026

INSTALL
1. Extract this entire ZIP into a new folder.
2. Run INSTALL-AZURE-PALACE.cmd. No PowerShell is required.
3. In TTS, Games > Save & Load > Azure Palace R1 - Crossing Lines Review.
   The resort is already deployed on the normal play table.
4. The second new save, Lobo Maps - Azure Palace Workshop Review R1,
   retains the complete 105-map collection and replaces its Veyra Gate entry.
   It requests Azure Palace deployment through the existing stage on first load.
5. Review the map in TTS. When ready, use Update Workshop > 3719263238.

The installer creates new numbered saves and preserves existing saves.
It opens the existing Workshop page in your browser. It does not publish to Steam.
For a custom TTS location, drag the data folder onto INSTALL-AZURE-PALACE.cmd.
Assets use public HTTPS URLs pinned to an immutable source commit.

INCLUDED
- Twelve furnished buildings, with two three-storey hotel wings in midfield.
- Ground and upper-floor states, rooftop access and attached raised signs.
- A 48-inch board with a 3-inch raised platform and recessed dry pool.
- Four stair exits from the pool and a solid planted island.
- All eight approved scatter designs: luggage trolley, limestone planter,
  bronze sculpture, linen cart, pool maintenance unit, stacked loungers,
  pool bar cart and damaged shade screen.
- A separate optional scatter bag with one copy of each design.
- Two antenna objectives in the existing Crossing Lines positions.
- The exact canonical Map Controls panel, including Turn 180, independent
  rainbow DZ and Exclusion colors, Mission, Grid, scoring and Day/Night/Off.

REVIEW STATUS
Concept and scatter direction approved. This is the first playable review build.
Preview images in this package render the exported 3D geometry; the approved
concept sheet is included separately for comparison.
Offline tests check mesh/collider limits, closed collision pieces, open doors,
roof support, all four pool stair exits, Lua compilation, rendered control
buttons, rotation, independent zone colors and preservation of other maps.
The installer is cross-compiled for Windows; its file-write logic is tested on
Linux with pre-existing saves. Windows execution, live TTS loading, physics,
fresh-cache multiplayer and performance timings remain untested.
No Steam publication or portal replacement has been performed.
'''
(bundle/'README.txt').write_text(readme)
for name in ['Azure-Palace-overview.png','Azure-Palace-scatter.png','Approved-Scatter-Concept.png','geometry-validation.json','hosted-asset-validation.json','control-validation.json']:
 if(R/'Review'/name).exists():
  (bundle/'Review').mkdir(exist_ok=True);shutil.copyfile(R/'Review'/name,bundle/'Review'/name)
shutil.copyfile(R.parent/'tts-map-controls-standard/STANDARD.md',bundle/'STANDARD.md')
out=release/'Lobo-Azure-Palace-Workshop-Installer-R1.zip'
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,9)as z:
 for p in sorted(bundle.rglob('*')):
  if p.is_file():z.write(p,p.relative_to(bundle))
print(out,round(out.stat().st_size/1024/1024,2),'MiB')
