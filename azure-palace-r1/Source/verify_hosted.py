from pathlib import Path
import urllib.request,json,re,hashlib,io
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
import trimesh
R=Path(__file__).resolve().parents[1];host=(R/'Source/asset-base.txt').read_text().strip();d=json.loads((R/'Release/Azure-Palace.json').read_text());urls=set()
def walk(o):
 yield o
 for q in o.get('ContainedObjects',[])+o.get('ChildObjects',[]):yield from walk(q)
 for q in o.get('States',{}).values():yield from walk(q)
for root in d['ObjectStates']:
 for o in walk(root):
  for k,u in o.get('CustomMesh',{}).items():
   if k.endswith('URL')and u:urls.add(u)
  s=o.get('LuaScript','');m=re.search(r'local config=JSON.decode\(\[==\[(.*?)\]==\]\)',s,re.S)
  if m:urls.update(v for k,v in json.loads(m[1]).get('background',{}).items()if k in ['day','night','off'])
def check(u):
 with urllib.request.urlopen(u,timeout=45)as r:
  assert r.status==200;(data:=r.read())
 local=R/'Assets'/u.rsplit('/',1)[-1]if u.startswith(host+'/')else None
 if local:assert data==local.read_bytes(),('Hosted bytes differ',u)
 if u.lower().endswith(('.jpg','.png','.jpeg')):
  im=Image.open(io.BytesIO(data));im.load();kind='image'
 elif u.lower().endswith('.obj'):
  m=trimesh.load(io.BytesIO(data),file_type='obj',force='mesh',process=False);assert len(m.vertices)>2 and len(m.faces)>0;kind='mesh'
 else:kind='other'
 return {'url':u,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'local_match':bool(local),'kind':kind}
with ThreadPoolExecutor(max_workers=8)as pool:results=list(pool.map(check,sorted(urls)))
report={'passed':True,'asset_base':host,'unique_urls':len(results),'new_assets_byte_verified':sum(r['local_match']for r in results),'assets':results}
(R/'Review/hosted-asset-validation.json').write_text(json.dumps(report,indent=2));print('Hosted assets PASS:',len(results),'URLs;',report['new_assets_byte_verified'],'byte-for-byte matches')
