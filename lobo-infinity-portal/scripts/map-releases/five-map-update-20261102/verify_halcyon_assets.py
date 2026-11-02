from pathlib import Path
import json,hashlib,urllib.request,urllib.parse,concurrent.futures,time
ROOT=Path(__file__).resolve().parent;OUT=ROOT/'five-release';CACHE=ROOT/'asset-cache';CACHE.mkdir(exist_ok=True)
index=json.loads((OUT/'Source/new-map-index.json').read_text());urls=set()
def scan(v):
 if isinstance(v,dict):
  for k,q in v.items():
   if isinstance(q,str)and q.startswith(('http://','https://'))and k.endswith(('URL','Url')):urls.add(q)
   else:scan(q)
 elif isinstance(v,list):
  for q in v:scan(q)
for row in index:
 if row['kind']=='general' and row['map']=='Halcyon Thermal Baths':scan(json.loads((OUT/row['path']).read_text()))
# Background URLs live in escaped Lua JSON; include them too.
import re
for row in index:
 if row['kind']=='general' and row['map']=='Halcyon Thermal Baths':
  text=(OUT/row['path']).read_text();urls.update(s.replace('\\/','/') for s in re.findall(r'https?://[^\s\"\'\\<>)]+',text)if any(t in s for t in ['raw.githubusercontent.com','steamusercontent','steamstatic']))
def get(url):
 path=CACHE/(hashlib.sha256(url.encode()).hexdigest()+Path(urllib.parse.urlparse(url).path).suffix)
 for trial in range(3):
  try:
   if not path.exists():
    req=urllib.request.Request(url,headers={'User-Agent':'Lobo-map-release-verification'})
    with urllib.request.urlopen(req,timeout=55)as r:data=r.read()
    if not data:raise ValueError('Empty response')
    path.write_bytes(data)
   data=path.read_bytes()
   return dict(url=url,path=str(path),bytes=len(data),sha256=hashlib.sha256(data).hexdigest(),status='passed')
  except Exception as e:
   if trial==2:return dict(url=url,status='failed',error=str(e))
   time.sleep(.3)
with concurrent.futures.ThreadPoolExecutor(max_workers=14)as pool:
 result=list(pool.map(get,sorted(urls)))
(OUT/'Source/hosted-assets-validation.json').write_text(json.dumps(dict(uniqueURLs=len(urls),passed=sum(r['status']=='passed'for r in result),failed=[r for r in result if r['status']!='passed'],assets=result),indent=2))
print('HOSTED ASSETS',len(urls),'passed',sum(r['status']=='passed'for r in result),'failed',len([r for r in result if r['status']!='passed']),flush=True)
for r in result:
 if r['status']!='passed':print(r,flush=True)
