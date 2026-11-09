"""Ten distinct station building forms, with closed component colliders."""
from geometry import *
from components import cyl,ladder,cabinet,hvac,case
from shapely import affinity
GAP=1.8
COVER_SITES=[]
from furniture_cover import sites_for

def plan(w,d,style):
 if style=='stepped':return box(-w/2,-d/2,w/2,d/2).difference(box(w/2-1.5,d/2-1.5,w/2+.1,d/2+.1))
 if style in ['octagon','booth']:
  c=1.25 if style=='octagon'else .75
  return Polygon([(-w/2+c,-d/2),(w/2-c,-d/2),(w/2,-d/2+c),(w/2,d/2-c),(w/2-c,d/2),(-w/2+c,d/2),(-w/2,d/2-c),(-w/2,-d/2+c)])
 if style=='pavilion':
  r=1.35;pts=[(-w/2,d/2),(w/2,d/2),(w/2,-d/2+r)]
  for a in np.linspace(0,-math.pi/2,7)[1:]:pts.append((w/2-r+r*math.cos(a),-d/2+r+r*math.sin(a)))
  pts.append((-w/2+r,-d/2))
  for a in np.linspace(-math.pi/2,-math.pi,7)[1:]:pts.append((-w/2+r+r*math.cos(a),-d/2+r+r*math.sin(a)))
  return Polygon(pts)
 if style=='capsule':
  r=d/2;c=w/2-r
  pts=[(c+r*math.cos(a),r*math.sin(a))for a in np.linspace(-math.pi/2,math.pi/2,13)]
  pts +=[(-c+r*math.cos(a),r*math.sin(a))for a in np.linspace(math.pi/2,3*math.pi/2,13)]
  return Polygon(pts)
 return box(-w/2,-d/2,w/2,d/2)

def panel(m,points,thickness=.16,mat='roof'):
 """Closed sloping roof panel, visual and collision use the same envelope."""
 ps=np.array(points,float);normal=np.cross(ps[1]-ps[0],ps[2]-ps[0]);normal/=np.linalg.norm(normal)
 if normal[1]<-.001:normal=-normal
 bottom=[tuple(p-normal*thickness)for p in ps]
 for mm in m:
  start=len(mm.f);mm.groups.append(start)
  if mm is m[0]and len(points)==4:
   mm.quad(*points,mat=mat,tile=1.25 if mat==13 else 2.)
  else:
   for i in range(1,len(points)-1):mm.face([points[0],points[i],points[i+1]],mat)
  for i in range(1,len(points)-1):
   mm.face([bottom[0],bottom[i+1],bottom[i]],mat)
  for p,q,bp,bq in zip(points,points[1:]+points[:1],bottom,bottom[1:]+bottom[:1]):mm.face([p,bp,bq,q],mat)

def wall(m,a,b,y,h,mat='plaster',door=False,window=True,service=False):
 a,b=np.array(a,float),np.array(b,float);v=b-a;L=float(np.linalg.norm(v));u=v/L
 openings=[];dc=L/2
 if door and L>1.95:openings.append((dc-GAP/2,dc+GAP/2,0,2.25))
 if window and L>1.5:
  count=max(1,int((L-.45)/1.65))
  for c in np.linspace(1.,L-1.,count)if count>1 else [L/2]:
   width=min(1.1,L-.65)
   lo,hi=c-width/2,c+width/2
   p=a+u*c
   if lo<.24 or hi>L-.24:continue
   if door and hi>dc-GAP/2-.16 and lo<dc+GAP/2+.16:continue
   if service and abs(p[1])<.95:continue
   openings.append((lo,hi,1.05,min(2.3,h-.25)))
 xs=sorted(set([0,L]+[t for o in openings for t in o[:2]]));ys=sorted(set([0,.42,h]+[t for o in openings for t in o[2:]]))
 angle=-math.degrees(math.atan2(u[1],u[0]))
 for x1,x2 in zip(xs,xs[1:]):
  for y1,y2 in zip(ys,ys[1:]):
   cx,cy=(x1+x2)/2,(y1+y2)/2
   if any(lo<cx<hi and bottom<=cy<top for lo,hi,bottom,top in openings):continue
   if min(x2-x1,y2-y1)<.002:continue
   p=a+u*cx;solid(m,(p[0],y+cy,p[1]),(x2-x1,y2-y1,.20),'metal' if cy<.42 else mat,angle)
 for lo,hi,bottom,top in openings:
  for x in [lo,hi]:
   p=a+u*x;m[0].box((p[0],y+(bottom+top)/2,p[1]),(.055,top-bottom,.245),'metal',angle)
  p=a+u*((lo+hi)/2)
  for yy in [bottom,top]:m[0].box((p[0],y+yy,p[1]),(hi-lo+.08,.06,.26),'metal',angle)
  if bottom:m[0].box((p[0],y+bottom-.045,p[1]),(hi-lo+.15,.075,.38),'silver',angle)

def roof(m,p,w,d,y,style):
 # No repeated flat parapet boxes: each function has a distinct silhouette.
 if style=='barrel':
  n=18
  def h(x):return y+.20+1.25*math.sin(math.pi*(x+w/2)/w)
  for i in range(n):
   xa=-w/2+i*w/n;xb=-w/2+(i+1)*w/n
   panel(m,[(xa,h(xa),-d/2-.12),(xb,h(xb),-d/2-.12),(xb,h(xb),d/2+.12),(xa,h(xa),d/2+.12)],mat='roof')
   if i%3==0:m[0].beam((xa,h(xa)+.025,-d/2-.15),(xa,h(xa)+.025,d/2+.15),.055,mat='metal')
   for z in [-d/2,d/2]:
    pts=[(xa,y,z),(xb,y,z),(xb,h(xb)-.16,z),(xa,h(xa)-.16,z)]
    panel(m,pts,.10,'plaster')
  solid(m,(0,y+1.50,0),(1.75,.10,d+.22),'grating')
 elif style=='sawtooth':
  for i in range(3):
   a=-d/2+i*d/3;b=a+d/3;c=b-.45
   panel(m,[(-w/2-.1,y+.2,a),(w/2+.1,y+.2,a),(w/2+.1,y+1.25,c),(-w/2-.1,y+1.25,c)],mat='roof')
   panel(m,[(-w/2-.1,y+1.25,c),(w/2+.1,y+1.25,c),(w/2+.1,y+.2,b),(-w/2-.1,y+.2,b)],mat='screen')
   for x in [-w/2,w/2]:
    panel(m,[(x,y,a),(x,y,c),(x,y+1.09,c),(x,y+.04,a)],.10,'plaster')
    panel(m,[(x,y,c),(x,y,b),(x,y+.04,b),(x,y+1.09,c)],.10,'plaster')
   for x in np.arange(-w/2+.2,w/2,.8):m[0].beam((x,y+1.28,c),(x,y+.23,b),.045,mat='silver')
 elif style=='gable':
  high=y+1.50;low=y+.20
  panel(m,[(-w/2-.18,low,-d/2-.18),(0,high,-d/2-.18),(0,high,d/2+.18),(-w/2-.18,low,d/2+.18)],mat='roof')
  panel(m,[(0,high,-d/2-.18),(w/2+.18,low,-d/2-.18),(w/2+.18,low,d/2+.18),(0,high,d/2+.18)],mat='roof')
  for z in [-d/2,d/2]:panel(m,[(-w/2,y,z),(w/2,y,z),(w/2,low-.16,z),(0,high-.16,z),(-w/2,low-.16,z)],.1,'plaster')
  solid(m,(w*.25,y+1.,d*.22),(.65,1.75,.65),'plaster')
  solid(m,(w*.25,y+1.95,d*.22),(.82,.16,.82),'concrete')
 elif style in ['loading','container']:
  low=y+.20;high=y+(.80 if style=='loading'else .45)
  panel(m,[(-w/2-.15,low,-d/2-.6),(w/2+.15,low,-d/2-.6),(w/2+.15,high,d/2+.12),(-w/2-.15,high,d/2+.12)],mat='roof')
  # Close the ends beneath the sloping roof; nothing floats above the walls.
  for x in [-w/2,w/2]:panel(m,[(x,y,-d/2),(x,y,d/2),(x,high-.16,d/2),(x,low-.16,-d/2)],.10,'plaster')
  panel(m,[(-w/2,y,d/2),(w/2,y,d/2),(w/2,high-.16,d/2),(-w/2,high-.16,d/2)],.10,'plaster')
 elif style=='booth':
  slab(m,p.buffer(.15,join_style=2),y,.15,'roof')
  coords=list(p.buffer(.15,join_style=2).exterior.coords)[:-1]
  for a,b in zip(coords,coords[1:]+coords[:1]):panel(m,[(a[0],y+.2,a[1]),(b[0],y+.2,b[1]),(0,y+1.,0)],.12,'roof')
 elif style=='capsule':
  slab(m,p.buffer(.12,join_style=2),y,.25,'roof')
  for z in [-.85,.85]:
   cyl(m,(-w/2+.5,y+.32,z),(w/2-.5,y+.32,z),.045,'silver',8,False)
  hvac(m,0,.1,y+.25,1.35,1.1,.5)
 elif style=='pavilion':
  slab(m,p.buffer(.22,join_style=1),y,.25,'roof')
  slab(m,p.buffer(-.18,join_style=1),y+.25,.10,'roof')
  # A shallow, closed oval clerestory dome is architecture, not an open roof gap.
  top=Point(0,0).buffer(1.15,quad_segs=12);top=affinity.scale(top,1.25,.72)
  slab(m,top,y+.35,.22,'screen')
  for a in np.linspace(0,math.tau,16,endpoint=False):
   x=1.4375*math.cos(a);z=.828*math.sin(a);m[0].beam((x,y+.39,z),(0,y+.73,0),.035,mat='silver')
 else:
  roofplan=p.buffer(.10,join_style=2)
  if style=='octagon':roofplan=roofplan.difference(box(.55,.70,2.15,2.40))
  slab(m,roofplan,y,.25,'roof')
  coords=list(p.exterior.coords)
  for a,b in zip(coords,coords[1:]):
   a,b=np.array(a),np.array(b);v=b-a;L=np.linalg.norm(v);mid=(a+b)/2
   if abs(mid[0]-p.bounds[0])<.12 and abs(mid[1])<1.:continue
   solid(m,(mid[0],y+.65,mid[1]),(L,.8,.18),'concrete',-math.degrees(math.atan2(v[1],v[0])))
  if style=='octagon':
   # Faceted control-room roof equipment differs from office HVAC repetition.
   cyl(m,(0,y+.25,0),(0,y+1.,0),.62,'metal',8)
   cyl(m,(0,y+1.,0),(0,y+1.65,0),.045,'silver',8,False)
   for yy in [y+1.12,y+1.4]:m[0].beam((-.5,yy,0),(.5,yy,0),.035,mat='silver')

def building(w,d,floors,level,role,style,kit):
 m=pair();p=plan(w,d,style);H=2.75 if style in ['capsule','booth','container']else 3.25
 current=floors-1 if level==floors else level
 for k in range(current+1):
  y=k*3.25
  upper=style=='stepped'and k==1
  wallplan=box(-1.25,-2.25,2.75,2.25)if upper else p
  # Upper office has a wide, usable terrace on the retained lower roof.
  floorplan=p if upper else wallplan
  if style=='octagon' and k>0:floorplan=floorplan.difference(box(.55,.70,2.15,2.40))
  slab(m,floorplan,y,.25,'tile'if not upper else 'roof')
  wallmat='plaster'
  coords=list(wallplan.exterior.coords)
  for a,b in zip(coords,coords[1:]):
   a,b=np.array(a),np.array(b);L=float(np.linalg.norm(b-a));mid=(a+b)/2
   horizontal=abs(a[1]-b[1])<.01
   minx=wallplan.bounds[0]
   isleft=abs(mid[0]-minx)<.12
   door=(horizontal and L>1.95 and k==0)or(k==1 and isleft and L>2.)
   wall(m,a,b,y+.25,H-.25,wallmat,door,not(style=='stepped' and k==1 and isleft),isleft)
  if style=='stepped'and upper:
   q=pair();kit['furniture'](q,4.,4.5,0,'office');kit['move'](q,3.225,y,0);kit['merge'](m,q)
  elif style=='octagon':
   for sign in [-1,1]:
    kit['desk'](m,sign*2.25,-.45 if sign>0 else 0,y+.25,1.65,.70,90 if sign<0 else 270)
    kit['chair'](m,sign*2.0,-.45 if sign>0 else 0,y+.25,90 if sign<0 else 270)
    cabinet(m,sign*1.65,-1.95,y+.25,.65,1.8,.65,'blue')
   for za,zb in [(-1.7,-.85),(.85,1.7)]:solid(m,(-.62,y+1.50,(za+zb)/2),(.14,2.5,zb-za),'plaster')
  elif style=='capsule':
   # Curve-fitted end banks have no inaccessible floor behind separate racks.
   for sign in [-1,1]:
    bank=p.intersection(box(1.65 if sign>0 else -w/2,-d/2,w/2 if sign>0 else -1.65,d/2))
    slab(m,bank,y+.25,1.95,'metal')
    for z in [-.70,.70]:
     q=pair();cabinet(q,0,0,0,1.15,1.82,.12,'grille')
     kit['merge'](m,kit['move'](q,sign*1.66,y+.30,z,90 if sign<0 else 270))
    solid(m,(sign*1.65,y+1.15,0),(.045,.32,.18),'screen',collision=False)
  elif style=='booth':
   kit['desk'](m,-w/2+.425,.15,y+.25,1.4,.65,90)
   kit['chair'](m,-w/2+1.0,.15,y+.25,90)
   cabinet(m,w/2-.5,.15,y+.25,.6,1.5,.7,'blue')
  elif style=='loading':
   for sign in [-1,1]:kit['shelf'](m,sign*(w/2-.4),0,y+.25,2.6,90 if sign<0 else 270)
   kit['desk'](m,1.8,d/2-.6,y+.25,1.3,.6,180)
   kit['chair'](m,1.8,d/2-1.05,y+.25)
   case(m,-w/2+1.10,1.3,y+.25,.85,.6,.85,'burgundy')
  elif style=='pavilion':
   solid(m,(-w/2+.6,y+.75,0),(1.,1.,d*.48),'blue')
   solid(m,(-w/2+.6,y+1.30,0),(1.1,.10,d*.50),'wood')
   kit['shelf'](m,-w/2+.40,.3,y+1.35,1.8,90,'cafe')
   cabinet(m,-w/2+.6,d/2-.65,y+.25,.75,1.8,.65,'silver')
   for z in [-1.2,1.2]:
    kit['table'](m,.75,z,y+.25);kit['chair'](m,.75-.83,z,y+.25,270);kit['chair'](m,.75+.83,z,y+.25,90)
   # Coffee machine with separate reservoir, group head and drip tray.
   solid(m,(-w/2+.6,y+1.65,-.4),(.65,.6,.5),'silver')
   cyl(m,(-w/2+.37,y+1.37,-.72),(-w/2+.37,y+1.58,-.72),.045,'metal',8,False)
   solid(m,(-w/2+.6,y+1.38,-.72),(.60,.05,.24),'grille',collision=False)
  else:kit['furniture'](m,w,d,k,role)
  if style=='octagon':ladder(m,1.35,2.15,3.25,0,base_y=y+.25)
  for site in sites_for(w,d,role,style,upper):
   if upper:site['x']+=.75
   COVER_SITES.append(dict(floor_y=y+.25,**site))
  # Credible base course, eave band and separate structural corner frames.
  for a,b in zip(coords,coords[1:]):
   a,b=np.array(a),np.array(b);mid=(a+b)/2;L=np.linalg.norm(b-a);ang=-math.degrees(math.atan2((b-a)[1],(b-a)[0]))
   # Keep the band above the door lintels, never across a doorway.
   solid(m,(mid[0],y+H-.12,mid[1]),(L,.24,.25),'burgundy',ang,False)
  for x,z in list(wallplan.exterior.coords)[:-1]:
   solid(m,(x,y+H/2,z),(.16,H,.16),'metal',collision=False)
 if style=='stepped':
  ladder(m,-w/2-.27,0,3.5,90)
  if current>=1:
   ladder(m,-1.52,1.65,3.25,90,base_y=3.5)
   # Solid low terrace parapet has a deliberate ladder/door arrival gap.
   for z in [-d/2,d/2]:solid(m,(-2.35,3.65,z),(2.3,.30,.16),'concrete')
 elif floors>1:
  # A real external landing gives the upper-floor door and roof ladder access.
  for y in [3.5,6.75]:
   if y>3.5 and level!=floors:continue
   solid(m,(-w/2-.63,y-.10,0),(1.45,.20,1.75),'grating')
   for z in [-.83,.83]:m[0].beam((-w/2,y-.75,z),(-w/2-1.25,y-.12,z),.10,mat='metal')
  ladder(m,-w/2-1.55,0,6.75,90)
 else:
  # Service ladder aligns with a solid left-side pier and the real roof edge.
  target=H+.25
  if style=='sawtooth':target=H+.7
  if style=='barrel':target=H+.2
  if style in ['loading','container']:
   low=H+.20;high=H+(.80 if style=='loading' else .45)
   target=low+(high-low)*(d/2+.6)/(d+.72)
  ladder(m,-w/2-.27,0,target,90)
 if level==floors:
  rp=box(-1.25,-2.25,2.75,2.25)if style=='stepped'else p
  roof(m,rp,4. if style=='stepped'else w,4.5 if style=='stepped'else d,floors*3.25 if floors>1 else H,style)
 # Door canopy styles differ in extent and material, with usable S2 clearance.
 if style not in ['pavilion','loading','barrel']:
  solid(m,(0,2.78,-d/2-.4),(2.45,.12,.85),'wood'if style=='gable'else 'metal')
  for x in [-.95,.95]:m[0].beam((x,2.45,-d/2-.1),(x,2.72,-d/2-.78),.045,mat='silver')
 return m
