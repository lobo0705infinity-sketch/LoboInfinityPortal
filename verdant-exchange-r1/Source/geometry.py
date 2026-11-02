from pathlib import Path
import math,json,random
import numpy as np
from shapely.geometry import Polygon, box, Point, LineString
from shapely import constrained_delaunay_triangles, orient_polygons
from shapely.geometry.polygon import orient
ROOT=Path(__file__).resolve().parents[1]
ASSET=ROOT/'Assets'
MATS={'concrete':0,'metal':1,'tile':2,'roof':3,'soil':4,'foliage':5,'silver':6,'rust':7,'plaster':8,'blue':9,'grille':10,'glass':11,'wood':12,'asphalt':13,'counter':14,'grating':15,'composite':8,'tarp':9,'paving':2,'yellow':7}
def triangulate(poly): return [orient(t,sign=1.0) for t in constrained_delaunay_triangles(poly).geoms]
class Mesh:
 def __init__(self): self.v=[];self.uv=[];self.f=[];self.groups=[]
 def face(self,points,mat='concrete'):
  i=len(self.v); n=len(points); t=MATS.get(mat,mat); col=t%4;row=t//4
  # A small inset prevents neighbouring atlas materials bleeding into a face.
  uv=[(.008,.008),(.992,.008),(.992,.992),(.008,.992)][:n]
  self.v.extend(points);self.uv.extend([((col+u)/4,1-(row+v)/4) for u,v in uv])
  self.f.extend([(i,i+k,i+k+1) for k in range(1,n-1)])
 def quad(self,a,b,c,d,mat='concrete',tile=2.):
  a,b,c,d=map(lambda p:np.array(p,float),(a,b,c,d))
  if mat=='composite' and tile<100:tile=1.25
  nu=max(1,math.ceil(np.linalg.norm(b-a)/tile));nv=max(1,math.ceil(np.linalg.norm(d-a)/tile))
  for i in range(nu):
   for j in range(nv):
    def p(u,v):return (a+(b-a)*u+(d-a)*v).tolist()
    start=len(self.v)
    self.face([p(i/nu,j/nv),p((i+1)/nu,j/nv),p((i+1)/nu,(j+1)/nv),p(i/nu,(j+1)/nv)],mat)
    # Keep material proportions on narrow piers and lintels instead of squeezing
    # a whole brick photograph into every small rectangular face.
    t=MATS.get(mat,mat);col=t%4;row=t//4
    su=min(.984,np.linalg.norm(b-a)/nu/tile*.984);sv=min(.984,np.linalg.norm(d-a)/nv/tile*.984)
    coords=[(.008,.008),(.008+su,.008),(.008+su,.008+sv),(.008,.008+sv)]
    if mat=='composite' and abs(b[1]-a[1])>.9*np.linalg.norm(b-a):coords=[(.008,.008),(.008,.008+su),(.008+sv,.008+su),(.008+sv,.008)]
    self.uv[start:]=[((col+u)/4,1-(row+v)/4) for u,v in coords]
 def box(self,c,s,mat='concrete',angle=0,tile=2.):
  x,y,z=c;w,h,d=np.array(s)/2
  vs=np.array([[-w,-h,-d],[w,-h,-d],[w,h,-d],[-w,h,-d],[-w,-h,d],[w,-h,d],[w,h,d],[-w,h,d]])
  r=math.radians(angle);R=np.array([[math.cos(r),0,math.sin(r)],[0,1,0],[-math.sin(r),0,math.cos(r)]])
  vs=vs@R.T+np.array(c)
  self.groups.append(len(self.f))
  for ids in [(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(3,7,6,2),(0,1,5,4)]:self.quad(*(vs[i] for i in ids),mat,tile)
 def cylinder(self,a,b,r,mat='metal',n=12,r2=None):
  a,b=np.array(a,float),np.array(b,float);v=b-a;v/=np.linalg.norm(v)
  u=np.cross(v,[0,1,0] if abs(v[1])<.9 else [1,0,0]);u/=np.linalg.norm(u);w=np.cross(v,u)
  rings=[]
  for c,rad in [(a,r),(b,r if r2 is None else r2)]:rings.append([c+rad*(math.cos(t)*u+math.sin(t)*w) for t in np.arange(n)*2*math.pi/n])
  for i in range(n):
   j=(i+1)%n;self.face([rings[0][i],rings[0][j],rings[1][j],rings[1][i]],mat)
   self.face([a,rings[0][j],rings[0][i]],mat);self.face([b,rings[1][i],rings[1][j]],mat)
 def beam(self,a,b,w,d=None,mat='metal'):
  a,b=np.array(a,float),np.array(b,float);v=b-a;L=np.linalg.norm(v);v/=L
  u=np.cross(v,[0,1,0] if abs(v[1])<.9 else [1,0,0]);u/=np.linalg.norm(u);q=np.cross(v,u)
  w=w/2;d=(d if d else w*2)/2
  corners=[a-u*w-q*d,a+u*w-q*d,b+u*w-q*d,b-u*w-q*d,a-u*w+q*d,a+u*w+q*d,b+u*w+q*d,b-u*w+q*d]
  self.groups.append(len(self.f))
  for ids in [(0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(3,7,6,2),(0,1,5,4)]:self.face([corners[i] for i in ids],mat)
 def slab(self,poly,y,h,mat='concrete',tile=2.):
  poly=orient_polygons(poly)
  # Constrained triangles preserve concave outlines and stair openings. Project
  # horizontal UVs from shared material cells so triangles cannot stretch/flicker.
  x0,z0,x1,z1=poly.bounds
  for gx in np.arange(math.floor(x0/tile)*tile,x1,tile):
   for gz in np.arange(math.floor(z0/tile)*tile,z1,tile):
    cell=poly.intersection(box(gx,gz,gx+tile,gz+tile))
    if cell.is_empty or cell.area<1e-8:continue
    for t in triangulate(cell):
     pts=list(t.exterior.coords)[:3]
     for yy,rev in [(y+h,True),(y,False)]:
      points=[(x,yy,z) for x,z in pts]
      if rev:points=points[::-1]
      start=len(self.v);self.face(points,mat);mi=MATS.get(mat,mat);col=mi%4;row=mi//4
      self.uv[start:]=[((col+.008+.984*(x-gx)/tile)/4,1-(row+.008+.984*(z-gz)/tile)/4) for x,_,z in points]
  polys=list(poly.geoms) if hasattr(poly,'geoms') else [poly]
  for p in polys:
   for ring in [p.exterior,*p.interiors]:
    pts=list(ring.coords)
    for (x,z),(xx,zz) in zip(pts,pts[1:]):self.quad((x,y,z),(x,y+h,z),(xx,y+h,zz),(xx,y,zz),mat,tile)
 def merge(self,m):
  offset=len(self.v);fo=len(self.f);self.v+=m.v;self.uv+=m.uv;self.f +=[tuple(offset+i for i in f) for f in m.f];self.groups +=[fo+i for i in m.groups]
 def write(self,path,compound=False):
  collider=path.stem.endswith('-collider')
  unique_v={};unique_uv={};vm=[];um=[]
  for p,uv in zip(self.v,self.uv):
   # TTS's OBJ import reverses X. Convert the file and its winding together;
   # imported global ground cutouts, pavements and local models then agree.
   p=tuple(round(float(a)*(-1 if i==0 else 1),5) for i,a in enumerate(p));uv=tuple(round(float(a),6) for a in uv)
   if p not in unique_v:unique_v[p]=len(unique_v)+1
   if uv not in unique_uv:unique_uv[uv]=len(unique_uv)+1
   vm.append(unique_v[p]);um.append(unique_uv[uv])
  with open(path,'w') as f:
   f.write('# Verdant Exchange R1 | inches | Y-up | triangulated\n')
   for p in unique_v:f.write('v '+' '.join(f'{float(v):.5f}' for v in p)+'\n')
   if not collider:
    for uv in unique_uv:f.write('vt '+' '.join(f'{float(v):.6f}' for v in uv)+'\n')
   groups=set(self.groups)
   for k,tri in enumerate(self.f):
    if compound and k in groups:f.write(f'o convex_{k}\n')
    f.write('f '+' '.join(str(vm[i]) if collider else f'{vm[i]}/{um[i]}' for i in reversed(tri))+'\n')
 def bounds(self):return np.array(self.v).min(0).tolist(),np.array(self.v).max(0).tolist()

meshes={};placements=[]
def pair():return Mesh(),Mesh()
def solid(m,c,s,mat='concrete',angle=0,collision=True):
 m[0].box(c,s,mat,angle)
 if collision:m[1].box(c,s,mat,angle,tile=10000)
def slab(m,poly,y,h,mat='concrete'):
 m[0].slab(poly,y,h,mat)
 # Convex triangular prisms keep floor wells open without a high-poly collider.
 for t in triangulate(poly):
  if not poly.covers(t):continue
  pts=list(t.exterior.coords)[:3];c=Mesh();c.groups.append(0)
  c.face([(x,y,z) for x,z in pts]);c.face([(x,y+h,z) for x,z in pts][::-1])
  for (x,z),(xx,zz) in zip(pts,pts[1:]+pts[:1]):c.quad((x,y,z),(x,y+h,z),(xx,y+h,zz),(xx,y,zz),tile=10000)
  m[1].merge(c)
def register(name,m,nonconvex=False):
 meshes[name]={'visual':m[0],'collider':m[1],'nonconvex':nonconvex}
 m[0].write(ASSET/(name+'.obj'));m[1].write(ASSET/(name+'-collider.obj'),compound=not nonconvex)
 return name
