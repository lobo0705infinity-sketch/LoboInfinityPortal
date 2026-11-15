"""Fetch every asset referenced by the revised layouts and compare local bytes."""
import concurrent.futures,hashlib,json,time,urllib.request
from pathlib import Path
from audit_assets import ROOT,bags
from make_installer import urls

def main():
 d=json.loads((ROOT/'release-r12/Clash-of-Empires-Workshop-Release.json').read_text());targets=sorted(urls(bags(d)))
 assert not any('/PENDING/' in u for u in targets)
 old=json.loads((ROOT/'asset-manifest.json').read_text());expected={}
 for u in targets:
  p=ROOT/'original13-assets'/u.split('/')[-1] if '/original13/' in u else Path(old[u]);expected[u]=hashlib.sha256(p.read_bytes()).hexdigest()
 def check(u):
  for attempt in range(3):
   try:
    with urllib.request.urlopen(u,timeout=45) as r:
     assert r.status==200;data=r.read()
    h=hashlib.sha256(data).hexdigest();assert h==expected[u],f'hash mismatch: {h}'
    return {'url':u,'sha256':h,'bytes':len(data),'passed':True}
   except Exception as e:error=str(e)
  return {'url':u,'passed':False,'error':error}
 results=[];start=time.time()
 with concurrent.futures.ThreadPoolExecutor(max_workers=20) as pool:
  for i,r in enumerate(pool.map(check,targets),1):
   results.append(r)
   if i%100==0:print('Verified',i,'/',len(targets),'failures',sum(not x['passed'] for x in results),flush=True)
 report={'scope':'Every mesh, collider and image referenced by the 16 revised layouts','passed':all(x['passed'] for x in results),'asset_count':len(results),'new_asset_count':sum('/original13/' in r['url'] for r in results),'elapsed_seconds':round(time.time()-start,1),'results':results}
 (ROOT/'public-asset-verification.json').write_text(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='results'}));assert report['passed']
if __name__=='__main__':main()
