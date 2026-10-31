"""Old Quarter Excavation R1. Deterministic, textured TTS terrain authoring.
Coordinates are inches, Y up; the street surface is at world Y=3.5.
Run from this directory's parent with Python 3 and numpy/scipy/shapely/Pillow.
"""
from pathlib import Path
import json, math, random, copy, hashlib
import numpy as np
from PIL import Image
from shapely.geometry import Polygon, box, Point
from shapely.ops import unary_union
from shapely import constrained_delaunay_triangles,orient_polygons
from shapely.geometry.polygon import orient
from map_config import STREET_Y,PIT_DEPTH,BASE_BOTTOM,GROUND_FLOOR_TOP
def triangulate(poly):return [orient(t,sign=1.0) for t in constrained_delaunay_triangles(poly).geoms]

ROOT=Path(__file__).resolve().parents[1]
ASSET=ROOT/'Assets'; ASSET.mkdir(exist_ok=True)
random.seed(10312026)
ATLAS=Image.open(ASSET/'old-quarter-material-atlas.png').convert('RGB')
import io
_buffer=io.BytesIO();ATLAS.resize((1024,1024),Image.Resampling.LANCZOS).save(_buffer,format='JPEG',quality=94,subsampling=0)
(ASSET/'old-quarter-material-atlas.jpg').write_bytes(_buffer.getvalue())
MATS={'asphalt':0,'concrete':1,'brick':2,'blue':3,'tarp':4,'metal':5,'plaster':6,'rust':7,'rubble':8,'soil':9,'yellow':10,'silver':11,'tile':12,'roof':13,'tech':14,'wood':15}

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
  if mat=='brick' and tile<100:tile=1.25
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
    if mat=='brick' and abs(b[1]-a[1])>.9*np.linalg.norm(b-a):coords=[(.008,.008),(.008,.008+su),(.008+sv,.008+su),(.008+sv,.008)]
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
   f.write('# Old Quarter Excavation R1 | inches | Y-up | triangulated\n')
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

def wall(m,a,b,y,h,mat='brick',door=False,windows=True,broken=False):
 a,b=np.array(a),np.array(b);L=np.linalg.norm(b-a);u=(b-a)/L
 # Real openings in geometry and collision. End posts remain solid for roof ladders.
 op=[]
 if door:op.append((L*.5-.78,L*.5+.78,0,2.25))
 if windows:
  for c in np.arange(1.2,L-.65,1.7):
   if door and abs(c-L*.5)<1.6:continue
   op.append((c-.48,c+.48,.9,2.08))
 xs=sorted(set([0,L]+[max(0,min(L,t)) for o in op for t in o[:2]]));ys=sorted(set([0,h]+[max(0,min(h,t)) for o in op for t in o[2:]]))
 angle=-math.degrees(math.atan2(u[1],u[0]))
 for x1,x2 in zip(xs,xs[1:]):
  for y1,y2 in zip(ys,ys[1:]):
   if x2-x1<.005 or y2-y1<.005:continue
   cx,cy=(x1+x2)/2,(y1+y2)/2
   if any(o[0]<cx<o[1] and o[2]<=cy<o[3] for o in op):continue
   p=a+u*cx;solid(m,(p[0],y+cy,p[1]),(x2-x1,y2-y1,.2),mat,angle)
 for x1,x2,low,high in op:
  if low==0:continue
  # Thin steel frames leave the window aperture open.
  for xx in [x1,x2]:
   p=a+u*xx;m[0].box((p[0],y+(low+high)/2,p[1]),(.065,high-low,.24),'metal',angle)
  p=a+u*((x1+x2)/2)
  for yy in [low,high]:m[0].box((p[0],y+yy,p[1]),(x2-x1+.1,.065,.27),'metal',angle)
  m[0].box((p[0],y+low-.05,p[1]),(x2-x1+.2,.10,.38),'concrete',angle)

def stairs(m,x,z,width,run,rise,y=0,axis=1):
 steps=12
 for i in range(steps):
  height=rise*(i+1)/steps;zz=z+run*(i+.5)/steps
  solid(m,(x,y+height/2,zz),(width,height,run/steps+.012),'concrete')
 # Rail posts sit beside, rather than on, the usable stair tread.
 for sx in [-1,1]:
  for i in range(0,steps+1,3):
   zz=z+run*i/steps;hh=y+rise*i/steps
   m[0].cylinder((x+sx*(width/2+.05),hh,zz),(x+sx*(width/2+.05),hh+.8,zz),.035,'metal',6)
  m[0].beam((x+sx*(width/2+.05),y+.8,z),(x+sx*(width/2+.05),y+rise+.8,z+run),.055,mat='metal')

def ladder(m,x,z,h):
 for dx in [-.36,.36]:
  m[0].cylinder((x+dx,.05,z),(x+dx,h+.55,z),.045,'yellow',8)
  m[1].box((x+dx,(h+.55)/2,z),(.09,h+.55,.09),tile=10000)
 for yy in np.arange(.25,h+.3,.24):m[0].cylinder((x-.36,yy,z),(x+.36,yy,z),.035,'yellow',6)
 for yy in np.arange(.2,h,.9):
  for dx in [-.36,.36]:m[0].beam((x+dx,yy,z),(x+dx,yy,z+.2),.045,mat='metal')

def crate(m,x,z,y=0,w=.8):
 solid(m,(x,y+.35,z),(w,.7,.75),'tarp')
 for dx in [-w*.35,w*.35]:m[0].box((x+dx,y+.71,z),(.055,.03,.78),'metal')
 for zz in [-.37,.37]:m[0].box((x,y+.71,z+zz),(w,.03,.045),'silver')

def hvac(m,x,z,y):
 solid(m,(x,y+.33,z),(1.15,.65,.8),'silver')
 for i in range(6):m[0].box((x-.45+i*.18,y+.35,z+.407),(.055,.42,.018),'metal')
 m[0].cylinder((x,y+.66,z),(x,y+.70,z),.25,'metal',16)
 for i in range(4):
  t=i*math.pi/2;m[0].beam((x,y+.72,z),(x+math.cos(t)*.21,y+.72,z+math.sin(t)*.21),.04,mat='silver')

def building(kind,state):
 random.seed(10312026+sum(ord(c) for c in kind))
 m=pair();full=state==1;nf=2 if state in [1,2] else 1
 if kind=='civic':
  w,d=8,6;poly=Polygon([(-4,-3),(4,-3),(4,0),(1,0),(1,3),(-4,3)]);H=2.85;mat='brick'
 elif kind=='annex':w,d=6.4,6;poly=box(-w/2,-d/2,w/2,d/2);H=3.15;mat='plaster'
 elif kind=='ruin':w,d=7,6;poly=Polygon([(-3.5,-3),(3.5,-3),(3.5,1.4),(1.4,3),(-3.5,3)]);H=2.75;mat='brick'
 else:w,d=6,4.8;poly=box(-3,-2.4,3,2.4);H=2.65;mat='plaster';nf=1
 # Interior stair shaft: flat floors stop at its rim, so the stairs are usable.
 sx=-w/2+1.05;sz=-d/2+.45;well=box(sx-.79,sz-.05,sx+.79,sz+2.85)
 for floor in range(nf):
  yy=floor*(H+.15);fp=poly if floor==0 else poly.difference(well)
  slab(m,fp,yy-.14+(GROUND_FLOOR_TOP if floor==0 else 0),.14,'tile')
  coords=list(poly.exterior.coords)
  for k,(a,b) in enumerate(zip(coords,coords[1:])):
   if kind=='ruin' and k in [1,2]:continue
   wall(m,a,b,yy,H,mat,door=((k==1) if kind=='annex' else (k==0 or (floor==0 and k==2))),windows=True)
  # Exposed concrete frame, cornice and narrow structural piers.
  for x,z in list(poly.exterior.coords)[:-1]:solid(m,(x,yy+H/2,z),(.28,H,.28),'concrete')
  for a,b in zip(coords,coords[1:]):
   u=np.array(b)-np.array(a);L=np.linalg.norm(u);p=(np.array(a)+np.array(b))/2
   if kind=='ruin' and tuple(a)==tuple(coords[1]):continue
   m[0].box((p[0],yy+H-.08,p[1]),(L+.12,.16,.31),'concrete',-math.degrees(math.atan2(u[1],u[0])))
  if floor==0 and nf>1:stairs(m,sx,sz,1.46,2.75,H+.15)
  # Sparse solid interior cover away from the stair well and entrances.
  crate(m,w/2-.75,-d/2+.8,yy,.85)
  m[0].box((w/2-.8,yy+.7,-d/2+1.65),(1,.12,.6),'wood')
  for xx in [w/2-1.15,w/2-.45]:m[0].box((xx,yy+.35,-d/2+1.65),(.08,.7,.5),'metal')
 if kind=='ruin':
  # Cohesive ruined wall stumps form opaque cover; rebar is visual only.
  for i in range(6):
   x=-3.0+i*1.03;h=[1.8,1.25,.95,.65,1.4,2.2][i]
   solid(m,(x,h/2,3),(.98,h,.32),'brick')
   for j in range(2):m[0].cylinder((x-.2+j*.4,h,3),(x-.18+j*.4,h+.35,3),.018,'rust',5)
  for i in range(35):
   x=random.uniform(-3,3);z=random.choice([-2.7,2.6])+random.uniform(-.2,.2)
   m[0].box((x,.12,z),(random.uniform(.15,.45),.22,random.uniform(.12,.35)),random.choice(['brick','concrete']),random.uniform(-25,25))
 if full:
  ry=nf*(H+.15)
  roofpoly=poly.difference(well)
  if kind=='ruin':roofpoly=roofpoly.intersection(box(-w/2,-d/2,.2,0))
  slab(m,roofpoly,ry-.15,.15,'roof')
  for a,b in zip(list(roofpoly.exterior.coords),list(roofpoly.exterior.coords)[1:]):
   mid=(np.array(a)+np.array(b))/2;u=np.array(b)-np.array(a);L=np.linalg.norm(u)
   solid(m,(mid[0],ry+.28,mid[1]),(L,.56,.19),'concrete',-math.degrees(math.atan2(u[1],u[0])))
  if kind!='ruin':hvac(m,w/2-1.1,-d/2+1.1,ry);hvac(m,.3,-d/2+1.1,ry)
  else:
   # Roof-mounted exhaust with a weather cap screens the surviving roof corner.
   solid(m,(-.45,ry+.825,-2.4),(.65,1.65,.65),'rust')
   m[0].box((-.45,ry+1.69,-2.4),(.85,.12,.85),'metal')
 # Roof access is on a solid corner pier; the same ladder survives all states.
 roofheight=(2 if kind!='depot' else 1)*(H+.15)
 ladder(m,w/2-.15,-d/2-.28,roofheight)
 # Downpipe and utility cabinet lend scale without blocking openings.
 m[0].cylinder((-w/2-.19,.06,-d/2+.3),(-w/2-.19,roofheight,-d/2+.3),.055,'rust',8)
 solid(m,(w/2+.16,.7,-d/2+.45),(.3,1.4,.8),'metal')
 if kind=='annex' and state!=3:
  # Upper terrace; its end has a direct door opening, not a stair through a wall.
  slab(m,box(-1,3,2.6,4.3),H+.02,.13,'concrete')
  solid(m,(.8,H+.62,4.3),(3.6,.9,.16),'concrete')
  solid(m,(2.6,H+.62,3.65),(.16,.9,1.3),'concrete')
  # The rear corner ladder provides roof access without crossing these windows.
 return register(kind+f'-state-{state}',m)

for kind in ['civic','annex','ruin']:
 for s in [1,2,3]:building(kind,s)
building('depot',1)
building('depot',2)

def small_building(kind,state=1):
 m=pair();w,d=(3.4,3.0) if kind=='utility-kiosk' else (4.2,3.0);H=2.55
 poly=box(-w/2,-d/2,w/2,d/2);slab(m,poly,GROUND_FLOOR_TOP-.12,.12,'tile')
 coords=[(-w/2,-d/2),(w/2,-d/2),(w/2,d/2),(-w/2,d/2),(-w/2,-d/2)]
 for k,(a,b) in enumerate(zip(coords,coords[1:])):wall(m,a,b,0,H,'brick' if kind=='utility-kiosk' else 'plaster',door=k==0,windows=k in [0,1,2])
 for x,z in coords[:-1]:solid(m,(x,H/2,z),(.18,H,.18),'concrete')
 if state==1:
  slab(m,poly,H,.13,'roof')
  for k,(a,b) in enumerate(zip(coords,coords[1:])):
   u=np.array(b)-np.array(a);L=np.linalg.norm(u);p=(np.array(a)+np.array(b))/2
   solid(m,(p[0],H+.32,p[1]),(L,.4,.16),'concrete',-math.degrees(math.atan2(u[1],u[0])))
  hvac(m,-w/2+.8,-.65,H+.13)
 ladder(m,w/2-.12,d/2+.22,H+.13)
 # A shallow metal service canopy and its brackets give each small facade a role.
 m[0].box((0,2.28,-d/2-.35),(1.9,.1,.7),'blue')
 for x in [-.8,.8]:m[0].beam((x,2.22,-d/2-.6),(x,1.92,-d/2),.04,mat='rust')
 crate(m,w/2+.42,.6,w=.65)
 return register(kind+('-open' if state==2 else ''),m)
for k in ['utility-kiosk','site-office']:
 for s in [1,2]:small_building(k,s)

def rubble(variant='small'):
 fx,fy,fz={'small':(1,1,1),'medium':(1.45,1.3,1.25),'large':(1.85,1.65,1.5)}[variant]
 random.seed(10312026+sum(ord(c) for c in variant))
 m=pair()
 # Two large irregular wall remnants provide actual silhouette-blocking cover.
 solid(m,(-.8*fx,.8*fy,0),(1.8*fx,1.6*fy,.38*fz),'brick',-12)
 solid(m,(.5*fx,.5*fy,.3*fz),(1.9*fx,1.0*fy,.45*fz),'concrete',28)
 for i in range(45):
  x=random.uniform(-1.8,1.8);z=random.uniform(-.7,.7);h=random.uniform(.1,.35)
  m[0].box((x*fx,h/2*fy,z*fz),(random.uniform(.12,.55)*fx,h*fy,random.uniform(.12,.38)*fz),random.choice(['brick','concrete','rubble']),random.uniform(0,180))
 for i in range(5):m[0].beam(((-1+i*.18)*fx,1.3*fy,0),((-1.05+i*.18)*fx,(1.9+random.random()*.2)*fy,.1*fz),.025,mat='rust')
 return register('wall-rubble'+('' if variant=='small' else '-'+variant),m)
for variant in ['small','medium','large']:rubble(variant)

def barriers():
 m=pair()
 for x in [-1.55,0,1.55]:
  solid(m,(x,.48,0),(1.45,.96,.48),'concrete')
  m[0].box((x,.12,.29),(1.48,.15,.12),'yellow')
  for xx in [-.48,.48]:m[0].cylinder((x+xx,.95,0),(x+xx,1.08,0),.045,'rust',6)
 solid(m,(0,1.8,0),(3.6,1.7,.12),'blue')
 for x in [-1.85,1.85]:solid(m,(x,1.4,0),(.1,2.8,.16),'rust')
 return register('construction-screen',m)
barriers()

def stores():
 m=pair()
 crate(m,-.7,0,w=1.15);crate(m,.6,0,w=1.1);crate(m,-.1,.8,w=.95)
 for j in range(3):
  yy=.22+j*.31
  for k in range(3-j):m[0].cylinder((-1.2+k*.42,yy,-1.4),(-1.2+k*.42,yy,-.05),.19,'concrete',12)
 solid(m,(-.8,.4,-.75),(1.25,.8,1.5),'concrete',collision=True)
 return register('site-stores',m)
stores()

def excavation():
 m=pair();W,D=8,6;dep=PIT_DEPTH
 # Continuous weathered steel shoring replaces isolated concrete cubes. Timber
 # wales and regularly seated soldier piles make the walls read as a real dig.
 for x in [-4,4]:
  solid(m,(x,-dep/2,0),(.28,dep,6),'soil')
  solid(m,(x,.48,0),(.2,.96,5.95),'rust')
  for z in np.arange(-2.85,2.9,.38):m[0].box((x+math.copysign(.11,x),(.96-dep)/2,z),(.10,dep+.96,.12),'metal')
  for yy in [-dep*.6,.16,.83]:m[0].box((x+math.copysign(.18,x),yy,0),(.15,.14,5.95),'wood')
  for z in [-2.7,-1.35,0,1.35,2.7]:
   m[0].box((x,(.96-dep)/2,z),(.3,dep+.96,.19),'rust')
   m[0].cylinder((x-math.copysign(.18,x),.62,z),(x-math.copysign(.22,x),.62,z),.065,'silver',8)
 for sign in [-1,1]:
  z=sign*3
  for x in [-2.75,2.75]:solid(m,(x,-dep/2,z),(2.5,dep,.24),'soil')
  solid(m,(0,-.075,sign*2.55),(2.2,.15,.9),'concrete')
  # Longer diagonal ramps fit the original pit footprint at a usable incline.
  start=np.array([0,0,sign*2.2]);end=np.array([-sign*3.05,-dep,-sign*.1]);d=end-start
  u=np.array([-d[2],0,d[0]]);u=u/np.linalg.norm(u)*.7
  al,ar,bl,br=start-u,start+u,end-u,end+u
  lowl=al.copy();lowl[1]=-dep;lowr=ar.copy();lowr[1]=-dep
  for part in m:
   part.face([al,ar,br,bl],'concrete');part.face([lowr,lowl,bl,br],'soil')
   part.face([lowl,lowr,ar,al],'soil');part.face([al,bl,lowl],'soil');part.face([ar,lowr,br],'soil')
  for side in [-1,1]:
   aa=start+side*u;bb=end+side*u
   m[0].beam(aa+[0,.7,0],bb+[0,.7,0],.05,mat='yellow')
   for f in [0,.33,.67,1]:
    pos=aa+(bb-aa)*f;m[0].cylinder(pos,pos+[0,.7,0],.028,'rust',6)
 # Open earth and rubble only; no custom Hyperthermal Tech scenery.
 for i in range(36):
  x=random.choice([-1,1])*random.uniform(2.2,3.7);z=random.uniform(-2.7,2.7)
  m[0].box((x,-dep+.1,z),(random.uniform(.2,.6),.2,random.uniform(.15,.45)),random.choice(['brick','concrete','rubble']),random.uniform(0,180))
 return register('excavation-cut',m,True)
excavation()

def excavator():
 m=pair()
 for z in [-.85,.85]:
  solid(m,(0,.32,z),(2.8,.64,.5),'metal')
  for x in np.arange(-1.25,1.3,.22):m[0].box((x,.68,z),(.12,.08,.58),'rust')
  for x in [-1,-.5,0,.5,1]:m[0].cylinder((x,.3,z-.27),(x,.3,z+.27),.23,'metal',12)
 m[0].cylinder((0,.65,0),(0,.95,0),.7,'metal',18)
 solid(m,(-.35,1.25,0),(1.9,.7,1.4),'yellow')
 solid(m,(-.65,1.93,-.22),(1.0,.9,.9),'metal')
 for z in [-.68,.24]:m[0].box((-.65,2.0,z),(.78,.6,.025),'blue')
 m[0].box((-.13,2.0,-.2),(.025,.6,.72),'blue')
 m[0].box((-.65,2.45,-.2),(1.05,.1,1),'yellow')
 m[0].beam((.4,1.35,.1),(1.4,3.05,.1),.32,.4,'yellow')
 m[0].beam((1.4,3.05,.1),(2.6,.8,.1),.24,.3,'yellow')
 m[0].cylinder((.3,1.2,-.15),(1.24,2.9,-.15),.06,'silver',8)
 m[0].cylinder((1.65,2.65,-.12),(2.45,.9,-.12),.05,'silver',8)
 solid(m,(2.7,.32,.1),(.75,.64,.85),'rust')
 for dz in [-.3,-.1,.1,.3]:m[0].box((2.99,.13,.1+dz),(.38,.17,.1),'silver',15)
 # Low-poly compound arm volumes preserve the space below the boom.
 m[1].beam((.4,1.35,.1),(1.4,3.05,.1),.32,.4);m[1].beam((1.4,3.05,.1),(2.6,.8,.1),.24,.3)
 return register('tracked-excavator',m)
excavator()

def van():
 m=pair();solid(m,(0,.8,0),(1.45,1.25,3.15),'tarp')
 solid(m,(0,1.55,-.7),(1.4,.6,1.7),'tarp')
 m[0].box((0,1.55,-1.565),(1.13,.6,.025),'blue')
 m[0].box((0,.93,-1.61),(1.13,.35,.04),'metal')
 for x in [-.73,.73]:
  m[0].box((x,1.55,-.8),(.025,.55,1.0),'blue')
  for z in [-1.05,1.0]:m[0].cylinder((x-.09,.43,z),(x+.09,.43,z),.43,'metal',16);m[0].cylinder((x-.1,.43,z),(x+.1,.43,z),.21,'silver',12)
 for x in [-.5,.5]:m[0].box((x,.95,-1.65),(.27,.16,.045),'silver')
 return register('utility-van',m)
van()

def streetkit():
 m=pair();solid(m,(0,.85,0),(.85,1.7,.6),'metal')
 for i in range(7):m[0].box((0,1.0+i*.065,.315),(.6,.022,.035),'silver')
 solid(m,(1.2,.35,.1),(1.0,.7,1.1),'concrete')
 for i in range(10):m[0].cylinder((1.2,.75,.1),(1.2+random.uniform(-.35,.35),1.0+random.random()*.4,.1+random.uniform(-.4,.4)),.025,'rust',5)
 return register('utility-and-planter',m)
streetkit()

def coverwall():
 m=pair();solid(m,(0,1.4,0),(3.4,2.8,.32),'brick')
 solid(m,(0,2.84,0),(3.6,.16,.5),'concrete')
 for x in [-1.6,1.6]:solid(m,(x,1.4,0),(.35,2.8,.55),'concrete')
 return register('retained-foundation-wall',m)
coverwall()

# Layout axis: consoles run SW--NE; deployment corners are SE and NW.
BUILDINGS=[
 ('civic','Civic Corner East',14,-17,0),('annex','Research Annex East',18,-5,0),
 ('ruin','Tenement South',-10,-17.5,0),('depot','Service Workshop South',1,-21,0),
 ('civic','Civic Corner West',-14,17,180),('annex','Research Annex West',-18,5,180),
 ('ruin','Tenement North',10,17.5,180),('depot','Service Workshop North',-1,21,180),
 ('ruin','Central Ruined Block',-5.4,5.4,45),('annex','Central Survey Annex',5.4,-5.4,45)]
for kind,title,x,z,angle in BUILDINGS:
 p=dict(mesh=kind+'-state-1',title=title,x=x,z=z,y=STREET_Y,angle=angle,kind='building',states=True)
 if kind=='depot':p.update(stateVariants={'2':'depot-state-2'},stateLabels={'1':'Roof on','2':'Ground floor exposed'})
 placements.append(p)
for kind,title,x,z,angle in [('utility-kiosk','Midfield Utilities South',-2.5,-4,0),('utility-kiosk','Midfield Utilities North',2.5,4,180),('site-office','Western Excavation Site Office',-18,-14,0),('site-office','Eastern Excavation Site Office',18,14,180)]:
 placements.append(dict(mesh=kind,title=title,x=x,z=z,y=STREET_Y,angle=angle,kind='building',states=True,stateVariants={'2':kind+'-open'},stateLabels={'1':'Roof on','2':'Ground floor exposed'}))
DIGS=[(-14,-3),(14,3),(-4,-11)]
for i,(x,z) in enumerate(DIGS):placements.append(dict(mesh='excavation-cut',title=f'Excavation Pocket {i+1}',x=x,z=z,y=STREET_Y,angle=0,kind='dig'))
SCATTER=[
 ('wall-rubble',-13.5,-17,20),('wall-rubble',13.5,17,200),
 ('wall-rubble',-5,-.8,100),('wall-rubble',5,.8,280),
 ('wall-rubble',-21,14,0),('wall-rubble',21,-14,180),
 ('site-stores',-20,0,90),('site-stores',20,0,270),
 ('site-stores',-5,-22,0),('site-stores',5,22,180),
 ('tracked-excavator',-8,-3,90),('tracked-excavator',8,3,270),
 ('utility-van',21,-21,10),('utility-van',-21,21,190),
 ('utility-and-planter',-20,-5,0),('utility-and-planter',20,5,180),
 ('wall-rubble-large',-6.5,13,0),('wall-rubble-large',6.5,-13,180),
 ('wall-rubble-medium',-17,11,45),('wall-rubble-medium',17,-11,225),
 ('wall-rubble-medium',-10,-22,0),('wall-rubble-medium',10,22,180),
 ('wall-rubble',-15,-10,45),('wall-rubble',15,10,225),
 ('wall-rubble',-6,20.5,90),('wall-rubble',6,-20.5,270)]
for i,(mesh,x,z,angle) in enumerate(SCATTER):placements.append(dict(mesh=mesh,title=mesh.replace('-',' ').title()+f' {i+1}',x=x,z=z,y=STREET_Y,angle=angle,kind='scatter'))

# Continuous mat with physical cutouts. No invisible collider covers the pits.
ground=box(-24,-24,24,24)
for x,z in DIGS:ground=ground.difference(box(x-4,z-3,x+4,z+3))
mat=pair();street_vertices=set()
for t in triangulate(ground):
 if not ground.covers(t):continue
 pts=list(t.exterior.coords)[:3]
 # Clip ground triangles into 2-inch material panels so asphalt grain stays scaled.
 for x in np.arange(-24,24,2):
  for z in np.arange(-24,24,2):
   p=t.intersection(box(x,z,x+2,z+2))
   if p.is_empty or p.area<.00001:continue
   for tt in triangulate(p):
    if p.covers(tt):
     points=[(xx,0,zz) for xx,zz in list(tt.exterior.coords)[:3]][::-1]
     start=len(mat[0].v);mat[0].face(points,'asphalt')
     mat[0].uv[start:]=[((xx+24)/48*.5,1-(zz+24)/48) for xx,_,zz in points]
     street_vertices.update(range(start,len(mat[0].v)))
 mat[1].face([(x,0,z) for x,z in pts][::-1])
# Pit floors are part of the mat, with matching earthen bottom surfaces.
for x,z in DIGS:
 mat[0].quad((x-4,-PIT_DEPTH,z-3),(x-4,-PIT_DEPTH,z+3),(x+4,-PIT_DEPTH,z+3),(x+4,-PIT_DEPTH,z-3),'soil')
 mat[1].quad((x-4,-PIT_DEPTH,z-3),(x-4,-PIT_DEPTH,z+3),(x+4,-PIT_DEPTH,z+3),(x+4,-PIT_DEPTH,z-3),tile=10000)
# Close the entire base, including pit walls and underside. The bottom rests
# at world 0.85 instead of hanging several inches above the standard table.
for x,z in DIGS:
 for a,b in [((x-4,z-3),(x+4,z-3)),((x+4,z-3),(x+4,z+3)),((x+4,z+3),(x-4,z+3)),((x-4,z+3),(x-4,z-3))]:
  for part in mat:part.quad((a[0],-PIT_DEPTH,a[1]),(b[0],-PIT_DEPTH,b[1]),(b[0],0,b[1]),(a[0],0,a[1]),'soil',tile=10000 if part is mat[1] else 2)
for a,b in [((-24,-24),(24,-24)),((24,-24),(24,24)),((24,24),(-24,24)),((-24,24),(-24,-24))]:
 for part in mat:part.quad((a[0],BASE_BOTTOM,a[1]),(a[0],0,a[1]),(b[0],0,b[1]),(b[0],BASE_BOTTOM,b[1]),'soil',tile=10000 if part is mat[1] else 2)
for part in mat:part.face([(-24,BASE_BOTTOM,-24),(24,BASE_BOTTOM,-24),(24,BASE_BOTTOM,24),(-24,BASE_BOTTOM,24)],'soil')
for i,(u,v) in enumerate(mat[0].uv):
 if i not in street_vertices:mat[0].uv[i]=(.5+.5*u,v)
register('urban-street-mat',mat,True)
placements.insert(0,dict(mesh='urban-street-mat',title='Old Quarter Excavation — Street Mat',x=0,z=0,y=STREET_Y,angle=0,kind='mat'))

# Raised pavements ground the buildings in an urban street layout. Each is a
# separate textured model, so the primary ground stays comfortably below 25k.
pavement=pair()
from shapely.affinity import rotate,translate
for kind,title,x,z,angle in BUILDINGS:
 if kind=='civic':poly=Polygon([(-4,-3),(4,-3),(4,0),(1,0),(1,3),(-4,3)])
 elif kind=='annex':poly=box(-3.2,-3,3.2,3)
 elif kind=='ruin':poly=Polygon([(-3.5,-3),(3.5,-3),(3.5,1.4),(1.4,3),(-3.5,3)])
 else:poly=box(-3,-2.4,3,2.4)
 ring=poly.buffer(.48,join_style=2).difference(poly)
 ring=translate(rotate(ring,-angle,origin=(0,0)),xoff=x,yoff=z)
 slab(pavement,ring,.005,.11,'concrete')
for p in placements:
 if p['mesh'] not in ['utility-kiosk','site-office']:continue
 w=3.4 if p['mesh']=='utility-kiosk' else 4.2
 poly=box(-w/2,-1.5,w/2,1.5);ring=poly.buffer(.35,join_style=2).difference(poly)
 ring=translate(rotate(ring,-p['angle'],origin=(0,0)),xoff=p['x'],yoff=p['z']);slab(pavement,ring,.005,.11,'concrete')
register('urban-pavements',pavement)
placements.insert(1,dict(mesh='urban-pavements',title='Urban Pavements and Curbs',x=0,z=0,y=STREET_Y,angle=0,kind='pavement'))

# No painted road dashes. The mat uses a unique full-board street photograph.

manifest=[]
for name,v in meshes.items():
 visual=v['visual'];col=v['collider']
 assert len(visual.v)<25000,(name,len(visual.v))
 # Compound components are simple boxes; nonconvex locked meshes are checked separately.
 if not v['nonconvex']:
  spans=sorted(set([0,*col.groups,len(col.f)]));assert max((b-a for a,b in zip(spans,spans[1:])),default=0)<256
 manifest.append(dict(name=name,vertices=len(visual.v),triangles=len(visual.f),colliderTriangles=len(col.f),nonconvex=v['nonconvex'],bounds=visual.bounds()))
(ROOT/'Source'/'mesh-manifest.json').write_text(json.dumps(manifest,indent=2))
(ROOT/'Source'/'layout.json').write_text(json.dumps(placements,indent=2))
print(json.dumps({'meshes':len(meshes),'placed_components':len(placements),'max_vertices':max(len(v['visual'].v) for v in meshes.values())}))

if __name__=='__main__': pass
