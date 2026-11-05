from pathlib import Path
import json,urllib.request,hashlib,concurrent.futures,io
from PIL import Image
R=Path(__file__).resolve().parents[1];host=(R/'Source/asset-base.txt').read_text().strip();files=sorted((R/'Assets').iterdir())
def verify(p):
 u=host+'/'+p.name
 for attempt in range(3):
  try:
   with urllib.request.urlopen(u,timeout=35)as res:data=res.read();status=res.status
   assert status==200;assert hashlib.sha256(data).digest()==hashlib.sha256(p.read_bytes()).digest(),'hash mismatch'
   r={'file':p.name,'url':u,'status':status,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'hash_matches':True}
   if p.suffix in ['.png','.jpg']:
    with Image.open(io.BytesIO(data))as im:im.load();r.update(full_pixel_decode=True,size=list(im.size))
   return r
  except Exception as e:last=str(e)
 return {'file':p.name,'url':u,'error':last}
with concurrent.futures.ThreadPoolExecutor(max_workers=12)as ex:results=list(ex.map(verify,files))
failed=[r for r in results if'error'in r]
report={'status':'Fail'if failed else'Pass','new_assets_checked':len(results),'assets':results,'failures':failed,'inherited_assets':'Retain the exact immutable R2/R3/R4 references from the R4 review package','limitations':['Public byte checks are not a live TTS client loading test']}
(R/'Review/Meridian-R5-Hosted-Assets.json').write_text(json.dumps(report,indent=2));print(report['status'],len(results),'assets;',failed,flush=True)
assert not failed
