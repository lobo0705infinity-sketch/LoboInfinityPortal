"""Sample actual exported triangles for obvious roof-to-objective dominance.
This is a sampled geometric diagnostic, not an Infinity model-eye playtest.
"""
from pathlib import Path
import json,math
import numpy as np
import trimesh
from tts_geometry import load_tts_mesh
from map_config import STREET_Y
from shapely.geometry import Polygon,Point
from shapely.ops import unary_union
R=Path(__file__).resolve().parents[1];items=json.loads((R/'Source/layout.json').read_text());triangles=[];roofsets=[]
def transform(p,vs):
 t=math.radians(p['angle']);rot=np.array([[math.cos(t),0,math.sin(t)],[0,1,0],[-math.sin(t),0,math.cos(t)]])
 return vs@rot.T+[p['x'],p['y'],p['z']]
for p in items:
 m=load_tts_mesh(R/'Assets'/(p['mesh']+'.obj'));local=m.triangles;v=transform(p,m.vertices);triangles.append(v[m.faces])
 if p['kind']=='building':
  kind=p['mesh'].split('-state-')[0];ry={'civic':6,'annex':6.6,'ruin':5.8,'depot':2.8,'utility-kiosk':2.68,'site-office':2.68}[kind]
  ts=[Polygon(t[:,[0,2]]) for t in local if np.max(abs(t[:,1]-ry))<.001 and Polygon(t[:,[0,2]]).area>.001]
  if not ts:continue
  poly=unary_union(ts).buffer(-.4);pts=[]
  for x in np.arange(-4,4.01,1.5):
   for z in np.arange(-3,3.01,1.5):
    if poly.contains(Point(x,z)):pts.append(transform(p,np.array([[x,ry+1.45,z]]))[0])
  roofsets.append((p['title'],pts))
T=np.concatenate(triangles);v0=T[:,0];e1=T[:,1]-v0;e2=T[:,2]-v0
def visible(o,end):
 d=end-o;L=np.linalg.norm(d);d/=L;p=np.cross(np.broadcast_to(d,e2.shape),e2);det=np.einsum('ij,ij->i',e1,p)
 inv=np.divide(1,det,out=np.zeros_like(det),where=abs(det)>1e-9);s=o-v0;u=np.einsum('ij,ij->i',s,p)*inv;q=np.cross(s,e1);v=(q@d)*inv;t=np.einsum('ij,ij->i',e2,q)*inv
 return not np.any((abs(det)>1e-9)&(u>=-1e-8)&(v>=-1e-8)&(u+v<=1+1e-8)&(t>.025)&(t<L-.025))
targets=[np.array([a,STREET_Y+1.45,a]) for a in [-16/math.sqrt(2),0,16/math.sqrt(2)]]
result=[]
for name,pts in roofsets:
 rows=[dict(eye=p.tolist(),visibleConsoles=[i+1 for i,t in enumerate(targets) if visible(p,t)]) for p in pts]
 result.append(dict(building=name,sampledRoofPositions=len(rows),maxConsoleSightlines=max((len(x['visibleConsoles']) for x in rows),default=0),samples=rows))
(R/'Source/roof-sightline-sampling.json').write_text(json.dumps({'silhouetteEyeHeightInches':1.45,'results':result,'scope':'Point rays to three S2-height objective positions; actual windows and cover triangles included. Full silhouette, trooper facing and gameplay not simulated.'},indent=2))
print(json.dumps([dict(building=r['building'],positions=r['sampledRoofPositions'],maxVisibleConsoles=r['maxConsoleSightlines']) for r in result]))
