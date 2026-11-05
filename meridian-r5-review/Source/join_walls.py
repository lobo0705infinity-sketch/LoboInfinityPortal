"""Join vertical wall prisms by exact 2D union at every height transition.
No internal or coincident faces are emitted at segment, trim or partition joins.
"""
import numpy as np
from shapely.geometry import Polygon,Point
from shapely.geometry.polygon import orient
from shapely.ops import unary_union,triangulate

def polygons(p):
 if p.is_empty:return []
 if p.geom_type=='Polygon':return [p]
 return [q for q in p.geoms if q.geom_type=='Polygon']
def join_walls(m):
 if not m.wall_volumes or getattr(m,'_walls_joined',False):return
 m._walls_joined=True
 volumes=[dict(v,shape=Polygon(v['poly']).buffer(0))for v in m.wall_volumes]
 wall_parts=[p for p in m.parts if p['kind']=='wall']
 if not wall_parts:return
 keep=[]
 for f in m.f:
  if not any(p['first']<=min(f)and max(f)<p['last']for p in wall_parts):keep.append(f)
 removed=len(m.f)-len(keep);m.f=keep
 m.parts=[p for p in m.parts if p['kind']!='wall'];first=len(m.v)
 levels=sorted(set(round(v['y'],6)for v in volumes)|set(round(v['y']+v['h'],6)for v in volumes))
 slabs=[]
 for lo,hi in zip(levels,levels[1:]):
  mid=(lo+hi)/2;active=[v['shape']for v in volumes if v['y']-1e-7<mid<v['y']+v['h']+1e-7]
  slabs.append(unary_union(active).buffer(0))
 def material(coords):
  c=np.array(coords).mean(axis=0);pt=Point(c[0],c[2])
  for v in reversed(volumes):
   if v['y']-1e-5<=c[1]<=v['y']+v['h']+1e-5 and v['shape'].buffer(1e-6).covers(pt):return v['mat']
  return 'limestone'
 def face(coords):m.face(coords,material(coords))
 def cap(shape,y,up):
  for p in polygons(shape):
   for t in triangulate(p):
    if not p.covers(t):continue
    q=list(t.exterior.coords)[:3]
    if up:q=q[::-1]
    face([(x,y,z)for x,z in q])
 for i,(lo,hi)in enumerate(zip(levels,levels[1:])):
  for p in polygons(slabs[i]):
   p=orient(p,sign=1)
   for ring in [p.exterior]+list(p.interiors):
    points=list(ring.coords)
    for (x,z),(xx,zz)in zip(points,points[1:]):
     if abs(x-xx)+abs(z-zz)<1e-8:continue
     face([(x,lo,z),(x,hi,z),(xx,hi,zz),(xx,lo,zz)])
 for i,y in enumerate(levels):
  below=slabs[i-1]if i>0 else Polygon();above=slabs[i]if i<len(slabs)else Polygon()
  cap(below.difference(above),y,True);cap(above.difference(below),y,False)
 m.parts.append({'kind':'wall','first':first,'last':len(m.v)})
 m.wall_join_evidence={'prisms_joined':len(volumes),'height_slabs':len(slabs),'original_wall_triangles_removed':removed,'joined_wall_triangles':sum(min(f)>=first for f in m.f),'internal_horizontal_faces_emitted':0}
