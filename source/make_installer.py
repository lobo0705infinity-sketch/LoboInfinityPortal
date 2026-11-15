"""Package only referenced cache payloads, preserving the full collection."""
import hashlib,json,re,shutil,zipfile
from pathlib import Path
from audit_assets import ROOT,bags,walk
OUT=ROOT/'installer-r12';OUT.mkdir(exist_ok=True);(OUT/'Assets').mkdir(exist_ok=True)
def hashfile(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def cache_name(u):
 a,ext=u.rsplit('.',1);return re.sub('[^A-Za-z0-9]','',a)+'.'+ext
def urls(d):
 result=set()
 for root in d:
  for o in walk(root):
   for cm in [o.get('CustomMesh',{}),o.get('CustomImage',{}),o.get('CustomAssetbundle',{})]:
    for k,u in cm.items():
     if isinstance(u,str) and u.startswith('https:') and u.rsplit('.',1)[-1] in ['obj','jpg','png']:result.add(u)
 return result
def main():
 source=ROOT/'release-r12/Clash-of-Empires-Workshop-Release.json';data=json.loads(source.read_text());allurls=urls(data['ObjectStates']);required=urls(bags(data))
 known=json.loads((ROOT/'asset-manifest.json').read_text());cachelookup={}
 # Existing cache manifests keep the other battles' already supplied assets.
 for p in (ROOT/'release-r11').glob('*Cache.json'):
  d=json.loads(p.read_text(encoding='utf-8-sig'));entries=d if isinstance(d,list) else [e for a in d.values() if isinstance(a,list) for e in a]
  for e in entries:
   if not isinstance(e,dict) or not e.get('file'):continue
   matches=[f for f in (ROOT/'release-r11').rglob(e['file']) if f.is_file()]
   matches=[f for f in matches if hashfile(f)==e.get('sha256')]
   if matches:cachelookup[e.get('cache',e.get('cache_name'))]=matches[0]
 assets=[];missing=[];used=set()
 for u in sorted(allurls):
  if '/original13/' in u:p=ROOT/'original13-assets'/u.split('/')[-1]
  elif u in known:p=Path(known[u])
  else:p=cachelookup.get(cache_name(u))
  if not p or not p.exists():missing.append(u);continue
  digest=hashfile(p);fn=digest+'.'+u.rsplit('.',1)[-1];dest=OUT/'Assets'/fn
  if fn not in used:shutil.copyfile(p,dest);used.add(fn)
  assets.append({'url':u,'file':fn,'cache':cache_name(u),'sha256':digest})
 assert not required.intersection(missing),required.intersection(missing)
 assert len({a['cache'] for a in assets})==len(assets)
 for p in (OUT/'Assets').iterdir():
  if p.name not in used:p.unlink()
 for fn in ['Clash-of-Empires-Workshop-Release.json','Workshop-Thumbnail.png']:shutil.copyfile(ROOT/'release-r12'/fn,OUT/fn)
 (OUT/'Install-Clash-of-Empires.ps1').write_text((ROOT/'installer-r12.ps1').read_text(),encoding='utf-8-sig',newline='\r\n')
 shutil.copyfile(ROOT/'release-r11/Install-Clash-of-Empires.cmd',OUT/'Install-Clash-of-Empires.cmd')
 (OUT/'Asset-Cache.json').write_text(json.dumps({'revision':'R12','save_sha256':hashfile(source),'assets':assets,'on_demand_assets':missing},indent=2))
 notes=OUT/'Build-notes';notes.mkdir(exist_ok=True)
 if (ROOT/'Original13-Builder-Source.zip').exists():shutil.copyfile(ROOT/'Original13-Builder-Source.zip',notes/'Original13-Builder-Source.zip')
 for fn in ['original13-validation.json','original13-battle-audit.json','original13-models.json','original13-instances.json','public-asset-verification.json']:
  if (ROOT/fn).exists():shutil.copyfile(ROOT/fn,notes/fn)
 for fn in ['build_original13.py','package_original13.py','validate_original13.py','audit_assets.py','make_installer.py']:shutil.copyfile(ROOT/fn,notes/fn)
 if (ROOT/'AUDIT-R12.md').exists():shutil.copyfile(ROOT/'AUDIT-R12.md',OUT/'AUDIT-R12.md')
 for fn in ['full-0.png','full-1.png','conditions.png']:shutil.copyfile(ROOT/'renders'/fn,notes/fn)
 (OUT/'README-FIRST.txt').write_text('''Clash of Empires - Full Collection R12 - Original 13 Audit

1. Close Tabletop Simulator and extract the entire ZIP.
2. Run Install-Clash-of-Empires.cmd.
3. Open Games > Save & Load > Clash of Empires - Full Collection R12 - Original 13 Audit.
4. Select a battle in the collection and click Load Battle.

The installer adds a new save slot and leaves existing saves in place.
For a nonstandard TTS location, run the installer with -TTSDataPath "D:\\Your TTS Folder".
All assets use public URLs. The included cache speeds up loading; other players can fetch the assets from those URLs.
The full collection still contains all 37 scenario bags. Load battles on demand.

Updated: Granicus, Zama, Gaugamela, Hydaspes, Issus, Cannae, Trebia,
Cynoscephalae, Raphia, Magnesia, Adrianople, Pharsalus and Teutoburg.
All alternate layouts are included: 16 layouts, 1,359 stands, 517 model states.
Commanders have name-only labels and Normal/Wounded states.
Elephants and chariots remain one model per base.
Hydaspes includes the 15 corrected Turn 2 reserve stands.

To publish: load this save and use Update Workshop on your existing entry.
GitHub publication does not itself update the Steam Workshop entry.

Validation: serialized saves, figure counts, mesh/terrain geometry, deployment
collisions, visual renders and public asset hashes are checked. Live TTS
behavior and the Windows installer have not been tested in this workspace.
See AUDIT-R12.md and Build-notes for results.
''')
 if any('PENDING' in a['url'] for a in assets):print('DRAFT package; public commit not assigned');return
 z=ROOT/'Clash-of-Empires-Original-13-R12-Installer.zip'
 with zipfile.ZipFile(z,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
  for p in sorted(OUT.rglob('*')):
   if p.is_file():archive.write(p,p.relative_to(OUT))
 with zipfile.ZipFile(z) as archive:assert archive.testzip() is None
 print(json.dumps({'zip':str(z),'bytes':z.stat().st_size,'cache_entries':len(assets),'unique_payloads':len(used),'on_demand_assets':len(missing),'updated_battle_missing_payloads':0}))
if __name__=='__main__':main()
