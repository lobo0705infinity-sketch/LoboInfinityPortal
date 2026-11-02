from pathlib import Path
import json,subprocess,hashlib,zipfile,re,shutil,urllib.request,concurrent.futures
ROOT=Path(__file__).resolve().parent;OUT=ROOT/'five-release';REPO=ROOT/'five-portal';APP=REPO/'lobo-infinity-portal';REV='approved-five-map-update-20261102-r1';PUBLIC=APP/'public/assets/maps'/REV
meta=json.loads((APP/'shared/lobo-workshop-current.json').read_text())
tracked=set(subprocess.check_output(['git','ls-tree','-r','--name-only','HEAD'],cwd=REPO,text=True).splitlines())
paths=set()
for m in meta['maps']:
 for k in ['overhead','angled','diagram','download']:
  p='lobo-infinity-portal/public'+m[k]
  if p in tracked:paths.add(p)
text=(APP/'shared/top40-round-maps.mjs').read_text()
for u in re.findall(r'"(/assets/maps/[^\"]+)"',text):
 p='lobo-infinity-portal/public'+u
 if p in tracked:paths.add(p)
tree={line.split('\t',1)[1]:line.split()[2]for line in subprocess.check_output(['git','ls-tree','-r','HEAD'],cwd=REPO,text=True).splitlines()}
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip()
def download(path):
 p=REPO/path
 if p.exists():
  b=p.read_bytes()
  if hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==tree[path]:return
 with urllib.request.urlopen('https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/'+head+'/'+path,timeout=60)as response:b=response.read()
 assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==tree[path],path
 p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
with concurrent.futures.ThreadPoolExecutor(max_workers=14)as pool:list(pool.map(download,sorted(paths)))
print('Restored',len(paths),'unchanged public dependencies',flush=True)
maps=[]
for m in meta['maps']:
 p=APP/('public'+m['download']);b=p.read_bytes();maps.append(dict(guid=m['guid'],name=m['name'],kind='general',download=m['download'],sha256=hashlib.sha256(b).hexdigest(),objects=m['objectCount']))
for row in json.loads((OUT/'Source/saved-object-index.json').read_text()):
 if row['kind']=='general':continue
 if row['kind']=='top40':
  if 'Kestrel'in row['name']:filename='Lobos-Top-40-Kestrel-Lunar-Base-Data-Harvest.json'
  else:filename=row['name'].replace(' ','-')+'.json'
  new='/assets/maps/'+REV+'/'+filename
  if (PUBLIC/filename).exists():url=new
  else:url='/assets/maps/seven-map-update-20261102-r1/'+filename
 else:url='/assets/maps/seven-map-update-20261102-r1/Nereid-Deep-Azure-Coast-R7.json'
 b=(OUT/row['path']).read_bytes();maps.append(dict(guid=row['guid'],name=row['map'],kind=row['kind'],download=url,sha256=hashlib.sha256(b).hexdigest(),objects=len(json.loads(b)['ObjectStates'][0]['ContainedObjects'])))
inventory=dict(release='Five Map Update R1',saveName="Lobo's Infinity Maps - Five Map Update R1",generalMaps=40,auroraSetups=50,top40Maps=10,maps=maps)
(PUBLIC/'release-inventory.json').write_text(json.dumps(inventory,indent=2)+'\n')
with zipfile.ZipFile(PUBLIC/'Lobo-ITS18-Drop-Zone-Maps.zip','w',zipfile.ZIP_DEFLATED,9)as z:
 for m in meta['maps']:z.write(APP/('public'+m['download']),m['slug']+'.json')
for name in ['approved-preservation.json','approved-release-validation.json','stage-validation.json','map-controls-validation.json','catalogue-validation.json']:
 if (OUT/'Source'/name).exists():shutil.copy2(OUT/'Source'/name,PUBLIC/name)
print('Portal inventory ready:',len(maps),'public map payloads',flush=True)
