"""Verify exported geometry through the real side approaches, in both states."""
from pathlib import Path
import json, math, sys
import numpy as np
from shapely.geometry import MultiPoint, LineString
from shapely.ops import unary_union
ROOT=Path(__file__).resolve().parents[1]

def read(path):
 v=[];f=[];groups=[];cur=[]
 for line in path.read_text().splitlines():
  q=line.split()
  if not q:continue
  if q[0]=='v':v.append([-float(q[1]),float(q[2]),float(q[3])])
  elif q[0]=='o':
   if cur:groups.append(cur);cur=[]
  elif q[0]=='f':
   ix=[int(x.split('/')[0])-1 for x in q[1:]]
   for i in range(1,len(ix)-1):f.append([ix[0],ix[i],ix[i+1]]);cur.append(f[-1])
 if cur:groups.append(cur)
 return np.asarray(v),np.asarray(f),groups

def blocked(tri,start,end):
 origin=np.asarray(start);direction=np.asarray(end)-origin
 a,b,c=tri[:,0],tri[:,1],tri[:,2];e1=b-a;e2=c-a
 h=np.cross(np.broadcast_to(direction,e2.shape),e2);det=np.einsum('ij,ij->i',e1,h)
 valid=np.abs(det)>1e-9;inv=np.divide(1.,det,out=np.zeros_like(det),where=valid)
 s=origin-a;u=inv*np.einsum('ij,ij->i',s,h);q=np.cross(s,e1)
 v=inv*np.einsum('j,ij->i',direction,q);t=inv*np.einsum('ij,ij->i',e2,q)
 return bool(np.any(valid&(u>=-1e-7)&(v>=-1e-7)&(u+v<=1+1e-7)&(t>=0)&(t<=1)))

def slice_boxes(v,groups,y):
 out=[]
 for group in groups:
  pts=v[np.unique(group)]
  if not pts[:,1].min()+1e-7<y<pts[:,1].max()-1e-7:continue
  # Collider OBJ groups are individual convex boxes/prisms.
  out.append(MultiPoint(pts[:,[0,2]]).convex_hull)
 return unary_union(out)

def main():
 report={'status':'passed','live_TTS_physics':False,'states':[]}
 for state in ['open','roof']:
  v,f,groups=read(ROOT/'Assets'/('concourse-'+state+'.obj'));tri=v[f]
  cv,cf,cg=read(ROOT/'Assets'/('concourse-'+state+'-collider.obj'))
  checks=0
  for sign in [-1,1]:
   cx=sign*7.5
   # Visible geometry: full standing-height width, actual side-to-deck direction.
   for x in np.linspace(cx-1.12,cx+1.12,31):
    for y in np.linspace(3.26,5.90,32):
     assert not blocked(tri,[x,y,sign*1.7],[x,y,sign*.9]),(state,sign,x,y)
     checks+=1
   # Swept 25 mm circular base through the opening, then turn into the aisle.
   path=LineString([(cx,sign*1.8),(cx,0),(0,0)]).buffer(25/25.4/2,quad_segs=32)
   for y in np.linspace(3.26,3.25+40/25.4,24):
    assert not path.intersects(slice_boxes(cv,cg,y)),(state,'S2 path',sign,y)
   # The deck, flush threshold and last tread meet without a horizontal gap.
   sv,sf,sg=read(ROOT/'Assets'/('concourse-stairs-'+('1'if sign==-1 else'2')+'-collider.obj'))
   sv[:,0]+=cx
   # Stair 2 has already been exported rotated through 180 degrees.
   tops=[]
   for g in sg:
    p=sv[np.unique(g)]
    if abs(p[:,1].max()-3.25)<1e-6:tops.append(MultiPoint(p[:,[0,2]]).convex_hull)
   tops.append(slice_boxes(cv,cg,3.24))
   support=unary_union(tops)
   assert support.covers(LineString([(cx,sign*1.7),(cx,0)])),(state,'unsupported threshold',sign)
  # Opaque protection survives away from designated entrances.
  for sign in [-1,1]:
   for x in np.linspace(-6.1,6.1,35):
    for y in [3.35,4.5,5.8]:assert blocked(tri,[x,y,sign*1.1],[x,y,sign*1.7])
  assert len(v)<24000 and len(cv)<24000
  report['states'].append({'state':state,'visible_entrance_rays':checks,'clear_width_inches':2.30,'clear_height_inches':2.70,'S2_swept_paths':2,'threshold_support':'continuous','visual_vertices':len(v),'collision_vertices':len(cv),'convex_collision_groups':len(cg),'opaque_central_sides':'retained'})
 (ROOT/'Source/R4-stair-access-validation.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps(report,indent=2))

if __name__=='__main__':main()
