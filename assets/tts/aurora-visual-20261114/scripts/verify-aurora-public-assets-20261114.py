#!/usr/bin/env python3
"""Fetch every published release asset referenced by the ready TTS save."""
import concurrent.futures, hashlib, io, json, pathlib, sys, time, urllib.request
from PIL import Image

root=pathlib.Path(sys.argv[1]);commit=sys.argv[2]
base=f'https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/{commit}/assets/tts/aurora-visual-20261114/'
assets=root/'aurora-source/assets/tts/aurora-visual-20261114'
save=(root/'output/Workshop-Save.json').read_text()
assert '__AURORA' not in save and '__LOBO' not in save
refs=set()
def walk(v):
    if isinstance(v,dict):
        for k,x in v.items():
            if k.endswith('URL') and isinstance(x,str) and x.startswith(base):refs.add(x)
            walk(x)
    elif isinstance(v,list):
        for x in v:walk(x)
walk(json.loads(save))
def check(url):
    rel=url[len(base):];local=assets/rel;expected=hashlib.sha256(local.read_bytes()).hexdigest()
    for attempt in range(4):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':'Lobo-Aurora-Asset-Verification/1.0'})
            with urllib.request.urlopen(req,timeout=60) as response:
                assert response.status==200
                content=response.read()
            assert hashlib.sha256(content).hexdigest()==expected,('hash mismatch',rel)
            if local.suffix.lower() in ('.png','.jpg','.jpeg'):
                with Image.open(io.BytesIO(content)) as im:im.load()
            elif local.suffix=='.obj':
                text=content.decode();assert '\nv ' in text and '\nvt ' in text and '\nf ' in text
            return {'asset':rel,'url':url,'bytes':len(content),'sha256':expected,'http_status':200}
        except Exception:
            if attempt==3:raise
            time.sleep(attempt+1)
results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
    for fut in concurrent.futures.as_completed([pool.submit(check,u) for u in sorted(refs)]):
        results.append(fut.result())
        if len(results)%50==0:print('Downloaded and verified',len(results),'/',len(refs),flush=True)
result={'commit':commit,'asset_count':len(results),'total_bytes':sum(r['bytes'] for r in results),'all_passed':True,'assets':sorted(results,key=lambda r:r['asset'])}
(root/'output/hosted-assets-validation.json').write_text(json.dumps(result,indent=2))
print('PASS',len(results),'exact public URLs',flush=True)
