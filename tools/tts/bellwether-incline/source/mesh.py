"""Bellwether art meshes. Scene coordinates are inches, Y up, +Z north."""
from math import ceil,cos,sin,pi,sqrt
from pathlib import Path
import json
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"assets"
CELL=512
TOTAL=4096
NAMES=[
 "ashlar","rubble","concrete","plaster","larch","slate","corrugated","steel",
 "snow","darkiron","enamelblue","red","ivory","copper","floorwood","sage",
 "rubber","ochre","canvas","paper","brass","leather","package","glass",
 "light","tile","charcoal","seat","salt","garnet","floor","weatherwood"]
UV={}
for i,n in enumerate(NAMES):
 x=i%8*512;y=i//8*512;UV[n]=(x+3,y+3,x+509,y+509)
SIGNS=["station","parcel","platform","test","cafe","spare-enamel","brakeshop","staff","tickets","carname","bellmark","numbers","winding","timetable","stores","parcelmark","locker","recorders","poster1","poster2","poster3","mapprint"]
for i,n in enumerate(SIGNS):
 if i<18:
  x=(i%4)*1024;y=2048+(i//4)*256;UV[n]=(x+4,y+4,x+1020,y+252)
 else:
  x=(i-18)*1024;y=3328;UV[n]=(x+4,y+4,x+1020,4092)
SCALE={"ashlar":(3.3,2.4),"rubble":(2.6,2.6),"concrete":(4,4),"plaster":(3.2,3.2),"larch":(2.65,2.65),"slate":(2.65,2.65),"corrugated":(2.4,2.4),"floorwood":(3.1,3.1),"weatherwood":(3.0,3.0),"snow":(3.0,3.0),"tile":(2.6,2.6),"floor":(3.4,3.4)}
def unit(a):
 a=np.asarray(a,dtype=float);return a/(np.linalg.norm(a) or 1)
def fmt(v):
 return ('%.5f'%v).rstrip('0').rstrip('.') if abs(v)>0.0000049 else '0'

class Mesh:
 def __init__(self,name):
  self.name=name;self.v=[];self.uv=[];self.vn=[];self.fs=[];self.vi={};self.ui={};self.ni={}
 def idx(self,values,items,lookup):
  key=tuple(round(float(a),5) for a in values)
  if key not in lookup:lookup[key]=len(items)+1;items.append(key)
  return lookup[key]
 def add(self,pts,coords):
  # Unity's OBJ conversion reflects X. Reversing winding here preserves outward faces.
  normal=np.cross(np.subtract(pts[1],pts[0]),np.subtract(pts[2],pts[0]))
  if np.linalg.norm(normal)<1e-7:return
  nx,ny,nz=unit(normal);norm=self.idx((-nx,ny,nz),self.vn,self.ni)
  vals=[]
  for (x,y,z),uv in zip(pts,coords):
   vals.append((self.idx((-x,y,z),self.v,self.vi),self.idx(uv,self.uv,self.ui),norm))
  for i in range(1,len(vals)-1):self.fs.append((vals[0],vals[i+1],vals[i]))
 def quad(self,pts,mat,uv=None):
  p=np.asarray(pts,dtype=float)
  if uv is not None:self.add(p,uv);return
  l,t,r,b=UV[mat]
  def atlas(u,v):return ((l+(r-l)*u)/TOTAL,1-(b-(b-t)*v)/TOTAL)
  lengths=(np.linalg.norm(p[1]-p[0]),np.linalg.norm(p[3]-p[0]))
  scale=SCALE.get(mat)
  nu,nv=(min(12,max(1,ceil(lengths[0]/scale[0]))),min(12,max(1,ceil(lengths[1]/scale[1])))) if scale else (1,1)
  if len(p)==4 and (nu>1 or nv>1):
   def point(u,v):return p[0]*(1-u)*(1-v)+p[1]*u*(1-v)+p[2]*u*v+p[3]*(1-u)*v
   for i in range(nu):
    for j in range(nv):
     a,h=i/nu,(i+1)/nu;c,d=j/nv,(j+1)/nv
     self.add([point(a,c),point(h,c),point(h,d),point(a,d)],[atlas(0,0),atlas(1,0),atlas(1,1),atlas(0,1)])
  else:self.add(p,[atlas(0,0),atlas(1,0),atlas(1,1),atlas(0,1)][:len(p)])
 def tri(self,pts,mat):
  l,t,r,b=UV[mat];self.add(pts,[(l/TOTAL,1-b/TOTAL),(r/TOTAL,1-b/TOTAL),((l+r)/2/TOTAL,1-t/TOTAL)])
 def solid(self,vs,mat,top=None):
  for k,ix in enumerate(((0,1,2,3),(5,4,7,6),(4,0,3,7),(1,5,6,2),(3,2,6,7),(4,5,1,0))):
   self.quad([vs[i] for i in ix],top if k==4 and top else mat)
 def box(self,x,y,z,w,h,d,mat,top=None):
  if min(w,h,d)<=0:return
  a=x-w/2;b=x+w/2;c=z-d/2;e=z+d/2
  self.solid([(a,y,e),(b,y,e),(b,y+h,e),(a,y+h,e),(a,y,c),(b,y,c),(b,y+h,c),(a,y+h,c)],mat,top)
 def beam(self,a,b,width,depth,mat):
  a=np.asarray(a);b=np.asarray(b);ax=unit(b-a)
  ref=np.array([0.,1.,0.]) if abs(ax[1])<.90 else np.array([0.,0.,1.])
  side=unit(np.cross(ax,ref))*width/2;up=unit(np.cross(side,ax))*depth/2
  pts=[a-side-up,b-side-up,b-side+up,a-side+up,a+side-up,b+side-up,b+side+up,a+side+up]
  # Orient the quad by comparing its face normal to the radial direction.
  center=(a+b)/2
  for ids in ((0,1,2,3),(5,4,7,6),(4,0,3,7),(1,5,6,2),(3,2,6,7),(4,5,1,0)):
   face=[pts[i] for i in ids]
   if np.dot(np.cross(face[1]-face[0],face[2]-face[0]),np.mean(face,axis=0)-center)<0:face=face[::-1]
   self.quad(face,mat)
 def cyl(self,a,b,r,mat,sides=12,cap=None,r2=None):
  a=np.asarray(a,dtype=float);b=np.asarray(b,dtype=float);ax=unit(b-a)
  ref=np.array([0.,1.,0.]) if abs(ax[1])<.9 else np.array([0.,0.,1.])
  u=unit(np.cross(ax,ref));v=np.cross(ax,u);r2=r if r2 is None else r2
  rings=[[p+(u*cos(2*pi*i/sides)+v*sin(2*pi*i/sides))*rr for i in range(sides)] for p,rr in ((a,r),(b,r2))]
  for i in range(sides):
   j=(i+1)%sides
   self.quad([rings[0][i],rings[0][j],rings[1][j],rings[1][i]],mat)
   self.tri([a,rings[0][j],rings[0][i]],cap or mat);self.tri([b,rings[1][i],rings[1][j]],cap or mat)
 def sign(self,center,w,h,face,graphic):
  x,y,z=center
  # Right as read by an observer facing the wall.
  rx,rz={'S':(1,0),'N':(-1,0),'W':(0,-1),'E':(0,1)}[face]
  pts=[(x-rx*w/2,y-h/2,z-rz*w/2),(x+rx*w/2,y-h/2,z+rz*w/2),(x+rx*w/2,y+h/2,z+rz*w/2),(x-rx*w/2,y+h/2,z-rz*w/2)]
  # The face is double-sided; UVs on the outward side read left to right.
  l,t,r,b=UV[graphic];uv=[(l/TOTAL,1-b/TOTAL),(r/TOTAL,1-b/TOTAL),(r/TOTAL,1-t/TOTAL),(l/TOTAL,1-t/TOTAL)]
  self.add(pts[::-1],uv[::-1])
 def write(self,filename,collider=False):
  path=OUT/filename
  lines=['# Bellwether Incline, Lobo Infinity Maps','o '+self.name]
  lines+=['v '+' '.join(map(fmt,v)) for v in self.v]
  if not collider:
   lines+=['vt '+' '.join(map(fmt,v)) for v in self.uv]
   lines+=['vn '+' '.join(map(fmt,v)) for v in self.vn]
  if collider:lines+=['f '+' '.join(str(v[0]) for v in f) for f in self.fs]
  else:lines+=['f '+' '.join('/'.join(map(str,v)) for v in f) for f in self.fs]
  path.write_text('\n'.join(lines)+'\n',encoding='ascii');return filename

class Pair:
 def __init__(self,key):self.key=key;self.m=Mesh(key);self.c=Mesh(key+'-collider')
 def box(self,x,y,z,w,h,d,mat,physical=True,top=None):
  self.m.box(x,y,z,w,h,d,mat,top)
  if physical:self.c.box(x,y,z,w,h,d,'darkiron')
 def beam(self,a,b,w,d,mat,physical=False):
  self.m.beam(a,b,w,d,mat)
  if physical:self.c.beam(a,b,w,d,'darkiron')
 def cyl(self,a,b,r,mat,sides=12,physical=False,cap=None):
  self.m.cyl(a,b,r,mat,sides,cap)
  if physical:self.c.cyl(a,b,r,'darkiron',min(8,sides))
 def sign(self,p,w,h,face,graphic):self.m.sign(p,w,h,face,graphic)
 def closed_plate(self,points,direction,material,back,physical=True):
  outer=np.asarray(points,dtype=float)
  normal=np.cross(outer[1]-outer[0],outer[2]-outer[0])
  if np.dot(normal,direction)>0:outer=outer[::-1]
  inner=outer+direction
  for mesh,front,rear in [(self.m,material,back)]+([(self.c,'darkiron','darkiron')] if physical else []):
   draw=mesh.quad if len(outer)==4 else mesh.tri
   draw(outer,front);draw(inner[::-1],rear)
   for i in range(len(outer)):
    j=(i+1)%len(outer);mesh.quad([outer[i],inner[i],inner[j],outer[j]],rear)
 def deck(self,points,material,thickness=.14,under='weatherwood',physical=True):
  self.closed_plate(points,np.array([0,-thickness,0]),material,under,physical)
 def panel(self,pts,mat,physical=False):
  self.m.quad(pts,mat)
  if physical:self.c.quad(pts,'darkiron')
 def write(self):
  assert self.m.fs and self.c.fs,self.key
  return {'mesh':self.m.write(self.key+'.obj'),'col':self.c.write(self.key+'-col.obj',True),'tri':len(self.m.fs),'ctri':len(self.c.fs)}
