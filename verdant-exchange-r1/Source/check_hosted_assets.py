"""Verify each immutable asset URL before delivering the installer."""
from pathlib import Path
import json,hashlib,urllib.request,concurrent.futures,time
ROOT=Path(__file__).resolve().parents[1]
revision=(ROOT/'Source/asset-revision.txt').read_text().strip()
base='https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/'+revision+'/verdant-exchange-r1/Assets/'
files=list((ROOT/'Assets').iterdir())
def check(p):
 data=urllib.request.urlopen(base+p.name,timeout=45).read()
 assert hashlib.sha256(data).digest()==hashlib.sha256(p.read_bytes()).digest(),p.name
 return {'name':p.name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'status':'passed'}
with concurrent.futures.ThreadPoolExecutor(max_workers=10)as pool:results=list(pool.map(check,files))
report={'status':'passed','assets':len(results),'asset_revision':revision,'byte_identical_downloads':True,'checks':results}
(ROOT/'Source/hosted-assets-validation.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items()if k!='checks'}))
