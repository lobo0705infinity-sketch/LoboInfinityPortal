from pathlib import Path
import json,math
import numpy as np,trimesh
from shapely.geometry import LineString,Polygon
from shapely import affinity
R=Path(__file__).resolve().parents[1];A=R/'Assets'
widths=[]
for stem,d in [('parcel-office',4.5),('north-service-office',4.)]:
 for state in ['ground','roof']:
  for suffix in ['', '-collider']:
   name=f'r15-{stem}-{state}{suffix}.obj';m=trimesh.load(A/name,force='mesh',process=False)
   sections=trimesh.intersections.mesh_plane(m,[0,1,0],[0,1.2,0])
   for z in [-d/2,d/2]:
    xs=[]
    for line in sections:
     a,b=line[:,[0,2]]
     if min(a[1],b[1])-1e-7<=z<=max(a[1],b[1])+1e-7 and abs(a[1]-b[1])>1e-8:
      x=a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1]);xs.append(x)
    lo=max(x for x in xs if x<0);hi=min(x for x in xs if x>0);mm=(hi-lo)*25.4
    assert abs(mm-26.67)<.01,(name,z,mm)
    widths.append(dict(mesh=name,wall_z=z,clear_mm=round(mm,3)))
b=json.load(open(R/'Source/R15-layout.json'))['ObjectStates'][0];old=json.load(open(R/'Saved-Objects/Redline-Interchange-R14-Custom-Layout-Mat.json'))['ObjectStates'][0]
rot=['193c66','b3711b','eaa1fd'];objs={o['GUID']:o for o in b['ContainedObjects']};olds={o['GUID']:o for o in old['ContainedObjects']}
for guid in rot:
 for q,p in zip([objs[guid]]+list(objs[guid].get('States',{}).values()),[olds[guid]]+list(olds[guid].get('States',{}).values())):
  assert abs((q['Transform']['rotY']-p['Transform']['rotY'])%360-90)<.001
# Actual collider footprint, scale and yaw; ensure rotated buildings remain inside board and separate.
foot={}
for o in b['ContainedObjects']:
 if not ({'building','building-state'} & set(o.get('Tags',[]))):continue
 t=o['Transform'];v=[]
 for l in (A/o['CustomMesh']['ColliderURL'].split('/')[-1]).read_text().splitlines():
  if l.startswith('v '):v.append((-float(l.split()[1])*t['scaleX'],float(l.split()[3])*t['scaleZ']))
 p=affinity.translate(affinity.rotate(Polygon(v).convex_hull,-t['rotY'],origin=(0,0)),t['posX'],t['posZ']);foot[o['GUID']]=p
for guid in rot:
 assert all(abs(v)<=24 for v in foot[guid].bounds),(guid,foot[guid].bounds)
 for other,p in foot.items():
  if other!=guid:assert foot[guid].intersection(p).area<.001,(guid,other)
r={'measured_door_sections':widths,'rotated_buildings_in_all_states':3,'rotated_buildings_inside_board':True,'rotated_buildings_overlap_other_buildings':False,'live_tts_tested':False}
(R/'Source/R15-validation.json').write_text(json.dumps(r,indent=2));print(json.dumps(r,indent=2))
