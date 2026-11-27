from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.request import Request,urlopen
from hashlib import md5
import json,time
R=Path(__file__).resolve().parents[1]; F=R/'work/texture-sources'; F.mkdir(parents=True,exist_ok=True)
NAMES=['brick_wall_001','dark_brick_wall','white_sandstone_blocks_02','corrugated_iron','green_metal_rust','concrete_wall_006','grey_roof_tiles_02','wood_table_001','plastered_wall_02','concrete_floor_02','metal_plate_02','rusty_metal_shutter','weathered_planks','blue_metal_plate']
def download(url):
 for i in range(3):
  try:
   with urlopen(Request(url,headers={'User-Agent':'Vanta-Freeport-TTS-original-table-design/1.0'}),timeout=20)as res:return res.read()
  except OSError:
   if i==2:raise
   time.sleep(i+.4)
def fetch(name):
 meta=json.loads(download('https://api.polyhaven.com/files/'+name));links={}
 for typ,options in [('color',['Diffuse','diff','color','col']),('normal',['nor_gl','nor_dx'])]:
  key=next(k for k in options if k in meta);choices=meta[key]['1k'];entry=choices.get('jpg',choices.get('png'))
  p=F/(name+'-'+typ+Path(entry['url']).suffix)
  if not p.exists():p.write_bytes(download(entry['url']))
  assert md5(p.read_bytes()).hexdigest()==entry['md5']
  links[typ]={'file':p.name,'md5':entry['md5'],'url':entry['url']}
 return name,links
if __name__=='__main__':
 with ThreadPoolExecutor(10) as pool:data=dict(pool.map(fetch,NAMES))
 (F/'sources.json').write_text(json.dumps(data,indent=2));print(len(data),'physically photographed material sets')
