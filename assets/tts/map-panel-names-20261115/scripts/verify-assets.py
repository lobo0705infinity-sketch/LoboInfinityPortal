#!/usr/bin/env python3
"""Re-fetch the unchanged assets and match the prior full geometry audit hashes."""
import concurrent.futures, hashlib, io, json, math, pathlib, sys, time, urllib.request
from PIL import Image

audit=json.loads(pathlib.Path(sys.argv[1]).read_text())
output=pathlib.Path(sys.argv[2])

def verify(entry):
    url=entry['url']
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Lobo-Map-Panel-Validation/1.0'}),timeout=45) as r:
                assert r.status==200
                body=r.read()
            digest=hashlib.sha256(body).hexdigest()
            assert digest==entry['sha256'], 'Asset hash changed'
            result={'url':url,'sha256':digest,'bytes':len(body),'status':200}
            if entry.get('image') or body[:8]==b'\x89PNG\r\n\x1a\n' or body[:3]==b'\xff\xd8\xff':
                with Image.open(io.BytesIO(body)) as im:
                    im.load();result['image']=[im.width,im.height]
            elif entry.get('geometry') or url.lower().endswith('.obj'):
                vertices=[];faces=[]
                for line in body.decode('utf-8-sig').splitlines():
                    bits=line.split()
                    if not bits:continue
                    if bits[0]=='v':
                        xyz=list(map(float,bits[1:4]));assert len(xyz)==3 and all(map(math.isfinite,xyz));vertices.append(xyz)
                    elif bits[0]=='f':
                        face=[int(p.split('/')[0]) for p in bits[1:]];assert len(face)>=3
                        faces.append(face)
                assert vertices and faces, 'Missing OBJ vertices or faces'
                assert all(i!=0 and abs(i)<=len(vertices) for f in faces for i in f), 'Invalid OBJ vertex index'
                result['geometry']={'vertices':len(vertices),'triangles':sum(len(f)-2 for f in faces)}
            return result
        except Exception as exc:
            if attempt==2:return {'url':url,'error':type(exc).__name__+': '+str(exc)}
            time.sleep(attempt+1)

prior=json.loads(output.read_text())['assets'] if output.exists() else []
results=[r for r in prior if 'error' not in r]
done={r['url'] for r in results}
pending=[e for e in audit['assets'] if e['url'] not in done]
print(f'Verifying {len(pending)} URLs; reusing {len(done)} successful checks from this run',flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=16 if prior else 96) as pool:
    futures=[pool.submit(verify,e) for e in pending]
    for f in concurrent.futures.as_completed(futures):
        results.append(f.result())
        if len(results)%250==0:print(f'Checked {len(results)}/{len(audit["assets"])}; failures {sum("error" in r for r in results)}',flush=True)
errors=[r for r in results if 'error' in r]
summary={'all_passed':not errors,'count':len(results),'total_bytes':sum(r.get('bytes',0) for r in results),
         'decoded_images':sum('image' in r for r in results),'parsed_meshes':sum('geometry' in r for r in results),
         'errors':errors,'assets':sorted(results,key=lambda r:r['url'])}
output.write_text(json.dumps(summary,indent=2))
print(json.dumps({k:v for k,v in summary.items() if k!='assets'}),flush=True)
sys.exit(bool(errors))
