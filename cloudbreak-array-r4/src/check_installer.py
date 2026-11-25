"""Exercise the same installer file-writing path against pre-existing and orphaned slots."""
from rooftops import *
from pack_installer import ZIPNAME
import hashlib
import tempfile,zipfile,subprocess,shutil
with tempfile.TemporaryDirectory(dir=WORK)as temp:
 root=Path(temp)/'Tabletop Simulator';saves=root/'Saves';saves.mkdir(parents=True);package=Path(temp)/'release';package.mkdir()
 with zipfile.ZipFile(OUT/ZIPNAME)as z:z.extractall(package)
 assert (package/'Lobo-Cloudbreak-Array-Setup.exe').read_bytes()[:2]==b'MZ'
 assert 'Lobo-Cloudbreak-Array-Setup.exe' in (package/'INSTALL-CLOUDBREAK-ARRAY.cmd').read_text()
 assert (package/'Network Node - MissionGeist.url').read_text().splitlines()==['[InternetShortcut]','URL='+MISSION_URL]
 payload=package/'Files/payload.zip'
 with zipfile.ZipFile(payload)as zz:
  expected=json.loads(zz.read('manifest.json'))
  for name,h in expected.items():assert hashlib.sha256(zz.read(name)).hexdigest()==h
 (saves/'TS_Save_1.json').write_text('keep prior save');(saves/'TS_Save_2.png').write_bytes(b'keep orphaned thumbnail')
 for target in (root,saves):
  subprocess.run([str(WORK/'install-test'),'-tts-root',str(target),'-payload',str(payload),'-no-browser','-no-pause'],check=True,capture_output=True)
 for i,n in enumerate(['Play-Table.json','Workshop-Save.json','Play-Table.json','Workshop-Save.json'],3):
  assert hashlib.sha256((saves/f'TS_Save_{i}.json').read_bytes()).hexdigest()==expected[n]
  assert hashlib.sha256((saves/f'TS_Save_{i}.png').read_bytes()).hexdigest()==expected['Preview.png']
 objs=list((saves/'Saved Objects').rglob('*.json'));assert len(objs)==2
 for ob in objs:assert hashlib.sha256(ob.read_bytes()).hexdigest()==expected['Cloudbreak-Array.json'] and ob.with_suffix('.png').exists()
 assert (saves/'TS_Save_1.json').read_text()=='keep prior save' and (saves/'TS_Save_2.png').read_bytes()==b'keep orphaned thumbnail'
 # A mismatched package must stop before writing any slot.
 with zipfile.ZipFile(payload)as z, zipfile.ZipFile(Path(temp)/'damaged.zip','w',compression=zipfile.ZIP_DEFLATED,compresslevel=1)as zz:
  for name in z.namelist():zz.writestr(name,b'corrupted' if name=='Preview.png' else z.read(name))
 rr=subprocess.run([str(WORK/'install-test'),'-tts-root',str(root),'-payload',str(Path(temp)/'damaged.zip'),'-no-browser','-no-pause'],capture_output=True)
 assert rr.returncode!=0 and not (saves/'TS_Save_7.json').exists()
 print('Two installs verified, no save or thumbnail overwritten, four correct new saves, two saved bags, damaged package rejected.')
