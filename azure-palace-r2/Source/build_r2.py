"""Geometry authoring coordinates use tabletop inches, with Y up. Source OBJ converts X handedness."""
from pathlib import Path
import math,json,sys,collections
import numpy as np
ROOT=Path(__file__).resolve().parents[1];A=ROOT/'Assets';OLD=ROOT/'original'
if not OLD.is_dir():OLD=ROOT.parent/'azure-palace-r1'
sys.path.insert(0,str(OLD/'Source'))
import build_azure as R
from collision_helpers import compound,write_compound
from shapely.ops import unary_union
from shapely.geometry import box as polygon_box
cells=json.loads((ROOT/'Source/atlas-cells.json').read_text())
rec=json.loads((OLD/'Source/geometry-manifest.json').read_text())
def num(x):return ('%.6f'%x).rstrip('0').rstrip('.') if abs(x)>=0.0000005 else '0'
def export(mesh,path):
 vertices=np.array(mesh.v,float);vertices[:,0]*=-1;faces=np.asarray(mesh.f,int)[:,::-1]
 uv=np.asarray(mesh.uv,float);a,b,c=vertices[faces[:,0]],vertices[faces[:,1]],vertices[faces[:,2]]
 normals=np.cross(b-a,c-a);lens=np.linalg.norm(normals,axis=1);ok=lens>1.e-8;faces=faces[ok];normals=normals[ok]/lens[ok,None]
 def index(rows):
  unique,inv=np.unique(np.round(rows,6),axis=0,return_inverse=True);return unique,inv+1
 v,vi=index(vertices);t,ti=index(uv);n,ni=index(normals)
 lines=['# Azure Palace R2 | inches | TTS']+['v '+' '.join(map(num,row))for row in v]+['vt '+' '.join(map(num,row))for row in t]+['vn '+' '.join(map(num,row))for row in n]+['g visible']
 for f,nf in zip(faces,ni):lines.append('f '+' '.join(f'{vi[k]}/{ti[k]}/{nf}' for k in f))
 path.write_text('\n'.join(lines)+'\n')
 return len(v),len(faces)
def collision(mesh,name):
 parts=compound({'physical_primitives':mesh.solids,'physical_extras':mesh.physical_extras,'free_faces':[]})
 write_compound(A/(name+'-collision.obj'),parts,np.zeros(3))
def atlas_uv(key,u,v):
 idx=cells[key];col=idx%6;row=idx//6
 return ((col+(4+504*u)/512)/6,1-(row+(4+504*(1-v))/512)/6)
class Detail:
 def __init__(self):
  self.v=[];self.f=[];self.uv=[];self.records=[]
 def quad(self,pts,key,uvs=None):
  i=len(self.v);self.v+=list(pts);self.f.extend([[i,i+1,i+2],[i,i+2,i+3]])
  self.uv+=[atlas_uv(key,u,v) for u,v in (uvs or [(0,0),(0,1),(1,1),(1,0)])]
 def plaque(self,x,z,y,nx,nz,w,h,key):
  # Read left to right when seen from outside the wall. Opposite elevations get separate outward faces.
  rx,rz=-nz,nx
  def at(u,v):return(x+rx*u,y+v,z+rz*u)
  self.quad([at(-w/2,0),at(-w/2,h),at(w/2,h),at(w/2,0)],key)
 def framed(self,x,z,y,nx,nz,w,h,key):
  self.plaque(x,z,y,nx,nz,w,h,'edge')
  self.plaque(x+nx*.013,z+nz*.013,y+.028,nx,nz,w-.055,h-.056,'frame')
  self.plaque(x+nx*.026,z+nz*.026,y+.061,nx,nz,w-.12,h-.122,key)
 def flat(self,x0,z0,x1,z1,y,key,ref=None):
  pts=[(x0,y,z0),(x0,y,z1),(x1,y,z1),(x1,y,z0)]
  ax,az,bx,bz=ref or (x0,z0,x1,z1)
  q=[((x-ax)/(bx-ax),(z-az)/(bz-az))for x,_,z in pts]
  self.quad(pts,key,q)
 def boardfloor(self,w,d,y,key,opening):
  x0,z0,x1,z1=-w/2+.14,-d/2+.14,w/2-.14,d/2-.14
  ref=(x0,z0,x1,z1)
  if not opening:self.flat(*ref,y,key);return
  ax,az,bx,bz=w/2-2.115,d/2-2.215,w/2-.385,d/2-.385
  for part in [(x0,z0,x1,az),(x0,bz,x1,z1),(x0,az,ax,bz),(bx,az,x1,bz)]:self.flat(*part,y,key,ref=ref)
def ground():
 m=R.M();top=[]
 # Four contiguous slabs surround the unchanged 6 by 10 inch basin.
 for x0,z0,x1,z1 in [(-24,-24,24,-6),(-24,4,24,24),(-24,-6,-3,4),(3,-6,24,4)]:
  first=len(m.f);m.box((x0+x1)/2,-3,(z0+z1)/2,x1-x0,3,z1-z0,'asphalt')
  m.f[first:]=[f for f in m.f[first:] if not all(abs(m.v[j][1])<1e-9 for j in f)]
  top.append([(x0,0,z0),(x0,0,z1),(x1,0,z1),(x1,0,z0)])
 m.box(0,-3,-1,6,1.8,10,'mosaic')
 # Glazed basin wall panels sit on the four existing walls.
 for normal,cx,cz,length in [((1,0),-2.99,-1,10),((-1,0),2.99,-1,10),((0,1),0,-5.99,6),((0,-1),0,3.99,6)]:
  nx,nz=normal;rx,rz=-nz,nx
  for i in range(int(length)):
   u=-length/2+i
   def pos(a,y):return (cx+rx*a,y,cz+rz*a)
   m.face([pos(u,-1.18),pos(u,-.06),pos(u+1,-.06),pos(u+1,-1.18)],'mosaic')
 # All flights run from the basin toward the EXACT midpoint of their outside edge.
 stairs=[];cx,cz=0,-1
 for side,(nx,nz),edge,run,width in [('South',(0,-1),5,2.04,2.10),('North',(0,1),5,2.04,2.10),('West',(-1,0),3,1.47,2.05),('East',(1,0),3,1.47,2.05)]:
  rx,rz=-nz,nx
  def at(along,across=0):return (cx+nx*along+rx*across,cz+nz*along+rz*across)
  bottom=edge-run
  for step in range(6):
   dep=run/6;xx,zz=at(bottom+(step+.5)*dep);height=(step+1)*.2
   m.box(xx,-1.2,zz,dep+.0001 if nx else width,height,width if nx else dep+.0001,'travertine')
   # Flush, inset nosing shows each step without projecting into the route.
   xx,zz=at(bottom+step*dep+.04)
   m.box(xx,height-1.2+.001,zz,.025 if nx else width-.12,.011,width-.12 if nx else .025,'bronze',collide=False)
  for handed in (-1,1):
   across=handed*(width/2+.045)
   pts=[]
   for f in (0,.5,1):
    xx,zz=at(bottom+f*run,across);base=-1.2+f*1.2;high=base+.86
    m.beam((xx,base,zz),(xx,high,zz),.046,'bronze');pts.append((xx,high,zz))
   m.beam(pts[0],pts[2],.06,'bronze')
  # Coping on either side of the opening is exactly symmetric about the flight.
  half=5 if nx else 3;opening=width/2+.20
  for hand in (-1,1):
   xx,zz=at(edge,hand*(half+opening)/2)
   m.box(xx,0,zz,.27 if nx else half-opening,.073,half-opening if nx else .27,'limestone')
  stairs.append({'side':side,'center':at(edge),'bottom':at(bottom),'direction':[nx,nz],'run':run,'width':width,'opening':2*opening})
 # A narrower island leaves a 1.03-inch clear landing at the foot of each short flight.
 m.box(0,-1.2,-1,1.0,1.86,1.86,'limestone');m.box(0,.66,-1,1.02,.13,1.89,'travertine')
 m.box(0,.79,-1,.86,.065,1.72,'soil');R.palm(m,0,-1,.85,3.4)
 # The material patch in the right margin of the court sheet supplies all other surfaces.
 m.uv=[((3120+960*u)/4096,1-(8+960*(1-v))/4096) for u,v in m.uv]
 for pts in top:
  m.face(pts,'asphalt');m.uv[-4:]=[((8+(x+24)/48*3072)/4096,1-(8+(24-z)/48*3072)/4096) for x,y,z in pts]
 export(m,A/'basin-court.obj');collision(m,'basin-court')
 (ROOT/'Source'/'stairs.json').write_text(json.dumps(stairs,indent=2))
dims={'sunward-wing':(7,9,3,'suite'),'seaward-wing':(7,9,3,'suite'),'azure-spa':(8,6,2,'spa'),'terrace-restaurant':(8,6,2,'restaurant'),
      **{a+'-villa':(6.5,6.5,1,'villa') for a in ('north','east','south','west')},'reception':(7.5,5.5,1,'lobby'),'cafe':(7.5,5.5,1,'cafe'),'laundry':(6,7,1,'utility'),'pool-equipment':(6,7,1,'utility')}
motifs={'sunward-wing':['egret','citrus','promenade'],'seaward-wing':['swell','promenade','egret'],'azure-spa':['swell','egret'],
 'terrace-restaurant':['citrus','promenade'],'north-villa':['egret'],'east-villa':['promenade'],'south-villa':['citrus'],'west-villa':['swell'],
 'reception':['promenade'],'cafe':['citrus'],'laundry':['linen'],'pool-equipment':['water']}
slugs=list(dims)
def build_detail(slug,w,d,levels,role,count,closed):
 m=Detail();route=motifs[slug];px=-(w/2+1.125)/2
 pw=min(1.86,(w/2-1.125)-.43);ph=1.15
 # Front and rear entrance signs sit on solid piers, below the lintels and clear of doors and glazing.
 for nx,nz in [(0,-1),(0,1)]:
  x=px if nz<0 else -px;z=nz*(d/2+.22)
  m.framed(x,z,1.15,nx,nz,pw,ph,'sign-'+slug)
 for i in range(count):
  h=i*3.1
  m.boardfloor(w,d,h+.239,role,i>0)
  left=-w/2+.165;right=w/2-.165
  framewidth=min(2.0,d/3-.22)
  m.framed(left,0,h+.88,1,0,framewidth,1.43,route[i%len(route)])
  back='linen' if slug=='laundry' else 'water' if slug=='pool-equipment' else ['promenade','swell','citrus','egret'][(slugs.index(slug)+i+2)%4]
  m.framed(right,0,h+1.07,-1,0,framewidth*.85,1.18,back)
  # Glazed stone dados on the central opaque side bays. Never bridge a window or door opening.
  for sg in [-1,1]:
   m.plaque(sg*(w/2+.145),0,h+.43,sg,0,d/3-.18,1.94,'teal' if role not in ('utility','restaurant') else 'wood')
   m.framed(sg*(w/2+.17),0,h+.80,sg,0,min(1.48,d/3-.28),1.29,route[(i+1)%len(route)])
  if role not in ('utility','spa'):
   runner=['runner-blue','runner-sage','runner-russet'][(slugs.index(slug)+i)%3]
   m.flat(-.78,-1.5,.78,1.3,h+.255,runner)
  # Small, raised aged-brass and alabaster sconces on the front piers.
  for side in [-1,1]:
   xx=side*(w/2-.72);zz=-d/2-.18
   m.framed(xx,zz,h+1.40,0,-1,.20,.73,'ceramic')
  if role=='utility':
   m.flat(-.88,-d/2+.31,.88,-d/2+.61,h+.256,'basalt')
 if closed:
  y=levels*3.1+.242;m.boardfloor(w,d,y,'roof',True)
  # Thin parapet trim gives the roof a readable outline at game zoom.
  for x0,z0,x1,z1 in [(-w/2+.22,-d/2+.23,w/2-.22,-d/2+.34),(-w/2+.22,d/2-.34,w/2-.22,d/2-.23),(-w/2+.23,-d/2+.34,-w/2+.34,d/2-.34),(w/2-.34,-d/2+.34,w/2-.23,d/2-.34)]:m.flat(x0,z0,x1,z1,y+.013,'edge')
 return m,px,pw,ph
def details():
 for slug,(w,d,count,role) in dims.items():
  for ix,n in enumerate([count]+list(range(1,count+1)),1):
   m,px,pw,ph=build_detail(slug,w,d,count,role,n,ix==1)
   export(m,A/(slug+'-details-'+str(ix)+'.obj'))
  cm=R.M()
  for sg in (-1,1):cm.box(px if sg==-1 else -px,1.15,sg*(d/2+.21),pw,ph,.08,'bronze')
  collision(cm,slug+'-plaques')
def upper_rooms():
 import inspect
 fn=inspect.getsource(R.floor_shell).replace("if level or role=='hotel':","if role=='hotel':")
 scope=dict(R.__dict__);exec(fn,scope);floor_shell=scope['floor_shell']
 # The spa upper floor is a treatment suite and the restaurant upper floor is the dining terrace.
 # Regenerate both closed buildings and upper-open states, with matching physical furniture.
 for slug,role in [('azure-spa','spa'),('terrace-restaurant','restaurant')]:
  w,d=8,6;m=R.M();m.add(floor_shell(w,d,0,role));m.add(floor_shell(w,d,1,role))
  for ix in (3,1):
   if ix==1:
    R.slab_hatch(m,w,d,6.2);h=6.42
    for sg in [-1,1]:m.box(sg*w/2,h,0,.18,.8,d,'limestone');m.box(0,h,sg*d/2,w,.8,.18,'limestone')
    m.box(-w/2+1.2,h,-d/2+1.2,1.5,.55,1.2,'enamel')
    for j in range(7):m.box(-w/2+1.2,h+.55,-d/2+.7+j*.15,1.3,.05,.06,'rubber')
   name=slug+'-room-'+str(ix);export(m,A/(name+'.obj'));collision(m,name)
if __name__=='__main__':
 ground();details();upper_rooms()
 print('Built courtyard, four stairs, 12 multiple-state decoration sets and room geometry.')
