from pathlib import Path
import json,zipfile,hashlib,shutil
R=Path(__file__).resolve().parent;O=R/'five-release';A=R/'five-portal/lobo-infinity-portal';P=A/'public/assets/maps/approved-five-map-update-20261102-r1'
for name in ['build_five.py','normalize_five.py','normalize_grid_ids.py','validate_five.py','verify_halcyon_assets.py','render_halcyon_approved.py','prepare_five_portal.py','package_five.py','reconcile_kestrel.py']:shutil.copy2(R/name,O/'Source'/name)
manifest=[dict(path=p.relative_to(O).as_posix(),sha256=hashlib.sha256(p.read_bytes()).hexdigest().upper())for folder in ['Files','Saved-Objects']for p in sorted((O/folder).iterdir())if not p.name.startswith('Lobos Top 40 Kestrel Lunar Base - Data Harvest')];assert len(manifest)==46;(O/'Install-Manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
paths=sorted(p for p in O.rglob('*')if p.is_file()and not p.name.startswith('Lobos Top 40 Kestrel Lunar Base - Data Harvest')and p.name!='SHA256SUMS.txt'and '__pycache__'not in str(p)and not(p.parent.name=='Previews'and (p.suffix=='.png' or p.name.endswith('-overhead.webp'))))
(O/'SHA256SUMS.txt').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.relative_to(O).as_posix()+'\n'for p in paths));dest=R/'output/Lobo-Five-Map-Workshop-Update-Installer.zip';dest.parent.mkdir(exist_ok=True)
with zipfile.ZipFile(dest,'w',zipfile.ZIP_DEFLATED,9)as z:
 for p in paths+[O/'SHA256SUMS.txt']:z.write(p,p.relative_to(O).as_posix())
with zipfile.ZipFile(dest)as z:
 assert z.testzip()is None
 for line in z.read('SHA256SUMS.txt').decode().splitlines():
  h,p=line.split('  ',1);assert hashlib.sha256(z.read(p)).hexdigest()==h,p
 for row in json.loads(z.read('Install-Manifest.json')):assert hashlib.sha256(z.read(row['path'])).hexdigest().upper()==row['sha256']
shutil.copy2(dest,P/dest.name)
sources=A/'scripts/map-releases/five-map-update-20261102';sources.mkdir(parents=True,exist_ok=True)
for name in ['build_five.py','normalize_five.py','normalize_grid_ids.py','validate_five.py','verify_halcyon_assets.py','render_halcyon_approved.py','prepare_five_portal.py','package_five.py','reconcile_kestrel.py']:shutil.copy2(R/name,sources/name)
print(json.dumps(dict(archive=str(dest.resolve()),bytes=dest.stat().st_size,sha256=hashlib.sha256(dest.read_bytes()).hexdigest(),crcAndAllHashesVerified=True)))
