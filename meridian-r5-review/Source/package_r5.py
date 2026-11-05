from pathlib import Path
import json,hashlib,zipfile
R=Path(__file__).resolve().parents[1];out=R.parents[1]/'output';out.mkdir(exist_ok=True)
for name in ['Meridian-R5-Local-Checks.json','Meridian-R5-Hosted-Assets.json','Meridian-R5-Controls-Checks.json']:
 d=json.loads((R/'Review'/name).read_text());assert d['status']=='Pass',name
excluded={'Install-Manifest.json','Source/upload-files.json','Review/old-customs-reference.png'}
files=[p for p in sorted(R.rglob('*'))if p.is_file()and'__pycache__'not in p.parts and str(p.relative_to(R))not in excluded]
manifest=[{'path':str(p.relative_to(R)).replace('\\','/'),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}for p in files]
(R/'Install-Manifest.json').write_text(json.dumps(manifest,indent=2))
path=out/'Meridian-Exchange-Critical-Intervention-R5-Review-Installer.zip'
with zipfile.ZipFile(path,'w',zipfile.ZIP_DEFLATED,compresslevel=6)as z:
 for p in files+[R/'Install-Manifest.json']:z.write(p,str(p.relative_to(R)))
with zipfile.ZipFile(path)as z:
 assert z.testzip()is None
 for r in manifest:assert hashlib.sha256(z.read(r['path'])).hexdigest()==r['sha256']
 assert 'Install.cmd'in z.namelist()and'Install.ps1'in z.namelist()
 objects=json.loads(z.read('SavedObjects/Lobos-Top-40-Losers-Round-8-Meridian-R5.json'))['ObjectStates'];assert len(objects)==1 and len(objects[0]['ContainedObjects'])==74
print(json.dumps({'file':str(path.resolve()),'bytes':path.stat().st_size,'files':len(files)+1,'zip_crc':'Pass','manifest_sha256':'Pass'},indent=2))
