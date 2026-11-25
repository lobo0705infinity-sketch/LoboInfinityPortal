from pathlib import Path
import json,zipfile,io,hashlib
from validate_release import validate
ROOT=Path(__file__).resolve().parent
REPO=ROOT.parent
APP=REPO/'lobo-infinity-portal'
current=json.loads((APP/'shared/lobo-workshop-current.json').read_text())
installer=APP/'public'/current['installer'].lstrip('/')
with zipfile.ZipFile(installer)as outer:
 if 'Files/payload.zip' in outer.namelist():
  payload=outer.read('Files/payload.zip')
 else:
  manifest=json.loads(outer.read('Files/download-manifest.json'))
  assert manifest['parts'] and all(Path(name).name==name for name in manifest['parts'])
  payload=b''.join((installer.parent/name).read_bytes() for name in manifest['parts'])
  assert hashlib.sha256(payload).hexdigest()==manifest['sha256'],'Installer download integrity'
 with zipfile.ZipFile(io.BytesIO(payload))as inner:
  out=ROOT/'output';out.mkdir(exist_ok=True)
  (out/'Workshop-Save.json').write_bytes(inner.read('Workshop-Save.json'))
from patch_maps import bags
from upgrade_mission_links import REVISION
collection = json.loads((out/'Workshop-Save.json').read_bytes())
by_guid = {bag['GUID']:bag for bag in bags(collection)}
inventory = json.loads((APP/'public'/current['releaseInventory'].lstrip('/')).read_bytes())
assert inventory['revision']==REVISION
assert validate(out/'Workshop-Save.json')['maps']==len(inventory['maps'])==len(by_guid)
assert set(by_guid)=={row['guid'] for row in inventory['maps']}
for row in inventory['maps'] + inventory.get('standalone',[]):
 path=APP/'public'/row['download'].lstrip('/')
 assert validate(path)['maps']==1
 raw=path.read_bytes()
 assert hashlib.sha256(raw).hexdigest()==row['sha256'],row['download']
 if row in inventory['maps']:
  assert json.loads(raw)['ObjectStates']==[by_guid[row['guid']]],row['guid']
print(f"All {len(by_guid)} Workshop setups and {len(inventory.get('standalone',[]))} standalone exports validated.")

# Newly changed standalone map saves must also use this standard, even before
# someone adds them to the main catalog.
import os,subprocess
base=os.environ.get('LOBO_BASE_SHA','')
if base and set(base)!={'0'}:
 changed=subprocess.check_output(['git','diff','--name-only',base,'HEAD'],cwd=REPO,text=True).splitlines()
 for name in changed:
  path=REPO/name
  if '/assets/maps/'not in name or not path.is_file():continue
  if path.suffix=='.json':
   data=json.loads(path.read_text())
   if isinstance(data,dict)and 'ObjectStates'in data:
    from patch_maps import bags
    if list(bags(data)):validate(path)
print('Changed standalone map releases validated.')
