"""Download and verify every final asset used by this one repaired battle."""
import concurrent.futures,hashlib,json,math,urllib.request
from pathlib import Path
from PIL import Image
R=Path(__file__).resolve().parent
save=json.loads((R/'installer/Clash-of-Empires-Granicus-Arrian-435.json').read_text())
bag=save['ObjectStates'][3]['ContainedObjects'][0]
urls=set()
def walk(o):
 yield o
 for k in ['ContainedObjects','ChildObjects']:
  for v in o.get(k,[]):yield from walk(v)
 for v in o.get('States',{}).values():yield from walk(v)
for o in walk(bag):
 for k,v in o.get('CustomMesh',{}).items():
  if k.endswith('URL') and v:urls.add(v)
known=json.loads((R/'asset-manifest.json').read_text())
repaired={x['repaired_file']:x for name in ['mesh-repair-manifest.json','atlas-repair-manifest.json'] for x in json.loads((R/name).read_text())}
out=R/'verified-public-assets';out.mkdir(exist_ok=True)
def check(url):
 assert url.startswith('https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/')
 name=url.split('/')[-1];dest=out/name
 with urllib.request.urlopen(url,timeout=60) as res:
  assert res.status==200;raw=res.read();ctype=res.headers.get('Content-Type')
 dest.write_bytes(raw);sha=hashlib.sha256(raw).hexdigest()
 if name in repaired:assert sha==repaired[name]['sha256']
 elif url in known:assert sha==known[url]['sha256']
 info={'url':url,'file':name,'sha256':sha,'bytes':len(raw),'http_status':200,'content_type':ctype}
 if name.endswith('.obj'):
  v=vt=vn=faces=0
  for line in raw.decode().splitlines():
   a=line.split()
   if not a:continue
   if a[0] in ['v','vt','vn']:
    assert all(math.isfinite(float(x)) for x in a[1:])
    if a[0]=='v':v+=1
    elif a[0]=='vt':vt+=1
    else:vn+=1
   elif a[0]=='f':
    assert len(a)>=4
    for token in a[1:]:
     ids=token.split('/');assert 0<int(ids[0])<=v
     if len(ids)>1 and ids[1]:assert 0<int(ids[1])<=vt
     if len(ids)>2 and ids[2]:assert 0<int(ids[2])<=vn
    faces+=len(a)-3
  assert v<65000 and faces>0
  info.update(vertices=v,triangles=faces)
 else:
  im=Image.open(dest);im.load();assert im.width>0 and im.height>0
  info.update(width=im.width,height=im.height,format=im.format)
 return info
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as ex:results=list(ex.map(check,sorted(urls)))
def colors(x):
 if isinstance(x,dict):
  if {'r','g','b'}<=x.keys():assert all(isinstance(x[k],(int,float)) and math.isfinite(x[k]) for k in ['r','g','b'])
  for v in x.values():colors(v)
 elif isinstance(x,list):
  for v in x:colors(v)
colors(save)
(R/'public-asset-verification.json').write_text(json.dumps(results,indent=2))
print(json.dumps({'verified_public_assets':len(results),'bytes':sum(x['bytes'] for x in results),'max_mesh_vertices':max(x.get('vertices',0) for x in results),'typed_RGB_fields_valid':True},indent=2))
