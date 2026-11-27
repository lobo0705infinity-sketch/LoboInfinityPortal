"""Indexed Wavefront meshes; all dimensions are inches in native TTS axes."""
from design import *
from atlas import uv,surfaces
from shapely import constrained_delaunay_triangles
from shapely.geometry import Polygon,MultiPolygon
from functools import lru_cache
@lru_cache(maxsize=2100)
def tri(poly):
 return [list(t.exterior.coords)[:3] for t in constrained_delaunay_triangles(poly).geoms if t.area>1e-7]
def vec(x):return np.asarray(x,dtype=float)
def uniq(seq):return list(dict.fromkeys(seq))
class Obj:
 def __init__(self,coll=False):
  self.v={};self.tex={};self.lines=[];self.coll=coll;self.groups=0
 def part(self):
  if self.coll:self.groups+=1;self.lines.append('o part_%03d'%self.groups)
 def face(self,pts,key='foot',normal=None,tc=None):
  if len(pts)<3:return
  a=vec(pts)
  if tc is None:tc=[(0,0),(1,0),(1,1),(0,1)][:len(pts)] if len(pts)<=4 else [(i/(len(pts)-1),int(i>1))for i in range(len(pts))]
  nc=np.cross(a[1]-a[0],a[2]-a[0])
  if np.linalg.norm(nc)<1e-9:return
  if normal is not None and np.dot(nc,normal)<0:a=a[::-1];tc=tc[::-1]
  ids=[];v=self.v;text=self.tex
  for (x,y,z),(u,w) in zip(a,tc):
   pt=(round(-float(x),5),round(float(y),5),round(float(z),5));vi=v.setdefault(pt,len(v)+1)
   if self.coll:ids.append(str(vi));continue
   uvp=tuple(round(float(t),6)for t in uv(key,u,w));ti=text.setdefault(uvp,len(text)+1);ids.append(str(vi)+'/'+str(ti))
  for i in range(1,len(ids)-1):
   if len({ids[0].split('/')[0],ids[i+1].split('/')[0],ids[i].split('/')[0]})==3:self.lines.append('f '+' '.join((ids[0],ids[i+1],ids[i])))
 def disk(self,poly,y,mat,top=True):
  norm=(0,1 if top else -1,0)
  if self.coll:
   for t in tri(poly):self.face([(x,y,z)for x,z in t],mat,norm,[(0,0)]*3)
   return
  pitch=surfaces.get(mat,('',None,3.0))[2]
  xmin,zmin,xmax,zmax=poly.bounds
  for i in range(math.floor(xmin/pitch),math.ceil(xmax/pitch)):
   for j in range(math.floor(zmin/pitch),math.ceil(zmax/pitch)):
    area=poly.intersection(box(i*pitch,j*pitch,(i+1)*pitch,(j+1)*pitch))
    if area.area<.00001:continue
    for t in tri(area):
     self.face([(x,y,z)for x,z in t],mat,norm,[(min(1,max(0,x/pitch-i)),min(1,max(0,z/pitch-j)))for x,z in t])
 def save(self,dest):
  v=['v %.5f %.5f %.5f'%p for p in self.v]
  t=[]if self.coll else ['vt %.6f %.6f'%p for p in self.tex]
  dest.write_text('\n'.join(['# Vanta Freeport / native TTS geometry',*v,*t,*self.lines])+'\n')
class Building:
 def __init__(self):
  self.v=Obj();self.c=Obj(True)
 def prism(self,shape,bottom,top,wall,deck=None,physical=True,visible=True):
  if shape.is_empty:return
  shape=orient(shape,1)
  deck=deck or wall
  if visible:
   self.v.disk(shape,top,deck);self.v.disk(shape,bottom,wall,False)
   for ring in [shape.exterior,*shape.interiors]:
    ls=list(ring.coords)
    for a,b in zip(ls,ls[1:]):
     dx=b[0]-a[0];dz=b[1]-a[1];self.v.face([(a[0],bottom,a[1]),(b[0],bottom,b[1]),(b[0],top,b[1]),(a[0],top,a[1])],wall,(dz,0,-dx))
  if physical:
   for t in tri(shape):
    self.c.part();center=np.mean(t,axis=0);tb=[(x,bottom,z)for x,z in t];tt=[(x,top,z)for x,z in t]
    self.c.face(tb,wall,(0,-1,0));self.c.face(tt,wall,(0,1,0))
    for i in range(3):
     j=(i+1)%3;n=(vec(t[i])+vec(t[j]))*.5-center;self.c.face([tb[i],tb[j],tt[j],tt[i]],wall,(n[0],0,n[1]))
 def hexa(self,points,key,physical=True,visible=True,faces=(0,1,2,3,4,5)):
  a=vec(points);center=np.mean(a,axis=0);indices=[(0,1,2,3),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
  if physical:self.c.part()
  for i,inds in enumerate(indices):
   p=a[list(inds)];n=p.mean(axis=0)-center
   if visible and i in faces:self.v.face(p,key,n)
   if physical:self.c.face(p,key,n)
 def beam(self,a,b,y0,y1,th,key,physical=False,off=0):
  a,b=vec(a),vec(b);u=b-a;ln=np.linalg.norm(u)
  if ln<.001 or y1<=y0:return
  n=np.array((u[1],-u[0]))/ln;a=a+n*off;b=b+n*off
  pts=[a+n*th/2,b+n*th/2,b-n*th/2,a-n*th/2]
  self.hexa([(x,y,z)for y in (y0,y1)for x,z in pts],key,physical)
 def block(self,c,s,k,physical=False):
  x,y,z=c;w,h,d=s;self.beam((x-w/2,z),(x+w/2,z),y-h/2,y+h/2,d,k,physical)
 def rod(self,a,b,r,key,n=8,physical=False):
  a,b=vec(a),vec(b);axis=b-a;ln=np.linalg.norm(axis)
  if ln<.001:return
  axis/=ln;ref=(1,0,0)if abs(axis[0])<.8 else(0,1,0);u=np.cross(axis,ref);u/=np.linalg.norm(u);w=np.cross(axis,u)
  ds=[r*(math.cos(i*math.tau/n)*u+math.sin(i*math.tau/n)*w)for i in range(n)];lo=[a+p for p in ds];hi=[b+p for p in ds]
  for mesh in ([self.v,self.c] if physical else [self.v]):
   mesh.part();mesh.face(lo,key,-axis);mesh.face(hi,key,axis)
   for i in range(n):j=(i+1)%n;mesh.face([lo[i],lo[j],hi[j],hi[i]],key,ds[i]+ds[j])
 def label(self,c,w,h,key,n,back='ink'):
  x,y,z=c;n=vec(n);u=np.array([-n[1],n[0]]);c2=np.array([x,z])
  self.beam(c2-u*(w+.05)/2,c2+u*(w+.05)/2,y-h/2-.025,y+h/2+.025,.052,back)
  p=c2+n*.033
  pts=[(p[0]+u[0]*w*i/2,y+j*h/2,p[1]+u[1]*w*i/2)for i,j in [(-1,-1),(1,-1),(1,1),(-1,1)]]
  self.v.face(pts,key,(n[0],0,n[1]),[(0,0),(1,0),(1,1),(0,1)])
 def save(self,slug):
  self.v.save(A/(slug+'.obj'));self.c.save(A/(slug+'-collider.obj'))
def xyz(p,h):return (p[0],h,p[1])
def tiled(mesh,P,N,lo,hi,y0,y1,key,phase=0):
 if hi<=lo+.00001 or y1<=y0+.00001:return
 step=surfaces[key][2]
 def cuts(u,v,phase):return [u]+[k*step-phase for k in range(math.floor((u+phase)/step)+1,math.ceil((v+phase)/step)) if u+.00001<k*step-phase<v-.00001]+[v]
 xs=cuts(lo,hi,phase);ys=cuts(y0,y1,0)
 for a,b in zip(xs,xs[1:]):
  ix=math.floor(((a+b)/2+phase)/step)
  for h,j in zip(ys,ys[1:]):
   iy=math.floor((h+j)/(2*step));ab=[(a,h),(b,h),(b,j),(a,j)]
   mesh.face([xyz(P(x),y)for x,y in ab],key,(N[0],0,N[1]),[((x+phase)/step-ix,y/step-iy)for x,y in ab])
