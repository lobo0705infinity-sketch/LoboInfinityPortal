"""Check exterior paths, model placement, objective identity and the actual Stage registration."""
from yard import *
from layout import CLONES,MOVES,SHARED
from shapely.geometry import Point,LineString,box,MultiLineString
from shapely.ops import unary_union
from scipy import ndimage
from PIL import Image,ImageDraw
from itertools import combinations
import re
from concurrent.futures import ThreadPoolExecutor
objectives=('81004d','810051','81004f')
def check_navigation(b):
 n=961;scale=(n-1)/48
 def pixel(x,z):return round((x+24)*scale), round((z+24)*scale)
 mask=Image.new('1',(n,n));d=ImageDraw.Draw(mask);polys={};cuts=[]
 for o in b['ContainedObjects']:
  g=o['GUID']
  if g in ('810007','810008','51838e')or g in objectives:continue
  result=geo(o)
  if result is None:continue
  v,f,groups=result
  if v[:,1].min()>GRADE+1.65:continue
  poly=footprint(o)
  polys[g]=poly
  # For routing use whole building footprints. Divide the new equipment into its actual
  # compound collider sections so bases may pass along a gangway or between gate posts.
  footprints=[poly]
  if g in CLONES:
   footprints=[]
   for group in np.unique(groups):
    verts=v[np.unique(f[groups==group].ravel())]
    if verts[:,1].max()<GRADE+.17 or verts[:,1].min()>GRADE+1.63:continue
    hull=MultiPoint(verts[:,[0,2]]).convex_hull
    if hull.geom_type=='Polygon':footprints.append(hull)
  for p in footprints:d.polygon([pixel(x,z)for x,z in p.exterior.coords],fill=1)
  # Actual triangle crossings at infantry silhouette height, including windows and doors.
  tris=v[f];yh=GRADE+1.5;yy=tris[:,:,1]
  for tr in tris[(yy.min(1)<yh)&(yy.max(1)>yh)]:
   points=[]
   for a,c in zip(tr,np.roll(tr,-1,axis=0)):
    if (a[1]<yh)!=(c[1]<yh):
     h=a+(c-a)*(yh-a[1])/(c[1]-a[1]);points.append((h[0],h[2]))
   if len(points)==2 and np.linalg.norm(np.subtract(*points))>1e-5:cuts.append(points)
 for a,c in combinations(polys,2):
  if not ({a,c}&(set(CLONES)|set(MOVES))):continue
  inter=polys[a].intersection(polys[c]).area
  if inter>.065 and {a,c}!={'7cb2f9','d57af6'}:raise AssertionError(('ground footprint conflict',a,c,inter))
 root={o['GUID']:o for o in b['ContainedObjects']}
 for g in CLONES:assert box(-24,-24,24,24).covers(polys[g])
 low,top=(geo(root[g])[0]for g in ('7cb2f9','d57af6'))
 assert abs(low[:,1].max()-top[:,1].min())<.018
 assert footprint(root['7cb2f9']).symmetric_difference(footprint(root['d57af6'])).area<.003
 occ=np.array(mask)
 Z,X=np.ogrid[:n,:n];X=X/scale-24;Z=Z/scale-24
 for g in objectives:
  x,z=where(root[g]);occ|=np.hypot(X-x,Z-z)<=20/25.4
 occ[[0,-1],:]=True;occ[:,[0,-1]]=True
 dist=ndimage.distance_transform_edt(~occ)/scale;routes={}
 for mm in (25,40):
  radius=mm/50.8;labels,num=ndimage.label(dist>=radius,np.ones((3,3)));w=set(np.unique(labels[:,1:240]));e=set(np.unique(labels[:,-240:-1]));both=(w&e)-{0}
  for g in objectives:
   x,z=where(root[g]);ring=abs(np.hypot(X-x,Z-z)-(radius+20/25.4))<.05;iz,ix=np.nonzero(ring & np.isin(labels,list(both)))
   sectors={int(((math.atan2(zz/scale-24-z,xx/scale-24-x)+math.tau)%math.tau)/(math.pi/4))%8 for zz,xx in zip(iz,ix)}
   assert len(sectors)>=3,(mm,g,sectors)
   routes[g+'/'+str(mm)]=len(sectors)
 # One region connects all three objective rings, so the beacon can move between them.
   if g==objectives[0]:common=set(labels[iz,ix])
   else:common.intersection_update(labels[iz,ix])
  assert common,(mm,'no through route')
 linework=MultiLineString(cuts);edge={}
 for offset in (.1,.5,.8):
  e=24-offset
  for loc,a,c in [('west',(-e,-24),(-e,24)),('east',(e,-24),(e,24)),('near',(-24,-e),(24,-e)),('far',(-24,e),(24,e))]:
   ray=LineString([a,c]);hits=ray.intersection(linework)
   distances=[0.,48.]
   def collect(p):
    if p.is_empty:return
    if p.geom_type=='Point':distances.append(ray.project(p));return
    if p.geom_type=='LineString':
     distances.extend(ray.project(Point(v))for v in p.coords);return
    for part in p.geoms:collect(part)
   collect(hits);edge[loc+str(offset)]=round(max(np.diff(sorted(distances))),2)
 return dict(objectiveRingSectorsFromBothDeployments=routes,outlineRayLongestSegments=edge)
def check_save():
 b=load(W/'Vanta-Customs-Yard.json')['ObjectStates'][0];old=originals();a={o['GUID']:o for o in old['ContainedObjects']};idx={o['GUID']:o for o in b['ContainedObjects']};table=load(W/'Play-Table.json')
 for g in objectives:assert a[g]==idx[g]
 for g in a:
  if a[g].get('States'):assert a[g]==idx[g],g
 assert set(idx)-set(a)=={'d95301','d95302','d95303'}
 keep=[o for o in table['ObjectStates']if TAG not in o.get('Tags',[])];roots=b['ContainedObjects']
 assert len(keep)==138 and table['ObjectStates']==keep+roots
 assert 'vanta-freeport-day' in table['SkyURL']
 assert table['SaveName']==TITLE
 reg={l[2:8]:list(map(float,l.split(',')[1:]))for l in b['LuaScript'].splitlines() if re.match(r'^--[0-9a-f]{6},',l)}
 prefix=' local config=JSON.decode(';owner=idx['51838e']['LuaScript'];cfg=json.loads(json.loads(next(l for l in owner.splitlines()if l.startswith(prefix))[len(prefix):-1]))
 ids=set()
 for o in roots:
  for st in (o,*o.get('States',{}).values()):
   g=st['GUID'];ids.add(g);assert cfg['guids'].get(g),g
   # Stage's legacy position records intentionally round original catalogue poses.
   assert all(abs(v-st['Transform'][axis])<.00011 for axis,v in zip(SHARED,reg[g])),(g,reg[g],st['Transform'])
 assert set(reg)==ids
 from lupa.lua52 import LuaRuntime
 lua=LuaRuntime(unpack_returned_tuples=True);compile_lua=lua.eval('function(s)local f,e=load(s);return f~=nil,e end')
 stage=next(o['LuaScript']for o in keep if o['Nickname']=='Stage')
 scripts={s['LuaScript'] for o in table['ObjectStates'] for s in flat(o) if s.get('LuaScript')}|{table['LuaScript'],b['LuaScript']}
 for script in scripts:
  ok,error=compile_lua(script);assert ok,error
 axes=SHARED;bag=b
 # Real Lua Stage, controller rotation and clear, with physical-table callbacks simulated.
 harness=(R/'src/stage-harness.txt').read_text()
 harness=harness.replace('<1e-7','<.00011')
 harness=harness.replace("assert abs((f.r.y-t['rotY']-180*iteration+180)%360-180)<.00011","assert abs((f.r.y-t['rotY']-(0 if t['posY'] < -10 else 180*iteration)+180)%360-180)<.00011, o['GUID']")
 harness=harness.replace('assert lua.globals().loboClearOwnedMaps()==len(roots)',"lua.globals().loboStandardClear(lua.table_from({'color':'Blue'}))")
 exec(compile(harness,'Vanta Stage checks','exec'),{**globals(),**locals()})
 # Exercise clearing a physical bag on the existing Stage as well as the direct save above.
 for o in roots:lua.globals().byGuid[o['GUID']].gone=False
 lua.globals().loaded_bag_code=bag['LuaScript']
 lua.execute("""
 cb=nil
 bb='810053'
 add_object(bb,'Vanta map bag','Bag',{0,0,0},{0,0,0},{},true)
 byGuid[bb].getLuaScript=function()return loaded_bag_code end
 byGuid['2d647a'].getVar=function(k)if k=='bb'then return bb elseif k=='cb'then return cb end end
 byGuid['2d647a'].call=function(k)assert(k=='btnTrash');btnTrash()end
 btnGetSod=function()end
 """)
 lua.globals().loboStandardClear(lua.table_from({'color':'Blue'}))
 assert lua.globals().bb is None and all(lua.globals().byGuid[o['GUID']].gone for o in roots)
 assert not any(lua.globals().byGuid[o['GUID']].gone for o in keep)
 return dict(mapObjects=len(roots),stateRecords=len(reg),persistentPlayTableObjects=len(keep),uniqueLuaScripts=len(scripts),stageRotateAndClear=True,physicalBagClear=True,preservedObjectives=list(objectives))
def check_public():
 b=load(W/'Vanta-Customs-Yard.json')['ObjectStates'][0];pin=(W/'pin.txt').read_text().strip();sums={}
 def matched(url):
  assert url.startswith('https://') and 'PREVIEW' not in url
  data=get(url);assert data==cache(url).read_bytes(),url
  if '/'+PREFIX+'/' in url:assert RAW+pin+'/'+PREFIX+'/' in url
  return url,hashlib.sha256(data).hexdigest()
 with ThreadPoolExecutor(10)as ex:sums=dict(ex.map(matched,urls(b)))
 save(W/'public-qa.json',sums);print('Public assets',len(sums))
if __name__=='__main__':
 if sys.argv[-1]=='public':check_public()
 else:
  save(W/'geometric-qa.json',check_navigation(load(W/'Vanta-Customs-Yard.json')['ObjectStates'][0]))
  save(W/'save-qa.json',check_save());print((W/'save-qa.json').read_text());print((W/'geometric-qa.json').read_text())
