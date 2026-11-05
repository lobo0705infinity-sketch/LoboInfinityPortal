from pathlib import Path
from PIL import Image
import io,json
R=Path(__file__).resolve().parents[1];results=[]
# Transport has a 1 MiB text-body ceiling. Keep binary assets below 650 kB
# (base64 < 867 kB) and verify full decode before the immutable upload.
for p in sorted((R/'Assets').iterdir()):
 if p.suffix not in ['.png','.jpg']or p.stat().st_size<=650000:continue
 old=p.stat().st_size;im=Image.open(p).convert('RGB')
 if p.name.endswith('-normal.png'):im=im.resize((512,512),Image.Resampling.LANCZOS)
 elif p.name.endswith('-atlas.jpg'):im=im.resize((1536,1536),Image.Resampling.LANCZOS)
 elif 'mat' in p.name:im=im.resize((2048,2048),Image.Resampling.LANCZOS)
 while True:
  if p.suffix=='.png':
   b=io.BytesIO();im.save(b,format='PNG',optimize=True);data=b.getvalue()
  else:
   for q in [94,91,88,85,82,78,74,70]:
    b=io.BytesIO();im.save(b,format='JPEG',quality=q,subsampling=0,optimize=True);data=b.getvalue()
    if len(data)<=650000:break
  if len(data)<=650000:break
  im=im.resize((round(im.width*.8),round(im.height*.8)),Image.Resampling.LANCZOS)
 tmp=p.with_suffix('.tmp');tmp.write_bytes(data);Image.open(tmp).load();tmp.replace(p)
 results.append({'file':p.name,'before':old,'after':len(data),'size':list(im.size)})
(R/'Review/Texture-Transport-Checks.json').write_text(json.dumps(results,indent=2));print('Optimized',len(results),'assets; max binary',max(p.stat().st_size for p in (R/'Assets').iterdir()if p.suffix!='.obj'))
