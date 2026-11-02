"""Check identifiers, colliders, objective approaches and exterior base routes."""
from pathlib import Path
import json,math,re,collections
import numpy as np
from shapely.geometry import Polygon,Point,box,LineString
from shapely import affinity
from shapely.ops import unary_union
from lupa import LuaRuntime
ROOT=Path(__file__).resolve().parents[1]
b=json.loads((ROOT/'Map-Bags/Verdant-Exchange-Uplink-Center-R1.json').read_text())['ObjectStates'][0]
layouts=json.loads((ROOT/'Source/layout.json').read_text())
all_objects=[b]+[q for o in b['ContainedObjects'] for q in [o]+list(o.get('States',{}).values())]
ids=[o['GUID']for o in all_objects];assert len(ids)==len(set(ids))
records={l[2:].split(',')[0]:list(map(float,l[2:].split(',')[1:]))for l in b['LuaScript'].splitlines()}
assert set(records)==set(ids)-{b['GUID']}
lua=LuaRuntime()
for o in all_objects:
 s=o.get('LuaScript','')
 if s:lua.execute('assert(load(...))',s)
 if o is b:continue
 assert 'LoboMap:VerdantExchangeR1' in o['Tags']
 assert all(abs(v-o['Transform'][k])<1e-5 for v,k in zip(records[o['GUID']],['posX','posY','posZ','rotX','rotY','rotZ']))
 for k,u in o.get('CustomMesh',{}).items():
  if isinstance(u,str) and u:assert (ROOT/'Assets'/u.rsplit('/',1)[-1]).exists(),u
 if 'building' in o['Tags']:
  h=float(re.search(r'Height \(base to top\): ([\d.]+)',o['Description'])[1]);assert abs(h*4-round(h*4))<1e-6
controller=next(o for o in b['ContainedObjects'] if o['GUID']=='b9fffe')
assert 'PROVISIONING |' not in controller['LuaScript'] and 'SIROCCO WELLS' not in controller['LuaScript']
primary=[p for p in layouts if p['kind'] in ['building','scatter']]
for i,p in enumerate(primary):
 poly=Polygon(p['footprint']);assert box(-24,-24,24,24).covers(poly),p['label']
 for q in primary[i+1:]:assert poly.intersection(Polygon(q['footprint'])).area<.01,(p['label'],q['label'])
clearance=min(Polygon(p['footprint']).distance(Point(0,z))for p in primary for z in [-12,0,12])
assert clearance>=2.,clearance

def components(path):
 verts=[];groups=[];current=[]
 for line in path.read_text().splitlines():
  p=line.split()
  if not p:continue
  if p[0]=='v':verts.append([-float(p[1]),float(p[2]),float(p[3])])
  elif p[0]=='o':
   if current:groups.append(current)
   current=[]
  elif p[0]=='f':current.extend(int(x.split('/')[0])-1 for x in p[1:])
 if current:groups.append(current)
 v=np.array(verts)
 return [v[sorted(set(g))] for g in groups]

all_parts=[];polys=[];max_vertices=0
for o in b['ContainedObjects']:
 if not o.get('CustomMesh') or 'ground' in o['Tags'] or 'mission' in o['Tags']:continue
 t=o['Transform'];angle=-t['rotY']
 parts=components(ROOT/'Assets'/o['CustomMesh']['ColliderURL'].rsplit('/',1)[-1])
 for vs in parts:
  max_vertices=max(max_vertices,len(vs));assert len(vs)<=255
  # Ignore floors and overhanging roofs, retain actual blocking walls/posts.
  if vs[:,1].max()<=.18 or vs[:,1].min()>=1.55:continue
  p=Polygon(vs[:,[0,2]]).convex_hull
  if p.area<1e-7:continue
  p=affinity.translate(affinity.rotate(p,angle,origin=(0,0)),t['posX'],t['posZ'])
  polys.append(p);all_parts.append((p,float(vs[:,1].max()),o['Nickname']))
block=unary_union(polys)
routing=[]
for radius in [.5,.80]:
 inflated=block.buffer(radius+.015)
 grid={(i,j):(i*.4,j*.4)for i in range(-57,58)for j in range(-57,58)if not inflated.covers(Point(i*.4,j*.4))}
 def reach(start):
  q=collections.deque([start]);seen={start}
  while q:
   i,j=q.popleft()
   for di,dj in [(1,0),(-1,0),(0,1),(0,-1)]:
    k=i+di,j+dj
    if k in grid and k not in seen:seen.add(k);q.append(k)
  return seen
 seeds=[min(grid,key=lambda k:math.dist(grid[k],p))for p in [(-22,0),(22,0)]]
 regions=[reach(p)for p in seeds]
 assert seeds[1]in regions[0],('Deployment sides disconnected',radius)
 objective_results=[]
 for z in [-12,0,12]:
  # Legal contact approaches: centre is objective radius + moving base radius away.
  wanted=40/25.4/2+radius+.025
  targets=[k for k,p in grid.items()if abs(math.dist(p,(0,z))-wanted)<.27]
  assert any(k in regions[0] for k in targets),(radius,z,'unreachable objective')
  objective_results.append({'centre':[0,z],'reachable_contact_cells':sum(k in regions[0]for k in targets)})
 routing.append(dict(base_diameter_inches=radius*2,connected_cells=len(regions[0]),objectives=objective_results))
# Screen the whole table at an S2 eye-height sample. This is a geometric audit,
# not a promise of tournament balance or a substitute for playtesting.
solid=unary_union([p for p,h,n in all_parts if h>=1.55])
open_lanes=[z for z in np.arange(-23,23.01,.5) if not solid.intersects(LineString([(-23.5,z),(23.5,z)]))]
report=dict(status='passed',root_objects=len(b['ContainedObjects']),building_states=18,unique_ids=len(ids),maximum_convex_component_vertices=max_vertices,minimum_objective_clearance_inches=round(clearance,3),routing=routing,full_width_eye_height_lanes_z_inches=list(map(float,open_lanes)),limitations='No live Tabletop Simulator physics or multiplayer playtest performed.')
(ROOT/'Source/geometry-validation.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
