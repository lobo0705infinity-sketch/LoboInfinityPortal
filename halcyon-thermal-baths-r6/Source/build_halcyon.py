"""Halcyon Thermal Baths R1. Original geometry; units are tabletop inches.
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
ATLAS=Image.open(A/'halcyon-material-atlas.png').convert('RGB')
NAMES=['limestone','sage','ceramic','bronze','travertine','roof','asphalt','glass','wood','fabric','enamel','rubber','rock','soil','mosaic','red']
MAT={n:i for i,n in enumerate(NAMES)}
RECORDS=[]; SOLIDS=[]; FLOORS=[]; FURNITURE=[]
MIRROR_X=True  # Wavefront right-handed coordinates -> Unity left-handed import.

class Mesh:
 def __init__(self): self.v=[];self.f=[];self.uv=[];self.solids=[];self.parts=[];self.wall_volumes=[];self._wall_capture=False;self.physical_extras=[];self.free_ranges=[];self._solid_depth=0
 def face(self,vs,mat):
  vs=np.array(vs,float); normal=np.cross(vs[1]-vs[0],vs[2]-vs[0]); dim=int(np.argmax(np.abs(normal)))
  axes=[a for a in range(3) if a!=dim]; q=vs[:,axes]; lo=q.min(axis=0); span=np.maximum(q.max(axis=0)-lo,.01)
  tile=MAT.get(mat,mat); c=tile%4;r=tile//4
  q=(q-lo)/np.maximum(span,2.4);q=np.clip(q,0,1)
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
  opening=None
  if isinstance(kind,tuple):kind,opening=kind[0],kind[1:]
  def segment(a,b,yy,hh,mm):
   if b-a<.001 or hh<.001:return
   pp=p+a*v;qq=p+b*v;poly=[(pp+n*th/2).tolist(),(qq+n*th/2).tolist(),(qq-n*th/2).tolist(),(pp-n*th/2).tolist()]
   self.prism(poly,yy,hh,mm)
  if kind=='door' and L>=2.4:
   width=min(2.25,L-.5) if opening is None else opening[1]
   a=(L-width)/2 if opening is None else opening[0]-width/2;b=a+width
   segment(0,a,y,h,mat);segment(b,L,y,h,mat);segment(a,b,y+2.65,h-2.65,mat)
   for t in [a-.035,b+.035]:segment(t-.045,t+.045,y,2.7,'bronze')
   segment(a,b,y+2.65,.10,'bronze')
  elif kind=='window' and L>=1.4:
   a=.35 if opening is None else opening[0]-opening[1]/2
   b=L-.35 if opening is None else opening[0]+opening[1]/2
   sill=1.25;head=min(h-.4,2.5)
   segment(0,a,y,h,mat);segment(b,L,y,h,mat);segment(a,b,y,sill,mat);segment(a,b,y+head,h-head,mat)
   segment(a-.06,a+.06,y+sill,head-sill,'bronze');segment(b-.06,b+.06,y+sill,head-sill,'bronze')
   segment(a-.12,b+.12,y+sill-.09,.09,'travertine')
  else:segment(0,L,y,h,mat)
  segment(0,L,y,.18,'limestone');segment(0,L,y+h-.13,.13,'travertine')
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
  vs=np.array(self.v);fs=np.array(self.f);uv=np.array(self.uv)
  cross=np.cross(vs[fs[:,1]]-vs[fs[:,0]],vs[fs[:,2]]-vs[fs[:,0]])
  fs=fs[np.linalg.norm(cross,axis=1)>1e-10]
  if MIRROR_X:vs[:,0]*=-1;fs=fs[:,::-1]
  t=trimesh.Trimesh(vs,fs,process=False);normals=t.face_normals
  lines=['# Halcyon Thermal Baths R1 / inches / original geometry']
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
 m=Mesh();m.prism(poly,y,.25,'mosaic')
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
  # Each end is a solid 0.125-inch wall. Opposite ends need opposite outward
  # normals; a one-sided quad disappears when viewed from the wrong side.
  for xx in [x0,x1-.125]:
   section=[(y,zA),(yA,zA),(yB,zB),(y,zB)]
   section=[p for j,p in enumerate(section) if j==0 or np.linalg.norm(np.array(p)-section[j-1])>1e-8]
   if np.linalg.norm(np.array(section[-1])-section[0])<1e-8:section.pop()
   left=[(xx,yy,zz) for yy,zz in section]
   right=[(xx+.125,yy,zz) for yy,zz in section]
   m.face(left,'limestone');m.face(right[::-1],'limestone')
   for j in range(len(left)):
    k=(j+1)%len(left);m.face([left[j],left[k],right[k],right[j]],'limestone')
   m.physical_extras.append(left+right)
  if i%4==0:m.beam((x0,yA+.035,zA),(x1,yA+.035,zA),.07,'bronze')
 return m

def register(name,slug,states,x,z,rot=0,role='playable building',levels=None,footprint=None):
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

def build():
 # Crescent hall: a wide annular suite, articulated radial rooms and tall outer windows.
 outer=[(7*math.cos(a),7*math.sin(a))for a in np.linspace(math.pi/2,3*math.pi/2,13)]
 inner=[(3.0*math.cos(a),3.0*math.sin(a))for a in np.linspace(3*math.pi/2,math.pi/2,13)]
 cres=outer+inner;g=Mesh();g.prism(cres,0,.25,'mosaic')
 for i in range(12):g.wall(outer[i],outer[i+1],.25,3.25,'window' if i%3==1 else 'solid','sage')
 for i in range(12):
  if i in [2,3,4,7,8,9]:g.wall(inner[i],inner[i+1],2.90,.60,'solid','ceramic')
  else:g.wall(inner[i],inner[i+1],.25,3.25,'solid','ceramic')
 for a in [math.pi/2,3*math.pi/2]:g.wall((3*math.cos(a),3*math.sin(a)),(7*math.cos(a),7*math.sin(a)),.25,3.25,'door','sage')
 for a in [math.pi*.80,math.pi*1.20]:
  p=np.array([3.0*math.cos(a),3.0*math.sin(a)]);q=np.array([7*math.cos(a),7*math.sin(a)]);g.wall(p,q,.25,2.75,'door','ceramic')
 bench(g,-6.195,0,90,2.0);bed(g,-3.8,4.95,rot=52.5);bed(g,-3.8,-4.95,rot=-52.5)
 # Plumbing visible around the back of the bath, not blocking door openings.
 for zz in [-2.1,2.1]:g.beam((-6.70,.5,zz),(-6.7,2.9,zz),.11)
 r=roof(cres,3.5,gates={18:'all',19:'all'});ladder(g,-2.75,0,0,3.75,90,towards=(-.3,0))
 full=copy.deepcopy(g);full.add(r)
 register('Crescent Hydrotherapy Hall','crescent-hall',[('1 · Ground treatment suite',g),('2 · Roof terrace',full)],-2,-.5,footprint=cres)

 # Octagon: one clear treatment floor, eight-sided drum, shallow faceted dome on a flat collar.
 octa=regular(4.125/math.cos(math.pi/8));g=shell(octa,0,3.5,{0:'door',2:'window',4:'door',6:'window'},'limestone')
 from spa_details import basin,POOLS
 from spa_details import indoor_tub
 tub=indoor_tub(Mesh);tub.parts.append({'kind':'tub','first':0,'last':len(tub.v)});g.add(tub)
 lockers(g,-.8,3.79,count=4);bench(g,0,-3.55,length=2.5)
 r=roof(octa,3.5,False,'travertine')
 for j in range(12):
  t0=j*math.pi/24;t1=(j+1)*math.pi/24
  for i in range(48):
   a=i*math.pi/24;b=(i+1)*math.pi/24
   pts=[(2.7*math.cos(t)*math.cos(u),3.75+1.5*math.sin(t),2.7*math.cos(t)*math.sin(u))for t,u in [(t0,a),(t0,b),(t1,b),(t1,a)]]
   r.face(pts[::-1],'roof');r.face([(x,y-.10,z)for x,y,z in pts],'roof')
 for a in np.linspace(0,2*math.pi,8,endpoint=False):
  for j in range(12):
   t0=j*math.pi/24;t1=(j+1)*math.pi/24
   p=(2.7*math.cos(t0)*math.cos(a),3.78+1.5*math.sin(t0),2.7*math.cos(t0)*math.sin(a));q=(2.7*math.cos(t1)*math.cos(a),3.78+1.5*math.sin(t1),2.7*math.cos(t1)*math.sin(a));r.beam(p,q,.045)
 full=copy.deepcopy(g);full.add(r)
 register('Octagonal Mineral Treatment Pavilion','octagonal-pavilion',[('1 · Ground mineral soaking room',g),('2 · Fully roofed dome; sloping dome not a standing surface',full)],10,6.5,role='playable interior; dome is not a standing terrace',footprint=octa)

 # Wedge clinic: lower reception/exam floor, setback upper observation ward, roofed view.
 clinic=[(-4.75,-3.5),(2.5,-3.5),(4.75,-1.25),(4.75,3.5),(-4.75,3.5)]
 # Close the stair-blocked north door and shift the south opening clear of
 # the examination-room partition at X=-0.5.
 g=shell(clinic,0,3.5,{1:'window',2:'window',3:('door',3.725,2.25)},'sage')
 g.wall((-.5,-3.35),(-.5,3.35),.25,3.0,'door','enamel');desk(g,-3.625,-2.95,180);bed(g,2.9,2.3);shelf(g,-3.2,3.05);lockers(g,1,-3.165,rot=180,count=2)
 stairs(g,-4.25,-4.65,0,3.75,6.5,2.0)
 upperpoly=[(-3.5,-2),(2,-2),(3.5,-.5),(3.5,2.6),(-3.5,2.6)]
 g.box(2.25,3.5,-3.8,2.25,.25,2.5,'travertine')
 for xx in [1.3,3.2]:g.box(xx,0,-4.7,.20,3.5,.20,'limestone')
 up=copy.deepcopy(g);up.add(roof(clinic,3.5,False,'travertine'));u=shell(upperpoly,3.75,3.25,{0:'door',1:'window',3:'window'},'enamel')
 uf=Mesh();bed(uf,-2.3,1.95,90);desk(uf,1.6,2.05);u.add(uf.moved(y=3.75));up.add(u)
 # Parapet opening for stair arrival, lower roof edge on side has a deliberate entry gap.
 # A hatch-height ladder connects the lower observation terrace to the upper roof.
 ladder(up,3.72,1,3.75,7.25,90,towards=(-.25,0))
 full=copy.deepcopy(up);full.add(roof(upperpoly,7.0,True,gates={2:(1.5/3.1,1.4)}))
 register('Chamfered Quarantine Intake Clinic','intake-clinic',[('1 · Ground reception and examination',g),('2 · Upper observation ward',up),('3 · Fully roofed view',full)],-15,15,footprint=clinic,levels=[.25,4.0])

 # Laundry: a long barrel-vaulted service hall with actual washer doors and linen shelves.
 laund=polyrect(9,6);g=shell(laund,0,3.25,{0:'door',1:'door',2:'window'},'limestone')
 for xx in [-3,-1.25, .5]:washer(g,xx,2.30)
 shelf(g,2.75,-2.50);bench(g,-3.175,-2.445,length=2.4)
 full=copy.deepcopy(g);full.add(barrel(laund,3.25,1.5))
 register('Barrel-Vault Laundry and Sterilization','laundry-vault',[('1 · Ground washroom',g),('2 · Fully roofed barrel vault',full)],14.5,-14.5,rot=45,footprint=laund,role='playable interior; curved roof is scenery')

 # Butterfly-roof guest lodge: asymmetrical silhouette with a deep covered porch.
 guest=[(-4,-3.5),(3.75,-3.5),(3.75,0),(2,0),(2,3.5),(-4,3.5)]
 # Reduce the front doorway so its jamb clears the X=-1 partition; the map
 # contains two instances of this same building.
 g=shell(guest,0,3.25,{0:('door',4.125,1.7),1:'window',3:'door',4:'window'},'sage');g.wall((-1,-3.3),(-1,3.3),.25,2.75,'door','ceramic')
 bed(g,-3.35,2.3);bed(g,1.9,-2.25);lockers(g,-3.5,-2.0,rot=90,count=3);desk(g,.25,2.95)
 rr=Mesh()
 for x0,x1 in [(-4,0),(0,3.75)]:
  piece=Polygon(guest).intersection(sbox(x0,-4,x1,4));pp=list(piece.exterior.coords)[:-1]
  if not piece.exterior.is_ccw:pp=pp[::-1]
  def ht(x):return 3.5+(-x*.1875 if x<0 else x/3.75)
  for triangle in triangulate(piece):
   if piece.covers(triangle.representative_point()):
    pts=list(triangle.exterior.coords)[:3];rr.face([(x,ht(x),z)for x,z in pts[::-1]],'roof');rr.face([(x,3.25,z)for x,z in pts],'sage')
  for p,q in zip(pp,pp[1:]+pp[:1]):rr.face([(p[0],3.25,p[1]),(p[0],ht(p[0]),p[1]),(q[0],ht(q[0]),q[1]),(q[0],3.25,q[1])],'sage')
 rr.beam((0,3.55,-3.5),(0,3.55,3.5),.10,'bronze')
 full=copy.deepcopy(g);full.add(rr)
 register('Butterfly-Roof Recovery Lodge','recovery-lodge',[('1 · Ground recovery rooms',g),('2 · Fully roofed butterfly lodge',full)],-15.5,-13,footprint=guest,role='playable interior; pitched roof is scenery')

 # Apsidal pump house: chapel-like semicircular end, flat service deck and real pumps.
 aps=[(-4,-2.75)]+[(1.25+2.75*math.cos(a),2.75*math.sin(a))for a in np.linspace(-math.pi/2,math.pi/2,13)]+[(-4,2.75)]
 g=shell(aps,0,3.0,{0:'door',13:'door'},'limestone');pump(g,-1.2,.9);g.box(-3.65,.25,-1.3,.45,1.9,1.2,'enamel');ladder(g,-4.2,1,0,3.25,90,towards=(.25,0))
 g.box(-3.405,1.1,-1.55,.055,.22,.045,'bronze')
 for yy in [.55,.65,.75]:g.box(-3.41,yy,-1.3,.04,.035,.65,'bronze')
 full=copy.deepcopy(g);full.add(roof(aps,3.0,True,gates={14:((2.75-1)/5.5,1.4)}))
 register('Apsidal Mineral Pump Gallery','pump-gallery',[('1 · Ground pump service floor',g),('2 · Service roof terrace',full)],.5,16.5,footprint=aps)

 # Changing-room chevron: L footprint with a recessed courtyard rather than another box.
 change=[(-5,-3),(5,-3),(5,0),(0,0),(0,3),(-5,3)]
 g=shell(change,0,3.0,{0:'window',1:'door',3:'door'},'ceramic');lockers(g,-4,2.665,count=6);lockers(g,3.6,-2.665,rot=180,count=6);bench(g,-4.445,0,90,length=2.3);bench(g,2.3,-.70,length=2.6)
 ladder(g,-5.2,0,0,3.25,90,towards=(.25,0));full=copy.deepcopy(g);full.add(roof(change,3.0,True,gates={5:(.5,1.4)}))
 register('Recessed Changing Courts','changing-courts',[('1 · Ground lockers and changing bays',g),('2 · Changing court roof',full)],15,18,footprint=change)

 # Trapezoidal apothecary: counter, mixing bench, real bottle racks.
 ap=[(-3.5,-2.5),(3.5,-2.5),(2.5,2.75),(-2.5,2.75)]
 g=shell(ap,0,3.25,{0:'door',1:'window',3:'window'},'enamel');desk(g,0,2.2);shelf(g,-2.43,.716,-79.2)
 for xx in [-.7,-.35,0,.35,.7]:
  g.cyl(xx,1.22,1.95,.10,.35,'sage',12);g.cyl(xx,1.57,1.95,.065,.10,'bronze',10)
 ladder(g,1,3.02,0,3.5,0,towards=(0,-.3));full=copy.deepcopy(g);full.add(roof(ap,3.25,True,gates={2:(.3,1.4)}))
 register('Trapezoidal Apothecary','apothecary',[('1 · Ground dispensing and mixing room',g),('2 · Apothecary roof terrace',full)],1,-17,footprint=ap)

 # Terraced mineral landscape, elongated linked masses instead of isolated pillars.
 rocks=[(-10,5.5,5.7,2.0,2.75,25),(-8,-9,5.6,2.7,3.25,0),(4,-7,6,2.5,2.75,-25),(16,-2,5.7,2.3,2.5,45),(-16,2,5.2,2.8,3.0,45),(-6,19.5,4.8,2.0,2.5,0),(6,12.5,4.5,2.3,2.25,30),(6,-21,4.6,2.3,2.25,0),(-20,-4,4.3,2.0,2.25,0),(20,7,4.5,2,2.25,90)]
 for j,(x,z,w,d,h,rot) in enumerate(rocks):
  m=Mesh();n=22;rand=random.Random(j+113);base=[]
  for a in np.linspace(0,2*math.pi,n,endpoint=False):
   f=rand.uniform(.92,1.08);base.append((w/2*math.cos(a)*f,d/2*math.sin(a)*f))
  rings=[]
  for lev,scale in [(0,1),(.35,.98),(.7,.89),(1,.69)]:
   rings.append([(xx*scale,h*lev+(.08*rand.random()if lev not in[0,1]else 0),zz*scale)for xx,zz in base])
  for aa,bb in zip(rings,rings[1:]):
   for i in range(n):k=(i+1)%n;m.face([aa[i],bb[i],bb[k],aa[k]],'rock')
  m.face(rings[-1][::-1],'rock');m.face(rings[0],'rock')
  # A flat supported top shelf is intentional; rock sides are not miniature bases.
  register('Layered mineral outcrop '+str(j+1),'outcrop-'+str(j+1),[('Solid natural outcrop; flat crest',m)],x,z,rot,role='solid natural terrain',levels=[h])

 # A raised mineral court creates connected low relief, with two real ramp approaches.
 m=Mesh();p=[(-4,-2),(3,-2),(5,0),(3,2.5),(-4,2.5)];m.prism(p,0,.75,'travertine')
 stairs(m,-6,0,0,.75,2,2.5);stairs(m,6,0,0,.75,2,2.5,180)
 for xx in [-2.7,1.6]:bench(m,xx,1.5,length=2.3)
 m.wall((-3.5,-1.8),(2.8,-1.8),.75,1.5,'solid','limestone',.45)
 register('Stepped Mineral Therapy Court','therapy-terrace',[('Low terrace with two broad stair approaches',m)],-3.25,10,role='playable terraced ground',levels=[.25,.5,.75])

 # Deliberate cover furniture outside: plant basins, oxygen cages and linen carts.
 for j,(x,z,rot) in enumerate([(-19,20,0),(19,-20,0),(-9,13,45),(9,-10,45),(-11,-20,0),(18,12,90),(-12,-4,45),(4,2.2,90),(-2,-12,0),(8,20.8,0),(19,-6,45),(-20,8,0)]):
  m=Mesh();m.box(0,0,0,2.8,1.10,1.15,'limestone');m.box(0,1.10,0,2.65,.07,1.0,'soil')
  for a in np.linspace(-1.0,1,5):
   m.beam((a,1.15,0),(a+.1,1.6,.10),.06,'sage');m.beam((a,1.3,0),(a-.16,1.5,-.1),.045,'sage')
  register('Stone herb trough '+str(j+1),'herb-trough-'+str(j+1),[('Planter with real low herbs',m)],x,z,rot,role='solid scatter')
 for j,(x,z,rot) in enumerate([(-19,10,0),(18,-11,45),(-10,-16,90),(11,12,0),(3,-11,45),(7,-1,90)]):
  m=Mesh();m.box(0,0,0,2.5,.18,1.1,'bronze')
  for xx in [-.8,0,.8]:
   m.cyl(xx,.18,0,.26,1.35,'enamel',24);m.cyl(xx,1.53,0,.13,.2,'bronze',16)
   for yy in [.53,1.16]:m.cyl(xx,yy,0,.269,.045,'bronze',24)
   m.cyl(xx,1.73,0,.07,.13,'red',12)
   m.box(xx+.17,1.57,-.13,.16,.18,.07,'bronze');m.box(xx+.17,1.60,-.171,.12,.11,.015,'enamel')
   m.beam((xx+.17,1.64,-.184),(xx+.20,1.69,-.184),.012,'rubber')
   for k in range(8):
    a=k*.20;b=(k+1)*.20
    m.beam((xx+.27+.10*math.sin(a*2),1.5-a,-.15),(xx+.27+.10*math.sin(b*2),1.5-b,-.15),.025,'rubber')
   m.beam((xx,1.73,0),(xx,1.9,0),.06);m.beam((xx-.13,1.9,0),(xx+.13,1.9,0),.04,'red')
  for xx in [-1.15,1.15]:m.beam((xx,0,-.45),(xx,2,-.45),.07);m.beam((xx,0,.45),(xx,2,.45),.07)
  m.beam((-1.15,2,-.45),(1.15,2,-.45),.07);m.beam((-1.15,2,.45),(1.15,2,.45),.07)
  register('Medical oxygen cage '+str(j+1),'oxygen-cage-'+str(j+1),[('Oxygen cylinder rack',m)],x,z,rot,role='detailed service scatter; gaps remain open')

 from spa_details import basin,POOLS
 for spec in POOLS:
  m,poly=basin(Mesh,spec)
  register(spec['name'],spec['slug'],[('Recessed thermal basin with mineral water, submerged steps and stone coping',m)],spec['x'],spec['z'],role='hot spring basin; impassable water interior, normal coping',levels=[.125],footprint=poly)

 # Alpha occupies true open ground at center; no permanent scenic platform here.
 (ROOT/'Source'/'geometry-manifest.json').write_text(json.dumps(RECORDS,indent=2))
 (ROOT/'Source'/'furniture-inventory.json').write_text(json.dumps(FURNITURE,indent=2))
 print('Built',len(RECORDS),'terrain objects /',sum(len(r['states'])for r in RECORDS),'meshes')

if __name__=='__main__':build()
