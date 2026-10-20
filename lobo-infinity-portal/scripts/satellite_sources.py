import json, re, hashlib, urllib.request, concurrent.futures, pathlib, time, os
PYROOT=pathlib.Path(__file__).resolve().parents[1]
ROOT=pathlib.Path(os.environ.get('LOBO_SATELLITE_WORK', str(PYROOT / '.satellite-work')))
ROOT.mkdir(parents=True, exist_ok=True)
JOBS=[('b-pong-2', 'Romobrole', 'Cobalt Junction'), ('corporate-appropriation-1', 'Habsburg Havoc', 'Crownspire District'), ('crossing-lines-1', 'Hopes End', 'Lastlight Crossing'), ('double-bind-2', 'Pulpi Prodiges - Table 38', 'Copperline Exchange'), ('hardlock-1', 'Adepticon', 'Ironveil Complex'), ('neutralization-1', 'Epic!', 'Emberfall Station'), ('provisioning-2', 'Table 17 - USA', 'Palisade Depot'), ('the-dig-2', 'Satellite Merovingien', 'Old Quarter Excavation'), ('uplink-center-1', 'Kraken Masters - Table 31', 'Blackwater Relay'), ('data-harvest-2', '2025 - Pulpi Prodigies - Table 5', 'Signalworks'), ('evacuation-1', 'Borderbash', 'Wayfarer Landing'), ('neutralization-2', 'Colder Than Carbonite', 'Frostline Sector')]
def objects(v):
 if isinstance(v,dict):
  if 'Name' in v:yield v
  for k in ['ObjectStates','ContainedObjects','ChildObjects']:
   for a in v.get(k,[]):yield from objects(a)
  for a in v.get('States',{}).values():yield from objects(a)
source=json.loads(pathlib.Path(os.environ['LOBO_SATELLITE_SOURCE']).read_text())
bags={o['Nickname']:o for o in objects(source) if o.get('Nickname','').startswith('SET_')}
selected={slug:next(b for n,b in bags.items() if key in n) for slug,key,name in JOBS}
CACHE=ROOT/'asset-cache';CACHE.mkdir(exist_ok=True)
def cached(url):return CACHE/hashlib.sha256(url.encode()).hexdigest()
def fetch(url):
 p=cached(url)
 if p.exists():return {'url':url,'bytes':p.stat().st_size,'ok':True}
 for attempt in range(2):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Lobo-Map-Validation/1.0'}),timeout=25) as r:
    data=r.read(60*1024*1024)
    if not data or data[:50].lower().startswith(b'<!doctype html'):raise ValueError('Unexpected HTML or empty asset')
    p.write_bytes(data)
   return {'url':url,'bytes':len(data),'ok':True}
  except Exception as e:err=str(e)
 return {'url':url,'ok':False,'error':err}
def urls(obj):
 out=[]
 for o in objects(obj):
  for k in ['CustomMesh','CustomAssetbundle','CustomImage']:
   for f,v in o.get(k,{}).items():
    if isinstance(v,str) and v.startswith(('http://','https://')):out.append(v)
 return out
if __name__=='__main__':
 allurls=sorted(set(u for b in selected.values() for u in urls(b)))
 print('Checking',len(allurls),'source asset URLs',flush=True)
 results=[]
 with concurrent.futures.ThreadPoolExecutor(12) as pool:
  for i,r in enumerate(pool.map(fetch,allurls)):
   results.append(r)
   if (i+1)%25==0:print(i+1,'checked',flush=True)
 (ROOT/'asset-audit.json').write_text(json.dumps(results,indent=2))
 print('RESULT',len(results),'failed',sum(not r['ok'] for r in results),flush=True)
 for r in results:
  if not r['ok']:print(r,flush=True)
