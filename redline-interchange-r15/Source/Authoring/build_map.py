"""Redline Interchange: original measured terrain, inches/Y up; immutable TTS assets."""
from geometry import *
from components import cyl, ladder, wall, cabinet, hvac, case, staircase, ring
from shapely import affinity
import copy, hashlib, re, sys

ROOT=Path(__file__).resolve().parents[1]
ASSET=ROOT/'Assets'
import geometry as G
G.ASSET=ASSET
REV=sys.argv[1] if len(sys.argv)>1 else 'main'
URL=f'https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/{REV}/redline-interchange-r3/Assets/'
TAG='LoboMap:RedlineInterchangeR3'
import architecture as A
def station_building(w,d,f,level,role,style):
 A.COVER_SITES=[]
 return A.building(w,d,f,level,role,style,dict(furniture=furniture,chair=chair,desk=desk,bench=bench,shelf=shelf,table=table,move=move,merge=merge))
BASE=1.; STEP=3.25
objects=[];layouts=[];building_checks=[];furniture_checks=[]

def move(m,x=0,y=0,z=0,a=0):
 r=math.radians(a);R=np.array([[math.cos(r),0,math.sin(r)],[0,1,0],[-math.sin(r),0,math.cos(r)]])
 for mm in m:mm.v=[tuple(np.array(v)@R.T+[x,y,z])for v in mm.v]
 return m

def merge(m,n):
 for a,b in zip(m,n):a.merge(b)

def chair(m,x,z,y=.15,a=0):
 q=pair()
 solid(q,(0,.51,0),(.49,.10,.49),'burgundy')
 solid(q,(0,.86,.22),(.49,.62,.09),'burgundy')
 for xx in [-.18,.18]:
  for zz in [-.18,.18]:cyl(q,(xx,0,zz),(xx,.46,zz),.025,'silver',6,False)
 merge(m,move(q,x,y,z,a))

def desk(m,x,z,y=.15,w=1.65,d=.7,a=0,computer=True):
 q=pair();solid(q,(0,.85,0),(w,.12,d),'wood')
 for xx in [-w/2+.12,w/2-.12]:solid(q,(xx,.4,0),(.14,.8,d-.12),'silver')
 if computer:
  solid(q,(0,1.2,d*.2),(.63,.43,.07),'metal')
  q[0].box((0,1.2,d*.2-.043),(.55,.34,.012),'screen')
  solid(q,(0,1.,d*.15),(.08,.25,.08),'silver')
  q[0].box((0,.93,-d*.24),(.48,.035,.2),'metal')
 merge(m,move(q,x,y,z,a))

def bench(m,x,z,y=.15,w=2.5,a=0):
 q=pair()
 for xx in [-w*.36,w*.36]:solid(q,(xx,.32,0),(.10,.64,.5),'silver')
 for i in range(4):q[0].box((0,.68,-.23+i*.15),(w,.09,.12),'wood')
 for i in range(3):q[0].box((0,.86+i*.17,.25),(w,.13,.09),'wood')
 q[1].box((0,.68,0),(w,.10,.6),tile=10000)
 q[1].box((0,1.03,.25),(w,.53,.1),tile=10000)
 merge(m,move(q,x,y,z,a))

def shelf(m,x,z,y=.15,w=1.7,a=0,kind='tools'):
 q=pair()
 for xx in [-w/2,w/2]:solid(q,(xx,1.0,0),(.075,2.,.54),'silver')
 for yy in [.12,.72,1.32,1.92]:
  solid(q,(0,yy,0),(w,.075,.6),'silver')
  for i in range(3):
   sx=-w*.32+i*w*.32
   if kind=='cafe':
    cyl(q,(sx,yy+.04,0),(sx,yy+.25,0),.075,'counter',10,False)
    cyl(q,(sx,yy+.26,0),(sx,yy+.32,0),.04,'silver',8,False)
   else:
    q[0].box((sx,yy+.21,0),(.32,.34,.4),'blue')
    q[0].box((sx,yy+.21,-.212),(.17,.08,.018),'silver')
 merge(m,move(q,x,y,z,a))

def table(m,x,z,y=.15):
 cyl(m,(x,y,z),(x,y+.85,z),.06,'silver',8)
 cyl(m,(x,y+.85,z),(x,y+.94,z),.45,'wood',20)
 cyl(m,(x,y,z),(x,y+.04,z),.32,'metal',16,False)

def furniture(m,w,d,k,role):
 y=k*STEP+.25
 if w<5.5:
  desk(m,-w/2+.425,.35,y,min(1.6,w-1),.65,90)
  chair(m,-w/2+1.0,.35,y,90)
  cabinet(m,-w/2+.5,-d/2+.55,y,.65,1.7,.65,'blue')
  return
 if role in ['cafe','mess']:
  # Functional bar, service aisle, appliances, crockery shelves and seating.
  solid(m,(-w/2+.6,y+.5,0),(.85,1.,d*.56),'blue')
  solid(m,(-w/2+.6,y+1.03,0),(1.,.10,d*.58),'wood')
  hvac(m,-w/2+.6,-d*.18,y+1.08,.5,.45,.45)
  shelf(m,-w/2+.40,d*.17,y+1.10,1.55,90,'cafe')
  cabinet(m,-w/2+.55,-d/2+.7,y,.7,1.8,.65,'silver')
  for z in [-1.2,1.2]:
   table(m,.75,z,y)
   chair(m,.75-.83,z,y,270);chair(m,.75+.83,z,y,90)
 elif role=='workshop':
  for x in [-w/2+.475,w/2-.475]:
   desk(m,x,.8,y,2.3,.75,90 if x<0 else 270,False)
   cabinet(m,x,-d/2+.7,y,.75,1.8,.65,'blue')
  shelf(m,-1.55,d/2-.35,y,1.65,180)
  for i in range(5):
   m[0].box((-w/2+.13,y+1.65+i*.12,.5),(.04,.04,1.8),'silver')
  for x in [w/2-.8]:
   cyl(m,(x,y,-.4),(x,y+.7,-.4),.22,'burgundy',12)
   cyl(m,(x,y+.7,-.4),(x,y+1.1,-.4),.045,'silver',8,False)
 elif role=='ticket':
  for x in [-w/2+.6,w/2-.6]:
   cabinet(m,x,-d/2+.65,y,.75,1.9,.55,'blue')
   m[0].box((x,y+1.25,-d/2+.355),(.5,.55,.022),'screen')
  bench(m,-w/2+.40,.8,y,2.6,90);bench(m,w/2-.40,.8,y,2.6,270)
  # Ticket/customer-service desk outside the central through route.
  desk(m,1.8,-d/2+.75,y,1.5,.75,180)
  chair(m,1.8,-d/2+1.20,y,0)
 else:
  # Operations and crew/security rooms have a partition and a clear door aisle.
  for za,zb in [(-d/2+.2,-.85),(.85,d/2-.2)]:
   solid(m,(-.5,y+1.35,(za+zb)/2),(.14,2.7,zb-za),'plaster')
  desk(m,-w/2+.45,.35,y,1.65,.7,90)
  chair(m,-w/2+1.18,.35,y,90)
  if role=='signal':
   for zz in [-1.,.2,1.4]:cabinet(m,w/2-.48,zz,y,.65,2.3,.7,'grille')
  else:
   desk(m,w/2-.45,-.6,y,1.6,.7,270)
   chair(m,w/2-1.15,-.6,y,270)
   cabinet(m,w/2-.5,-d/2+.55,y,.7,1.8,.7,'blue')
  shelf(m,-w/2+.35,d/2-.9,y,1.4,90)

def footprint(w,d,shape):
 if shape=='chamfer':
  c=1.;return Polygon([(-w/2+c,-d/2),(w/2-c,-d/2),(w/2,-d/2+c),(w/2,d/2),(-w/2,d/2),(-w/2,-d/2+c)])
 if shape=='L':return box(-w/2,-d/2,w/2,d/2).difference(box(w/2-1.5,d/2-1.5,w/2+.1,d/2+.1))
 return box(-w/2,-d/2,w/2,d/2)

def building(w,d,floors,level,role,shape):
 """level 0 ground, level 1 upper, level floors fully roofed."""
 m=pair();p=footprint(w,d,shape)
 maxfloor=floors-1 if level==floors else level
 for k in range(maxfloor+1):
  y=k*STEP
  floor=p
  # Measured stairwell at a clear rear corner; upper contents stay with floor.
  hx=w/2-.72;hz=d/2-.72
  if k:floor=p.difference(box(hx-.55,hz-.55,hx+.55,hz+.55))
  slab(m,floor,y,.25,'tile')
  coords=list(p.exterior.coords)
  for j,(a,b) in enumerate(zip(coords,coords[1:])):
   length=np.linalg.norm(np.array(a)-np.array(b))
   horizontal=abs(a[1]-b[1])<.01
   door=horizontal and length>3.5 and k==0
   wall(m,a,b,y+.25,STEP-.25,door,True,'concrete' if j%2==0 else 'plaster',skin=True,
        reserve_intervals=[(length-1.4,length)])
  furniture(m,w,d,k,role)
  # Wall-mounted cable conduits and exterior lights follow each floor state.
  for x in [-w/2+.25,w/2-.25]:
   cyl(m,(x,y+.25,-d/2-.13),(x,y+2.9,-d/2-.13),.027,'silver',7,False)
  solid(m,(0,y+2.77,-d/2-.15),(1.0,.12,.18),'metal',collision=False)
  m[0].box((0,y+2.76,-d/2-.255),(.82,.055,.035),'counter')
 if floors>1 and maxfloor>=1:ladder(m,hx,hz,STEP,base_y=.25)
 # Permanent roof ladder terminates at an opening in the parapet.
 ladder(m,-w/2-.26,d/2-.58,floors*STEP)
 # Cantilevered door canopy and cable trays add real architectural depth.
 solid(m,(0,2.78,-d/2-.55),(2.75,.14,1.15),'metal')
 for xx in [-1.05,1.05]:m[0].beam((xx,2.4,-d/2-.13),(xx,2.71,-d/2-1.06),.055,mat='silver')
 for yy in [.42,.55]:
  cyl(m,(-w/2+.22,yy,d/2+.115),(w/2-.22,yy,d/2+.115),.025,'silver',7,False)
 if role in ['workshop','mess']:
  for zz in [-1.1,-.5,.1,.7]:m[0].box((w/2+.11,1.25,zz),(.025,.65,.22),'grille')
 if level==floors:
  slab(m,p.buffer(.075,join_style=2),floors*STEP,.25,'roof')
  for (a,b) in zip(list(p.exterior.coords),list(p.exterior.coords)[1:]):
   v=np.array(b)-a;L=np.linalg.norm(v);mid=(np.array(a)+b)/2;ang=-math.degrees(math.atan2(v[1],v[0]))
   # Left-rear ladder arrival has 1.4 inches clear of parapet.
   if abs(a[0]+w/2)<.01 and abs(b[0]+w/2)<.01:
    L=max(.1,L-1.4);mid[1]-=.7
   solid(m,(mid[0],floors*STEP+.65,mid[1]),(L,.8,.16),'concrete',ang)
  hvac(m,w*.18,-d*.1,floors*STEP+.25,1.3,1.,.75)
  cabinet(m,-w*.18,d*.14,floors*STEP+.25,.65,.85,.65,'metal')
  for i in range(3):
   cyl(m,(w*.18,floors*STEP+.3+i*.08,-d*.1),(w*.18+1.4,floors*STEP+.3+i*.08,-d*.1),.025,'silver',8,False)
 return m

def train(roof):
 m=pair();L=12.;D=3.5
 outline=Polygon([(-6,-1.15),(-5.3,-1.75),(5.3,-1.75),(6,-1.15),(6,1.15),(5.3,1.75),(-5.3,1.75),(-6,1.15)])
 m=pair()
 solid(m,(0,.2,0),(10.5,.4,2.85),'metal')
 for x in [-3.65,3.65]:solid(m,(x,.3,0),(1.65,.4,3.15),'grille')
 slab(m,outline,.45,.15,'tile')
 for z in [-1.75,1.75]:
  for lo,hi in [(-5.3,-4.2),(-2.6,2.6),(4.2,5.3)]:
   solid(m,((lo+hi)/2,.95,z),(hi-lo,.7,.16),'burgundy')
  # Four passenger windows per car, down from ten; doors remain 1.6 inches.
  windows=[(-1.95,-1.05),(.65,1.55)] if z>0 else [(-1.55,-.65),(1.05,1.95)]
  for lo,hi in [(-5.3,-4.2),(-2.6,2.6),(4.2,5.3)]:
   cuts=sorted(set([lo,hi]+[v for a,b in windows for v in (max(lo,a),min(hi,b)) if lo<v<hi]))
   for a,b in zip(cuts,cuts[1:]):
    if not any(wa<(a+b)/2<wb for wa,wb in windows):
     solid(m,((a+b)/2,1.94,z),(b-a,1.22,.18),'burgundy')
   solid(m,((lo+hi)/2,1.32,z),(hi-lo,.08,.20),'silver')
  for lo,hi in windows:
   for x in [lo,hi]:solid(m,(x,1.94,z),(.08,1.22,.21),'silver')
  for x in [-5.3,-4.2,-2.6,2.6,4.2,5.3]:
   solid(m,(x,1.9,z),(.10,1.2,.18),'silver')
  solid(m,(0,2.68,z),(10.6,.36,.18),'burgundy')
  for x in [-3.4,3.4]:
   solid(m,(x,2.43,z),(1.6,.14,.19),'silver')
   # Door handles, yellow edge and anti-slip entry threshold.
   solid(m,(x,.585,z+( .16 if z>0 else -.16)),(1.6,.08,.7),'yellow')
   for xx in [-.79,.79]:cyl(m,(x+xx,.65,z),(x+xx,2.4,z),.028,'silver',8,False)
 # Tapered cab ends, real windscreen openings and wraparound frames.
 pts=list(outline.exterior.coords)
 for a,b in zip(pts,pts[1:]):
  if abs(a[1]-b[1])<1e-6 and abs(a[1])==1.75:continue
  v=np.array(b)-a;length=np.linalg.norm(v);mid=(np.array(a)+b)/2;angle=-math.degrees(math.atan2(v[1],v[0]))
  solid(m,(mid[0],1.03,mid[1]),(length,.86,.16),'burgundy',angle)
  solid(m,(mid[0],2.66,mid[1]),(length,.34,.16),'burgundy',angle)
  if abs(a[0]-b[0])>.01:
   # Cab corner glazing is opaque scenery, with physical panels closing the LoF holes.
   solid(m,(mid[0],1.98,mid[1]),(length,1.10,.12),'window',angle)
  for q in [a,b]:solid(m,(q[0],2.,q[1]),(.10,1.0,.10),'silver')
 for x in [-5.6,5.6]:
  desk(m,x,0,.6,1.65,.55,90 if x<0 else 270,True)
 # Opaque safety windscreens: the cab interrupts an end-to-end firing lane.
 # Passenger windows and door apertures remain genuinely open.
 for x in [-5.99,5.99]:
  solid(m,(x,1.98,0),(.10,1.10,2.2),'window')
  for z in [-.9,.9]:solid(m,(x,1.25,z),(.12,.18,.32),'counter',collision=False)
 # Continuous wall-backed benches eliminate sub-base gaps between individual seats.
 for sign in [-1,1]:
  bench(m,0,sign*1.36,.6,4.7,0 if sign==1 else 180)
  for x in [-1.6,-.8,0,.8,1.6]:
   m[0].box((x,1.25,sign*1.65),(.025,.52,.025),'silver')
 for sign in [-1,1]:
  for x in [-2.3,2.3]:cyl(m,(x,.62,sign*1.61),(x,2.65,sign*1.61),.025,'silver',7,False)
 if roof:
  # Closed chamfered shell. A continuous flat crown supports full bases.
  p=outline.buffer(.08,join_style=2)
  slab(m,p,2.86,.16,'roof')
  solid(m,(0,3.13,0),(10.6,.25,2.75),'silver')
  for x in [-2.6,2.6]:hvac(m,x,0,3.26,1.35,.95,.4)
  for x in [-5.2,5.2]:
   for z in [-.8,.8]:solid(m,(x,3.07,z),(.45,.08,.3),'counter',collision=False)
 return m

def platform(length=14,width=2.5):
 m=pair();solid(m,(0,.25,0),(length,.5,width),'concrete')
 for sign in [-1,1]:
  # Yellow tactile paving stays on modeled platform, away from vertical faces.
  for x in np.arange(-length/2+.15,length/2,.34):
   m[0].box((x,.507,sign*(width/2-.16)),(.22,.012,.16),'yellow')
 # Two broad end ramps, no unsupported stair ends.
 for sign in [-1,1]:
  a=length/2;run=1.75
  for i in range(8):
   h=.5*(8-i)/8
   solid(m,(sign*(a+run*(i+.5)/8),h/2,0),(run/8,h,width),'concrete')
 return m

def concourse(roof):
 m=pair();w=17.5;d=2.75;floor=3.25
 solid(m,(0,floor-.10,0),(w,.2,d),'metal')
 for x in [-8.,-4.,4.,8.]:
  for z in [-1.21,1.21]:solid(m,(x,1.6,z),(.28,3.2,.28),'concrete')
 for sign in [-1,1]:
  z=sign*d/2;cx=sign*7.5;lo=cx-1.15;hi=cx+1.15
  # Two 2.30-inch openings face the real top stair treads, not the open ends.
  for a,b in [(-w/2,lo),(hi,w/2)]:
   solid(m,((a+b)/2,floor+.45,z),(b-a,.9,.18),'concrete')
   solid(m,((a+b)/2,floor+1.85,z),(b-a,1.9,.18),'blue')
  for x in np.arange(-8.5,8.6,1.7):
   if lo-.035<x<hi+.035:continue
   for face in [-1,1]:m[0].box((x,floor+1.85,z+face*.105),(.07,1.9,.035),'silver')
  # Full-depth jambs are outside the clear opening; header clears standing S2.
  for x in [lo-.025,hi+.025]:solid(m,(x,floor+1.35,z),(.05,2.7,.22),'silver')
  solid(m,(0,floor+2.8,z),(w,.20,.18),'metal')
  # Flush steel threshold bridges the seam between top tread and deck edge.
  solid(m,(cx,floor-.05,sign*1.375),(2.30,.10,.31),'metal')
 if roof:
  solid(m,(0,floor+2.99,0),(w+.15,.18,d+.18),'roof')
  for x in np.arange(-8.5,8.6,1.7):
   for z in [-d/2,d/2]:m[0].beam((x,floor+2.9,z),(x,floor+3.2,0),.075,mat='silver')
 return m

def transformer():
 m=pair();solid(m,(0,.10,0),(4.,.20,3.),'concrete')
 for x in [-.95,.95]:
  solid(m,(x,1.2,0),(1.45,2.0,1.9),'blue')
  for i in range(8):m[0].box((x,1.2,-1.0-i*.045),(1.4,1.65,.026),'silver')
  for z in [-.55,.55]:
   cyl(m,(x,2.2,z),(x,2.65,z),.09,'metal',10)
   for y in [2.25,2.38,2.51]:cyl(m,(x,y,z),(x,y+.055,z),.16,'counter',10,False)
 for z in [-1.4,1.4]:solid(m,(0,1.45,z),(4.,2.5,.18),'concrete')
 return m

def utility(kind):
 m=pair()
 if kind=='cabinet':
  for x in [-.6,.6]:cabinet(m,x,0,0,1.,2.3,.9,'blue')
  solid(m,(0,.06,0),(2.65,.12,1.4),'concrete')
 elif kind=='screen':
  solid(m,(0,1.25,0),(3.5,2.5,.5),'concrete')
  for x in [-1.4,1.4]:solid(m,(x,.15,0),(.35,.3,1.2),'metal')
  for i in range(5):m[0].box((0,.6+i*.33,-.27),(3.1,.13,.025),'burgundy')
 elif kind=='hvac':
  solid(m,(0,.08,0),(3.2,.16,2.),'concrete');hvac(m,0,0,.16,2.9,1.8,2.2)
 elif kind=='luggage':
  for x in [-.75,.75]:
   for z in [-.45,.45]:cyl(m,(x,.17,z-.05),(x,.17,z+.05),.17,'metal',10,False)
  solid(m,(0,.37,0),(1.9,.16,1.2),'silver')
  for x,sz in [(-.5,.7),(.35,.85)]:
   case(m,x,0,.45,sz,.85,.85,'burgundy' if x<0 else 'blue')
   m[0].beam((x-.13,1.31,-.16),(x+.13,1.31,-.16),.035,mat='silver')
  for z in [-.5,.5]:cyl(m,(-.9,.45,z),(-.9,1.2,z),.025,'silver',7,False)
  cyl(m,(-.9,1.2,-.5),(-.9,1.2,.5),.025,'silver',7,False)
 elif kind=='workrack':
  shelf(m,0,0,0,2.6,0)
  for x in [-.8,.8]:case(m,x,.8,0,.7,.6,.7,'blue')
 elif kind=='bench':bench(m,0,0,0,2.8)
 elif kind=='kiosk':
  solid(m,(0,1.2,0),(1.5,2.4,1.2),'blue')
  m[0].box((0,1.6,-.615),(1.1,.7,.025),'screen')
  for x in [-.4,.4]:m[0].box((x,.7,-.63),(.55,.65,.035),'window')
 return m

def model(key,m,x,z,a=0,label=None,kind='scenery',y=BASE):
 # Rotate scenery and mat together; keep the X-edge deployment/UI configuration.
 x,z,a=z,-x,(a+90)%360
 G.register(key,m)
 if kind in ['building','building-state']:
  for site in A.COVER_SITES:furniture_checks.append(dict(mesh=key,**site))
 lo,hi=m[0].bounds();h=hi[1]-lo[1]
 guid=hashlib.sha256(('RedlineR3:'+key).encode()).hexdigest()[:6]
 o={'GUID':guid,'Name':'Custom_Model','Nickname':label or key,'Description':f'Height (base to top): {h:.2f} in\nRedline Interchange | Cutthroat | 48 × 48 inches.\nUse normal Infinity movement, cover and line-of-fire rules.','Transform':dict(posX=x,posY=y,posZ=z,rotX=0,rotY=a,rotZ=0,scaleX=1,scaleY=1,scaleZ=1),'ColorDiffuse':dict(r=1,g=1,b=1),'Locked':True,'Grid':False,'Snap':False,'Hands':False,'Tooltip':True,'DragSelectable':True,'Tags':[TAG,'RedlineInterchange',kind],'CustomMesh':dict(MeshURL=URL+key+'.obj',DiffuseURL=URL+'redline-materials.png',ColliderURL=URL+key+'-collider.obj',Convex=True,MaterialIndex=3,TypeIndex=0,CastShadows=True),'LuaScript':'function onLoad() self.setLock(true) end\n','LuaScriptState':'','XmlUI':''}
 poly=Polygon(np.array(m[1].v)[:,[0,2]]).convex_hull if m[1].v else Polygon()
 poly=affinity.rotate(poly,-a,origin=(0,0));poly=affinity.translate(poly,x,z)
 layouts.append(dict(guid=guid,mesh=key,label=label or key,x=x,z=z,angle=a,y=y,kind=kind,bounds=[lo,hi],footprint=list(poly.exterior.coords)if not poly.is_empty else []))
 return o

SPECS=[
 ('Station Operations',-17.,-17.,7.,6.,2,'office','stepped',0),
 ('West Ticket Hall',-17.,-1.,8.,7.,1,'ticket','barrel',0),
 ('Traction Workshop',-17.,16.5,7.5,7.,1,'workshop','sawtooth',0),
 ('Dispatch Administration',17.,17.,7.5,6.,2,'office','octagon',180),
 ('Platform Cafe',17.,1.,8.,7.,1,'cafe','pavilion',180),
 ('Crew Mess',17.,-16.5,7.5,6.5,1,'mess','gable',180),
 ('Signal Relay House',-1.,-20.,6.,4.,1,'signal','capsule',0),
 ('Parcel Office',1.,20.,6.5,4.5,1,'office','loading',180),
 ('South Security Office',8.,-19.,4.,4.,1,'office','booth',45),
 ('North Service Office',-8.,19.,4.,4.,1,'office','container',225),
]
for name,x,z,w,d,f,role,shape,a in SPECS:
 key=re.sub('[^a-z0-9]+','-',name.lower())
 o=model(key+'-ground',station_building(w,d,f,0,role,shape),x,z,a,name+' | Ground floor exposed','building')
 o['States']={}
 for level in range(1,f+1):
  lab='Roof on' if level==f else 'Upper floor exposed'
  o['States'][str(level+1)]=model(key+'-'+('roof'if level==f else 'upper'),station_building(w,d,f,level,role,shape),x,z,a,name+' | '+lab,'building-state')
 for q in [o]+list(o['States'].values()):
  q['CustomMesh']['DiffuseURL']=URL+'redline-architecture.png'
  q['Description']+='\nStates: 1 ground floor; '+('2 upper floor; 3 roof on.'if f==2 else '2 roof on.')+' Roof ladder stays attached.'
 objects.append(o)
 building_checks.append(dict(name=name,x=z,z=-x,w=w,d=d,floors=f,role=role,shape=shape,angle=(a+90)%360,main=o['GUID'],states=list(o['States'])))

for index,(x,z,a) in enumerate([(-3.,-10.5,0),(3.,10.5,180)]):
 name='Redline passenger car '+str(index+1);key='passenger-car-'+str(index+1)
 o=model(key+'-open',train(False),x,z,a,name+' | Passenger deck exposed','train');o['States']={}
 o['States']['2']=model(key+'-roof',train(True),x,z,a,name+' | Roof on','train-state')
 for q in [o,o['States']['2']]:q['Description']+='\nState 1 passenger deck; State 2 roof on. Four side doors, furnished passenger aisle and cab consoles. Train is stationary scenery; no extra mission effects.'
 objects.append(o)
 # The maglev guideway has transverse joints and a low running surface.
 m=pair();solid(m,(0,.035,0),(48.,.07,3.7),'asphalt')
 for zz in [-1.,1.]:
  solid(m,(0,.09,zz),(48.,.11,.12),'silver')
 for xx in np.arange(-23.7,23.71,.65):m[0].box((xx,.075,0),(.14,.035,2.9),'metal')
 objects.append(model('guideway-'+str(index+1),m,0,z,0,'Continuous rail track '+str(index+1),'guideway'))
 objects.append(model('platform-'+str(index+1),platform(),x,z+(3.35 if index==0 else -3.35),0,'Passenger platform '+str(index+1)+' | 0.50-inch deck','platform'))

o=model('concourse-open',concourse(False),0,0,0,'Elevated concourse | Deck exposed','bridge')
o['States']={'2':model('concourse-roof',concourse(True),0,0,0,'Elevated concourse | Roof on','bridge-state')}
for q in [o,o['States']['2']]:q['Description']+='\nState 1 playable elevated deck; State 2 roof on. Deck 3.25 inches above ground. Supported 2.4-inch clear corridor; open underside. Stair access at both ends.'
objects.append(o)
for i,(x,sign) in enumerate([(-7.5,-1),(7.5,1)]):
 m=pair();staircase(m,0,-5.9,2.5,4.525,3.25)
 if sign==1:move(m,a=180)
 objects.append(model('concourse-stairs-'+str(i+1),m,x,0,0,'Concourse stair '+str(i+1),'stair'))

# Screened traction supply yards are deliberate sealed machinery, not rooms.
for i,(x,z,a) in enumerate([(-10.5,7.,0),(10.5,-7.,180)]):
 objects.append(model('traction-supply-'+str(i+1),transformer(),x,z,a,'Screened traction supply '+str(i+1)+' | Sealed machinery','machinery'))

SCATTER=[
 ('cabinet',-22.,-8.,90),('cabinet',22.,8.,270),
 ('hvac',-21.5,7.,0),('hvac',21.5,-7.,180),
 ('screen',-10.5,-17.,90),('screen',10.5,17.,270),
 ('screen',-3.,3.75,45),('screen',3.,-3.75,225),
 ('screen',-10.5,1.,0),('screen',10.5,-1.,180),
 ('cabinet',-4.,15.,0),('cabinet',4.,-15.,180),
 ('hvac',-11.,-4.5,90),('hvac',11.,4.5,270),
 ('screen',-20.5,-23.,0),('screen',20.5,23.,180),
 ('screen',-21.,22.,0),('screen',21.,-22.,180),
 ('cabinet',-22.5,0.,90),('cabinet',22.5,0.,270),
 ('luggage',-3.5,-7.1,0),('luggage',3.5,7.1,180),
 ('bench',1.,-7.1,0),('bench',-1.,7.1,180),
 ('kiosk',-12.5,-7.1,90),('kiosk',12.5,7.1,270),
 ('workrack',-16.,21.,180),('workrack',16.,-21.,0),
 ('cabinet',-9.,-22.,0),('cabinet',9.,22.,180),
 ('screen',-3.,-15.5,0),('screen',3.,15.5,180),
 ('hvac',4.5,-22.75,0),('hvac',-4.5,22.75,180),
]
for i,(kind,x,z,a) in enumerate(SCATTER):
 y=BASE+.5 if kind in ['luggage','bench'] else BASE
 objects.append(model('service-'+str(i+1),utility(kind),x,z,a,kind.title()+' service group '+str(i+1),'scatter',y))

# Genuine, legible station signs on façade mounts. They use their own atlas.
sign_indices=[3,4,6,3,5,7,9,10,7,13]
for i,(name,x,z,w,d,f,role,shape,a) in enumerate(SPECS):
 m=pair();solid(m,(0,2.43,-d/2-.205),(2.25,.46,.065),sign_indices[i])
 o=model('station-sign-'+str(i+1),m,x,z,a,name+' | Entrance sign','sign')
 o['CustomMesh']['DiffuseURL']=URL+'redline-signs.png';objects.append(o)
for i,(x,z,a,text_index) in enumerate([(-9.8,-7.2,90,1),(9.8,7.2,270,2),(-21,-12.5,0,0),(21,12.5,180,0)]):
 m=pair()
 for xx in [-1.05,1.05]:solid(m,(xx,1.4,0),(.08,2.8,.08),'silver')
 # Sign plaque is separate from posts because material atlases differ.
 sy=BASE+.5 if i<2 else BASE
 objects.append(model('wayfinding-post-'+str(i+1),m,x,z,a,'Station wayfinding posts '+str(i+1),'sign-post',sy))
 m=pair();solid(m,(0,2.55,0),(2.4,.6,.10),text_index)
 o=model('wayfinding-sign-'+str(i+1),m,x,z,a,'Station wayfinding '+str(i+1),'sign',sy)
 o['CustomMesh']['DiffuseURL']=URL+'redline-signs.png';objects.append(o)

# Modest station edge furniture, bollards and work equipment stay grouped by use.
for i,(x,z,a) in enumerate([(-12.3,19.7,0),(12.3,-19.7,180),(-12.3,-20.7,0),(12.3,20.7,180)]):
 m=pair()
 for xx in [-.8,0,.8]:
  cyl(m,(xx,0,0),(xx,.72,0),.09,'metal',10)
  cyl(m,(xx,.51,0),(xx,.64,0),.094,'yellow',10,False)
 objects.append(model('service-bollards-'+str(i+1),m,x,z,a,'Grouped service bollards '+str(i+1),'scatter'))

# Model ground at precisely 48 inches. UV projection is continuous in world XZ.
ground=pair();solid(ground,(0,-.06,0),(48,.12,48),'asphalt')
for mm in ground:mm.uv=[((x+24)/48,(z+24)/48)for x,y,z in mm.v]
mat=model('redline-ground',ground,0,0,label='Redline Interchange | 48 × 48 inch ground',kind='ground')
mat['CustomMesh'].update(DiffuseURL=URL+'redline-ground.png',MaterialIndex=3,CustomShader=dict(SpecularColor=dict(r=0,g=0,b=0),SpecularIntensity=0,SpecularSharpness=2,FresnelStrength=0))
mat['DragSelectable']=False
mat['ColorDiffuse']=dict(r=1,g=1,b=1)
mat['Description']='48 × 48 inches. ITS18 Cutthroat. 300 points. Player edges X=-24/+24; 16-inch DZ fronts X=-8/+8. No fixed mission objectives, HVTs or added special terrain. Remove this anchor to clear this map.'
mat['LuaScript']='''function onLoad() self.setLock(true) end
function onDestroy()
 if Global.getVar('clearingRedlineR3') then return end
 Global.setVar('clearingRedlineR3',true)
 local list={};for _,o in ipairs(getAllObjects())do if o~=self and o.hasTag('''+json.dumps(TAG)+''')then list[#list+1]=o end end
 for _,o in ipairs(list)do o.destruct()end
 Global.setVar('clearingRedlineR3',false)
end
'''
objects.insert(0,mat)

template=json.load(open(ROOT/'Source/reference-bag.json'))['ObjectStates'][0]
controller=copy.deepcopy(next(o for o in template['ContainedObjects']if 'local universalConfig='in o.get('LuaScript','')))
controller['GUID']='cefffe';controller['Nickname']='Redline Interchange | Map Controls';controller['Tags']=[TAG,'controller'];controller['Transform'].update(posX=0,posY=24,posZ=0)
script=controller['LuaScript'].replace('d60000',mat['GUID']).replace('d6fffe','cefffe').replace('LoboMap:8102b2',TAG).replace('Sirocco Wells','Redline Interchange').replace('SIROCCO WELLS','REDLINE INTERCHANGE').replace('PROVISIONING |','CUTTHROAT |')
script=script.replace('thickness=.025/width','thickness=.085/width').replace('thickness=.015/width','thickness=.055/width')
def config(name,fn):
 global script
 match=re.search(r'local '+name+r'=JSON.decode\((".*")\)',script);d=json.loads(json.loads(match[1]));fn(d)
 script=script[:match.start(1)]+json.dumps(json.dumps(d,ensure_ascii=False))+script[match.end(1):]
config('backgroundConfig',lambda d:d.update(day=URL+'redline-day.png',night=URL+'redline-night.png',category='Redline Interchange'))
config('universalConfig',lambda d:d.update(mat=mat['GUID'],shape='rect',depth=16,surface=BASE,tag=TAG))
pages=[
 ('Mission','Cutthroat | Redline Interchange','ITS Season 18: Overheat, version 2026.09.11; 300 points; 48 × 48 inches. Losers Round 3 design. No fixed objectives.\n\nThe current season PDF takes precedence over the older standalone scenario page.\nOfficial season rules:\nhttps://experience.corvusbelli.com/en/infinity/its'),
 ('Scoring','Lieutenant combat scoring','At game end: Kill more Army Points: 3 OP. Kill more Lieutenants: 3 OP; alternatively tie Lieutenant kills with at least one enemy Lieutenant killed: 2 OP. Kill more enemy Troopers with any of your Lieutenants: 4 OP.\n\nRecord which Lieutenants caused kills throughout the game. There is no separate Key Ops selection in the current season scoring.'),
 ('Deployment','16-inch deployment','Deploy from opposite X edges, X=-24 and X=+24. Each DZ is 16 inches deep; fronts at X=-8/+8. No Exclusion Zone. No fixed objectives, HVT or Classified Deck.\n\nDZ +4 and DZ +8 are independent measuring aids, not additional legal deployment permissions. Labels face the corresponding player.'),
 ('Lieutenants','Reinforced Tactical Link','Loss of Lieutenant does not apply. The Lieutenant identity is Open Information, including its Marker(s). The Lieutenant must be on the table as a Model or Marker by the first Game Round; no Hidden Deployment.\n\nIf your Tactical Phase begins without an eligible Lieutenant because it is undeployed, Isolated or in a Null State, name a replacement on-table Model or Marker without spending an Order. Its identity is Open Information. Consult the current ITS18 PDF for complete wording.'),
 ('Terrain','Station terrain and interiors','Normal Infinity geometry, cover, movement and line of fire apply. Trains are stationary scenery; rails, platforms and ground add no special terrain effects.\n\nBuildings: state 1 ground floor; state 2 upper floor where present; final state roof on. Passenger cars: state 1 passenger deck; state 2 roof on. Bridge: state 1 elevated deck; state 2 roof on.\n\nTrains and all ordinary buildings have playable interiors. Traction supply machines are sealed scenery. Roofs, floors, upper furniture and ladders follow their respective states.'),
 ('Controls','Controls and game end','Right-side drawer: DZ, DZ +4, DZ +8, Booty, Metachemistry, per-player Mission tabs, Day, Night and Background Off. Grid and snapping start off.\n\nThree Game Rounds. No Quarter: Retreat! does not apply.\n\nClear Table removes map components and alternate states while preserving unrelated miniatures, and restores the previous background/lighting.\n\nReview build: live TTS physics, independent multiplayer loading and side-swapped play remain to be verified.'),
]
page_lua='local siroccoPages={\n'+',\n'.join('{tab='+json.dumps(a)+',title='+json.dumps(b,ensure_ascii=False)+',body='+json.dumps(c,ensure_ascii=False)+'}'for a,b,c in pages)+'\n}'
script=re.sub(r'local siroccoPages=\{.*?\n\}',lambda m:page_lua,script,count=1,flags=re.S)
script=re.sub(r'local function siroccoDraw\(\).*?\nend\nlocal function siroccoMount','local function siroccoDraw()\n local mat=getObjectFromGUID(siroccoMat)\n if mat then loboUniversalWrite(mat,{})end\nend\nlocal function siroccoMount',script,count=1,flags=re.S)
controller['LuaScript']=script;controller['LuaScriptState']='';controller['XmlUI']='';controller['Description']='Current right-side Cutthroat controls, deployment aids, Booty/Metachemistry, mission references and day/night ambience.'
objects.append(controller)
bag=copy.deepcopy(template);bag['GUID']='ce0000';bag['Nickname']='SET_ITS18 Cutthroat — Redline Interchange R3'
bag['Description']='Drop on STAGE > DROP BAGS HERE.\nRedline Interchange | Weathered maglev terminal.\n48 × 48 inches, 300-point Cutthroat, 16-inch DZs from X edges. No fixed objectives.\n10 furnished station buildings, two playable passenger cars, elevated concourse, connected stairs and platforms, traction yards and purposeful service scatter.\nState 1 lowest playable floor; fully roofed view last. Individual day/night backgrounds and current right-side controls.\nREVIEW BUILD: Live TTS physics, independent loading, whole-army deployment and side-swapped play are not yet verified.'
bag['Tags']=['RedlineInterchangeR3'];bag['ContainedObjects']=objects;bag['ColorDiffuse']=dict(r=.44,g=.16,b=.19)
records=[]
for o in objects:
 for q in [o]+list(o.get('States',{}).values()):records.append('--'+q['GUID']+','+','.join(f"{q['Transform'][k]:.6f}"for k in ['posX','posY','posZ','rotX','rotY','rotZ']))
bag['LuaScript']='\r\n'.join(records)+'\r\n';bag['LuaScriptState']=''
(ROOT/'Map-Bags/Redline-Interchange-Cutthroat-R3.json').write_text(json.dumps({'ObjectStates':[bag]},ensure_ascii=False,separators=(',',':'))+'\n')
(ROOT/'Source/furniture-cover-sites.json').write_text(json.dumps(furniture_checks,indent=2))
(ROOT/'Source/layout.json').write_text(json.dumps(layouts,indent=2))
(ROOT/'Source/buildings.json').write_text(json.dumps(building_checks,indent=2))
(ROOT/'Source/deployment-config.json').write_text(json.dumps({bag['GUID']:dict(mat=mat['GUID'],shape='rect',depth=16,surface=BASE,tag=TAG)},indent=2))
(ROOT/'Source/mission-pages.json').write_text(json.dumps(pages,ensure_ascii=False,indent=2))
print(json.dumps(dict(objects=len(objects),buildings=len(SPECS),states=sum(len(o.get('States',{}))for o in objects),meshes=len(G.meshes),triangles=sum(len(x['visual'].f)for x in G.meshes.values()))))
