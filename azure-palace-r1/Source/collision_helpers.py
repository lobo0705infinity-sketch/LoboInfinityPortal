"""Preserve world geometry, give each state a common local pivot and convex parts.
Run after package_halcyon.py. Collision uses the author's closed primitives;
free scenic shells receive separate convex hulls, never the whole building.
"""
from pathlib import Path
import json,math,hashlib,copy
import numpy as np,trimesh
from shapely.geometry import Polygon
from shapely.ops import triangulate
R=Path(__file__).resolve().parents[1];A=R/'Assets'

def convex_polys(poly):
 p=Polygon(poly).buffer(0)
 if p.is_empty:return []
 if abs(p.convex_hull.area-p.area)<1e-7:return [p]
 pieces=[t for t in triangulate(p)if p.covers(t)]
 changed=True
 while changed:
  changed=False
  for i,a in enumerate(pieces):
   for j in range(i):
    b=pieces[j]
    if a.distance(b)>1e-7:continue
    u=a.union(b)
    if u.geom_type=='Polygon'and abs(u.convex_hull.area-u.area)<1e-7:
     pieces[j]=u;pieces.pop(i);changed=True;break
   if changed:break
 return pieces

def hull(points):
 pts=np.unique(np.round(np.array(points,float),7),axis=0)
 if len(pts)<3:return None
 centered=pts-pts.mean(axis=0)
 if np.linalg.matrix_rank(centered,tol=1e-7)<3:
  _,_,vh=np.linalg.svd(centered,full_matrices=False);normal=vh[-1]
  pts=np.vstack([pts+normal*.004,pts-normal*.004])
 try:m=trimesh.convex.convex_hull(pts)
 except Exception:return None
 if len(m.faces)>=255:
  p=np.asarray(m.vertices);chosen=list(dict.fromkeys([int(np.argmin(p[:,a]))for a in range(3)]+[int(np.argmax(p[:,a]))for a in range(3)]))
  while len(chosen)<min(64,len(p)):
   distances=((p[:,None,:]-p[chosen][None,:,:])**2).sum(axis=2).min(axis=1);chosen.append(int(np.argmax(distances)))
  m=trimesh.convex.convex_hull(p[chosen])
 return m if m.volume>1e-9 else None

def compound(st):
 volumes=[]
 for kind,data in st['physical_primitives']:
  if kind=='poly':poly,y,h=data
  else:
   x,y,z,w,h,d=data;poly=[(x-w/2,z-d/2),(x+w/2,z-d/2),(x+w/2,z+d/2),(x-w/2,z+d/2)]
  shape=Polygon(poly).buffer(0)
  if h>1e-7 and shape.area>1e-8:volumes.append((shape,y,y+h))
 volumes.sort(key=lambda p:p[0].area*(p[2]-p[1]),reverse=True)
 kept=[]
 for p,lo,hi in volumes:
  if any(a-1e-7<=lo and b+1e-7>=hi and q.buffer(1e-7).covers(p)for q,a,b in kept):continue
  kept.append((p,lo,hi))
 parts=[]
 for p,lo,hi in kept:
  for c in convex_polys(list(p.exterior.coords)[:-1]):
   q=list(c.exterior.coords)[:-1];m=hull([(x,y,z)for y in [lo,hi]for x,z in q])
   if m is not None:parts.append(m)
 for points in st['physical_extras']:
  m=hull(points)
  if m is not None:parts.append(m)
 # Uncaptured faces are only scenery shells: roof slopes, outcrops, bath shells.
 vs=[];fs=[]
 for points in st['free_faces']:
  n=len(vs);vs.extend(points)
  for j in range(1,len(points)-1):fs.append([n,n+j,n+j+1])
 if fs:
  free=trimesh.Trimesh(vs,fs,process=True)
  for component in free.split(only_watertight=False):
   m=hull(component.vertices)
   if m is not None:parts.append(m)
 assert parts
 return parts

def write_compound(path,parts,pivot):
 lines=['# Halcyon movable compound collider: one closed convex mesh per object/group']
 count=0;stored=[]
 for i,m in enumerate(parts):
  vs=np.asarray(m.vertices).copy();vs-=pivot;vs[:,0]*=-1;faces=m.faces[:,::-1]
  assert len(faces)<255,(path.name,i,len(faces))
  lines+=['o convex_%04d'%i,'g convex_%04d'%i]
  lines+=['v %.7f %.7f %.7f'%tuple(p)for p in vs]
  lines+=['f '+' '.join(str(count+j+1)for j in f)for f in faces]
  count+=len(vs);stored.append({'vertices':vs.tolist(),'faces':faces.tolist()})
 path.write_text('\n'.join(lines)+'\n');assert count<25000,(path.name,count)
 return stored

def localize(path,pivot):
 lines=[]
 for line in path.read_text().splitlines():
  if line.startswith('v '):
   x,y,z=map(float,line.split()[1:]);line='v %.7f %.7f %.7f'%(x+pivot[0],y-pivot[1],z-pivot[2])
  lines.append(line)
 path.write_text('\n'.join(lines)+'\n')
