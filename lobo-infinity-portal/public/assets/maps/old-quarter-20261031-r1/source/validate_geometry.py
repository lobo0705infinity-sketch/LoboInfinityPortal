from pathlib import Path
import json,math,collections
import numpy as np
import trimesh
from shapely.geometry import Point,MultiPoint,box
from shapely.ops import unary_union
from scipy.ndimage import label
ROOT=Path(__file__).resolve().parents[1];A=ROOT/'Assets'
items=json.loads((ROOT/'Source'/'layout.json').read_text())
manifest=json.loads((ROOT/'Source'/'mesh-manifest.json').read_text())
def world(p,v):
 t=math.radians(p['angle']);R=np.array([[math.cos(t),0,math.sin(t)],[0,1,0],[-math.sin(t),0,math.cos(t)]])
 return np.array(v)@R.T+[p['x'],p['y'],p['z']]
footprints=[];ground_geometry=[]
for p in items:
 if p['kind'] in ['mat','marking','pavement']:continue
 m=trimesh.load(A/(p['mesh']+'.obj'),force='mesh',process=False)
 v=world(p,m.vertices);poly=MultiPoint(v[:,[0,2]]).convex_hull
 footprints.append((p['title'],poly))
 ground_geometry.append((p,v,np.array(m.faces)))

tech=[(-20,-20),(-20,-10),(-6,-6),(6,6),(20,10),(20,20)]
corners=[(24,-24),(-24,24)];rad=25/25.4/2
records=[]
for i,t in enumerate(tech):
 boundary_clearance=min(math.dist(t,c)-24-rad for c in corners)
 separation=min(math.dist(t,u)-2*rad for u in tech if u!=t)
 nearest=min((Point(t).distance(f)-rad,n) for n,f in footprints)
 inside=all(-24+rad<=v<=24-rad for v in t)
 records.append(dict(token=i+1,center=t,outsideDZInches=boundary_clearance,nearestTokenEdgeGap=separation,nearestSceneryEdgeGap=nearest[0],nearestScenery=nearest[1]))
 assert inside and boundary_clearance>8 and separation>8 and nearest[0]>.05,records[-1]

consoles=[(-16/math.sqrt(2),-16/math.sqrt(2)),(0,0),(16/math.sqrt(2),16/math.sqrt(2))]
console_records=[]
for t in consoles:
 nearest=min((Point(t).distance(f)-40/25.4/2,n) for n,f in footprints)
 console_records.append(dict(center=t,nearestSceneryEdgeGap=nearest[0],nearestScenery=nearest[1]))
 assert nearest[0]>.55,console_records[-1]

# Conservative S2 street-route check: every building footprint and excavation
# pocket is treated as an obstruction, even where interiors/ramps are traversable.
obstacles=unary_union([f for _,f in footprints]).buffer(rad+.04)
step=.4;coords=np.arange(-24+rad,24-rad,step);n=len(coords)
blocked=np.array([[obstacles.contains(Point(x,z)) for x in coords] for z in coords])
labels,count=label(~blocked)
def component(t):
 x,z=t;i=np.argmin(abs(coords-z));j=np.argmin(abs(coords-x));return labels[i,j]
anchors=[(22,-18),(-22,18)];a=[int(component(t)) for t in anchors]
assert a[0]!=0 and a[0]==a[1],('DZ street routes disconnected',a)
for t in tech:assert component(t)==a[0],('Tech not reachable',t)
for t in consoles:
 rings=[(t[0]+1.45*math.cos(a),t[1]+1.45*math.sin(a)) for a in np.linspace(0,2*math.pi,24,endpoint=False)]
 reachable=sum(component(p)==a[0] for p in rings)
 assert reachable>=8,('Console approaches restricted',t,reachable)

# Mesh and collider format checks use exported files. Every compound component
# must stay below 256 triangles; every locked nonconvex collider does too.
mesh_checks=[]
for m in manifest:
 v=0;tris=0;component_tris=[];current=0
 for l in (A/(m['name']+'-collider.obj')).read_text().splitlines():
  if l.startswith('o '):
   if current:component_tris.append(current)
   current=0
  if l.startswith('f '):current+=1;tris+=1
 if current:component_tris.append(current)
 maxtri=max(component_tris,default=0)
 assert maxtri<256,(m['name'],maxtri)
 assert m['vertices']<25000
 mesh_checks.append(dict(mesh=m['name'],expandedVertices=m['vertices'],colliderComponents=len(component_tris),maxColliderComponentTriangles=maxtri))

# Detect unintended full-volume overlaps between separate large buildings.
for i,(name,f) in enumerate(footprints):
 if not any(p['title']==name and p['kind']=='building' for p in items):continue
 for name2,f2 in footprints[i+1:]:
  if any(p['title']==name2 and p['kind']=='building' for p in items):assert f.intersection(f2).area<.01,(name,name2)

result=dict(tableSize=[48,48],deployment=dict(corners=corners,radius=24),consoleCenters=consoles,
techDiameterMm=25,consoleDiameterMm=40,legalSixTokenExample=records,consoleClearance=console_records,
streetRoutes=dict(modelBaseDiameterMm=25,gridResolutionInches=step,bothDZsConnected=True,allSixTechLocationsReachable=True,allConsolesMultipleApproaches=True),
meshes=mesh_checks,liveTTSPhysicsAndGameplay='Not run in this environment; validate in TTS before tournament use.')
(ROOT/'Source'/'geometry-validation.json').write_text(json.dumps(result,indent=2))
print(json.dumps({'six_legal_techs':True,'min_tech_DZ_clearance':min(r['outsideDZInches'] for r in records),'min_tech_edge_separation':min(r['nearestTokenEdgeGap'] for r in records),'min_console_to_scenery_edge_gap':min(r['nearestSceneryEdgeGap'] for r in console_records),'all_street_routes_pass':True,'meshes_and_collider_components_pass':len(mesh_checks)}))
