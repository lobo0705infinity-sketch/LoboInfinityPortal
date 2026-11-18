from test_standard import *
from concurrent.futures import ProcessPoolExecutor,as_completed
import traceback,hashlib

def check(item):
 i,bag=item
 try:
  w=validate_map(bag)
  if i==1:(ROOT/'audit/panel-vanta.xml').write_text(w.xml)
  return {'index':i,'map':bag['GUID'],'name':bag['Nickname'],'passed':True}
 except Exception as e:
  return {'index':i,'map':bag['GUID'],'name':bag['Nickname'],'passed':False,'error':repr(e),'traceback':traceback.format_exc()}
if __name__=='__main__':
 (ROOT/'audit').mkdir(exist_ok=True)
 data=json.loads((ROOT/'output/Workshop-Save.json').read_text());report=[]
 with ProcessPoolExecutor(max_workers=4)as pool:
  jobs=[pool.submit(check,(i,b))for i,b in enumerate(bags(data),1)]
  for job in as_completed(jobs):
   r=job.result();report.append(r);print(r['index'],'PASS'if r['passed']else r['error'],flush=True)
 report.sort(key=lambda r:r['index'])
 (ROOT/'audit/standard-runtime.json').write_text(json.dumps(report,indent=2))
 (ROOT/'audit/runtime-build.json').write_text(json.dumps({'canonical_sha256':hashlib.sha256((ROOT/'standard-broker.lua').read_bytes()).hexdigest(),'collection_sha256':hashlib.sha256((ROOT/'output/Workshop-Save.json').read_bytes()).hexdigest(),'maps':len(report),'passed':all(r['passed']for r in report)},indent=2))
 if any(not r['passed']for r in report):raise SystemExit(1)
