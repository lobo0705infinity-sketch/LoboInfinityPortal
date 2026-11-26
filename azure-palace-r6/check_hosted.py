import hashlib,json,re,concurrent.futures,time,urllib.request,sys
from pathlib import Path
R=Path(__file__).resolve().parent
read=lambda p:json.loads(p.read_bytes())
def walk(x):
 if isinstance(x,dict):
  yield x
  for k in ('ObjectStates','ContainedObjects','ChildObjects'):
   for y in x.get(k,[]): yield from walk(y)
  for y in x.get('States',{}).values():yield from walk(y)
source={'ObjectStates':sum((read(R/'Release'/name)['ObjectStates'] for name in ('Azure-Palace.json','Azure-Palace-Scatter.json')),[])};urls=set()
for o in walk(source):
 for k,v in o.get('CustomMesh',{}).items():
  if k.endswith('URL') and v:urls.add(v)
 if o.get('GUID')=='8428d8':
  cfg=json.loads(re.search(r'local config=JSON.decode\(\[==\[(.*?)\]==\]\)',o['LuaScript'],re.S)[1])
  urls.update([cfg['background']['day'],cfg['background']['night']])
def check(u):
 name=u.split('/')[-1]
 dirs=[R/'Assets'] if '/azure-palace-r6/' in u else [R.parent/'azure5/Assets'] if '/azure-palace-r5/' in u else [R.parent/'azure4/Assets'] if '/azure-palace-r4/' in u else [R.parent/'azure2/Assets'] if '/azure-palace-r2/' in u else [R.parent/'azure2/original/Assets',R.parent/'azure2/original/deps']
 fn=next(d/name for d in dirs if (d/name).exists());orig=fn.read_bytes()
 assert u.startswith('https://') and re.search('/[0-9a-f]{40}/',u),u
 for i in range(4):
  try:
   q=urllib.request.Request(u,headers={'User-Agent':'Lobo-Azure-Palace-release-verification'})
   with urllib.request.urlopen(q,timeout=20) as resp:b=resp.read()
   assert hashlib.sha256(b).digest()==hashlib.sha256(orig).digest(),(name,'hash mismatch')
   return [u,len(b),hashlib.sha256(b).hexdigest()]
  except Exception:
   if i==3:raise
   time.sleep(1+i)
with concurrent.futures.ThreadPoolExecutor(13) as pool:results=list(pool.map(check,sorted(urls)))
(R/'Review'/'hosted.json').write_text(json.dumps(results,indent=1));print('Verified all',len(results),'distinct HTTPS map assets;',sum(len_ for _,len_,_ in results),'bytes.',flush=True)
