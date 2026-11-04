import build_hut as b
import numpy as np,json
from shapely.geometry import Polygon,box
from shapely.ops import triangulate

def generate(view):
 b.parts=[]
 def top(r,y,hole=False):
  p=Polygon(b.poly(r))
  if hole:p=p.difference(box(2,-.8,3.4,2.85))
  for t in triangulate(p):
   if p.covers(t.representative_point()):
    vv=np.array([(x,y,z)for x,z in list(t.exterior.coords)[:3]]);b.parts.append((vv,[(2,1,0)],'stone',True))
 def panel(a,bb,y,h):
  v=np.array([(a[0],y,a[1]),(bb[0],y,bb[1]),(bb[0],y+h,bb[1]),(a[0],y+h,a[1])]);b.parts.append((v,[(0,1,2),(0,2,3),(2,1,0),(3,2,0)],'wood',True))
 def walls(r,y):
  pp=b.poly(r)
  for i in range(8):
   a=pp[i];bb=pp[(i+1)%8];mid=(a+bb)/2;u=(bb-a)/np.linalg.norm(bb-a)
   if i in [0,2,4,6]:
    gap=2.5 if i==0 and y<1 else 1.4;l=mid-u*gap/2;rr=mid+u*gap/2
    panel(a,l,y,2.75);panel(rr,bb,y,2.75);panel(l,rr,y+2.2,.55)
   else:panel(a,bb,y,.9);panel(a,bb,y+2.15,.6)
 top(4.5,.25);walls(4.05,.25)
 for i in range(12):
  y=.25+(i+1)*.25;z=-2.9+i*.43
  b.quad([(4.125,y,z-.215),(4.125,y,z+.215),(5.375,y,z+.215),(5.375,y,z-.215)],'stone')
 b.quad([(4.125,3.25,1.95),(4.125,3.25,2.95),(5.375,3.25,2.95),(5.375,3.25,1.95)],'plank')
 if view>=2:
  top(4.9,3.25);walls(3.65,3.25)
  for i in range(12):
   y=3.25+(i+1)*.25;z=-.6+i*.285
   b.quad([(2.05,y,z-.1425),(2.05,y,z+.1425),(3.25,y,z+.1425),(3.25,y,z-.1425)],'wood')
 if view>=3:top(3.75,6.25,True)
 # Counters and table tops support figures without adding tiny detail collisions.
 for c,s in [((-.5,1.36,2.9),(4.5,.12,.8)),((0,1.21,-2.9),(3.5,.18,.7))]:
  x,y,z=c;xx,_,zz=s;b.quad([(x-xx/2,y,z-zz/2),(x-xx/2,y,z+zz/2),(x+xx/2,y,z+zz/2),(x+xx/2,y,z-zz/2)],'wood')
 return list(b.parts)
report={}
for view in [1,2,3]:
 ps=generate(view);report[view]=b.objwrite(b.A/f'hut-view-{view}-collider.obj',ps,True);assert report[view]['triangles']<255
(b.ROOT/'review/colliders.json').write_text(json.dumps(report,indent=2));print('Colliders',report)
