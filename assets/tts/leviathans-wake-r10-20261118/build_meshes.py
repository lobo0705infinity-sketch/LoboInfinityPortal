from pathlib import Path
import math,json,random,copy
import numpy as np
from PIL import Image,ImageDraw,ImageFont
R=Path(__file__).resolve().parent;A=R/'assets';random.seed(7317)

# Compile generated material scans and exact lettering into one production atlas.
base=Image.open(A/'materials-r2.png').convert('RGB').resize((2048,2048))
atlas=Image.new('RGB',(4096,4096),'#303436')
def puttile(tile,im):atlas.paste(im.resize((512,512)),((tile%8)*512,(tile//8)*512))
for i in range(16):puttile(i,base.crop(((i%4)*512,(i//4)*512,(i%4+1)*512,(i//4+1)*512)))
damage=Image.open(A/'damage-materials-r2.png').convert('RGB').resize((2048,2048))
for i in range(4):puttile(32+i,damage.crop(((i%2)*1024,(i//2)*1024,(i%2+1)*1024,(i//2+1)*1024)))
labels=json.loads((R/'signs.json').read_text());font='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
for i,label in enumerate(labels):
 im=Image.new('RGB',(512,128),'#d9d6c8');d=ImageDraw.Draw(im);dark=i in [0,8,12]
 d.rectangle((2,2,509,125),fill='#28525c' if dark else '#d9d6c8',outline='#303839',width=3)
 size=49
 while ImageFont.truetype(font,size).getlength(label)>480:size-=1
 d.text((256,63),label,font=ImageFont.truetype(font,size),fill='#ece6d5' if dark else '#183641',anchor='mm')
 puttile(16+i,im)
atlas.save(A/'rocinante-atlas.jpg',quality=96,subsampling=0)
# Rock scans use a full resolution crop of the generated surface reference.
damage.crop((0,0,1024,1024)).save(A/'ash-rock.jpg',quality=96,subsampling=0)

def uvbox(tile):
 c=tile%8;r=tile//8;pad=.001
 return c/8+pad,1-(r+1)/8+pad,(c+1)/8-pad,1-r/8-pad
class Mesh:
 def __init__(self):self.v=[];self.uv=[];self.f=[]
 def face(self,points,tile=0,uv=None):
  i=len(self.v);self.v.extend([tuple(map(float,p)) for p in points]);a,b,c,d=uvbox(tile)
  self.uv.extend(uv if uv is not None else [(a,b),(c,b),(c,d),(a,d)][:len(points)])
  for j in range(1,len(points)-1):self.f.append((i,i+j,i+j+1))
 def box(self,c,s,tile=0):
  x,y,z=c;w,h,l=np.array(s)/2;x0,x1=x-w,x+w;y0,y1=y-h,y+h;z0,z1=z-l,z+l
  for q in [[(x0,y0,z0),(x1,y0,z0),(x1,y1,z0),(x0,y1,z0)],[(x1,y0,z1),(x0,y0,z1),(x0,y1,z1),(x1,y1,z1)],[(x0,y0,z1),(x0,y0,z0),(x0,y1,z0),(x0,y1,z1)],[(x1,y0,z0),(x1,y0,z1),(x1,y1,z1),(x1,y1,z0)],[(x0,y1,z0),(x1,y1,z0),(x1,y1,z1),(x0,y1,z1)],[(x0,y0,z1),(x1,y0,z1),(x1,y0,z0),(x0,y0,z0)]]:self.face(q[::-1],tile)
 def wall(self,c,s):
  x,y,z=c;w,h,d=np.array(s)/2
  q=[(x-w,y-h,z),(x+w,y-h,z),(x+w,y+h,z),(x-w,y+h,z)];self.face(q);self.face(q[::-1])
 def cyl(self,p,q,r,tile=2,n=20,r2=None):
  p=np.array(p,float);q=np.array(q,float);axis=q-p;axis/=np.linalg.norm(axis);u=np.cross(axis,[0,1,0] if abs(axis[1])<.8 else [1,0,0]);u/=np.linalg.norm(u);v=np.cross(axis,u);r2=r if r2 is None else r2
  a=[p+r*(u*math.cos(t)+v*math.sin(t)) for t in np.linspace(0,2*math.pi,n,endpoint=False)];b=[q+r2*(u*math.cos(t)+v*math.sin(t)) for t in np.linspace(0,2*math.pi,n,endpoint=False)]
  for i in range(n):j=(i+1)%n;self.face([a[i],a[j],b[j],b[i]],tile)
  u0,v0,u1,v1=uvbox(tile);disk=[((u0+u1)/2+(u1-u0)*.45*math.cos(t),(v0+v1)/2+(v1-v0)*.45*math.sin(t)) for t in np.linspace(0,2*math.pi,n,endpoint=False)];self.face(a[::-1],tile,disk[::-1]);self.face(b,tile,disk)
 def tube(self,points,r,tile=7,n=8):
  for p,q in zip(points,points[1:]):self.cyl(p,q,r,tile,n)
 def rounded(self,c,s,tile=0,rad=.1):
  x,y,z=c;w,h,l=np.array(s)/2;rad=min(rad,w*.4,l*.4,h*.5)
  outlines=[]
  for yy,inset in [(y-h,rad),(y-h+rad,0),(y+h-rad,0),(y+h,rad)]:
   ring=[]
   for cx,cz,angle in [(w-rad,l-rad,0),(-w+rad,l-rad,90),(-w+rad,-l+rad,180),(w-rad,-l+rad,270)]:
    for aa in np.linspace(angle,angle+90,4):t=math.radians(aa);ring.append((x+cx+(rad-inset)*math.cos(t),yy,z+cz+(rad-inset)*math.sin(t)))
   outlines.append(ring)
  for a,b in zip(outlines,outlines[1:]):
   for i in range(16):j=(i+1)%16;self.face([b[i],b[j],a[j],a[i]],tile)
  u0,v0,u1,v1=uvbox(tile);cap=lambda ring:[(u0+(px-x+w)/(2*w)*(u1-u0),v0+(pz-z+l)/(2*l)*(v1-v0)) for px,py,pz in ring];self.face(outlines[0],tile,cap(outlines[0]));self.face(outlines[-1][::-1],tile,cap(outlines[-1][::-1]))
 def sign(self,c,w,h,tile,side=-1):
  x,y,z=c
  q=[(x-w/2,y-h/2,z),(x+w/2,y-h/2,z),(x+w/2,y+h/2,z),(x-w/2,y+h/2,z)]
  # R2: screenshot-calibrated UV handedness; TTS displays the exported OBJ directly.
  if side<0:q=[q[1],q[0],q[3],q[2]]
  self.box((x,y,z-side*.016),(w,h,.028),2)
  u0,v0,u1,v1=uvbox(tile);uv=[(u1,v0),(u0,v0),(u0,v1),(u1,v1)]
  self.face(q,tile,uv=uv)
  self.face([(a,b,c-side*.032) for a,b,c in [q[1],q[0],q[3],q[2]]],tile,uv=uv)
 def merge(self,m,translate=(0,0,0),yaw=0,scale=1):
  i=len(self.v);t=math.radians(yaw);co,si=math.cos(t),math.sin(t);dx,dy,dz=translate
  for x,y,z in m.v:self.v.append((dx+scale*(co*x+si*z),dy+scale*y,dz+scale*(-si*x+co*z)))
  self.uv.extend(m.uv);self.f.extend(tuple(i+j for j in f) for f in m.f)
 def write(self,name):
  # Preserve R1 geometry placement; sign UVs are separately corrected for observed TTS output.
  lines=['# Rocinante | Leviathans Wake | world inches','o '+name]
  lines+=['v %.5f %.5f %.5f'%(-x,y,z) for x,y,z in self.v]
  lines+=['vt %.6f %.6f'%u for u in self.uv]
  lines+=['f '+' '.join(f'{i+1}/{i+1}' for i in f[::-1]) for f in self.f]
  (A/(name+'.obj')).write_text('\n'.join(lines)+'\n')
  return {'name':name,'vertices':len(self.v),'triangles':len(self.f),'bounds':[np.min(self.v,axis=0).tolist(),np.max(self.v,axis=0).tolist()]}

def rail(m,x0,x1,y,z):
 m.cyl((x0,y,z),(x1,y,z),.045,2,8)
 for x in np.linspace(x0,x1,max(2,int(abs(x1-x0)/1.2)+1)):m.cyl((x,y-.7,z),(x,y,z),.04,2,8)
def seat(m,x,z,y=.35):
 m.box((x,y+.25,z),(.65,.5,.65),2);m.rounded((x,y+.55,z),(.8,.2,.78),4,.08);m.rounded((x,y+.98,z+.3),(.8,.78,.17),4,.06)
 for s in [-1,1]:m.box((x+s*.43,y+.72,z),(.1,.16,.78),2)
def baggage(m,x,z,y=.1):
 m.rounded((x,y+.4,z),(.62,.8,.42),14,.08)
 for xx in [-.2,.2]:m.box((x+xx,y+.4,z-.218),(.035,.73,.025),2)
 m.tube([(x-.16,y+.8,z),(x-.16,y+.9,z),(x+.16,y+.9,z),(x+.16,y+.8,z)],.025,6)
def ramp(m,c,w,l,rise,tile=3):
 x,y,z=c;verts=[(x-w/2,y,z-l/2),(x+w/2,y,z-l/2),(x+w/2,y+rise,z+l/2),(x-w/2,y+rise,z+l/2)]
 m.face(verts[::-1],tile);m.face([(a,b-.12,c) for a,b,c in verts],2)
 for j in range(4):k=(j+1)%4;m.face([verts[j],verts[k],(verts[k][0],verts[k][1]-.12,verts[k][2]),(verts[j][0],verts[j][1]-.12,verts[j][2])][::-1],2)
def cabinet(m,x,z,w=1.4,y=.35):
 m.rounded((x,y+.6,z),(w,1.2,.6),9,.05)
 for xx in np.linspace(x-w/2+.22,x+w/2-.22,3):m.box((xx,y+.67,z-.315),(.04,.25,.035),2)
 m.box((x,y+1.25,z),(w+.1,.1,.7),2)

def wreck_panel(m,c,s,side=1,tile=33):
 x,y,z=c;w,h,t=s
 # Torn plates retain a broad solid centre and split into asymmetric bent corners.
 outline=[(-.5,-.5),(-.17,-.48),(.07,-.5),(.43,-.45),(.5,-.18),(.47,.17),(.35,.5),(.13,.40),(-.11,.5),(-.42,.44),(-.5,.12)]
 q=[(x+a*w,y+b*h,z+side*t/2+(.04 if i in (3,6,9) else 0)) for i,(a,b) in enumerate(outline)]
 center=(x,y,z+side*t/2)
 u0,v0,u1,v1=uvbox(tile)
 for i in range(len(q)):
  j=(i+1)%len(q);p=[center,q[i],q[j]]
  uv=[((u0+u1)/2,(v0+v1)/2),(u0+(outline[i][0]+.5)*(u1-u0),v0+(outline[i][1]+.5)*(v1-v0)),(u0+(outline[j][0]+.5)*(u1-u0),v0+(outline[j][1]+.5)*(v1-v0))]
  m.face(p,tile,uv);m.face([(px,py,pz-side*t) for px,py,pz in p[::-1]],35,uv[::-1])
  m.face([q[i],q[j],(q[j][0],q[j][1],q[j][2]-side*t),(q[i][0],q[i][1],q[i][2]-side*t)],15)
def crash_details(m,L,W,H,opened):
 # Split exposed ribs and draped wiring stay inside the original footprint.
 for end in [-1,1]:
  x=end*(L/2-.13)
  for side in [-1,1]:
   z=side*(W/2-.22)
   m.tube([(x,.35,z),(x-end*.1,1.1,z-side*.1),(x-end*.25,1.9,z+side*.10),(x-end*.05,2.55,z-side*.22)],.065,35,8)
   m.tube([(x-end*.2,2.5,z-side*.05),(x-end*.50,1.8,z-side*.35),(x-end*.28,1.1,z-side*.3),(x-end*.65,.55,z-side*.5)],.025,7,8)
   m.tube([(x-end*.15,2.48,z-side*.10),(x-end*.7,1.65,z-side*.15),(x-end*.45,.85,z-side*.50)],.018,6,8)
   # Angular fallen cladding, sitting directly on the floor at fractured ends.
   for i in range(3):
    xx=x-end*(.35+.28*i);zz=z-side*(.35+.22*(i%2));yy=.33+.025*i
    m.face([(xx-.24,yy,zz-.18),(xx+.27,yy+.04,zz-.14),(xx+.14,yy+.15,zz+.20),(xx-.25,yy,zz+.13)],33 if i%2 else 34)
 if not opened:
  for end in [-1,1]:
   x=end*L*.23
   m.tube([(x,2.8,-W/2+.15),(x+end*.18,H-.55,-W*.21),(x+end*.55,H-.2,-W*.06)],.06,35,8)
   m.tube([(x,H-.3,-W*.13),(x+end*.32,H-1.2,-W*.25),(x+end*.12,2.8,-W*.28)],.035,7,8)

def hull(L=11,W=6,H=5,kind='lounge',opened=False,clear_cabin_rear=True):
 m=Mesh();c=Mesh();floor=.32;door_half=max(1.22,L*.14)
 m.box((0,.15,0),(L,.3,W),3);c.box((0,.15,0),(L,.3,W),3)
 # Architectural sidewalls with actual window and doorway openings.
 for side in [-1,1]:
  z=side*W/2
  rear_removed=kind=='cabin' and clear_cabin_rear and side==-1
  # Broad passenger opening in middle of each side; wall masses at both ends.
  for x in [-L*.32,L*.32]:
   wid=L*.36
   wreck_panel(m,(x,.88,z),(wid,1.1,.16),side,33);c.box((x,.88,z),(wid,1.1,.16))
   m.box((x,2.65,z),(wid,.45,.16),0);c.wall((x,2.65,z),(wid,.45,.16))
   for end in [-1,1]:m.box((x+end*(wid/2-.14),1.95,z),(.28,1.1,.18),0)
   # Window frame: metallic backing ring with a genuine clear opening.
   for yy in [1.45,2.42]:m.box((x,yy,z-side*.03),(wid-.25,.07,.23),2)
   for xx in [x-wid/2+.2,x+wid/2-.2]:m.box((xx,1.94,z-side*.03),(.07,.98,.23),2)
   wreck_panel(m,(x,1.12,z+side*.09),(wid,.36,.035),side,34)
  for x in [-L/2+.12,L/2-.12,-door_half,door_half]:
   if rear_removed and abs(x)==door_half:continue
   m.box((x,1.54,z),(.19,2.44,.21),2);
   if abs(x)<L*.3:c.wall((x,1.54,z),(.19,2.44,.21))
  m.sign((L*.31,2.65,z+side*.094),L*.32,.37,16,side)
  if not rear_removed:m.sign((0,2.85,z+side*.02),2.25,.48,17,side)
  # Integrated door thresholds, edge seals, header and amber strip.
  if not rear_removed:
   m.box((0,2.75,z),(door_half*2,.2,.28),0)
   m.box((0,2.72,z+side*.18),(1.4,.06,.08),7)
   for x in [-door_half+.10,door_half-.10]:m.box((x,1.55,z+side*.1),(.055,2.35,.08),6)
  # Wide shallow access ramp, part of the hull's mesh and states.
  if not rear_removed:
   rr=Mesh();ramp(rr,(0,.12,0),2.3,1.25,.18);m.merge(rr,(0,0,side*(W/2+.62)),0 if side<0 else 180);c.merge(rr,(0,0,side*(W/2+.62)),0 if side<0 else 180)
 # Solid transverse bulkheads interrupt end-to-end LoF while leaving wide doors.
 for end in [-1,1]:
  for side in [-1,1]:
   zz=side*(W/4+.575);ww=W/2-1.15
   endplate=Mesh();wreck_panel(endplate,(0,1.54,0),(ww,2.44,.18),1,33);m.merge(endplate,(end*L/2,0,zz),90)
   cc=Mesh();cc.wall((0,1.54,0),(ww,2.44,.18));c.merge(cc,(end*L/2,0,zz),90)
  m.box((end*L/2,2.72,0),(.23,.25,2.3),2)
 # R6: clear the central aisle and all side doorway approaches.
 # Curved roof with a torn central opening; removed entirely for floor state.
 if not opened:
  for a,b in [(-L/2,-L*.21),(L*.25,L/2)]:
   for j in range(12):
    t0=j*math.pi/12;t1=(j+1)*math.pi/12
    # small uneven fracture lips on open ends
    aa=a+(0.10+.30*(.5+.5*math.sin(j*2.7+1.2)));bb=b-(0.08+.34*(.5+.5*math.sin(j*3.7+.3)))
    q=[(aa,2.78+(H-2.78)*math.sin(t0),W/2*math.cos(t0)),(bb,2.78+(H-2.78)*math.sin(t0),W/2*math.cos(t0)),(bb,2.78+(H-2.78)*math.sin(t1),W/2*math.cos(t1)),(aa,2.78+(H-2.78)*math.sin(t1),W/2*math.cos(t1))]
    u0,v0,u1,v1=uvbox(33);outeruv=[(u0,v0+(v1-v0)*j/12),(u1,v0+(v1-v0)*j/12),(u1,v0+(v1-v0)*(j+1)/12),(u0,v0+(v1-v0)*(j+1)/12)]
    m.face(q,33,uv=outeruv);m.face([(x,y-.12,z*.98) for x,y,z in q][::-1],35)
    for end in [0,1]:
     p=q[end];v=q[3-end];m.face([p,v,(v[0],v[1]-.12,v[2]*.98),(p[0],p[1]-.12,p[2]*.98)],15)
   # Collider roof uses matching 6-panel shell. Thin slabs, not a solid hull.
   for j in range(5):
    t0=j*math.pi/5;t1=(j+1)*math.pi/5
    q=[(a,2.78+(H-2.78)*math.sin(t0),W/2*math.cos(t0)),(b,2.78+(H-2.78)*math.sin(t0),W/2*math.cos(t0)),(b,2.78+(H-2.78)*math.sin(t1),W/2*math.cos(t1)),(a,2.78+(H-2.78)*math.sin(t1),W/2*math.cos(t1))]
    c.face(q);c.face([(x,y-.12,z) for x,y,z in q][::-1])
 # Flat maintenance treads and internal ladders; physically supported roof positions.
 if not opened:
  for x in [-L*.355,L*.375]:
   m.box((x,H+.055,0),(L*.26,.11,1.35),3);c.box((x,H+.055,0),(L*.26,.11,1.35))
 for x in [-L*.44,L*.44]:
  for z in [1.15,1.85]:m.cyl((x,.32,z),(x,H,z),.045,2,8)
  for y in np.arange(.5,H,.3):m.cyl((x,y,1.15),(x,y,1.85),.035,2,8)
 # Frames/ribs, cable runs and hull repair fasteners are structural geometry.
 for x in [-L/2+.04,-L*.21,L*.25,L/2-.04]:
  pts=[(x,2.78+(H-2.78)*math.sin(t),W/2*math.cos(t)) for t in np.linspace(0,math.pi,13)]
  if not opened:m.tube(pts,.065,2)
  for side in [-1,1]:m.cyl((x,.35,side*(W/2-.16)),(x,2.7,side*(W/2-.16)),.07,2,8)
 for side in [-1,1]:
  for yy in [.5,.66]:
   for start,end in [(-L/2,-door_half),(door_half,L/2)]:m.cyl((start,yy,side*(W/2+.13)),(end,yy,side*(W/2+.13)),.035,7,8)
  for x in np.linspace(-L/2+.3,L/2-.3,10):
   if abs(x)<door_half+.1:continue
   for yy in [.4,2.7]:m.cyl((x,yy,side*(W/2+.08)),(x,yy,side*(W/2+.14)),.04,2,8)
 if kind in ['lounge','cabin']:
  for x in [-L*.36,-L*.23,L*.23,L*.36]:seat(m,x,W*.28)
  c.box((-L*.3,.95,W*.28),(L*.27,1.25,1.0));c.box((L*.3,.95,W*.28),(L*.27,1.25,1.0))
  if kind!='cabin' or not clear_cabin_rear:
   cabinet(m,-L*.34,-W*.29,L*.24)
   c.box((-L*.34,.95,-W*.29),(L*.24,1.25,.7))
   for x in [L*.25,L*.37]:baggage(m,x,-W*.27,.32)
  # R6: removed the artwork partition that blocked the passenger doorway.
  m.sign((-L*.32,.95,-W/2+.092),.72,.72,13,1)
  if kind!='cabin' or not clear_cabin_rear:m.rounded((L*.32,.59,-W*.27),(L*.24,.42,.85),4,.07)
 elif kind=='bridge':
  # Tapered command prow makes the forward section distinct from the cabins.
  m.cyl((-L/2,1.5,0),(-L/2-1.7,1.5,0),W*.43,0,12,.75)
  m.cyl((-L/2-1.72,1.5,0),(-L/2-1.8,1.5,0),.74,8,12,.66)
  c.box((-L/2-.55,1.5,0),(1.1,2.8,W*.7))
  # Side console banks leave the centre doors and crossing aisle unobstructed.
  for side in [-1,1]:
   x=side*L*.32;seat(m,x,W*.24)
   m.rounded((x,1.1,-W*.29),(L*.25,.5,.7),2,.1);c.box((x,1.1,-W*.29),(L*.25,.5,.7))
   for xx in [x-.45,x+.45]:m.box((xx,1.48,-W*.29),(.63,.35,.09),1);m.box((xx,1.45,-W*.29-.06),(.5,.19,.02),8)
  m.sign((L*.31,1.75,W/2-.11),1.5,.32,31,-1)
 elif kind=='engineering':
  for z in [-W*.36,W*.36]:
   m.cyl((L/2-.2,1.6,z),(L/2+1.5,1.6,z),.62,2,20,1.05)
   m.cyl((L/2+1.51,1.6,z),(L/2+1.54,1.6,z),.89,6,20)
   c.box((L/2+.65,1.6,z),(1.7,2.1,2.1))
  for x in [-L*.32,L*.32]:
   m.rounded((x,1.1,W*.26),(1.7,1.5,1.4),8,.1);c.box((x,1.1,W*.26),(1.7,1.5,1.4))
   for z in [-W*.34,-W*.23]:m.cyl((x,.35,z),(x,2.4,z),.26,2,16)
  m.sign((0,2.8,W/2-.1),2.3,.4,30,-1)
 crash_details(m,L,W,H,opened)
 return m,c

def capsule():
 m=Mesh();c=Mesh()
 # Truncated capsule: coherent rounded shell, opening on front.
 levels=[(.16,1.1),(.45,1.4),(1.7,1.4),(2.7,.9),(3.15,.52)]
 for (y0,r0),(y1,r1) in zip(levels,levels[1:]):
  for j in range(24):
   t0=2*math.pi*j/24;t1=2*math.pi*(j+1)/24
   if y0>=.45 and j in [16,17,18,19]:continue
   q=[(r0*math.cos(t0),y0,r0*math.sin(t0)),(r0*math.cos(t1),y0,r0*math.sin(t1)),(r1*math.cos(t1),y1,r1*math.sin(t1)),(r1*math.cos(t0),y1,r1*math.sin(t0))];m.face(q[::-1],0 if y0!=.45 else 1)
 m.box((0,.15,0),(2.2,.3,2.2),2);c.box((0,1.45,0),(2.2,2.9,2.2))
 for x in [-1,1]:m.rounded((x,.12,0),(.6,.24,2.7),2,.06)
 seat(m,0,.1,.3);m.box((0,2.6,-.9),(1.2,.1,.16),7)
 m.sign((0,2.2,-1.13),1.5,.35,16)
 for x in [-.63,.63]:m.box((x,1.63,-1.13),(.08,1.9,.12),2)
 door=Mesh();door.rounded((0,1.5,0),(1.1,2.1,.15),0,.06);door.box((0,1.8,-.09),(.55,.45,.03),8);m.merge(door,(1.1,0,-1),-45)
 for y in [.5,2.4]:m.tube([(-1,y,-.8),(-1,y,-1),(-.75,y,-1)],.04,2)
 return m,c
def bulwark():
 m=Mesh();c=Mesh()
 # Narrow folded structural foot; genuinely open windows above the solid apron.
 m.box((0,.16,0),(5.5,.3,1.1),2);c.box((0,.16,0),(5.5,.3,1.1))
 for x in [-1.35,1.35]:
  m.box((x,.9,0),(2.65,1.35,.24),0);c.box((x,.9,0),(2.65,1.35,.24))
  m.box((x,2.9,0),(2.65,.5,.25),0);c.box((x,2.9,0),(2.65,.5,.25))
  m.box((x,1.15,-.13),(2.65,.35,.03),1)
  for xx in [x-1.2,x+1.2]:m.box((xx,2.13,0),(.24,1.2,.27),2);c.box((xx,2.13,0),(.24,1.2,.27))
 for x in [-2.4,-.4,.4,2.4]:
  m.box((x,1.58,.19),(.12,3,.18),2);m.box((x,.4,.4),(.25,.55,.7),2)
  m.cyl((x,.3,.34),(x,2.9,.34),.05,7,8)
 for x in np.linspace(-2.7,2.7,10):m.box((x,3.16+random.uniform(-.1,.15),0),(.5,.15,.28),15)
 m.sign((0,2.92,-.135),2.65,.35,16)
 return m,c
def turbine():
 m=Mesh();c=Mesh();m.box((0,.17,0),(3.8,.34,2.6),2);c.box((0,.17,0),(3.8,.34,2.6))
 m.cyl((-1.7,1.25,0),(1.7,1.25,0),1.0,2,24);c.box((0,1.25,0),(3.4,2,2))
 for x in np.linspace(-1.7,1.7,8):m.cyl((x-.045,1.25,0),(x+.045,1.25,0),1.07,0,24)
 for x in [-1.77,1.77]:
  m.cyl((x,1.25,0),(x+.03,1.25,0),.78,8,24)
  for a in np.linspace(0,2*math.pi,16,endpoint=False):m.cyl((x,1.25,0),(x,1.25+.78*math.sin(a),.78*math.cos(a)),.025,2,6)
 for z in [-.72,.72]:
  for y in [.6,1.1,1.6]:m.tube([(-1.4,y,z),(-.9,y,z*1.5),(.9,y,z*1.5),(1.4,y,z)],.055,7)
 m.box((0,1.7,-1),(2,.47,.18),0);m.sign((0,1.7,-1.1),1.9,.4,22)
 return m,c
def medical():
 m=Mesh();c=Mesh();m.rounded((0,1.25,.4),(3.4,2.5,.9),9,.13);c.box((0,1.25,.4),(3.4,2.5,.9))
 m.sign((0,2.15,-.06),2.6,.53,18)
 for x in [-1.2,-.8]:m.cyl((x,.15,-.2),(x,1.65,-.2),.16,2,12)
 m.box((.8,1.55,-.08),(.8,.65,.09),1)
 m.rounded((.7,.95,-1),(1.45,.3,1.55),4,.1)
 for x in [.1,1.3]:m.cyl((x,0,-1.6),(x,.86,-1.6),.045,2,8)
 c.box((.7,.95,-1),(1.45,.3,1.55))
 for y in [.5,.9,1.3]:m.box((-.1,y,-.07),(.6,.24,.03),9)
 return m,c
def cart():
 m=Mesh();c=Mesh();m.rounded((0,.55,0),(3,.65,1.6),0,.12);c.box((0,.9,0),(3,1.8,1.6))
 for x in [-1.1,1.1]:
  for z in [-.78,.78]:m.cyl((x,.35,z-.12),(x,.35,z+.12),.35,6,12);m.cyl((x,.35,z-.13),(x,.35,z+.13),.16,2,12)
 for x in [-.95,-.25,.45,1.12]:baggage(m,x,0,.88)
 m.box((.25,1.7,.18),(1.4,.55,.58),4)
 for x in [-1.05,.9]:m.box((x,1.45,-.4),(.045,1.1,.035),6)
 m.tube([(-1.45,.9,0),(-1.9,1.6,0),(-1.9,1.8,0)],.07,2);m.box((-1.9,1.8,0),(.4,.12,.55),6)
 m.sign((0,.6,-.82),2.2,.45,16)
 return m,c
def galley():
 m=Mesh();c=Mesh();m.rounded((0,.83,0),(3.5,1.66,1.5),9,.18);m.rounded((0,1.7,0),(3.65,.14,1.65),2,.07);c.box((0,.9,0),(3.65,1.8,1.65))
 m.sign((.55,1.15,-.77),1.8,.4,21)
 for x in [-1.2,-.4,.4,1.2]:m.box((x,.72,-.77),(.04,.24,.04),2)
 m.rounded((-1,2.03,.2),(.7,.65,.55),8,.05);m.box((-1,2.15,-.09),(.4,.15,.03),2)
 for x in [.2,.6,1.0]:m.cyl((x,1.8,.2),(x,2.5,.2),.18,2,12);m.cyl((x,2.1,-.1),(x,2.1,-.23),.035,2,8)
 return m,c


from scatter_r2 import install_scatter_builders
install_scatter_builders(globals())
from crash_r3 import install
extra_wrecks=install(globals())

def wreckage():
 m=Mesh();c=Mesh()
 # Folded, ripped sheet with a buckled central ridge and exposed cross section.
 q=[(-1.20,.07,-.64),(-.58,.11,-.73),(.12,.32,-.58),(.96,.10,-.52),(1.20,.06,-.20),(.89,.13,.41),(.35,.38,.55),(-.21,.31,.62),(-.98,.04,.49)]
 center=(0,.26,0);u0,v0,u1,v1=uvbox(33)
 for i in range(len(q)):
  j=(i+1)%len(q)
  uv=lambda p:(u0+(p[0]+1.2)/2.4*(u1-u0),v0+(p[2]+.75)/1.5*(v1-v0))
  m.face([center,q[i],q[j]],33,[uv(center),uv(q[i]),uv(q[j])])
  m.face([(x,y-.035,z) for x,y,z in [q[j],q[i],center]],35)
  m.face([q[i],q[j],(q[j][0],q[j][1]-.035,q[j][2]),(q[i][0],q[i][1]-.035,q[i][2])],15)
 m.tube([(-1.1,.13,.12),(-.45,.33,.2),(.12,.38,-.1),(.8,.18,-.23)],.065,35,10)
 m.tube([(-.8,.12,-.3),(-.2,.15,-.4),(.45,.14,-.23),(.82,.07,.2)],.025,7,8)
 c.box((0,.19,0),(2.4,.38,1.46));return m,c

stats=[];models={}
for slug,fun in [('escape-capsule',capsule),('hull-bulwark',bulwark),('aux-turbine',turbine),('medical-station',medical),('baggage-cart',cart),('galley-module',galley),('torn-wreckage',wreckage)]+list(extra_wrecks.items()):
 m,c=fun();stats.extend([m.write(slug),c.write(slug+'-collider')]);models[slug]={'mesh':slug+'.obj','collider':slug+'-collider.obj'}
for slug,L,W,H,kind in [('passenger-habitat',11,6.5,5.5,'lounge'),('command-nose',9,6,4.75,'bridge'),('engineering-hull',9.5,6.5,5.25,'engineering'),('detached-cabin',7.2,5.2,3.5,'cabin')]:
 for state,opened in [(1,True),(2,False)]:
  m,c=hull(L,W,H,kind,opened);name=f'{slug}-state-{state}';stats.extend([m.write(name),c.write(name+'-collider')]);models[name]={'mesh':name+'.obj','collider':name+'-collider.obj'}
# The ground is an accurately flat, collision-supporting 48-inch surface.
m=Mesh();m.face([(-24,0,-24),(24,0,-24),(24,0,24),(-24,0,24)][::-1],uv=[(0,0),(1,0),(1,1),(0,1)]);m.face([(-24,-.03,24),(24,-.03,24),(24,-.03,-24),(-24,-.03,-24)][::-1],uv=[(0,0),(1,0),(1,1),(0,1)])
stats.append(m.write('ash-mat'));m.write('ash-mat-collider')
(R/'mesh-stats.json').write_text(json.dumps(stats,indent=2));(R/'models.json').write_text(json.dumps(models,indent=2))
print('Created',len(stats),'meshes; max vertices',max(s['vertices'] for s in stats),'max triangles',max(s['triangles'] for s in stats))
print('Collider maxima',max(s['triangles'] for s in stats if 'collider' in s['name']))
