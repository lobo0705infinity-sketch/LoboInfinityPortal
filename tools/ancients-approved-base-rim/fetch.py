from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import hashlib,json,subprocess
ROOT=Path(__file__).parent
CACHE=ROOT/'cache'
def file(url):
 return CACHE/(hashlib.sha256(url.encode()).hexdigest()[:16]+'-'+url.rsplit('/',1)[-1])
def fetch(url):
 p=file(url)
 if p.exists():return p
 temp=p.with_suffix('.tmp')
 args=['curl','-fLsS','--max-time','30','--retry','2']
 urls=[url]
 if 'cdn.jsdelivr.net/gh/' in url:
  gh=url.split('/gh/',1)[1]
  repo,rest=gh.split('@',1)
  urls.insert(0,'https://raw.githubusercontent.com/'+repo+'/'+rest)
 for u in urls:
  if subprocess.run([*args,u,'-o',str(temp)],capture_output=True).returncode==0:
   temp.replace(p)
   return p
 raise RuntimeError(url)
if __name__=='__main__':
 import sys
 CACHE.mkdir(exist_ok=True)
 plan=json.loads((ROOT/'plan.json').read_text())
 urls=set(plan)
 if '--meshes-only' not in sys.argv:urls.update(t for ts in plan.values() for t in ts)
 with ThreadPoolExecutor(24) as pool:
  for n,p in enumerate(pool.map(fetch,sorted(urls)),1):
   if n%25==0:print(n,p.name,flush=True)
