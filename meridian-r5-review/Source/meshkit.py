"""Meridian Exchange R1. Original geometry; units are tabletop inches.
Y is vertical, opposing player edges X=-24/+24. Deterministic build.
"""
from pathlib import Path
import math, json, copy, hashlib, random
import numpy as np
import trimesh
from PIL import Image, ImageDraw, ImageFont
from shapely.geometry import Polygon, Point, box as sbox
from shapely.ops import triangulate

ROOT=Path(__file__).resolve().parents[1]
A=ROOT/'Assets'; A.mkdir(exist_ok=True)
random.seed(2806)
ATLAS=Image.open(A/'meridian-atlas.png').convert('RGB')
NAMES=['limestone','sage','ceramic','bronze','travertine','roof','asphalt','glass','wood','fabric','enamel','rubber','rock','soil','mosaic','red']
MAT={n:i for i,n in enumerate(NAMES)}
MATERIAL_SCALE={'wood':.80,'ceramic':1.20,'fabric':.65,'mosaic':1.60,'bronze':1.20}
RECORDS=[]; SOLIDS=[]; FLOORS=[]; FURNITURE=[]
MIRROR_X=True  # Wavefront right-handed coordinates -> Unity left-handed import.

class Mesh:
 def __init__(self): self.v=[];self.f=[];self.uv=[];self.solids=[];self.parts=[];self.wall_volumes=[];self._wall_capture=False;self.physical_extras=[];self.free_ranges=[];self._solid_depth=0
 def face(self,vs,mat):
  vs=np.array(vs,float); normal=np.cross(vs[1]-vs[0],vs[2]-vs[0]); dim=int(np.argmax(np.abs(normal)))
  repeat=MATERIAL_SCALE.get(mat,2.4)
  # Subdivide large planar faces so atlas materials retain a consistent inch scale.
  # Atlas wrapping must happen within each swatch, rather than into its neighbors.
  axes=[a for a in range(3)if a!=dim];projected=vs[:,axes]
  if np.max(np.ptp(projected,axis=0))>repeat+.001 and np.linalg.norm(normal)>1e-10:
   from shapely.geometry import box as clipbox
   polygon=Polygon(projected).buffer(0);lo=projected.min(axis=0);hi=projected.max(axis=0)
   tile=MAT.get(mat,mat);col=tile%4;row=tile//4
   for i in range(math.floor(lo[0]/repeat),math.floor(hi[0]/repeat)+1):
    for j in range(math.floor(lo[1]/repeat),math.floor(hi[1]/repeat)+1):
     piece=polygon.intersection(clipbox(i*repeat,j*repeat,(i+1)*repeat,(j+1)*repeat))
     polys=[piece]if piece.geom_type=='Polygon'else[p for p in getattr(piece,'geoms',[])if p.geom_type=='Polygon']
     for p in polys:
      if p.area<1e-10:continue
      for tri in triangulate(p):
       if not p.covers(tri):continue
       coords=np.array(list(tri.exterior.coords)[:3]);pts=np.zeros((3,3));pts[:,axes]=coords
       pts[:,dim]=vs[0,dim]-(normal[axes[0]]*(coords[:,0]-vs[0,axes[0]])+normal[axes[1]]*(coords[:,1]-vs[0,axes[1]]))/normal[dim]
       if np.dot(np.cross(pts[1]-pts[0],pts[2]-pts[0]),normal)<0:pts=pts[::-1];coords=coords[::-1]
       q=(coords-[i*repeat,j*repeat])/repeat;uv=np.column_stack(((col+.035+.93*q[:,0])/4,(3-row+.035+.93*q[:,1])/4))
       k=len(self.v);self.v.extend(pts.tolist());self.uv.extend(uv.tolist());self.f.append([k,k+1,k+2])
   return
  axes=[a for a in range(3) if a!=dim]; q=vs[:,axes]; lo=q.min(axis=0); span=np.maximum(q.max(axis=0)-lo,.01)
  tile=MAT.get(mat,mat); c=tile%4;r=tile//4
  q=(q-lo)/np.maximum(span,repeat);q=np.clip(q,0,1)
  uv=np.column_stack(((c+.035+.93*q[:,0])/4,(3-r+.035+.93*q[:,1])/4))
  k=len(self.v);self.v.extend(vs.tolist());self.uv.extend(uv.tolist())
  for i in range(1,len(vs)-1):self.f.append([k,k+i,k+i+1])
 def box(self,x,y,z,w,h,d,mat='limestone',collide=True):
  x0=x-w/2;x1=x+w/2;y0=y;y1=y+h;z0=z-d/2;z1=z+d/2
  self.face([(x0,y0,z0),(x0,y0,z1),(x0,y1,z1),(x0,y1,z0)],mat)
  self.face([(x1,y0,z1),(x1,y0,z0),(x1,y1,z0),(x1,y1,z1)],mat)
  self.face([(x0,y0,z1),(x0,y0,z0),(x1,y0,z0),(x1,y0,z1)],mat)
  self.face([(x0,y1,z0),(x0,y1,z1),(x1,y1,z1),(x1,y1,z0)],mat)
  self.face([(x1,y0,z0),(x0,y0,z0),(x0,y1,z0),(x1,y1,z0)],mat)
  self.face([(x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)],mat)
  if collide:self.solids.append(('box',(x,y,z,w,h,d)))
 def prism(self,poly,y,h,mat='travertine',collide=True):
  p=Polygon(poly)
  if not p.exterior.is_ccw:poly=list(reversed(poly));p=Polygon(poly)
  for t in triangulate(p):
   if not p.covers(t.representative_point()):continue
   q=list(t.exterior.coords)[:3]
   self.face([(x,y,z) for x,z in q],mat)
   self.face([(x,y+h,z) for x,z in reversed(q)],mat)
  for (x,z),(xx,zz) in zip(poly,poly[1:]+poly[:1]): self.face([(x,y,z),(x,y+h,z),(xx,y+h,zz),(xx,y,zz)],mat)
  if collide:self.solids.append(('poly',(poly,y,h)))
  if self._wall_capture:self.wall_volumes.append({'poly':poly,'y':y,'h':h,'mat':mat})
 def cyl(self,x,y,z,r,h,mat='bronze',n=20,r2=None):
  rr=r if r2 is None else r2
  bot=[(x+r*math.cos(t),y,z+r*math.sin(t)) for t in np.linspace(0,2*math.pi,n,endpoint=False)]
  top=[(x+rr*math.cos(t),y+h,z+rr*math.sin(t)) for t in np.linspace(0,2*math.pi,n,endpoint=False)]
  self.face(bot,mat);self.face(top[::-1],mat)
  for i in range(n):j=(i+1)%n;self.face([bot[i],top[i],top[j],bot[j]],mat)
 def beam(self,p,q,width,mat='bronze',depth=None):
  p=np.array(p);q=np.array(q);v=q-p;length=np.linalg.norm(v)
  if length<1e-7:return
  v=v/length;ref=np.array([0,1,0]) if abs(v[1])<.95 else np.array([1,0,0]);u=np.cross(v,ref);u=u/np.linalg.norm(u)*width/2
  w=np.cross(v,u);w=w/np.linalg.norm(w)*(depth or width)/2
  a=[p-u-w,p+u-w,p+u+w,p-u+w];b=[q-u-w,q+u-w,q+u+w,q-u+w]
  self.face(a[::-1],mat);self.face(b,mat)
  for i in range(4):j=(i+1)%4;self.face([a[i],a[j],b[j],b[i]],mat)
 def wall(self,p,q,y,h,kind='solid',mat='sage',th=.25):
  p=np.array(p,float);q=np.array(q,float);v=q-p;L=np.linalg.norm(v);v/=L;n=np.array([-v[1],v[0]])
  def segment(a,b,yy,hh,mm):
   if b-a<.001 or hh<.001:return
   pp=p+a*v;qq=p+b*v;poly=[(pp+n*th/2).tolist(),(qq+n*th/2).tolist(),(qq-n*th/2).tolist(),(pp-n*th/2).tolist()]
   self.prism(poly,yy,hh,mm)
  if kind=='door' and L>=2.4:
   width=min(2.25,L-.5);a=(L-width)/2;b=a+width
   segment(0,a,y,h,mat);segment(b,L,y,h,mat);segment(a,b,y+2.65,h-2.65,mat)
   for t in [a-.035,b+.035]:segment(t-.045,t+.045,y,2.7,'bronze')
   segment(a,b,y+2.65,.10,'bronze')
  elif kind=='window' and L>=1.4:
   a=.35;b=L-.35;sill=min(1.05,h*.25);head=h-.30
   segment(0,a,y,h,mat);segment(b,L,y,h,mat);segment(a,b,y,sill,mat);segment(a,b,y+head,h-head,mat)
   segment(a-.06,a+.06,y+sill,head-sill,'bronze');segment(b-.06,b+.06,y+sill,head-sill,'bronze')
   segment(a-.12,b+.12,y+sill-.09,.09,'travertine')
  else:segment(0,L,y,h,mat)
  if kind=='door' and L>=2.4:
   segment(0,a,y,.18,'limestone');segment(b,L,y,.18,'limestone')
  else:segment(0,L,y,.18,'limestone')
  segment(0,L,y+h-.13,.13,'travertine')
 def add(self,other):
  k=len(self.v);self.v.extend(other.v);self.uv.extend(other.uv);self.f.extend([[a+k for a in f] for f in other.f]);self.solids.extend(other.solids);self.wall_volumes.extend(copy.deepcopy(other.wall_volumes));self.physical_extras.extend(copy.deepcopy(other.physical_extras));self.free_ranges.extend([(a+k,b+k)for a,b in other.free_ranges]);self.parts.extend([dict(part,first=part["first"]+k,last=part["last"]+k)for part in other.parts])
 def moved(self,x=0,z=0,y=0,rot=0):
  out=copy.deepcopy(self);a=math.radians(rot);c=math.cos(a);s=math.sin(a)
  out.v=[(x+c*px+s*pz,y+py,z-s*px+c*pz) for px,py,pz in self.v]
  out.physical_extras=[[(x+c*px+s*pz,y+py,z-s*px+c*pz)for px,py,pz in pts]for pts in self.physical_extras]
  out.wall_volumes=[]
  for vol in self.wall_volumes:
   vv=copy.deepcopy(vol);vv["poly"]=[(x+c*px+s*pz,z-s*px+c*pz)for px,pz in vol["poly"]];vv["y"]+=y;out.wall_volumes.append(vv)
  out.solids=[]
  for kind,data in self.solids:
   if kind=='box':
    px,py,pz,w,h,d=data;pts=polyrect(w,d);pts=[(px+xx,pz+zz)for xx,zz in pts]
   else:pts,py,h=data
   pts=[(x+c*px+s*pz,z-s*px+c*pz)for px,pz in pts]
   out.solids.append(('poly',(pts,py+y,h)))
  return out
 def export(self,name):
  from join_walls import join_walls
  self._solid_depth+=1
  try:join_walls(self)
  finally:self._solid_depth-=1
  # Validate the same quantized positions that are actually written to OBJ.
  vs=np.round(np.array(self.v),5);fs=np.array(self.f);uv=np.array(self.uv)
  cross=np.cross(vs[fs[:,1]]-vs[fs[:,0]],vs[fs[:,2]]-vs[fs[:,0]])
  fs=fs[np.linalg.norm(cross,axis=1)>1e-10]
  if MIRROR_X:vs[:,0]*=-1;fs=fs[:,::-1]
  t=trimesh.Trimesh(vs,fs,process=False);normals=t.face_normals
  lines=['# Meridian Exchange R1 / inches / original geometry']
  lines.extend('v %.5f %.5f %.5f'%tuple(v) for v in vs)
  lines.extend('vt %.6f %.6f'%tuple(v) for v in uv)
  lines.extend('vn %.6f %.6f %.6f'%tuple(n) for n in normals)
  lines.append('g visible')
  for ni,f in enumerate(fs,1):lines.append('f '+' '.join(f'{i+1}/{i+1}/{ni}' for i in f))
  (A/(name+'.obj')).write_text('\n'.join(lines)+'\n')
  # Weld coincident vertices, retaining all disconnected solids and openings.
  col=trimesh.Trimesh(vs,fs,process=True);col.remove_unreferenced_vertices()
  (A/(name+'-collision.obj')).write_text(trimesh.exchange.obj.export_obj(col,include_normals=False,include_texture=False))
  return {'file':name+'.obj','collider':name+'-collision.obj','vertices':len(vs),'triangles':len(fs),'bounds':np.array(self.v).min(axis=0).tolist()+np.array(self.v).max(axis=0).tolist()}

def polyrect(w,d,ch=0):
 if not ch:return [(-w/2,-d/2),(w/2,-d/2),(w/2,d/2),(-w/2,d/2)]
 return [(-w/2+ch,-d/2),(w/2-ch,-d/2),(w/2,-d/2+ch),(w/2,d/2-ch),(w/2-ch,d/2),(-w/2+ch,d/2),(-w/2,d/2-ch),(-w/2,-d/2+ch)]
def regular(r,n=8):return [(r*math.cos(a),r*math.sin(a))for a in np.linspace(math.pi/8,2*math.pi+math.pi/8,n,endpoint=False)]
def shell(poly,y,h,kinds,mat='sage'):
 m=Mesh();m.floor_y=y+.25;m.prism(poly,y,.25,'mosaic')
 for i,(p,q) in enumerate(zip(poly,poly[1:]+poly[:1])):m.wall(p,q,y+.25,h-.25,kinds.get(i,'solid'),mat)
 return m
def roof(poly,y,parapet=True,mat='roof',gates=None):
 m=Mesh();m.prism(poly,y,.25,mat)
 if parapet:
  for i,(p,q) in enumerate(zip(poly,poly[1:]+poly[:1])):
   gate=(gates or{}).get(i)
   if gate=='all':continue
   if gate:
    p=np.array(p,float);q=np.array(q,float);v=q-p;L=np.linalg.norm(v);v/=L;center,width=gate;a=max(0,center*L-width/2);b=min(L,center*L+width/2)
    for aa,bb in [(0,a),(b,L)]:
     if bb-aa>.01:m.wall(p+aa*v,p+bb*v,y+.25,.75,'solid','limestone',.25)
   else:m.wall(p,q,y+.25,.75,'solid','limestone',.25)
 return m
def ladder(m,x,z,y0,y1,orientation=0,towards=(0,0)):
 a=math.radians(orientation);u=np.array([math.cos(a),math.sin(a)])
 for sign in [-1,1]:
  xx,zz=np.array([x,z])+sign*.48*u;m.beam((xx,y0,zz),(xx,y1+.7,zz),.075)
 for yy in np.arange(y0+.3,y1+.15,.33):
  p=np.array([x,z])-.48*u;q=np.array([x,z])+.48*u;m.beam((p[0],yy,p[1]),(q[0],yy,q[1]),.055)
 for yy in [y0+.35,y1-.25]:
  for side in [-1,1]:
   xx,zz=np.array([x,z])+side*.48*u;m.beam((xx,yy,zz),(xx+towards[0],yy,zz+towards[1]),.065)
 # Solid brackets meet the visible wall; rungs retain separate collision.
def stairs(m,x,z,y,h,length,width,rot=0):
 t=Mesh();steps=round(h/.25)
 for i in range(steps):t.box((i+.5)*length/steps,y,z=0,w=length/steps+.002,h=(i+1)*h/steps,d=width,mat='travertine')
 for side in [-1,1]:
  t.beam((0,y+.9,side*(width/2+.05)),(length,y+h+.9,side*(width/2+.05)),.055)
  for f in np.linspace(0,1,5):t.beam((f*length,y+f*h,side*(width/2+.05)),(f*length,y+f*h+.9,side*(width/2+.05)),.05)
 m.add(t.moved(x,z,rot=rot));m.box(x+length*math.cos(math.radians(rot)),y+h-.25,z-length*math.sin(math.radians(rot)),width,.25,width,'travertine')
def bench(m,x,z,rot=0,length=2.4):
 t=Mesh()
 for j in range(5):t.box(0,.62,-.32+j*.16,length,.1,.12,'wood')
 for side in [-1,1]:
  t.box(side*(length/2-.3),0,0,.13,.65,.75,'bronze')
  t.beam((side*(length/2-.3),.5,.36),(side*(length/2-.3),1.25,.43),.07)
 for j in range(4):t.box(0,.78+j*.14,.43,length,.1,.07,'wood')
 m.add(t.moved(x,z,y=.25,rot=rot))
def bed(m,x,z,rot=0):
 t=Mesh();t.box(0,.48,0,1.05,.12,2.15,'enamel');t.box(0,.6,0,.95,.18,2.02,'fabric');t.box(0,.78,.70,.78,.16,.45,'fabric')
 for xx in [-.39,.39]:
  for zz in [-.78,.78]:
   t.box(xx,.12,zz,.09,.38,.09,'bronze');t.cyl(xx,.04,zz,.115,.13,'rubber',10)
  t.beam((xx,.64,-.7),(xx,1.0,-.7),.035);t.beam((xx,.64,.2),(xx,1,.2),.035);t.beam((xx,1,-.7),(xx,1,.2),.035)
 # Headboard and articulated infusion monitor, screen, buttons, wire stem.
 t.box(0,.8,1.03,1.05,.40,.08,'enamel');t.beam((.65,0,.7),(.65,1.8,.7),.055)
 t.box(.65,1.25,.7,.50,.34,.09,'enamel');t.box(.65,1.3,.645,.36,.18,.014,'glass')
 for i in range(3):t.cyl(.48+i*.15,1.25,.63,.025,.02,'red',8)
 m.add(t.moved(x,z,y=.25,rot=rot));FURNITURE.append({'kind':'treatment bed','center':[x,z],'size':[1.45,2.2]})
def desk(m,x,z,rot=0):
 t=Mesh();t.box(0,.85,0,2.0,.12,.85,'wood')
 for xx in [-.78,.78]:t.box(xx,0,0,.12,.85,.7,'bronze')
 t.box(-.52,.2,0,.62,.55,.7,'enamel')
 for yy in [.32,.51,.7]:t.box(-.52,yy,-.365,.42,.04,.04,'bronze')
 t.box(.15,1.12,.13,.72,.45,.07,'bronze');t.box(.15,1.17,.085,.61,.30,.012,'glass');t.box(.15,.97,-.2,.65,.035,.25,'rubber')
 t.box(.15,.95,.13,.10,.2,.08,'bronze')
 # Keyboard keys, ergonomic chair shell, five-spoke caster base and armrests.
 for k in range(8):
  for j in range(3):t.box(-.12+k*.065,1.01,-.28+j*.05,.048,.012,.035,'enamel')
 t.cyl(.1,.17,-1.05,.055,.47,'bronze',12)
 t.box(.1,.63,-1.05,.68,.13,.64,'fabric');t.box(.1,.91,-1.37,.68,.64,.12,'fabric')
 for side in [-1,1]:
  t.beam((.1+side*.32,.65,-1.15),(.1+side*.32,.92,-1.15),.04,'bronze');t.box(.1+side*.32,.92,-1.03,.08,.05,.48,'rubber')
 for angle in np.linspace(0,2*math.pi,5,endpoint=False):
  xx=.1+.43*math.cos(angle);zz=-1.05+.43*math.sin(angle)
  t.beam((.1,.2,-1.05),(xx,.13,zz),.055,'bronze');t.cyl(xx,.04,zz,.075,.10,'rubber',10)
 m.add(t.moved(x,z,y=.25,rot=rot))
def lockers(m,x,z,rot=0,count=4):
 t=Mesh()
 for i in range(count):
  xx=i*.48;t.box(xx,0,0,.46,1.7,.42,'sage');t.box(xx,.12,-.221,.40,1.46,.025,'enamel');t.box(xx+.10,.84,-.249,.04,.20,.03,'bronze')
  for yy in [1.34,1.40,1.46]:t.box(xx,yy,-.24,.25,.02,.015,'rubber')
 m.add(t.moved(x,z,y=.25,rot=rot))
def washer(m,x,z):
 m.box(x,0,z,1.35,1.65,1.15,'enamel')
 # Porthole faces out Z-, ring via small radial plates, dark inner glass.
 m.box(x,.45,z-.59,.8,.8,.025,'rubber')
 for a in np.linspace(0,2*math.pi,20,endpoint=False):m.box(x+.44*math.cos(a),.86+.44*math.sin(a),z-.62,.13,.12,.08,'bronze')
 m.box(x,1.40,z-.6,.85,.12,.04,'glass');m.box(x+.40,1.4,z-.64,.10,.10,.05,'red')
def shelf(m,x,z,rot=0):
 t=Mesh()
 for xx in [-.92,.92]:t.box(xx,0,0,.08,1.9,.65,'bronze')
 for yy in [.15,.75,1.35,1.85]:
  t.box(0,yy,0,1.95,.08,.65,'wood')
  if yy<1.5:
   for xx in [-.55,.1,.62]:
    for i in range(2):t.box(xx,yy+.09+i*.11,0,.42,.1,.50,'fabric')
 m.add(t.moved(x,z,y=.25,rot=rot))
def pump(m,x,z,scale=1):
 t=Mesh();t.box(0,0,0,2.7,.20,1.55,'limestone')
 for xx in [-.7,.7]:
  t.cyl(xx,.2,0,.42,1.1,'sage',24);t.cyl(xx,1.3,0,.48,.12,'bronze',24)
  t.cyl(xx,1.42,0,.12,.38,'bronze',12)
  for a in np.linspace(0,2*math.pi,8,endpoint=False):t.cyl(xx+.34*math.cos(a),1.43,.34*math.sin(a),.04,.06,'enamel',8)
 t.beam((-.7,1.8,0),(.7,1.8,0),.18);t.beam((0,1.8,0),(0,2.1,0),.12)
 for a in np.linspace(0,2*math.pi,12,endpoint=False):
  b=a+2*math.pi/12;t.beam((.28*math.cos(a),2.1,.28*math.sin(a)),(.28*math.cos(b),2.1,.28*math.sin(b)),.035,'red')
 m.add(t.moved(x,z))
def barrel(poly,y,h,axis='x',mat='roof'):
 # Supported barrel roof, shell with closed end profiles; removable as a state.
 p=Polygon(poly);x0,z0,x1,z1=p.bounds;m=Mesh();r=(z1-z0)/2;zc=(z0+z1)/2
 for i in range(24):
  a=i*math.pi/24;b=(i+1)*math.pi/24
  zA=zc+r*math.cos(a);zB=zc+r*math.cos(b);yA=y+h*math.sin(a);yB=y+h*math.sin(b)
  m.face([(x0,yA,zA),(x1,yA,zA),(x1,yB,zB),(x0,yB,zB)],mat)
  m.face([(x0,yA-.10,zA),(x0,yB-.10,zB),(x1,yB-.10,zB),(x1,yA-.10,zA)],mat)
  for xx in [x0,x1]:m.face([(xx,y,zA),(xx,yA,zA),(xx,yB,zB),(xx,y,zB)],'limestone')
  if i%4==0:m.beam((x0,yA+.035,zA),(x1,yA+.035,zA),.07,'bronze')
 return m

def register(name,slug,states,x,z,rot=0,role='playable building',levels=None,footprint=None):
 print('Exporting',slug,flush=True)
 rec={'name':name,'slug':slug,'x':x,'z':z,'rotation':rot,'role':role,'states':[],'levels':levels or [.25]}
 for label,m in states:
  wm=m.moved(x,z,rot=rot);info=wm.export(slug+'-'+str(len(rec['states'])+1));info['label']=label;info['parts']=wm.parts;info['physical_primitives']=wm.solids;info['physical_extras']=wm.physical_extras;info['free_faces']=[[wm.v[j]for j in range(a,b)]for a,b in wm.free_ranges];info['height']=round(max(v[1] for v in m.v)-min(v[1] for v in m.v),3);rec['states'].append(info)
 rec['collision_primitives']=wm.solids
 if footprint:
  a=math.radians(rot);c=math.cos(a);s=math.sin(a);rec['footprint']=[[x+c*xx+s*zz,z-s*xx+c*zz]for xx,zz in footprint]
 RECORDS.append(rec);return rec

# Capture closed convex details and uncaptured scenic shells for movable colliders.
def solid_capture(kind,fn):
 def call(m,*args,**kw):
  first=len(m.v);m._solid_depth+=1
  try:value=fn(m,*args,**kw)
  finally:m._solid_depth-=1
  if kind in ['cyl','beam']and len(m.v)>first:m.physical_extras.append(m.v[first:])
  return value
 return call
for _name in ['box','prism','cyl','beam']:
 setattr(Mesh,_name,solid_capture(_name,getattr(Mesh,_name)))
_original_face=Mesh.face
def free_face(m,*args,**kw):
 first=len(m.v);value=_original_face(m,*args,**kw)
 if m._solid_depth==0:m.free_ranges.append((first,len(m.v)))
 return value
Mesh.face=free_face

def traced(label,fn):
 def call(m,*args,**kw):
  start=len(m.v);before=m._wall_capture;m._wall_capture=(label=='wall');value=fn(m,*args,**kw);m._wall_capture=before
  m.parts.append({'kind':label,'first':start,'last':len(m.v)})
  return value
 return call
Mesh.wall=traced('wall',Mesh.wall)
for _name in ['bed','desk','lockers','bench','washer','shelf','pump','stairs','ladder']:
 globals()[_name]=traced(_name,globals()[_name])

