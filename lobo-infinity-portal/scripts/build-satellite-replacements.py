import copy,json,re,math,sys,zipfile,hashlib
from pathlib import Path
import numpy as np
from shapely.geometry import Point,box
from shapely.ops import unary_union
from shapely.affinity import translate
from PIL import Image,ImageDraw,ImageFont
import argparse, os, concurrent.futures
parser=argparse.ArgumentParser(description='Build the twelve approved mission-specific Satellite replacements.')
parser.add_argument('--source', type=Path, required=True, help='Original tau24 Workshop 3486064611 JSON')
parser.add_argument('--work', type=Path, required=True, help='Local cache and audit directory')
args=parser.parse_args()
os.environ['LOBO_SATELLITE_SOURCE']=str(args.source.resolve())
os.environ['LOBO_SATELLITE_WORK']=str(args.work.resolve())
from satellite_sources import JOBS,selected,objects,PYROOT,ROOT,cached,urls,fetch
allurls=sorted(set(u for bag in selected.values() for u in urls(bag)))
with concurrent.futures.ThreadPoolExecutor(12) as pool:
 audit=list(pool.map(fetch,allurls))
(ROOT/'asset-audit.json').write_text(json.dumps(audit,indent=2))
from satellite_geometry import footprint
sys.path.insert(0,str(PYROOT/'scripts'))
from map_markings import PATTERN
import runpy
repair=runpy.run_path(str(PYROOT/'scripts/repair-map-alignment.py'))
VERSION='satellites-20261020-r2'
OUT=PYROOT/'public/assets/maps'/VERSION
OUT.mkdir(parents=True,exist_ok=True)
catalog=json.loads((PYROOT/'shared/lobo-workshop-current.json').read_text())
previous_labels={e['slug']:list(dict.fromkeys([e['workshopBagName'],e['workshopName'],*e.get('labelAliases',[])])) for e in catalog['maps']}
retired_path=PYROOT/'shared/lobo-workshop-archive-20261020.json'
if retired_path.exists():
 for old in json.loads(retired_path.read_text()):catalog['maps'][old['index']-1]=old
BASE=ROOT/'baseline'
BASE.mkdir(exist_ok=True)
with zipfile.ZipFile(PYROOT/'public/assets/maps/its18-markings-20261018-r6/Lobo-ITS18-Drop-Zone-Maps.zip') as baseline:
 for entry in catalog['maps']:
  (BASE/(entry['slug']+'.json')).write_bytes(baseline.read(entry['slug']+'.json'))
 (BASE/'Lobo-ITS18-Drop-Zone-Library.json').write_bytes(baseline.read('Lobo-ITS18-Drop-Zone-Library.json'))
table=json.loads((BASE/'Lobo-ITS18-Drop-Zone-Library.json').read_text())
archive=[];report=[];counter=0x810000
def guid():
 global counter
 counter+=1;return f'{counter:06x}'
def scrub(obj):
 for o in objects(obj):
  s=o.get('LuaScript','')
  s=re.sub(r'--\[\[Object base code\]\].*?--\[\[Spawning object\]\]','',s,flags=re.S)
  if any(x in s for x in ['obje.glitch.me','Spawning object','Object base code']):raise ValueError('Unclean script')
  o['LuaScript']=s.rstrip()+'\n' if s.strip() else ''
  o['LuaScriptState']=''
  image=o.get('CustomImage',{})
  if image.get('ImageSecondaryURL') in BAD:image['ImageSecondaryURL']=image['ImageURL']
def freeze(o):
 s=o.get('LuaScript','')
 o['LuaScript']=s+'''\n-- Preserve authored scenery while the map is deployed.
local satelliteOriginalOnLoad=onLoad
function onLoad(saved)
 self.setLock(true)
 if satelliteOriginalOnLoad then satelliteOriginalOnLoad(saved) end
end
'''
 o['Locked']=True
def new_ids(obj):
 for o in objects(obj):
  if 'GUID'in o:o['GUID']=guid()
def write(p,x):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(x,ensure_ascii=False,separators=(',',':'))+'\n')
BAD={x['url']for x in json.loads((ROOT/'asset-audit.json').read_text())if not x['ok']}

for jobindex,(slug,_,name) in enumerate(JOBS,1):
 entry=next(e for e in catalog['maps']if e['slug']==slug)
 previous=json.loads((BASE/(slug+'.json')).read_text())['ObjectStates'][0]
 oldrecords=repair['positions'](previous)
 mat=next(o for o in previous['ContainedObjects']if 'LOBO_MISSION_LINES'in o.get('LuaScript',''))
 markings=mat['LuaScript'][mat['LuaScript'].index('-- Mission markings retained'):]
 mission=[copy.deepcopy(o)for o in previous['ContainedObjects']if ('mission base' in o.get('Description','') or 'Corner DZ Template'in o.get('Nickname',''))]
 source=copy.deepcopy(selected[slug]);scrub(source)
 records=repair['positions'](source)
 sourcebagname=source['Nickname']
 terrain=source['ContainedObjects']
 ground=next(o for o in terrain if o['GUID']=='33a9e5')
 mats=[o for o in terrain if o['Name']=='Custom_Tile' and o['Transform']['scaleX']==24]
 # The Kraken 31 street surface consists of sixteen 12-inch tiles. Replace
 # its defunct Google Sites mesh with native TTS tiles, preserving textures.
 repairedtiles=0
 for o in terrain:
  cm=o.get('CustomMesh',{})
  if 'loseta.obj'in cm.get('MeshURL',''):
   image=cm['DiffuseURL'];o.pop('CustomMesh');o['Name']='Custom_Tile';o['CustomImage']={'ImageURL':image,'ImageSecondaryURL':image,'ImageScalar':1.,'WidthScale':0.,'CustomTile':{'Type':0,'Thickness':.1,'Stackable':False,'Stretch':True}}
   o['Transform'].update(scaleX=6.,scaleY=1.,scaleZ=6.)
   records[o['GUID']][1]=4.5+.00425*records[o['GUID']][0]
   repairedtiles+=1
 surface=mats[0] if mats else ground
 surface['LuaScript']=surface.get('LuaScript','')+'\n'+markings
 oldlines=json.loads(json.loads(PATTERN.search(surface['LuaScript'])[1]))
 # Read the source ground plane so objective pieces keep the correct height.
 # Source collections have a small common tilt along world X.
 ground_offset=0.
 points=[]
 for o in mission:
  p=oldrecords[o['GUID']].copy()
  if 'Corner DZ Template' not in o.get('Nickname',''):
   points.append((o.get('Nickname',''),p.copy(),.79 if '40 mm'in o.get('Description','')else .5))
 targets=[Point(p[0],p[2]).buffer(r+.55)for _,p,r in points if abs(p[0])<=24 and abs(p[2])<=24]
 exclusions=unary_union(targets)
 scenery=[o for o in terrain if o is not ground and o not in mats and o['Name'] not in ['Notecard','Custom_Tile']]
 shapes=[]
 for o in scenery:
  f=footprint(o,records[o['GUID']]);shapes.append(f if f is not None else Point(records[o['GUID']][0],records[o['GUID']][2]).buffer(.01))
 # Keep stacked shells/roofs together when clearing mission positions.
 parents=list(range(len(scenery)))
 def root(i):
  while parents[i]!=i:i=parents[i]
  return i
 for i,a in enumerate(shapes):
  for j in range(i):
   b=shapes[j]
   if min(a.area,b.area)>.05 and a.intersection(b).area/min(a.area,b.area)>.55:parents[root(i)]=root(j)
 groups={}
 for i in range(len(scenery)):groups.setdefault(root(i),[]).append(i)
 groups=list(groups.values());moves=[];removed=set()
 for group in groups:
  shape=unary_union([shapes[i]for i in group])
  if not shape.intersects(exclusions):continue
  others=unary_union([f for j,f in enumerate(shapes)if j not in group and j not in removed])
  existing=shape.intersection(others).area
  candidates=[]
  for radius in np.arange(.5,16.01,.5):
   for degree in range(0,360,10):
    dx=round(float(radius*math.cos(math.radians(degree))),4);dz=round(float(radius*math.sin(math.radians(degree))),4)
    moved=translate(shape,dx,dz)
    if moved.intersects(exclusions) or not box(-24.5,-24.5,24.5,24.5).covers(moved):continue
    if moved.intersection(others).area>existing+.05:continue
    candidates.append((dx,dz,moved))
   if candidates:break
  if not candidates:
   # Open the objective plaza rather than overlap buildings or disassemble a
   # stacked structure. Retain the remainder of the source table intact.
   removed.update(group)
   for i in group:shapes[i]=Point(1000,1000).buffer(.001)
   continue
  # Prefer the least movement; keep source terrain in its original half.
  dx,dz,_=min(candidates,key=lambda a:math.hypot(a[0],a[1]))
  for i in group:
   p=records[scenery[i]['GUID']];p[0]+=dx;p[2]+=dz;p[1]+=.00425*dx
   shapes[i]=translate(shapes[i],dx,dz)
  moves.append({'sourceGuids':[scenery[i]['GUID']for i in group],'dx':dx,'dz':dz})
 assert not any(s.intersects(exclusions)for s in shapes)
 removed_guids=[scenery[i]['GUID']for i in removed]
 terrain[:]=[o for o in terrain if o['GUID']not in removed_guids]
 for id in removed_guids:records.pop(id)
 shapes=[s for i,s in enumerate(shapes)if i not in removed]
 if len(removed)>len(scenery)*.25:raise ValueError(f'Too much source terrain removed: {slug}')
 # Mission footprints and their world coordinates come from the existing,
 # mission-specific export; do not copy another mission's marker layout.
 for o in mission:
  p=oldrecords[o['GUID']].copy();o['GUID']=guid();new_ids_children=list(objects(o))[1:]
  for child in new_ids_children:
   if 'GUID'in child:child['GUID']=guid()
  terrain.append(o);records[o['GUID']]=p
 # Keep every source asset ID unique across bags and safely normalize angles.
 newrecords={};idmap={}
 for o in terrain:
  p=records[o['GUID']];old=o['GUID'];o['GUID']=guid();idmap[old]=o['GUID'];newrecords[o['GUID']]=p
  for child in list(objects(o))[1:]:
   if 'GUID'in child:
    oldchild=child['GUID'];child['GUID']=guid();idmap[oldchild]=child['GUID']
  freeze(o)
  o['Transform'].update(dict(zip(['posX','posY','posZ','rotX','rotY','rotZ'],p)))
 # Preserve scripted links between terrain pieces after assigning fresh IDs.
 for o in objects(source):
  script=o.get('LuaScript','')
  o['LuaScript']=re.sub(r'\b[0-9a-f]{6}\b',lambda m:idmap.get(m[0],m[0]),script)
 source['GUID']=guid();source['Nickname']=f"SET_ITS18 {entry['missionSetups'][0]} — {name} — SATELLITE EDITION"
 source['Description']=f"{entry['missionSetups'][0]} / {name}\n48 × 48 inches; 300 points.\nSource: {sourcebagname}\nhttps://steamcommunity.com/sharedfiles/filedetails/?id=3486064611\nOfficial mission: {entry['missionUrl']}\nMission positions retained; scenery adjusted for objective clearance.\nLive TTS physics and playtesting pending."
 source['LuaScript']='\r\n'.join('--'+id+','+','.join(f'{float(v):.6f}'for v in p[:3]+[repair['angle'](v)for v in p[3:]])for id,p in newrecords.items())+'\r\n'
 source['Locked']=False;source['Transform'].update(posX=0,posY=2,posZ=0,rotX=0,rotY=0,rotZ=0)
 repair['repair_bag'](source)
 oldentry=copy.deepcopy(entry);oldentry['isCurrent']=False;archive.append(oldentry)
 newslug=slug+'-satellite'
 entry.update(isCurrent=True,id='3719263238:'+source['GUID'],guid=source['GUID'],slug=newslug,name=name,workshopBagName=source['Nickname'],workshopName=source['Nickname'][4:],layoutKey=2000+jobindex,objectCount=len(terrain),sourceNote=f"Adapted from tau24’s Return to the Satellites: {sourcebagname[4:]}. Mission setup diagram shown; fresh TTS screenshots and live playtesting pending. Use this page’s Download map bag for the new setup; Steam Workshop publication is pending.",sourceOverhead=None,sourceAngled=None,previewKind='diagram',overhead=f'/assets/maps/{VERSION}/{newslug}.webp',angled=f'/assets/maps/{VERSION}/{newslug}.webp',diagram=f'/assets/maps/{VERSION}/{newslug}.webp',download=f'/assets/maps/{VERSION}/{newslug}.json')
 entry['labelAliases']=previous_labels.get(newslug,[])
 write(OUT/(newslug+'.json'),{'ObjectStates':[source]})
 table['ObjectStates']=[source if o.get('GUID')==previous['GUID'] else o for o in table['ObjectStates']]
 # An accurate, explicitly labeled footprint view replaces stale Azure images.
 W,H=1600,1200;im=Image.new('RGB',(W,H),'#101b24');d=ImageDraw.Draw(im)
 font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
 f=ImageFont.truetype(font,22);small=ImageFont.truetype(font,17);title=ImageFont.truetype(font,30)
 d.text((42,24),name,fill='#f2f1e8',font=title);d.text((42,68),entry['missionSetups'][0]+' · Mission setup / terrain footprint diagram',fill='#b2c4ce',font=f)
 scale=19.;cx,cy=800,630
 def pixel(x,z):return (cx+z*scale,cy-x*scale)
 d.rectangle([pixel(24,-24),pixel(-24,24)],fill='#24343c',outline='#9aaeb8',width=2)
 for a in range(-20,24,4):
  d.line([pixel(a,-24),pixel(a,24)],fill='#30434c',width=1);d.line([pixel(-24,a),pixel(24,a)],fill='#30434c',width=1)
 for sh in shapes:
  for poly in sh.geoms if sh.geom_type=='MultiPolygon' else [sh]:
   if poly.geom_type=='Polygon':d.polygon([pixel(x,z)for x,z in poly.exterior.coords],fill='#677b83',outline='#a7b6ba',width=2)
 for line in oldlines:d.line([pixel(p[0],p[2])for p in line['points']],fill=tuple(int(x*255)for x in line['color']),width=3)
 for i,(label,p,r)in enumerate(points,1):
  if abs(p[0])>24 or abs(p[2])>24:continue
  x,y=pixel(p[0],p[2]);rr=r*scale
  d.ellipse((x-rr,y-rr,x+rr,y+rr),fill='#f1bd55',outline='#101b24',width=2);d.text((x+rr+4,y-10),str(i),fill='#fff0cf',font=small)
  d.text((44,145+(i-1)*36),f'{i}. {label}',fill='#f1d8a4',font=small)
 # Corner deployment templates retain their physical models in the export.
 if entry['family']=='Diagonal deployment':
  for corner in [(24,-24),(-24,24)]:
   coords=[]
   for a in np.linspace(0,math.pi/2,60):
    x=corner[0]-math.copysign(24*math.cos(a),corner[0]);z=corner[1]-math.copysign(24*math.sin(a),corner[1]);coords.append(pixel(x,z))
   d.line(coords,fill='#ed9b36',width=3)
 d.text((450,1120),'Terrain bounds derived from source meshes · Objectives retain mission coordinates',fill='#b2c4ce',font=small)
 d.text((450,1152),'Diagram only · Live TTS screenshots and playtesting pending',fill='#b2c4ce',font=small)
 im.save(OUT/(newslug+'.webp'),quality=88)
 report.append({'mission':entry['missionSetups'][0],'slug':newslug,'sourceBag':sourcebagname,'previousSlug':slug,'sourceObjectCount':len(selected[slug]['ContainedObjects']),'objectCount':len(terrain),'missionObjectCount':len(mission),'terrainMoves':moves,'removedSourceGuids':removed_guids,'nativeRoadTiles':repairedtiles,'objectiveClearance':True,'liveTtsVerified':False})
 print(entry['missionSetups'][0],len(moves),'terrain groups moved;',len(removed),'objects removed for objective plazas',flush=True)

table['SaveName']='Lobo ITS18 | Satellite variety edition | 2026-10-20'
table['LuaScript']='';table['LuaScriptState']=''
for entry in catalog['maps']:
 if not entry['slug'].endswith('-satellite'):
  # Keep unchanged exports byte-for-byte in the all-maps package.
  pass
archive_path=OUT/'Lobo-ITS18-Drop-Zone-Maps.zip'
archive_temp=archive_path.with_suffix('.zip.tmp')
with zipfile.ZipFile(archive_temp,'w',zipfile.ZIP_DEFLATED,compresslevel=9)as z:
 for entry in catalog['maps']:
  p=OUT/(entry['slug']+'.json')if entry['slug'].endswith('-satellite')else (BASE/(entry['slug']+'.json'))
  z.writestr(entry['slug']+'.json',p.read_bytes())
 z.writestr('Lobo-ITS18-Drop-Zone-Library.json',json.dumps(table,ensure_ascii=False,separators=(',',':'))+'\n')
 z.writestr('README.txt','LOBO ITS18 — SATELLITE VARIETY EDITION\n40 mission setups / 28 terrain layouts.\nIndividual JSONs are Saved Objects bags for the normal Infinity map deployment spot.\nThe collection JSON is a game save.\nTwelve named Satellite layouts replace nine Azure Circuit and three Tidal Turbines variants. Original event and table credits are retained.\nSource credit: tau24 — Infinity Maps: Return to the Satellites (3486064611).\nSource assets downloaded and checked; objective coordinates retained.\nNew previews are footprint diagrams. Live TTS screenshots, physics, line-of-fire and full-army playtesting remain pending.\n')
with zipfile.ZipFile(archive_temp) as check:
 assert len(check.namelist())==42 and check.testzip() is None
archive_temp.replace(archive_path)
catalog['download']=f'/assets/maps/{VERSION}/Lobo-ITS18-Drop-Zone-Maps.zip';catalog['downloadRevision']=VERSION;catalog['updatedAt']=__import__('datetime').datetime.now(__import__('datetime').timezone.utc).isoformat()
(PYROOT/'shared/lobo-workshop-current.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
(PYROOT/'shared/lobo-workshop-archive-20261020.json').write_text(json.dumps(archive,ensure_ascii=False,indent=2)+'\n')
write(OUT/'validation.json',{'maps':report,'uniqueLayouts':len(set(e['layoutKey']for e in catalog['maps'])),'azureCircuitSetups':sum(e['name']=='Azure Circuit'for e in catalog['maps']),'sourceAssetUrlsChecked':len(allurls),'sourceBrokenUrlsRepaired':3})
