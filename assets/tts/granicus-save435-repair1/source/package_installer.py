"""Package the repaired collection save and verified Granicus cache."""
import hashlib,json,re,shutil,zipfile
from pathlib import Path
R=Path(__file__).resolve().parent;out=R/'installer';assets=out/'Assets';assets.mkdir(exist_ok=True)
save=out/'Clash-of-Empires-Granicus-Arrian-435.json'
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
checks=json.loads((R/'public-asset-verification.json').read_text());entries=[]
for item in checks:
 u=item['url'];p=R/'verified-public-assets'/item['file'];assert digest(p)==item['sha256']
 ext=u.rsplit('.',1)[1];fn=item['sha256']+'.'+ext;shutil.copyfile(p,assets/fn)
 cache=re.sub('[^A-Za-z0-9]','',u.rsplit('.',1)[0])+'.'+ext
 entries.append({'url':u,'file':fn,'cache':cache,'sha256':item['sha256']})
assert len({x['cache'] for x in entries})==len(entries)
manifest={'revision':'SAVE435-GRANICUS-ARRIAN-REPAIR1','save_sha256':digest(save),'assets':entries,'scope':'Complete asset cache for Granicus — Arrian strengths only. Other battles retain their existing public URLs.'}
(out/'Asset-Cache.json').write_text(json.dumps(manifest,indent=2))
ps=(R/'reference-installer-r12.ps1').read_text()
ps=ps.replace('Clash-of-Empires-Workshop-Release.json',save.name)
ps=ps.replace("$manifest.revision -ne 'R12' -or @($manifest.assets).Count -lt 700",f"$manifest.revision -ne 'SAVE435-GRANICUS-ARRIAN-REPAIR1' -or @($manifest.assets).Count -ne {len(entries)}")
ps=ps.replace('Clash of Empires - Full Collection R12 - Original 13 Audit','Clash of Empires - Save 435 - Granicus Arrian Repair 1')
ps=ps.replace("Write-Host 'Open it in Games > Save & Load. Use Update Workshop to publish this save to your existing entry.'","Write-Host 'Open Games > Save & Load > Clash of Empires - Save 435 - Granicus Arrian Repair 1.'\nWrite-Host 'Select Granicus - Arrian strengths and click Load Battle.'")
(out/'Install-Clash-of-Empires.ps1').write_text(ps,encoding='utf-8-sig',newline='\r\n')
(out/'Install-Clash-of-Empires.cmd').write_text('@echo off\ncd /d "%~dp0"\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Clash-of-Empires.ps1" %*\nif errorlevel 1 (echo Installation failed. See the message above.)\npause\n',newline='\r\n')
with zipfile.ZipFile(R.parent/'status-download/Clash-of-Empires-Original-13-R12-Installer.zip') as z:(out/'Workshop-Thumbnail.png').write_bytes(z.read('Workshop-Thumbnail.png'))
(out/'README-FIRST.txt').write_text('''Clash of Empires - Save 435 - Granicus Arrian Repair 1

1. Close Tabletop Simulator and extract the entire ZIP.
2. Run Install-Clash-of-Empires.cmd.
3. Open Games > Save & Load > Clash of Empires - Save 435 - Granicus Arrian Repair 1.
4. Select Granicus - Arrian strengths and click Load Battle.

Load this NEW save to use the repaired figures. An already-open battle and
previously saved copies will still contain their old assets and labels.
The installer adds a new save slot; your original revision 435 stays intact.
For a nonstandard TTS location, run Install-Clash-of-Empires.cmd with
-TTSDataPath "D:\\Your TTS Folder".

REPAIRS
* Recovered the missing original casualty artwork and corrected texture
  mapping / lighting normals. No figure artwork was redrawn or replaced.
* Removed the duplicate flat label from all 85 stands and 249 states,
  including commanders. Existing standing labels remain.

This is the original supplied save 435 collection. Only Granicus - Arrian
strengths is repaired. All 36 other battle bags, roster, stats, deployment,
terrain and global rules are unchanged.

Every asset for this battle is included in the cache and also has a public
HTTPS URL. The save contains public URLs, never local paths, so other players
can download assets normally. Other battles use their original public assets.

VALIDATION
All 118 final battle assets downloaded successfully and passed file checks.
Original pixels and mesh geometry were compared, affected states rendered
from both sides, and all 249 figure scripts checked. The serialized save
diff was checked against the two requested repairs.

This is a release candidate: the Windows installer, live Tabletop Simulator
loading and multiplayer fresh-cache loading could not be exercised here.
The included previews are offline renders, not screenshots from TTS.

After reviewing it in TTS, use Update Workshop on your existing entry if
you want to publish it. This package has not updated Steam Workshop.
See Build-notes for verification records and repair sources.
''')
notes=out/'Build-notes';notes.mkdir(exist_ok=True)
for fn in ['save-validation.json','public-asset-verification.json','mesh-repair-manifest.json','atlas-repair-manifest.json','repaired-state-instances.json','matched-casualty-sources.json','original-casualty-state-references.json','asset-manifest.json','instance-manifest.json','download_assets.py','restore_atlases.py','repair_meshes.py','build_save.py','verify_public_assets.py','package_installer.py']:
 shutil.copyfile(R/fn,notes/fn)
for fn in ['greek-states-front.png','greek-states-back.png','rheomithres.png']:shutil.copyfile(R/'renders'/fn,notes/fn)
(notes/'REPRODUCE.txt').write_text('The original TS_Save_435.json is intentionally not overwritten or duplicated here. Extract the e90100 bag as battle-original.json, download its original assets with download_assets.py, obtain the original cas-NN-material.jpg sheets at the immutable source URLs in atlas-repair-manifest.json, run restore_atlases.py and repair_meshes.py, then build_save.py with the asset commit in save-validation.json. Source manifests record exact old/new URLs and all preservation checks. Installer/Assets contains every final battle asset, named by SHA256; Asset-Cache.json maps each to its public URL.\n')
zpath=R/'Clash-of-Empires-Granicus-Arrian-435-Repair-Installer.zip'
with zipfile.ZipFile(zpath,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(out.rglob('*')):
  if p.is_file():z.write(p,p.relative_to(out))
with zipfile.ZipFile(zpath) as z:
 assert z.testzip() is None
 assert json.loads(z.read(save.name))['SaveName']=='Clash of Empires - Save 435 - Granicus Arrian Repair 1'
 assert hashlib.sha256(z.read(save.name)).hexdigest()==manifest['save_sha256']
 for e in entries:assert hashlib.sha256(z.read('Assets/'+e['file'])).hexdigest()==e['sha256']
print(json.dumps({'zip':str(zpath),'bytes':zpath.stat().st_size,'sha256':digest(zpath),'cache_entries':len(entries),'cache_payloads':len(list(assets.iterdir())),'zip_integrity_passed':True},indent=2))
