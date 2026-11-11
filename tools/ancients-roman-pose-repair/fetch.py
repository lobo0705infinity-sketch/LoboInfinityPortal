import concurrent.futures,subprocess,json
from pathlib import Path
root=Path(__file__).parent
cache=root/'source'
cache.mkdir(exist_ok=True)
plan=json.loads((root/'plan.json').read_text())
urls={u for c in plan.values() for m,t in c.items() for u in [m,*t]}
def fetch(url):
 p=cache/url.rsplit('/',1)[-1]
 if not p.exists():
  subprocess.run(['curl','-fLsS','--retry','2','--max-time','30',url,'-o',str(p)],check=True)
with concurrent.futures.ThreadPoolExecutor(24) as pool:
 list(pool.map(fetch,urls))
