from pathlib import Path
import concurrent.futures, hashlib, json, urllib.request, time
ROOT=Path(__file__).resolve().parent
DATA=ROOT/'release-r11/Clash-of-Empires-Workshop-Release.json'
NAMES=['Granicus','Zama','Gaugamela','Hydaspes','Issus','Cannae','Trebia','Cynoscephalae','Raphia','Magnesia','Adrianople','Pharsalus','Teutoburg']
def walk(o):
 yield o
 for s in o.get('States',{}).values():yield from walk(s)
 for s in o.get('ContainedObjects',[]):yield from walk(s)
 for s in o.get('ChildObjects',[]):yield from walk(s)
def bags(data):return [b for b in data['ObjectStates'][-1]['ContainedObjects'] if any(b['Nickname'].startswith(n) for n in NAMES)]
def meta(o):
 try:return json.loads(o.get('GMNotes','{}'))
 except:return {}
def main():
 data=json.loads(DATA.read_text());selected=bags(data);urls=set();profiles={}
 for bag in selected:
  for o in walk(bag):
   for u in o.get('CustomMesh',{}).values():
    if isinstance(u,str) and u.startswith('http'):urls.add(u)
   if 'LoboUnit' in o.get('Tags',[]):
    m=meta(o);k=(m.get('army'),m.get('name'),m.get('quality'),m.get('profile'),o.get('CustomMesh',{}).get('MeshURL'))
    profiles[k]={'name':m.get('name'),'army':m.get('army'),'figures':m.get('figures'),'class':m.get('unit_class',m.get('class')),'kind':m.get('kind'),'mesh':o['CustomMesh']['MeshURL'],'texture':o['CustomMesh']['DiffuseURL']}
 cache=ROOT/'asset-cache';cache.mkdir(exist_ok=True)
 manifest={u:str(cache/(hashlib.sha256(u.encode()).hexdigest()[:20]+'.'+u.rsplit('.',1)[-1])) for u in sorted(urls)}
 (ROOT/'asset-manifest.json').write_text(json.dumps(manifest,indent=2))
 (ROOT/'profile-inventory.json').write_text(json.dumps(list(profiles.values()),indent=2))
 def fetch(pair):
  u,p=pair;p=Path(p)
  if p.exists() and p.stat().st_size:return None
  for attempt in range(3):
   try:
    b=urllib.request.urlopen(u,timeout=45).read();p.write_bytes(b);return None
   except Exception as e:err=str(e)
  return {'url':u,'error':err}
 failures=[]
 print('Battle layouts',len(selected),'Unique referenced assets',len(urls),'Profile states',len(profiles),flush=True)
 with concurrent.futures.ThreadPoolExecutor(max_workers=20) as pool:
  for i,r in enumerate(pool.map(fetch,manifest.items()),1):
   if r:failures.append(r)
   if i%100==0:print('Downloaded',i,'/',len(urls),'errors',len(failures),flush=True)
 (ROOT/'asset-download-failures.json').write_text(json.dumps(failures,indent=2))
 print('Complete; failures',len(failures),flush=True)
if __name__=='__main__':main()
