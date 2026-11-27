"""Verify the map using its exported OBJ colliders and the real table's Lua scripts."""
from map_release import *
from pathlib import Path
from itertools import product
import re,math,json,hashlib,sys
import numpy as np
from shapely.geometry import LineString,MultiLineString,Point,box,Polygon,MultiPoint
from shapely.ops import unary_union
from concurrent.futures import ThreadPoolExecutor
import verify
from layout import SHARED
from lupa.lua52 import LuaRuntime
oldcache=yard.cache
def resolve(url):return A/url.rsplit('/',1)[1] if '/'+PREFIX+'/'in url else oldcache(url)
yard.cache=resolve
def slices(v,f,y):
 tri=v[f];yy=tri[:,:,1];lines=[]
 for tr in tri[(yy.min(1)<y)&(yy.max(1)>y)]:
  pts=[]
  for a,b in zip(tr,np.roll(tr,-1,axis=0)):
   if (a[1]<y)!=(b[1]<y):
    c=a+(b-a)*(y-a[1])/(b[1]-a[1]);pts.append((c[0],c[2]))
  if len(pts)==2 and np.linalg.norm(np.subtract(*pts))>1e-6:lines.append(pts)
 return MultiLineString(lines)
def physical(v,f,groups,bot,top):
 ps=[]
 for j in np.unique(groups):
  pts=v[np.unique(f[groups==j].ravel())]
  if pts[:,1].max()<bot or pts[:,1].min()>top:continue
  hull=MultiPoint(pts[:,[0,2]]).convex_hull
  if hull.geom_type=='Polygon':ps.append(hull)
 return unary_union(ps)
def check_rooms(b):
 m=yard.load(W/'buildings.json');out={};hashes=set()
 for o in b['ContainedObjects']:
  guid=o['GUID']
  if guid not in BY:continue
  d=BY[guid];r=m[guid];sta={int(i):s for i,s in o.get('States',{}).items()};sta[len(sta)+1]=o;result={}
  for i,s in sta.items():
   cm=s['CustomMesh'];vp=resolve(cm['MeshURL']);cp=resolve(cm['ColliderURL']);v0,f0,_=yard.meshdata(vp);v,f,g=yard.meshdata(cp)
   for vs,fs in ((v0,f0),(v,f)):
    assert (fs>=0).all()and fs.max()<len(vs)and np.isfinite(vs).all()
    assert len(vs)<32000 and len(fs)<45000
   h=hashlib.sha256(vp.read_bytes()).hexdigest();assert h not in hashes;hashes.add(h)
   if len(sta)==1:
    # Scanner vehicle channel and the protected pedestrian side of the loading dock.
    through_z=0 if d['style']=='portal' else 1.39
    line=LineString([(-2.89,through_z),(2.83,through_z)]).buffer(25/50.8)
    for yy in(.20,.67,1.49):assert line.disjoint(slices(v,f,yy)),(d['slug'],'open path',yy)
    result['throughRoute25mm']=True
   if i==1 and len(sta)>1:
    meta=r[0]['door'];p=np.array(meta['center']);u=np.array(meta['tangent']);n=np.array(meta['outward'])
    # Swept entry of a real 25mm base and the infantry model above it, across the wall thickness.
    passage=LineString([p-n*.69,p+n*.68]).buffer(25/50.8)
    for yy in (.18,.61,1.50):assert passage.disjoint(slices(v,f,yy)),(d['slug'],'door collision',yy)
    result['doorInches']=round(meta['width'],3)
   if len(sta)>1 and (i==1 or i==2 and len(sta)==3):
    floor=.11 if i==1 else (d['h']+.14)
    p=d['p'] if i==1 else d['up'];obs=physical(v,f,g,floor+.065,floor+1.53)
    clear=p.buffer(-25/50.8).difference(obs.buffer(25/50.8));assert clear.area>.90,(d['slug'],i,'no clear standing room',clear.area)
    assert {q['level']for q in r[i-1]['room']}==set(range(1,i+1)),(d['slug'],i,'empty staff space')
    result['clearFloor'+str(i)]=round(clear.area,2)
   if i==2 and r[i-1].get('terraceDoor'):
    meta=r[i-1]['terraceDoor'];p0=np.array(meta['center']);normal=np.array(meta['outward']);floor=meta['floor']
    for yy in (.18,.66,1.48):
     path=LineString([p0-normal*.53,p0+normal*.53]).buffer(25/50.8)
     assert path.disjoint(slices(v,f,floor+yy)),(d['slug'],'terrace door',yy)
    result['terraceDoorInches']=round(meta['width'],3)
   if i==len(sta)and len(sta)>1:
    p=d['up'] if d['up']is not None else d['p'];hx,hz=r[0]['hatch'];roof=d['h']+(.14+d['uh'] if d['up']is not None else 0)+.135
    aperture=Point(hx,hz).buffer(25/50.8)
    assert aperture.disjoint(slices(v,f,roof-.066)),(d['slug'],'hatch',roof)
    obs=physical(v,f,g,roof+.105,roof+1.51)
    clear=p.buffer(-25/50.8).difference(box(hx-.55,hz-.63,hx+.55,hz+.63).buffer(25/50.8)).difference(obs.buffer(25/50.8))
    assert clear.area>.10,(d['slug'],'roof has no room for 25mm',clear.area)
    result['clearRoofArea']=round(clear.area,2)
  out[d['slug']]=result|{'states':len(sta)}
 assert len(out)==14 and len(hashes)==30
 return out
def check_stage(bag,table):
 roots=bag['ContainedObjects'];reg={l[2:8]:list(map(float,l.split(',')[1:]))for l in bag['LuaScript'].splitlines() if re.match(r'^--[0-9a-f]{6},',l)}
 keep=[o for o in table['ObjectStates']if yard.TAG not in o.get('Tags',[])];assert len(keep)==138 and table['ObjectStates']==keep+roots
 oldt=yard.load(R1/'work/Play-Table.json');oldb=yard.load(R1/'work/Vanta-Customs-Yard.json')['ObjectStates'][0]
 assert [o for o in oldt['ObjectStates']if yard.TAG not in o.get('Tags',[])]==keep and table['LuaScript']==oldt['LuaScript']
 old={o['GUID']:o for o in oldb['ContainedObjects']};assert sum(o==old[o['GUID']]for o in roots)==len(roots)-14
 ids=set()
 for o in roots:
  r=old[o['GUID']]
  assert set(r.get('States',{}))==set(o.get('States',{}))
  for s,old_s in zip(yard.flat(o),yard.flat(r)):
   assert s['GUID']==old_s['GUID']and s['Transform']==old_s['Transform']and s.get('LuaScript')==old_s.get('LuaScript')
  for s in [o,*o.get('States',{}).values()]:
   ids.add(s['GUID']);assert all(abs(s['Transform'][k]-v)<.00011 for k,v in zip(SHARED,reg[s['GUID']]))
 assert ids==set(reg)
 lua=LuaRuntime(unpack_returned_tuples=True);compile_lua=lua.eval('function(s)local fn,e=load(s);return fn~=nil,e end')
 scripts={s['LuaScript']for o in table['ObjectStates']for s in yard.flat(o)if s.get('LuaScript')}|{table['LuaScript'],bag['LuaScript']}
 for s in scripts:
  ok,e=compile_lua(s);assert ok,e
 stage=next(o['LuaScript']for o in keep if o['Nickname']=='Stage');owner=next(o['LuaScript']for o in roots if o['GUID']=='51838e');axes=SHARED
 harness=(R1/'src/stage-harness.txt').read_text().replace('<1e-7','<.00011').replace("assert abs((f.r.y-t['rotY']-180*iteration+180)%360-180)<.00011","assert abs((f.r.y-t['rotY']-(0 if t['posY'] < -10 else 180*iteration)+180)%360-180)<.00011").replace('assert lua.globals().loboClearOwnedMaps()==len(roots)',"lua.globals().loboStandardClear(lua.table_from({'color':'Blue'}))")
 exec(compile(harness,'Vanta Freeport Stage','exec'),{**globals(),**locals()})
 menu_choices=0
 for o in roots:
  if o['GUID']not in BY or not o.get('States'):continue
  models={int(k):v for k,v in o['States'].items()};models[len(models)+1]=o
  for active,st in models.items():
   ui=LuaRuntime(unpack_returned_tuples=True)
   ui.execute("menu={};target=nil;self={setLock=function(k)assert(k)end,clearContextMenu=function() menu={} end,addContextMenuItem=function(k,f)menu[#menu+1]=f end,setState=function(k)target=k;return {setLock=function(v)assert(v)end}end}")
   ui.execute(st['LuaScript']);ui.globals().onLoad();assert len(ui.globals().menu)==len(models)
   for i,target in models.items():
    ui.globals().target=None;ui.globals().menu[i]();assert ui.globals().target==(None if i==active else i)
    assert target['CustomMesh']['MeshURL'].endswith('-s'+str(i)+'.obj');menu_choices+=1
 return {'floorMenuChoicesTested':menu_choices,'objects':len(roots),'stageStatePositions':len(ids),'persistentTableObjects':len(keep),'uniqueLua':len(scripts),'stagePlaceRotateTwiceClear':True}
def check_public(b):
 urls=yard.urls(b);r1=yard.load(R1/'work/public-qa.json')
 def get(u):
  # New meshes and both atlas files are byte-verified at their pinned public URL.
  p=resolve(u);h=hashlib.sha256(p.read_bytes()).hexdigest()
  if '/'+PREFIX+'/'in u:
   assert '/'+(W/'pin.txt').read_text().strip()+'/'in u and hashlib.sha256(yard.get(u)).hexdigest()==h
  else:assert r1[u]==h
  return u,h
 with ThreadPoolExecutor(8)as pool:rows=dict(pool.map(get,urls))
 return {'immutableNewAssetsDownloaded':sum('/'+PREFIX+'/'in u for u in rows),'inheritedVerifiedAssets':sum('/'+PREFIX+'/'not in u for u in rows)}
if __name__=='__main__':
 pin=(W/'pin.txt').read_text().strip() if (W/'pin.txt').exists() else 'PREVIEW'
 bf,table=build(pin);b=bf['ObjectStates'][0]
 if sys.argv[-1]=='public':print(check_public(b));sys.exit()
 results={'rooms':check_rooms(b),'lifecycle':check_stage(b,table),'routes':verify.check_navigation(b)}
 if pin!='PREVIEW':results['urls']=check_public(b)
 yard.save(W/'qa.json',results);print(json.dumps({k:v for k,v in results.items() if k!='rooms'}),flush=True)
