"""Scoped Dig access repairs. Preserve original faces/UVs outside edited geometry."""
from pathlib import Path
import json,re,copy,hashlib,subprocess
import numpy as np
from mesh_tools import Obj
ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'lobo-infinity-portal/public/assets/maps/top40-excavation-interiors-20261101-r1'
OUT=ROOT/'lobo-infinity-portal/public/assets/maps/dig-access-20261124';OUT.mkdir(exist_ok=True)
URL='https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/main/lobo-infinity-portal/public/assets/maps/dig-access-20261124/'
report=[]
def mesh(name,kind,state,collider):
 o=Obj(SRC/name);remove=set();moved=set();delta=.8 if kind=='civic' else 0
 groups=o.groups()
 # UV sample from the existing yellow exterior ladder rung.
 uv=(.5,.5)
 for g in groups:
  a,b=o.bounds(g)
  if a[2]<-3.23 and b[2]<-3.23 and .2<a[1]<.3:
   refs=o.lines[o.fi[g[0]]].split()[1:]
   ts=[o.uv[int(r.split('/')[1])-1] for r in refs if '/'in r and r.split('/')[1]]
   if ts:uv=np.mean(ts,axis=0);break
 for g in groups:
  a,b=o.bounds(g)
  if kind in ['annex','civic']:
   # All stair treads, railings and posts; do not touch surrounding slabs/walls.
   if a[0]>=1.33+delta-1e-5 and b[0]<=2.97+delta+1e-5 and a[2]>=-2.60 and b[2]<=.24 and a[1]>=0 and b[1]<=4.13:remove.update(g)
   # Obsolete stairwell curb on roof; replaced by an open ladder landing.
   if a[0]>=1.26+delta and b[0]<=3.04+delta and a[2]>=-2.70 and b[2]<=.40 and a[1]>=5.99:remove.update(g)
  if kind=='civic' and a[2]>=-3.326 and b[2]<=-3.079 and a[0]>=-4.256 and b[0]<=-3.444:
   moved.update(o.faces[g].flatten())
 # Exterior ladder moves from south wall to clear west wall, z=-0.65.
 for i in moved:
  x,y,z=o.v[i];o.v[i]=[-4.28+(z+3.28),y,-.65-(x+3.85)]
 lines=[];vi=0
 for i,l in enumerate(o.lines):
  if l.startswith('v '):
   if vi in moved:l='v '+' '.join(f'{v:.7f}' for v in o.v[vi])
   vi+=1
  if i not in {o.fi[f] for f in remove}:lines.append(l)
 nv=len(o.v);nt=len(o.uv)
 def box(a,b,tex=uv):
  nonlocal nv,nt
  x,y,z=a;X,Y,Z=b
  pts=[(x,y,z),(X,y,z),(X,Y,z),(x,Y,z),(x,y,Z),(X,y,Z),(X,Y,Z),(x,Y,Z)]
  lines.extend('v '+' '.join(f'{v:.7f}'for v in p)for p in pts)
  floor_texture=isinstance(tex,str)
  if not collider:
   if floor_texture:
    # Retain the original tiled-floor atlas swatch; map full surfaces, not a single pixel.
    for u,v in [(0.001,.501),(.124,.501),(.124,.624),(.001,.624)]:lines.append(f'vt {u} {v}')
    nt+=4
   else:lines.append(f'vt {tex[0]:.7f} {tex[1]:.7f}');nt+=1
  for f in [(0,3,2),(0,2,1),(4,5,6),(4,6,7),(0,4,7),(0,7,3),(1,2,6),(1,6,5),(3,7,6),(3,6,2),(0,1,5),(0,5,4)]:
   lines.append('f '+' '.join(str(nv+i+1)+(f'/{nt-3+([0,1,1,0,3,2,2,3][i])}'if floor_texture and not collider else f'/{nt}'if not collider else '')for i in f))
  nv+=8
 def ladder(x,z,low,high):
  for side in [-.36,.36]:box((x+side-.045,low,z-.045),(x+side+.045,high+.45,z+.045))
  for y in np.arange(low+.2,high+.16,.24):box((x-.36,y-.03,z-.035),(x+.36,y+.03,z+.035))
  for y in np.arange(low+.4,high,.9):
   for side in [-.36,.36]:box((x+side-.025,y-.025,z-.18),(x+side+.025,y+.025,z+.035))
 if kind in ['annex','civic']:
  floor=3.0 if kind=='civic'else 3.3
  ladder(2.15+delta,.12,.035,floor)
  if state>=2:
   # Solid landing under upper ladder; lower ladder opening stays clear.
   # Use a floor UV sample, preserving the existing shared texture atlas.
   tex=uv
   for f,idx in zip(o.faces,o.fi):
    if np.all(abs(o.v[f,1]-.035)<1e-5):
     ref=o.lines[idx].split()[1].split('/');
     if len(ref)>1 and ref[1]:tex=o.uv[int(ref[1])-1]
     break
   box((1.34+delta,floor-.14,-2.60),(2.96+delta,floor,-.70),'floor')
   ladder(2.15+delta,-1.95,floor,2*floor)
  if state==3:box((1.34+delta,2*floor-.15,-1.0),(2.96+delta,2*floor,.30),'floor')
 elif kind=='ledge' and state>=2:
  ladder(.45,.24,2.9,6.36)
 outname=f'{kind}-state-{state}-'+('collider.obj'if collider else 'mesh.obj')
 # Tenement South and Central Ruined Block have distinct source mesh variants.
 if kind=='ledge':outname=name[:16]+'-'+outname
 (OUT/outname).write_text('\n'.join(lines)+'\n')
 report.append(dict(file=outname,removed_faces=len(remove),moved_vertices=len(moved),added_vertices=nv-len(o.v)))
 return URL+outname
# One optional text line in the existing header; no button/layout/action changes.
broker=ROOT/'tts-map-controls-standard/standard-broker.lua'
s=broker.read_text();old="text('LOBO',12,-7,180,12,20);text('Map Controls',12,-27,220,22,30)"
new="text(state.mapName or 'LOBO',12,-7,state.mapName and 258 or 180,state.mapName and 11 or 12,20);text('Map Controls',12,-27,220,22,30)"
assert old in s or new in s
s=s.replace(old,new);broker.write_text(s)
def walk(o):
 yield o
 for k in ['ContainedObjects','ChildObjects']:
  for c in o.get(k,[]):yield from walk(c)
 for c in o.get('States',{}).values():yield from walk(c)
for mapid in ['810340','8a1c29']:
 p=ROOT/f'lobo-infinity-portal/public/assets/maps/standard-controls-20261118/{mapid}.json';data=json.loads(subprocess.check_output(['git','show','HEAD:'+str(p.relative_to(ROOT))],cwd=ROOT));bag=data['ObjectStates'][0]
 for o in bag['ContainedObjects']:
  n=o.get('Nickname','').split(' |')[0]
  kind='annex'if n in ['Research Annex East','Central Survey Annex']else 'civic'if n=='Civic Corner West'else 'ledge'if n in ['Tenement South','Central Ruined Block']else None
  if kind:
   for key,st in [('3',o)]+list(o.get('States',{}).items()):
    state=int(key)
    if kind=='ledge'and state==1:continue
    for field in ['MeshURL','ColliderURL']:
     st['CustomMesh'][field]=mesh(st['CustomMesh'][field].split('/')[-1],kind,state,field=='ColliderURL')
    if kind in ['annex','civic']:st['Description']=st.get('Description','').replace('External ladders persist across states.','Internal ladders connect ground, upper floor and roof. Exterior ladders persist across states.')
 for o in walk(bag):
  script=o.get('LuaScript','')
  if 'function loboStandardState()'in script:
   script=script.replace('return{flipped=LOBO_MAP_ROTATION_FLIPPED','return{mapName="Old Quarter Excavation - The Dig",flipped=LOBO_MAP_ROTATION_FLIPPED')
  match=re.search(r'local loboLifeBrokerData=(".*")',script)
  if match:
   d=json.loads(json.loads(match[1]));d['LuaScript']=s
   script=script[:match.start(1)]+json.dumps(json.dumps(d,separators=(',',':')))+script[match.end(1):]
  o['LuaScript']=script
 p.write_text(json.dumps(data,separators=(',',':')))
 (OUT/f'{mapid}.json').write_text(json.dumps(data,separators=(',',':')))
(ROOT/'map-fixes/dig-20261124/geometry-report.json').write_text(json.dumps(report,indent=2))
print('Built',len(list(OUT.glob('*.obj'))),'mesh/collider files and both map variants')
