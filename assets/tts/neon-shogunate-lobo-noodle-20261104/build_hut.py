from pathlib import Path
import math,json,copy,re,hashlib,random
import numpy as np
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parent; A=ROOT;A.mkdir(exist_ok=True)
atlas=Image.open(ROOT/'lobo-noodle-atlas.jpg').convert('RGB')
(ROOT/'review').mkdir(exist_ok=True)
rects={'wood':(4,4,252,252),'stone':(514,4,764,252),'roof':(772,4,1020,252),'red':(1028,4,1276,252),'metal':(1540,4,1788,252),'gold':(4,260,252,508),'black':(1796,260,2044,508),'cream':(772,260,1020,508),'plank':(1796,772,2044,1020),'cyan':(8,780,248,1016),'pink':(264,780,504,1016),'amber':(520,780,760,1016),'sign':(0,1024,2048,1704),'menu':(0,1720,740,2048),'joke':(760,1720,2048,2048)}
parts=[]
def quad(v,mat,coll=True):
 # Vertices arranged CCW viewed from outside. Separate vertices allow correct per-face UVs.
 parts.append((np.array(v,float),[(0,1,2),(0,2,3)],mat,coll))
def box(c,s,mat,coll=True):
 x,y,z=c;a,b,h=np.array(s)/2
 v=[(x-a,y-b,z-h),(x+a,y-b,z-h),(x+a,y+b,z-h),(x-a,y+b,z-h),(x-a,y-b,z+h),(x+a,y-b,z+h),(x+a,y+b,z+h),(x-a,y+b,z+h)]
 for ids in [(1,0,3,2),(4,5,6,7),(0,4,7,3),(5,1,2,6),(3,7,6,2),(0,1,5,4)]:quad([v[i] for i in ids],mat,coll)
def beam(a,b,w,mat,coll=True):
 a=np.array(a,float);b=np.array(b,float);vec=b-a;length=np.linalg.norm(vec);u=vec/length
 side=np.cross(u,[0,1,0]);
 if np.linalg.norm(side)<.01:side=np.cross(u,[1,0,0])
 side=side/np.linalg.norm(side)*w/2;other=np.cross(u,side);other=other/np.linalg.norm(other)*w/2
 v=[a-side-other,a+side-other,a+side+other,a-side+other,b-side-other,b+side-other,b+side+other,b-side+other]
 for ids in [(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]:quad([v[i]for i in ids],mat,coll)
def ring(cx,y,cz,r0,r1,h,mat,n=24,coll=True):
 for i in range(n):
  a=2*math.pi*i/n;b=2*math.pi*(i+1)/n
  v=[(cx+r0*math.cos(a),y,cz+r0*math.sin(a)),(cx+r0*math.cos(b),y,cz+r0*math.sin(b)),(cx+r1*math.cos(b),y+h,cz+r1*math.sin(b)),(cx+r1*math.cos(a),y+h,cz+r1*math.sin(a))]
  quad(v[::-1],mat,coll)
def cyl(c,r,h,mat,n=12,coll=True):
 x,y,z=c;ring(x,y-h/2,z,r,r,h,mat,n,coll)
 for top in [False,True]:
  cy=y+(h/2 if top else -h/2)
  for i in range(n):
   a=2*math.pi*i/n;b=2*math.pi*(i+1)/n
   v=[(x,cy,z),(x+r*math.cos(a),cy,z+r*math.sin(a)),(x+r*math.cos(b),cy,z+r*math.sin(b))]
   if top:v=v[::-1]
   parts.append((np.array(v),[(0,1,2)],mat,coll))
def poly(r):
 a=r*(math.sqrt(2)-1);return np.array([[-a,-r],[a,-r],[r,-a],[r,a],[a,r],[-a,r],[-r,a],[-r,-a]])
def deck(r,y,h,mat,hole=False):
 # Top floor with a real open stairwell at rear east.
 if hole:
  # Tessellated octagon; exclude grid cells in stairwell, retain exact clipped exterior.
  from shapely.geometry import Polygon,box as sb
  from shapely.ops import triangulate
  p=Polygon(poly(r)).difference(sb(2.0,-.8,3.4,2.85))
  for t in triangulate(p):
   if not p.covers(t.representative_point()):continue
   pts=list(t.exterior.coords)[:3];parts.append((np.array([(x,y+h,z)for x,z in pts]),[(2,1,0)],mat,True));parts.append((np.array([(x,y,z)for x,z in pts]),[(0,1,2)],mat,True))
 else:
  for i in range(8):
   a=poly(r)[i];b=poly(r)[(i+1)%8]
   parts.append((np.array([(0,y+h,0),(a[0],y+h,a[1]),(b[0],y+h,b[1])]),[(2,1,0)],mat,True));parts.append((np.array([(0,y,0),(a[0],y,a[1]),(b[0],y,b[1])]),[(0,1,2)],mat,True))
 for i in range(8):
  a=poly(r)[i];b=poly(r)[(i+1)%8];quad([(a[0],y,a[1]),(b[0],y,b[1]),(b[0],y+h,b[1]),(a[0],y+h,a[1])],mat)
def wallseg(a,b,y,h,mat):
 a=np.array(a);b=np.array(b);mid=(a+b)/2;v=b-a;n=np.array([-v[1],v[0]])/np.linalg.norm(v)*.09
 quad([(a[0],y,a[1]),(b[0],y,b[1]),(b[0],y+h,b[1]),(a[0],y+h,a[1])],mat)
 quad([(b[0]+n[0],y,b[1]+n[1]),(a[0]+n[0],y,a[1]+n[1]),(a[0]+n[0],y+h,a[1]+n[1]),(b[0]+n[0],y+h,b[1]+n[1])],mat)
 for p in [a,b]:beam((p[0],y,p[1]),(p[0],y+h,p[1]),.16,'wood')
def walls(r,y,upper=False):
 pp=poly(r)
 for i in range(8):
  a=pp[i];b=pp[(i+1)%8];mid=(a+b)/2;unit=(b-a)/np.linalg.norm(b-a);length=np.linalg.norm(b-a)
  # Cardinal walls are real doorways; diagonal walls have open windows.
  if i in [0,2,4,6]:
   gap=2.5 if i==0 and not upper else 1.4
   l=mid-unit*gap/2;rr=mid+unit*gap/2
   wallseg(a,l,y,2.75,'cream');wallseg(rr,b,y,2.75,'cream');wallseg(l,rr,y+2.2,.55,'wood')
   if i==0 and not upper:box((0,y+.9,-r), (2.5,.15,.48),'wood')
  else:
   wallseg(a,b,y,.9,'red');wallseg(a,b,y+2.15,.6,'cream')
   for t in [.12,.88]:
    p=a+(b-a)*t;beam((p[0],y+.9,p[1]),(p[0],y+2.15,p[1]),.1,'wood')
  beam((a[0],y+2.75,a[1]),(b[0],y+2.75,b[1]),.18,'wood')
def eave(r,y,mat):
 for step in range(5):
  r0=r+step*.14;r1=r+(step+1)*.14;y0=y-.30*step/5;y1=y-.30*(step+1)/5+.12*(step/4)**3
  p0=poly(r0);p1=poly(r1)
  for i in range(8):
   j=(i+1)%8;quad([(p0[i,0],y0,p0[i,1]),(p1[i,0],y1,p1[i,1]),(p1[j,0],y1,p1[j,1]),(p0[j,0],y0,p0[j,1])],mat,False)
 # Visible individual raised tile ribs.
 pp=poly(r+.68);inn=poly(r)
 for i in range(8):
  for t in np.linspace(0,1,7):
   a=inn[i]*(1-t)+inn[(i+1)%8]*t;b=pp[i]*(1-t)+pp[(i+1)%8]*t
   beam((a[0],y+.02,a[1]),(b[0],y-.15,b[1]),.045,'metal',False)
def rail(r,y,skip=[]):
 pp=poly(r)
 for i in range(8):
  if i in skip:continue
  a=pp[i];b=pp[(i+1)%8]
  for t in np.linspace(0,1,4):
   p=a*(1-t)+b*t;beam((p[0],y,p[1]),(p[0],y+.85,p[1]),.09,'red')
  for h in [.35,.85]:beam((a[0],y+h,a[1]),(b[0],y+h,b[1]),.10,'wood')
def stool(x,y,z):cyl((x,y+.43,z),.09,.78,'metal');cyl((x,y+.86,z),.24,.1,'red')
def bowl(x,y,z,r=.15):
 ring(x,y,z,r*.55,r,.13,'cream',12,False);cyl((x,y+.10,z),r*.88,.03,'gold',12,False)
 for dx in [-.04,.04]:beam((x+dx,y+.15,z),(x+dx+.15,y+.18,z+.2),.018,'wood',False)
def table(x,y,z):
 cyl((x,y+.54,z),.08,1.0,'metal');box((x,y+1.02,z),(1.1,.13,.8),'wood');bowl(x-.2,y+1.1,z)
 for dx in [-.78,.78]:stool(x+dx,y,z)
def panel(x,y,z,w,h,mat,back=False):
 # Front -Z, correct readable orientation; back uses the opposite face independently.
 v=[(x-w/2,y-h/2,z),(x+w/2,y-h/2,z),(x+w/2,y+h/2,z),(x-w/2,y+h/2,z)]
 parts.append((np.array(v),[(0,1,2),(0,2,3)] if back else [(2,1,0),(3,2,0)],mat,False))
 # second matching face for rearward readability
 if mat=='sign':parts.append((np.array([(x+w/2,y-h/2,z+.16),(x-w/2,y-h/2,z+.16),(x-w/2,y+h/2,z+.16),(x+w/2,y+h/2,z+.16)]),[(2,1,0),(3,2,0)],mat,False))
def build(view):
 global parts;parts=[];deck(4.5,.05,.20,'stone');walls(4.05,.25)
 # Detailed kitchen occupies back wall, preserving central routes.
 box((-.5,.75,2.9),(4.3,1,.65),'metal');box((-.5,1.30,2.9),(4.5,.12,.8),'metal')
 box((-.5,2.25,3.0),(3.6,.55,.9),'metal');box((-2.4,1.35,2.5),(.65,2.1,.75),'metal')
 for x in [-1.7,-.85,0,.85]:cyl((x,1.39,2.9),.25,.07,'black');bowl(x,1.43,2.9)
 for x in [-1.9,-1.35,-.8,-.25,.3,.85]:
  cyl((x,1.5,3.55),.1,.35,'red',8,False)
 for x in [-1.8,-.8,.2]:
  beam((x,2.0,3.5),(x,1.75,3.5),.04,'metal',False);cyl((x,1.7,3.5),.11,.06,'metal',8,False)
 box((0,1.12,-2.9),(3.5,.18,.7),'wood')
 for x in [-1.2,0,1.2]:stool(x,.25,-3.7);bowl(x,1.23,-2.9)
 table(-2.4,.25,.1);table(1.8,.25,.1)
 # Exterior menu sits flush to the front diagonal wall, between the posts.
 start=len(parts)
 box((0,0,.04),(1.2,1.5,.07),'black',False)
 panel(0,0,-.01,1.1,1.4,'menu')
 theta=math.pi/4;rot=np.array([[math.cos(theta),0,math.sin(theta)],[0,1,0],[-math.sin(theta),0,math.cos(theta)]])
 for index in range(start,len(parts)):
  vv,ff,mat,col=parts[index];parts[index]=(vv@rot.T+np.array([-3.28,1.9,-2.68]),ff,mat,col)
 panel(0,1.95,3.88,2.5,.65,'joke',True)
 # External stair, 1.25 inch clear treads. Fixed .25 inch risers.
 for i in range(12):box((4.75,.25+(i+1)*.25/2, -2.9+i*.43),(1.25,(i+1)*.25,.43),'stone')
 box((4.75,3.13,2.45),(1.25,.24,1.0),'plank')
 for x in [4.10,5.4]:
  beam((x,1.2,-2.9),(x,4.1,2.3),.075,'metal')
  for i in [0,3,6,9,11]:beam((x,.25+(i+1)*.25,-2.9+i*.43),(x,1.15+(i+1)*.25,-2.9+i*.43),.07,'red')
 # Lantern bodies modeled in all directions, independent from old point lights.
 lanterns=[]
 for y in [2.25]+([5.25] if view>=2 else []):
  for x in [-2.7,2.7]:
   z=-3.9;cyl((x,y,z),.23,.58,'amber',12,False)
   for h in [-.32,.32]:cyl((x,y+h,z),.25,.07,'black',12,False)
   for a in np.linspace(0,2*math.pi,8,endpoint=False):beam((x+.235*math.cos(a),y-.27,z+.235*math.sin(a)),(x+.235*math.cos(a),y+.27,z+.235*math.sin(a)),.018,'red',False)
   beam((x,y+.35,z),(x,y+.7,z+.15),.045,'black',False);lanterns.append([x,y,z])
 if view>=2:
  deck(4.9,3.05,.20,'plank');walls(3.65,3.25,True);eave(4.05,3.08,'roof');rail(4.8,3.25,skip=[2])
  table(-1.8,3.25,0);table(.7,3.25,-1.6);table(-1.3,3.25,2.0)
  box((-2.8,3.85,1.5),(.5,1.2,2.2),'wood')
  for i in range(12):box((2.65,3.25+(i+1)*.25/2,-.6+i*.285),(1.2,(i+1)*.25,.285),'wood')
  beam((3.28,4.2,-.7),(3.28,7.0,2.6),.07,'red')
 if view>=3:
  deck(3.75,6.05,.20,'plank',hole=True);eave(3.7,6.25,'roof');rail(3.65,6.25,skip=[0])
  # Raised tiled pavilion roof leaves a roof walking strip around its perimeter.
  inn=poly(1.75);out=poly(3.38)
  for i in range(8):
   j=(i+1)%8
   if i not in [2,3]:quad([(inn[i,0],7.28,inn[i,1]),(out[i,0],6.45,out[i,1]),(out[j,0],6.45,out[j,1]),(inn[j,0],7.28,inn[j,1])],'roof',False)
   # curved raised hips and exposed edge fascia.
   beam((out[i,0],6.45,out[i,1]),(inn[i,0],7.30,inn[i,1]),.09,'roof',False)
   beam((out[i,0],6.42,out[i,1]),(out[j,0],6.42,out[j,1]),.09,'wood',False)
  deck(1.75,7.24,.06,'roof')
  # Roof terrace, open stairwell, maintenance hatch, exhaust stack.
  box((-2.1,6.55,1.5),(1.3,.6,1.0),'metal');cyl((-2.1,7.05,1.5),.24,.7,'metal')
  box((0,6.5,-3.5),(5.7,.18,.25),'wood');box((0,7.2,-3.5),(5.9,1.6,.14),'black',False);panel(0,7.2,-3.59,5.85,1.94,'sign')
  for x in [-2.45,2.45]:beam((x,6.25,-3.4),(x,8.2,-3.4),.12,'metal')
  # Dimensional giant ramen bowl, noodles, egg and chopsticks.
  ring(0,7.3,-.6,.65,1.1,.65,'red',32,False);ring(0,7.95,-.6,1.1,1.13,.06,'gold',32,False);cyl((0,7.96,-.6),1.02,.05,'gold',32,False)
  for k in range(4):
   rr=.22+k*.22
   for j in range(12):
    a=j*2*math.pi/12;b=(j+1)*2*math.pi/12;beam((rr*math.cos(a),8.02,-.6+rr*math.sin(a)),(rr*math.cos(b),8.02,-.6+rr*math.sin(b)),.04,'cream',False)
  cyl((.4,8.05,-.3),.25,.06,'cream',20,False);cyl((.4,8.09,-.3),.12,.03,'amber',16,False)
  for dx in [-.12,.12]:beam((-.5+dx,7.9,-.4),(1.7+dx,9.1,-.3),.055,'wood',False)
 # Remove downward caps coincident with playable floor surfaces. Vertical posts
 # remain supported by the continuous floor, without opposing coplanar faces.
 cleaned=[]
 for vv,ff,mat,col in parts:
  keep=[]
  for face in ff:
   tri=vv[list(face)];normal=np.cross(tri[1]-tri[0],tri[2]-tri[0])
   on_floor=np.ptp(tri[:,1])<1e-7 and any(abs(tri[0,1]-h)<1e-7 for h in [.25,3.25,6.25])
   if on_floor and normal[1]<-1e-9:continue
   keep.append(face)
  if keep:cleaned.append((vv,keep,mat,col))
 return cleaned,lanterns

def merge(ps,collision=False):
 verts=[];uv=[];faces=[]
 for vv,ff,mat,col in ps:
  if collision and not col:continue
  start=len(verts);verts.extend(vv);faces.extend(tuple(start+i for i in f)for f in ff)
  x0,y0,x1,y1=rects[mat];coords=[(x0/2048,1-y1/2048),(x1/2048,1-y1/2048),(x1/2048,1-y0/2048),(x0/2048,1-y0/2048)]
  if mat in ['stone','plank'] and np.ptp(vv[:,1])<.001:
   coords=[((x0+(x+5.5)/11*(x1-x0))/2048,1-(y0+(z+5.5)/11*(y1-y0))/2048)for x,y,z in vv]
  uv.extend(coords[:len(vv)])
 return np.array(verts),np.array(faces),np.array(uv)
def objwrite(path,ps,coll=False):
 v,f,uv=merge(ps,coll)
 # TTS mesh handedness: preserve established reflected X positions; UVs remain unreflected.
 with open(path,'w')as out:
  out.write('# Lo-Bo Noodle Hut / inches / Unity OBJ handedness\n')
  for x,y,z in v:out.write(f'v {-x:.5f} {y:.5f} {z:.5f}\n')
  for u,w in uv:out.write(f'vt {u:.6f} {w:.6f}\n')
  for a,b,c in f[:,::-1]+1:out.write(f'f {a}/{a} {b}/{b} {c}/{c}\n')
 return {'vertices':len(v),'triangles':len(f),'max_height':float(v[:,1].max()),'bounds':v.min(0).tolist()+v.max(0).tolist()}
if __name__=='__main__':
 report={}
 for view in [1,2,3]:
  ps,lanterns=build(view);report[view]=objwrite(A/f'hut-view-{view}.obj',ps);objwrite(A/f'hut-view-{view}-collider.obj',ps,True)
 (ROOT/'review/geometry.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
