from __future__ import annotations
import math,json,hashlib
from pathlib import Path
from functools import lru_cache
from collections import defaultdict
import numpy as np
from shapely.geometry import Polygon, MultiPoint
ROOT=Path(__file__).resolve().parents[1]; BASE=ROOT/'base'; AS=ROOT/'assets';WORK=ROOT/'work';OUT=ROOT/'out'
PITCH=3.2
TILES='membrane concrete ceramic facade zinc louver deck bronze leaves swifts rack balloon bench plants route charcoal cream teal red yellow glass light interior terrazzo timber water cloud blimp seam white soil black roofB floorB hazard frit hatch tile vents solar'.split()
RECT={}
for i in range(64):
 x=(i%8)*384;y=(i//8)*384;RECT[i]=(x+7,y+7,370,370)
for i in range(8):RECT['room'+str(i)]=(3078,6+i*506,1012,494)
for i in range(6):RECT['art'+str(i)]=(6+(i%3)*1024,3078+(i//3)*508,1012,496)
# Shared rects are always in pixels, with their top-left in the texture.
def uv(k,s,t):
 if isinstance(k,str) and k in TILES:k=TILES.index(k)
 x,y,w,h=RECT[k];return ((x+s*w)/4096,1-(y+(1-t)*h)/4096)
def source_id(face):
 us=[p[1] for p in face];return min(7,int(8*(1-sum(v for u,v in us)/3)))*8+min(7,int(8*sum(u for u,v in us)/3))
def unuv(i,st):
 u,v=st;return ((u*3264-i%8*408-7)/394,(v*3264-(3264-((i//8)*408+7+394)))/394)
def cross(a,b):return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def normal(a,b,c):
 v=cross(tuple(b[j]-a[j] for j in range(3)),tuple(c[j]-a[j]for j in range(3)));d=math.sqrt(sum(x*x for x in v));return tuple(x/d for x in v) if d>1e-9 else (0,1,0)
def rect(x,z,w,d):return [(x-w/2,z-d/2),(x+w/2,z-d/2),(x+w/2,z+d/2),(x-w/2,z+d/2)]
def tidy(v):
 s=f'{v:.5f}'.rstrip('0').rstrip('.');return '0' if s in ('','-0') else s
def row(v):return ' '.join(tidy(a) for a in v)
@lru_cache(None)
def read_obj(path):
 vs=[];ts=[];ns=[];faces=[];parts={};active='visible'
 for l in path.read_text().splitlines():
  a=l.split()
  if not a:continue
  if a[0]=='v':
   x,y,z=map(float,a[1:4]);vs.append((-x,y,z))
  elif a[0]=='vt':ts.append(tuple(map(float,a[1:3])))
  elif a[0]=='vn':
   x,y,z=map(float,a[1:4]);ns.append((-x,y,z))
  elif a[0]=='g':active=a[1]
  elif a[0]=='f':
   q=[s.split('/')for s in a[1:]]
   if len(q[0])==1:
    parts.setdefault(active,set()).update(int(v[0])-1 for v in q)
   else:
    faces.append(tuple((vs[int(p[0])-1],ts[int(p[1])-1],ns[int(p[2])-1])for p in q[::-1]))
 solids=[]
 for ix in parts.values():
  pts=[vs[k] for k in ix];p=MultiPoint([(x,z)for x,y,z in pts]).convex_hull
  if not p.exterior.is_ccw:p=Polygon(list(p.exterior.coords)[::-1])
  solids.append((list(p.exterior.coords)[:-1],min(v[1] for v in pts),max(v[1] for v in pts)))
 return faces,solids
def base_model(name):
 faces,_=read_obj(BASE/'assets'/(name+'.obj'));_,cols=read_obj(BASE/'assets'/(name+'-col.obj'));return faces,cols
def to_atlas(face,key=None):
 if key is None:return tuple((p,(u*.75,.25+v*.75),n) for p,(u,v),n in face)
 idx=source_id(face);return tuple((p,uv(key,*unuv(idx,st)),n)for p,st,n in face)
class Mesh:
 def __init__(self):self.faces=[];self.solids=[]
 def face(self,pts,material,st=None,smooth=None):
  if len(pts)<3:return
  n=normal(*pts[:3])
  if st is None:
   axis=max(range(3),key=lambda i:abs(n[i]));uvs=[(v[0],v[2]) if axis==1 else (v[0] if axis==2 else v[2],v[1]) for v in pts]
   low=[min(s[i]for s in uvs)for i in [0,1]];high=[max(s[i]for s in uvs)for i in [0,1]]
   st=[tuple((s[i]-low[i])/max(.000001,high[i]-low[i])for i in [0,1])for s in uvs]
  verts=[(p,uv(material,*t),smooth[j] if smooth else n)for j,(p,t)in enumerate(zip(pts,st))]
  for j in range(1,len(verts)-1):
   if len(set((verts[k][0] for k in (0,j,j+1))))==3:self.faces.append((verts[0],verts[j],verts[j+1]))
 def prism(self,poly,y,h,m,side=None,solid=False):
  p=[(x,y,z)for x,z in poly];q=[(x,y+h,z)for x,z in poly]
  self.face(p,side or m);self.face(q[::-1],m)
  for i in range(len(p)):
   j=(i+1)%len(p);self.face([p[i],q[i],q[j],p[j]],side or m)
  if solid:self.solids.append((poly,y,y+h))
 def box(self,x,y,z,w,h,d,m,side=None,solid=False):self.prism(rect(x,z,w,d),y,h,m,side,solid)
 def cyl(self,x,y,z,rx,h,m,rz=None,solid=False,n=16):
  self.prism([(x+rx*math.cos(i*math.tau/n),z+(rz if rz is not None else rx)*math.sin(i*math.tau/n))for i in range(n)],y,h,m,solid=solid)
 def ball(self,x,y,z,rx,ry,rz,m,n=15,r=8):
  def point(i,j):
   t=i*math.tau/n;p=-math.pi/2+math.pi*j/r;c=math.cos(p);return (x+rx*c*math.cos(t),y+ry*math.sin(p),z+rz*c*math.sin(t))
  for i in range(n):
   for j in range(r):
    vs=[point(a,b)for a,b in [(i,j),(i,j+1),(i+1,j+1),(i+1,j)]]
    ns=[]
    for v in vs:
     nrm=[(v[k]-[x,y,z][k])/([rx,ry,rz][k]**2) for k in range(3)];l=math.sqrt(sum(a*a for a in nrm));ns.append(tuple(a/l for a in nrm))
    self.face(vs,m,[(0,0),(0,1),(1,1),(1,0)],ns)
 def beam(self,a,b,w,m,h=None):
  p=np.array(a);q=np.array(b);d=q-p;d=d/np.linalg.norm(d);u=np.cross(d,[0,1,0]if abs(d[1])<.97 else[1,0,0]);u=u/np.linalg.norm(u)*w/2;v=np.cross(d,u);v=v/np.linalg.norm(v)*(h or w)/2
  x=[tuple(p+i*u+j*v)for i,j in [(-1,-1),(1,-1),(1,1),(-1,1)]];y=[tuple(q+i*u+j*v)for i,j in [(-1,-1),(1,-1),(1,1),(-1,1)]]
  self.face(x[::-1],m);self.face(y,m)
  for i in range(4):j=(i+1)%4;self.face([x[i],x[j],y[j],y[i]],m)
 def attach(self,other,x,y,z,angle=0):
  a=math.radians(angle);c=round(math.cos(a),9);s=round(math.sin(a),9)
  def rot(px,pz):return c*px+s*pz,-s*px+c*pz
  for face in other.faces:
   out=[]
   for (px,py,pz),t,(nx,ny,nz) in face:
    px,pz=rot(px,pz);nx,nz=rot(nx,nz);out.append(((px+x,py+y,pz+z),t,(nx,ny,nz)))
   self.faces.append(tuple(out))
  for poly,lo,hi in other.solids:self.solids.append(([(x+a,z+b)for a,b in (rot(u,v)for u,v in poly)],lo+y,hi+y))
 def save(self,name):
  vs={};ts={};ns={};ff=[]
  def index(d,v):
   k=tuple(round(a,5)for a in v)
   if k not in d:d[k]=len(d)+1
   return d[k]
  for f in self.faces:
   ids=[]
   for (x,y,z),t,(nx,ny,nz) in f[::-1]:ids.append((index(vs,(-x,y,z)),index(ts,t),index(ns,(-nx,ny,nz))))
   if len(set(a for a,b,c in ids))==3:ff.append('f '+' '.join('/'.join(map(str,v))for v in ids))
  assert len(vs)<24500,(name,len(vs))
  (AS/(name+'.obj')).write_text('\n'.join(['# Cloudbreak Array R2',*['v '+row(v)for v in vs],*['vt '+row(v)for v in ts],*['vn '+row(v)for v in ns],'g visible',*ff])+'\n')
  lines=['# Closed convex collider parts'];offset=0
  for i,(poly,lo,hi) in enumerate(self.solids):
   n=len(poly);lines+=['o Part%03d'%i,'g Part%03d'%i]
   for yy in(lo,hi):lines+=['v '+row((-x,yy,z))for x,z in poly]
   tris=[]
   for k in range(1,n-1):tris.extend([(0,k,k+1),(n,n+k+1,n+k)])
   for k in range(n):j=(k+1)%n;tris.extend([(k,k+n,j+n),(k,j+n,j)])
   lines+=['f '+' '.join(str(offset+j+1)for j in t[::-1])for t in tris];offset+=2*n
  if self.solids:(AS/(name+'-col.obj')).write_text('\n'.join(lines)+'\n')
  return len(vs),len(ff),len(self.solids)
