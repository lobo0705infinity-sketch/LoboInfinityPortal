from district import *
WORK=WORK3;OUT=OUT3
import re,urllib.request,concurrent.futures,time
from PIL import Image
from io import BytesIO
pin=(WORK/'assets-commit.txt').read_text().strip();p=json.loads((OUT/'Cloudbreak-Array.json').read_text())['ObjectStates'][0]
allurls=set()
def collect(d):
 if isinstance(d,dict):
  for k,v in d.items():
   if k in ('MeshURL','DiffuseURL','ColliderURL','AssetbundleURL','NormalURL','AssetbundleSecondaryURL') and v:allurls.add(v)
   if k=='LuaScript' and 'LOBO_STANDARD_META' in str(v):
    for line in v.splitlines():
     if line.startswith('local config=JSON.decode('):
      cfg=json.loads(json.loads(line.split('JSON.decode(',1)[1][:-1]));allurls.update(cfg['background'].values())
   if isinstance(v,(dict,list)):collect(v)
 elif isinstance(d,list):
  for v in d:collect(v)
collect(p)
def check(u):
 if not u.startswith('https://') or '/main/' in u:raise ValueError(u)
 name=u.split('/')[-1];asset=(NEW/name if '/cloudbreak-array-r3/' in u else AS2/name if '/cloudbreak-array-r2/' in u else BASE/'assets'/name)
 if 'background-off.jpg'in u:asset=BASE/'background-off.jpg'
 if 'DAF1E5F864A43C1AE1C7D4657FA1CACC28C78F9F'in u:asset=BASE/'standard-console.unity3d'
 if '35B6115843155E46391551B0AC37D029EF9F3C63'in u:asset=BASE/'console-base.obj'
 original=asset.read_bytes()
 for i in range(4):
  try:
   with urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':'Cloudbreak-asset-check/3'}),timeout=35)as resp:
    assert resp.status==200;data=resp.read()
   assert hashlib.sha256(data).digest()==hashlib.sha256(original).digest(),(name,len(data),len(original))
   if asset.suffix in ('.jpg','.png'):
    with Image.open(BytesIO(data))as im:im.load();assert im.mode in ('RGB','RGBA')
   return (asset.name,len(data))
  except Exception as e:
   err=e
   if i<3:time.sleep([.5,1,2][i])
 raise ValueError((u,str(err)))
if __name__=='__main__':
 assert pin in str(p);print('Checking',len(allurls),'public URLs.',flush=True)
 with concurrent.futures.ThreadPoolExecutor(max_workers=12)as ex:checked=list(ex.map(check,sorted(allurls)))
 print('Verified',len(checked),'HTTPS assets',sum(r[1] for r in checked),'bytes.',flush=True)
 (WORK/'host-audit.json').write_text(json.dumps(dict(checked),indent=1))
