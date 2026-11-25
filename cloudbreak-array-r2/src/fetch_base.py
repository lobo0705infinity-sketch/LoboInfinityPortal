"""Fetch exact production dependencies using the supplied R1 installer payload."""
import concurrent.futures,json,re,time,urllib.request
from pathlib import Path
r=Path(__file__).resolve().parents[1];base=r/'base'
for q in [base/'assets',r/'standard',r/'work',r/'assets',r/'out']:q.mkdir(parents=True,exist_ok=True)
b=(base/'r1/Cloudbreak-Array.json').read_text()
urls=set(re.findall(r'https://raw\.githubusercontent\.com/lobo0705infinity-sketch/LoboInfinityPortal/[a-f0-9]{40}/cloudbreak-array-r1/assets/[\w.-]+',b))
root='https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/main/tts-map-controls-standard/'
pairs=[(u,base/'assets'/u.rsplit('/',1)[1])for u in urls]+[(root+n,r/'standard'/n)for n in ['standard-broker.lua','standard-owner.lua','zone-colors.lua','zone-render.lua','rotation-frame.lua','test_standard.py','test_zones.py','patch_maps.py','validate_release.py']]
donor=json.loads((base/'console-candidate-0.json').read_text());off=next(v for vals in json.loads((r/'work/sky-candidates.json').read_text()).values() for v in vals if v.endswith('/background-off.jpg'))
pairs.extend([(donor['CustomAssetbundle']['AssetbundleURL'],base/'standard-console.unity3d'),(donor['ChildObjects'][0]['CustomMesh']['MeshURL'],base/'console-base.obj'),(off,base/'background-off.jpg')])
def get(pair):
 u,f=pair
 if f.is_file():return f.name
 for i in range(4):
  try:
   data=urllib.request.urlopen(u,timeout=45).read();f.write_bytes(data);return f.name
  except OSError:
   if i==3:raise
   time.sleep(1.5)
with concurrent.futures.ThreadPoolExecutor(12) as ex:print(len(list(ex.map(get,pairs))),'production dependencies checked')
