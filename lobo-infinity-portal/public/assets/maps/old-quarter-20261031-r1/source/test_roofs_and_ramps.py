"""Regress photographed roof-cap intersections and the opposed ramp entrances."""
from pathlib import Path
import json,math
import numpy as np
from shapely.geometry import Polygon,box
from shapely.ops import unary_union
from tts_geometry import load_tts_mesh
from map_config import PIT_WIDTH,PIT_LENGTH,PIT_DEPTH,RAMP_OFFSETS
R=Path(__file__).resolve().parents[1];A=R/'Assets';records=[]
for p in sorted(A.glob('*.obj')):
 if p.stem.endswith('-collider') or not p.stem.startswith(('civic-state','annex-state','ruin-state','depot-state','utility-kiosk','site-office')):continue
 m=load_tts_mesh(p);name=p.stem;k=name.split('-state-')[0];small=k in ['utility-kiosk','utility-kiosk-open','site-office','site-office-open']
 H={'civic':2.85,'annex':3.15,'ruin':2.75,'depot':2.65}.get(k,2.55)
 nf=1 if small or k=='depot' or name.endswith('-3') else 2
 levels=[i*(H+.15)+H for i in range(nf)]
 if name.endswith('-1'):levels.append(nf*(H+.15)+.56)
 if name in ['utility-kiosk','site-office']:levels.append(H+.13+.4)
 for y in levels:
  ids=np.where((np.max(abs(m.triangles[:,:,1]-y),axis=1)<1e-5)&(m.face_normals[:,1]>.99))[0]
  assert len(ids)>0,(name,y)
  polys=[Polygon(t[:,[0,2]]) for t in m.triangles[ids]];overlap=sum(p.area for p in polys)-unary_union(polys).area
  assert overlap<.0005,(name,y,'Overlapping visible frame/parapet caps',overlap)
  records.append(dict(mesh=name,height=y,triangles=len(ids),overlapSquareInches=max(0,overlap)))
pit=load_tts_mesh(A/'excavation-cut-collider.obj');T=pit.triangles
slopes=[t for t,n in zip(T,pit.face_normals) if .1<n[1]<.999 and abs(np.ptp(t[:,1])-PIT_DEPTH)<1e-5]
assert len(slopes)==4,len(slopes)
ramps=[]
for x in sorted(RAMP_OFFSETS.values()):
 ts=[t for t in slopes if abs(np.mean(t[:,0])-x)<.5]
 assert len(ts)==2
 pts=np.concatenate(ts);top=pts[abs(pts[:,1])<1e-5];bottom=pts[abs(pts[:,1]+PIT_DEPTH)<1e-5]
 width=np.ptp(pts[:,0]);run=abs(np.mean(top[:,2])-np.mean(bottom[:,2]));assert width>=1.39 and run>4.3
 ramps.append(dict(centerX=x,entranceZ=float(np.mean(top[:,2])),floorExitZ=float(np.mean(bottom[:,2])),width=float(width),run=float(run),angleDegrees=math.degrees(math.atan(PIT_DEPTH/run))))
assert abs(ramps[0]['centerX']-ramps[1]['centerX'])>3
assert ramps[0]['entranceZ']*ramps[1]['entranceZ']<0
clear_width=ramps[1]['centerX']-ramps[0]['centerX']-(ramps[0]['width']+ramps[1]['width'])/2
assert clear_width>1.8
result={'pitSizeInches':[PIT_WIDTH,PIT_LENGTH,PIT_DEPTH],'staggeredRampEntrances':ramps,'centralFloorLaneWidthInches':clear_width,'roofCapPlanes':records,'scope':'Offline mesh checks; live TTS check pending.'}
(R/'Source/roof-and-ramp-validation.json').write_text(json.dumps(result,indent=2));print(json.dumps({'roofCapPlanesWithoutOverlap':len(records),'pitSizeInches':[PIT_WIDTH,PIT_LENGTH,PIT_DEPTH],'centralFloorLaneWidthInches':clear_width,'rampEntrances':ramps}))
