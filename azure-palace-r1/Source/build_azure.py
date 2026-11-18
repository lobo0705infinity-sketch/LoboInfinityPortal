"""Azure Palace R1. Original resort geometry, tabletop inches, Y up.
Reusable material geometry helpers from the collection's thermal-baths authoring.
The approved concept images are visual references, never substitutes for meshes.
"""
from pathlib import Path
import sys, math, json, copy, random
import numpy as np
import trimesh
from PIL import Image,ImageDraw,ImageFont
from shapely.geometry import Polygon, box as sbox
from shapely.ops import triangulate
R=Path(__file__).resolve().parents[1]; A=R/'Assets'
sys.path.insert(0,str(R.parent/'halcyon-thermal-baths-r6/Source'))
import collection_geometry as H
from collision_helpers import compound,write_compound
H.A=A
M=H.Mesh
MAN=[]
random.seed(181126)

def export(m,slug):
 v=np.array(m.v,float);f=np.array(m.f,int);uv=np.array(m.uv,float)
 area=np.linalg.norm(np.cross(v[f[:,1]]-v[f[:,0]],v[f[:,2]]-v[f[:,0]]),axis=1)
 f=f[area>1e-9];v[:,0]*=-1;f=f[:,::-1]
 mesh=trimesh.Trimesh(v,f,process=False)
 lines=['# Azure Palace R1; inches; TTS handedness conversion']
 lines+=['v %.6f %.6f %.6f'%tuple(p)for p in v]
 lines+=['vt %.7f %.7f'%tuple(p)for p in uv]
 lines+=['vn %.6f %.6f %.6f'%tuple(p)for p in mesh.face_normals]
 lines+=['g visible']
 lines+=['f '+' '.join(f'{j+1}/{j+1}/{i+1}'for j in q)for i,q in enumerate(f)]
 (A/(slug+'.obj')).write_text('\n'.join(lines)+'\n')
 st={'physical_primitives':m.solids,'physical_extras':m.physical_extras,'free_faces':[]}
 parts=compound(st)
 write_compound(A/(slug+'-collision.obj'),parts,np.zeros(3))
 assert len(v)<65000,(slug,len(v))
 return {'mesh':slug+'.obj','collider':slug+'-collision.obj','vertices':len(v),'triangles':len(f),'collider_parts':len(parts),'bounds':np.array(m.v).min(0).tolist()+np.array(m.v).max(0).tolist()}

def record(name,slug,states,x=0,z=0,rot=0,kind='building',footprint=None):
 rec={'name':name,'slug':slug,'x':x,'z':z,'rot':rot,'kind':kind,'states':[],'footprint':footprint}
 for i,(label,m)in enumerate(states,1):
  info=export(m,slug+'-'+str(i));info['label']=label;rec['states'].append(info)
 MAN.append(rec);return rec

def box(m,x,y,z,w,h,d,mat='limestone'):m.box(x,y,z,w,h,d,mat)
def ring(m,c,r,th=.06,mat='bronze',axis='z',n=32):
 x,y,z=c
 rings=[]
 for t in np.linspace(0,2*math.pi,n,endpoint=False):
  q=[]
  for rr,depth in [(r-th/2,-th/2),(r+th/2,-th/2),(r+th/2,th/2),(r-th/2,th/2)]:
   q.append((x+rr*math.cos(t),y+rr*math.sin(t),z+depth)if axis=='z'else(x+rr*math.cos(t),y+depth,z+rr*math.sin(t)))
  rings.append(q)
 for a,b in zip(rings,rings[1:]+rings[:1]):
  for j in range(4):k=(j+1)%4;m.face([a[j],a[k],b[k],b[j]],mat)
  m.physical_extras.append(a+b)

def wheels(m,w,d,y=.18):
 for x in [-w/2+.20,w/2-.20]:
  for z in [-d/2+.15,d/2-.15]:
   # Proper wheel planes rather than upright horizontal cylinders.
   a=[(x+.18*math.cos(t),y+.18*math.sin(t),z-.08)for t in np.linspace(0,2*math.pi,20,endpoint=False)];b=[(xx,yy,z+.08)for xx,yy,_ in a]
   m.face(a,'rubber');m.face(b[::-1],'rubber')
   for j in range(20):k=(j+1)%20;m.face([a[j],b[j],b[k],a[k]],'rubber')
   m.physical_extras.append(a+b)
   m.beam((x,y,z),(x,.48,z),.07,'bronze')

def leaf(m,start,end,width=.12):
 p=np.array(start);q=np.array(end);mid=(p+q)/2+np.array([0,.12,0]);v=q-p
 side=np.cross(v,[0,1,0]);side=side/(np.linalg.norm(side)+1e-9)*width
 pts=[p,mid+side,q,mid-side]
 # Double-sided leaf with physical thickness, correctly rooted.
 m.face(pts,'red');m.face(pts[::-1],'red')

def palm(m,x,z,y=0,h=3.8):
 m.cyl(x,y,z,.14,h,'wood',14,r2=.095)
 for j in range(12):
  t=j*2*math.pi/12;L=1.2+.25*(j%3);start=(x,y+h,z)
  end=(x+L*math.cos(t),y+h-.45,z+L*math.sin(t))
  m.beam(start,end,.035,'red')
  for f in np.linspace(.15,.9,7):
   p=np.array(start)*(1-f)+np.array(end)*f
   for sg in [-1,1]:
    q=p+np.array([sg*.32*math.sin(t),-.18,-sg*.32*math.cos(t)])*(1-f*.7)
    leaf(m,p,q,.07)

def planter(w=3.0,d=1.3,tree=False):
 m=M();m.box(0,0,0,w,.95,d,'limestone');m.box(0,.95,0,w-.22,.10,d-.22,'soil')
 for z in [-d/2-.006,d/2+.006]:m.box(0,.25,z,w-.3,.45,.025,'mosaic')
 for x in [-w/2+.1,w/2-.1]:m.box(x,.92,0,.22,.15,d+.1,'travertine')
 for z in [-d/2+.1,d/2-.1]:m.box(0,.92,z,w,.15,.22,'travertine')
 for x in np.linspace(-w/2+.4,w/2-.4,4):
  for t in np.linspace(0,2*math.pi,7,endpoint=False):leaf(m,(x,1.04,0),(x+.48*math.cos(t),1.55,.4*math.sin(t)),.16)
 if tree:palm(m,0,0,1.04,2.6)
 return m

def chaise():
 m=M()
 for yy in [.18,.43,.68]:
  for x in [-.49,.49]:
   m.beam((x,yy,-1.2),(x,yy,1.2),.10,'wood')
   for z in [-.8,.8]:m.beam((x,max(0,yy-.3),z),(x,yy,z),.09,'bronze')
  for z in np.linspace(-1.1,1.1,12):m.box(0,yy,z,.94,.055,.14,'wood')
  m.box(0,yy+.08,-.25,.94,.12,1.6,'sage')
  m.beam((0,yy+.16,.55),(0,yy+.7,1.18),.9,'sage',.14)
 m.box(.18,.86,-.65,.4,.06,.75,'fabric')
 return m

def trolley(linen=False):
 m=M();w=2.2;d=1.25;wheels(m,w,d)
 m.box(0,.36,0,w,.15,d,'bronze')
 if linen:
  m.box(0,.5,0,2.0,1.15,1.12,'sage')
  for x in [-.48,.48]:
   m.box(x,.60,-.58,.90,.90,.04,'sage');m.box(x+.25,.94,-.62,.06,.3,.07,'bronze')
  for x in [-1,1]:m.box(x,1.65,0,.09,.7,1.12,'bronze')
  m.box(0,1.65,.53,2,.65,.06,'sage');m.box(0,2.3,0,2.1,.1,1.2,'wood')
  for x in [-.5,.5]:
   for yy in [1.74,1.9,2.06]:m.box(x,yy,0,.7,.14,.85,'fabric')
  m.box(1.3,.5,0,.48,1.20,.95,'fabric')
 else:
  for x in [-1,1]:m.beam((x,.5,.48),(x,2.9,.48),.08)
  for t in np.linspace(0,math.pi,14):
   a=t;b=min(math.pi,t+math.pi/14)
   m.beam((math.cos(a),2.9+.4*math.sin(a),.48),(math.cos(b),2.9+.4*math.sin(b),.48),.08)
  for x,y,z,w,h,d,mat in [(-.5,.52,0,.8,1.25,.8,'sage'),(.48,.52,.04,.85,1.0,.85,'enamel'),(-.25,1.8,.08,1.0,.62,.7,'wood')]:
   m.box(x,y,z,w,h,d,mat)
   for zz in [z-d/2-.015,z+d/2+.015]:
    for xx in [x-w*.28,x+w*.28]:m.box(xx,y+.06,zz,.045,h-.12,.02,'bronze')
   m.beam((x-.15,y+h+.02,z),(x-.15,y+h+.15,z),.045);m.beam((x+.15,y+h+.02,z),(x+.15,y+h+.15,z),.045);m.beam((x-.15,y+h+.15,z),(x+.15,y+h+.15,z),.045)
 return m

def sculpture():
 m=M();m.box(0,0,0,1.8,.15,1.6,'travertine');m.box(0,.15,0,1.6,.95,1.4,'limestone');m.box(0,1.1,0,1.8,.15,1.6,'travertine')
 for cy in [1.9,3.05]:ring(m,(0,cy,0),.66,.19,'bronze',n=40)
 m.box(0,1.24,0,.65,.12,.48,'bronze');return m

def maintenance():
 m=M();wheels(m,2,1.3);m.box(0,.35,0,2,.15,1.3,'bronze');m.box(-.25,.5,0,1.35,.8,1.05,'sage');m.cyl(.68,.5,0,.28,1.35,'enamel',18)
 m.beam((-.8,.5,.45),(-.8,2.1,.45),.07);m.beam((.35,.5,.45),(.35,2.1,.45),.07)
 for z in [-.15,.15]:ring(m,(-.25,1.65,z),.48,.055,'bronze',n=24)
 for z in np.linspace(-.15,.15,6):ring(m,(-.25,1.65,z),.4,.065,'sage',n=24)
 m.beam((-.8,2.1,.45),(.35,2.1,.45),.09,'rubber');return m

def bar():
 m=M();wheels(m,2.8,1.3);m.box(0,.35,0,2.8,.15,1.3,'bronze');m.box(0,.5,0,2.6,1.15,1.2,'limestone');m.box(0,1.65,0,2.9,.12,1.5,'wood');m.box(0,.68,-.62,1.2,.7,.04,'sage')
 for x in [-1.3,1.3]:m.beam((x,1.77,.6),(x,2.65,.6),.07)
 m.box(0,2.6,.50,2.8,.09,.65,'bronze')
 for x in [-.95,-.6,-.25,.1]:m.cyl(x,1.77,.45,.07,.42,'glass',12);m.cyl(x,2.19,.45,.035,.13,'bronze',10)
 m.box(.8,1.77,0,.7,.48,.75,'enamel');m.box(.8,2.25,0,.78,.08,.81,'sage');return m

def screen():
 m=M()
 def panel(w):
  p=M();p.box(0,0,0,w,.15,.6,'limestone');p.box(0,.15,0,w,.95,.2,'limestone')
  for x in [-w/2,w/2]:p.box(x,0,0,.14,2.5,.18,'bronze')
  for y in np.linspace(1.2,2.35,8):p.box(0,y,0,w,.11,.13,'sage')
  return p
 m.add(panel(2.4).moved(x=-1.2));m.add(panel(1.8).moved(z=.9,rot=90))
 for j in range(7):
  x=-2.2+j*.18;y=1.65+(.15 if j%2 else-.18)
  pts=[(x,2.55,-.12),(x+.18,2.55,-.12),(x+.18,y,-.19),(x,y+.08,-.19)]
  m.face(pts,'fabric');m.face(pts[::-1],'fabric')
 return m

def sofa(m,x,z,y=0):
 m.box(x,y+.18,z,1.8,.45,.85,'sage');m.box(x,y+.63,z+.3,1.8,.55,.22,'sage')
 for xx in [x-.78,x+.78]:m.box(xx,y+.5,z,.22,.45,.85,'wood')
 for xx in [x-.43,x+.43]:m.box(xx,y+.64,z-.1,.72,.14,.55,'fabric')

def bed(m,x,z,y=0):
 m.box(x,y+.18,z,1.8,.35,2.4,'wood');m.box(x,y+.53,z,1.75,.24,2.3,'fabric');m.box(x,y+.6,z+1.14,1.85,.9,.12,'wood')
 for xx in [x-.43,x+.43]:m.box(xx,y+.77,z+.75,.72,.18,.45,'fabric')
 m.box(x,y+.78,z-.6,1.77,.035,.65,'sage')
 for xx in [x-1.23,x+1.23]:m.box(xx,y+.05,z+.78,.45,.65,.5,'wood');m.cyl(xx,y+.70,z+.78,.12,.38,'bronze',12);m.cyl(xx,y+1.08,z+.78,.22,.25,'fabric',12)

def slab_hatch(m,w,d,y,th=.22):
 hole=sbox(w/2-2.1,d/2-2.2,w/2-.4,d/2-.4)
 p=sbox(-w/2,-d/2,w/2,d/2).difference(hole)
 for t in triangulate(p):
  if p.covers(t):m.prism(list(t.exterior.coords)[:-1],y,th,'travertine')

def floor_shell(w,d,level,role):
 m=M();y=level*3.1
 if level:slab_hatch(m,w,d,y)
 else:m.box(0,0,0,w,.22,d,'travertine')
 # Front and back doors; alternating actual window openings on sides.
 H.Mesh.wall(m,(-w/2,-d/2),(w/2,-d/2),y+.22,2.88,'door','limestone')
 H.Mesh.wall(m,(w/2,d/2),(-w/2,d/2),y+.22,2.88,'door','limestone')
 for sx in [-1,1]:
  for j in range(3):
   a=-d/2+j*d/3;b=a+d/3
   m.wall((sx*w/2,a),(sx*w/2,b),y+.22,2.88,'window'if j!=1 else'solid','limestone')
  m.box(sx*(w/2+.025),y+.4,0,.08,2.1,.7,'sage')
 for x in [-w/2+.15,w/2-.15]:m.box(x,y+.22,-d/2-.13,.26,2.9,.28,'limestone')
 # Resort facade: stone cornices, bronze arches, teal panels, inset drapery.
 for zz in [-d/2-.17,d/2+.17]:m.box(0,y+2.97,zz,w+.4,.13,.34,'travertine')
 for xx in [-w/2-.17,w/2+.17]:m.box(xx,y+2.97,0,.34,.13,d+.4,'travertine')
 for xx in [-w/2+.38,w/2-.38]:
  m.box(xx,y+.3,-d/2-.16,.42,2.45,.06,'sage')
  m.box(xx,y+.3,-d/2-.20,.46,.06,.05,'bronze')
 # Arched stone entry surround is real volume, with an open rectangular doorway below.
 for xx in [-1.22,1.22]:m.box(xx,y+.22,-d/2-.20,.16,1.9,.2,'limestone')
 for j in range(18):
  a=j*math.pi/18;b=(j+1)*math.pi/18
  m.beam((1.22*math.cos(a),y+2.02+.75*math.sin(a),-d/2-.22),(1.22*math.cos(b),y+2.02+.75*math.sin(b),-d/2-.22),.14,'limestone')
 # Internal ladder and open roof hatch, always attached to this state.
 H.ladder(m,w/2-1.2,d/2-.65,y+.22,y+3.32,0,towards=(0,.4))
 if level or role=='hotel':
  bed(m,-w/2+1.8,d/2-1.65,y+.22)
  sofa(m,-w/2+1.35,-d/2+1.4,y+.22)
  m.box(w/2-.5,y+.22,-d/2+1.5,.65,1.9,1.4,'wood')
  for yy in [y+.5,y+1.0,y+1.5,y+2.0]:m.box(w/2-.8,yy,-d/2+1.5,.04,.05,1.35,'bronze')
 elif role=='spa':
  for x in [-w*.23,w*.23]:
   m.box(x,y+.22,1,1.2,.65,2.5,'wood');m.box(x,y+.87,1,1.2,.15,2.5,'fabric')
   for z in [-.1,2.0]:m.box(x,y+1.02,z,.8,.12,.3,'fabric')
 elif role=='laundry':
  for x in [-w/2+1.0,-w/2+2.5]:H.washer(m,x,d/2-.8)
  H.shelf(m,w/2-.5,-d/2+1.6,90)
 elif role=='equipment':H.pump(m,-w/2+1.6,.4)
 else:
  m.box(-w/2+.8,y+.22,.5,1.3,1.15,3,'wood');m.box(-w/2+.8,y+1.37,.5,1.5,.12,3.2,'travertine')
  for z in [-d/2+1.3,d/2-1.6]:
   m.cyl(w/2-1.5,y+.22,z,.08,.85,'bronze',12);m.cyl(w/2-1.5,y+1.07,z,.7,.10,'wood',20)
   for xx in [w/2-2.45,w/2-.55]:m.box(xx,y+.22,z,.6,.55,.6,'sage')
 if level:
  # Front balcony, supported by the floor slab with two-thirds solid railing.
  m.box(0,y,-d/2-.65,w+.3,.24,1.5,'travertine')
  m.box(-w/4,y+.24,-d/2-1.4,w/2,.82,.15,'limestone')
  for x in [-w/2,w/2]:m.box(x,y+.24,-d/2-.75,.15,.82,1.4,'limestone')
  for x in np.linspace(.1,w/2,7):m.beam((x,y+.24,-d/2-1.4),(x,y+1.0,-d/2-1.4),.04,'bronze')
  m.beam((0,y+1,-d/2-1.4),(w/2,y+1,-d/2-1.4),.055,'bronze')
  # A broad curved balcony edge distinguishes the hotel wings from service blocks.
  if role=='hotel':
   arc=[(w/2*math.cos(a),-d/2-.5-1.2*math.sin(a))for a in np.linspace(0,math.pi,19)]
   poly=[(-w/2,-d/2+.12),(w/2,-d/2+.12)]+arc
   m.prism(poly,y,.22,'travertine')
   for j,(p,q)in enumerate(zip(arc,arc[1:])):
    m.wall(p,q,y+.22,.78,'solid','limestone'if j<6 or j>11 else'bronze',.12)
   for xx in [-w/2+.65,w/2-.65]:m.add(planter(1.1,.65).moved(x=xx,z=-d/2-.4,y=y+.22))
 return m

def building(name,slug,w,d,levels,x,z,rot,role):
 cumulative=[];m=M()
 for i in range(levels):m.add(floor_shell(w,d,i,role));cumulative.append(copy.deepcopy(m))
 roof=copy.deepcopy(m);slab_hatch(roof,w,d,3.1*levels)
 y=3.1*levels+.22
 for side in [-1,1]:roof.box(side*w/2,y,0,.18,.80,d,'limestone')
 for side in [-1,1]:roof.box(0,y,side*d/2,w,.80,.18,'limestone')
 roof.box(-w/2+1.2,y,-d/2+1.2,1.5,.55,1.2,'enamel')
 for j in range(7):roof.box(-w/2+1.2,y+.55,-d/2+.7+j*.15,1.3,.05,.06,'rubber')
 states=[('Full building and accessible rooftop',roof)]+[(f'Open floor {i+1}',q)for i,q in enumerate(cumulative)]
 rec=record(name,slug,states,x,z,rot,'building',[w+.4,d+1.8 if levels>1 else d+.4])
 # Exact lettering is authored once, outward-facing on a separate raised sign.
 label={'hotel':'SUITES','spa':'AZURE SPA','restaurant':'CAFE','reception':'THE AZURE PALACE','laundry':'LAUNDRY','equipment':'POOL SERVICE'}[role]
 if slug=='terrace-restaurant':label='TERRACE RESTAURANT'
 im=Image.new('RGB',(1024,256),(15,68,72));dr=ImageDraw.Draw(im);dr.rectangle((8,8,1015,247),outline=(193,153,81),width=7);font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf',70 if len(label)<15 else 53);dr.text((512,128),label,anchor='mm',font=font,fill=(231,203,151));im.save(A/(slug+'-sign.png'))
 sign=M();sw=min(w-.7,4.6);yy=2.79;zz=-d/2-.32
 pts=[(-sw/2,yy,zz),(-sw/2,yy+.5,zz),(sw/2,yy+.5,zz),(sw/2,yy,zz)]
 sign.face(pts,'sage');sign.uv[-4:]=[(0,0),(0,1),(1,1),(1,0)]
 sign.box(0,yy,zz+.035,sw,.5,.06,'sage')
 rec['sign']=export(sign,slug+'-sign');rec['sign']['texture']=slug+'-sign.png'
 return rec

def ground():
 m=M();pool=sbox(-3,-6,3,4);outer=sbox(-24,-24,24,24);p=outer.difference(pool)
 for t in triangulate(p):
  if p.covers(t):
   m.prism(list(t.exterior.coords)[:-1],-3,2.97,'travertine')
   kind,(poly,y,h)=m.solids[-1];m.solids[-1]=(kind,(poly,y,3))
 # Individually tiled paving keeps stone grain at a believable scale.
 for x in range(-24,24,2):
  for z in range(-24,24,2):
   tile=sbox(x+.008,z+.008,x+1.992,z+1.992).intersection(p)
   if tile.is_empty:continue
   for part in ([tile]if tile.geom_type=='Polygon'else tile.geoms):
    m.prism(list(part.exterior.coords)[:-1],-.03,.03,'travertine',collide=False)
 m.box(0,-3,-1,6,1.8,10,'mosaic')
 # Stone rim, four real stair approaches. Each stair has 0.2-inch rise.
 for x in [-3,3]:
  for z,d in [(-4,4),(3,2)]:m.box(x,0,z,.28,.08,d,'limestone')
 for z in [-6,4]:
  for x in [-2.2,2.2]:m.box(x,0,z,1.6,.08,.28,'limestone')
 for x,z,rot,width in [(0,-4,90,2),(0,2,-90,2),(-1,1,180,1.8),(1,1,0,1.8)]:
  stair=M()
  for i in range(6):stair.box((i+.5)/3,-1.2,0,1/3+.002,(i+1)*.2,width,'travertine')
  for sg in [-1,1]:
   stair.beam((0,-.25,sg*(width/2+.05)),(2,.95,sg*(width/2+.05)),.045,'bronze')
   for f in [0,.5,1]:stair.beam((2*f,-1.2+f*1.2,sg*(width/2+.05)),(2*f,-.25+f*1.2,sg*(width/2+.05)),.045,'bronze')
  m.add(stair.moved(x,z,rot=rot))
 # Island is solid masonry. Vegetation is decoration, not hidden cover.
 m.box(0,-1.2,-1,1.5,2.1,2.2,'limestone');m.box(0,.9,-1,1.3,.12,2,'soil');palm(m,0,-1,1.02,3.4)
 # Finishing fascia around the 3-inch platform.
 for z in [-24,24]:m.box(0,-3,z,48,2.8,.12,'asphalt')
 for x in [-24,24]:m.box(x,-3,0,.12,2.8,48,'asphalt')
 return record('Azure Palace - recessed resort ground','ground',[('Raised 48-inch board with sunken dry pool',m)],kind='ground')

def main():
 ground()
 specs=[
 ('Sunward Hotel Wing','sunward-wing',7,9,3,-8,-4,0,'hotel'),
 ('Seaward Hotel Wing','seaward-wing',7,9,3,8,4,180,'hotel'),
 ('Azure Spa','azure-spa',8,6,2,-7,13,90,'spa'),
 ('Terrace Restaurant','terrace-restaurant',8,6,2,7,-13,270,'restaurant'),
 ('North Guest Villa','north-villa',6.5,6.5,1,-18,17,90,'hotel'),
 ('East Guest Villa','east-villa',6.5,6.5,1,18,17,270,'hotel'),
 ('South Guest Villa','south-villa',6.5,6.5,1,18,-17,270,'hotel'),
 ('West Guest Villa','west-villa',6.5,6.5,1,-18,-17,90,'hotel'),
 ('Resort Reception','reception',7.5,5.5,1,0,-21,0,'reception'),
 ('Poolside Cafe','cafe',7.5,5.5,1,0,21,180,'restaurant'),
 ('Service Laundry','laundry',6,7,1,-19,0,90,'laundry'),
 ('Pool Equipment Room','pool-equipment',6,7,1,19,0,270,'equipment')]
 for s in specs:building(*s)
 scatter=[('Luggage Trolley','luggage-trolley',trolley()),('Limestone Planter','limestone-planter',planter(tree=True)),('Bronze Sculpture','bronze-sculpture',sculpture()),('Linen Cart','linen-cart',trolley(True)),('Pool Maintenance Unit','maintenance-unit',maintenance()),('Stacked Sun Loungers','stacked-loungers',chaise()),('Pool Bar Cart','pool-bar-cart',bar()),('Damaged Shade Screen','shade-screen',screen())]
 for name,slug,m in scatter:record(name,slug,[('Approved scatter design - solid geometry and matching collider',m)],kind='scatter')
 # Freestanding resort privacy walls create staggered routes through both halves.
 wall=M();wall.box(0,0,0,3.6,1.2,.42,'limestone');wall.box(0,1.2,0,3.8,.15,.54,'travertine')
 for x in [-1.75,1.75]:wall.box(x,0,0,.38,1.6,.55,'limestone')
 record('Resort Garden Wall','garden-wall',[('Low solid garden wall',wall)],kind='wall')
 (R/'Source/geometry-manifest.json').write_text(json.dumps(MAN,indent=2))
 print('Built',len(MAN),'original terrain designs;',sum(len(x['states'])for x in MAN),'visible states')

if __name__=='__main__':main()
