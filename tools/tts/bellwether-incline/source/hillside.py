"""The surveyed station terrain, in site coordinates. +x is uphill before placement."""
from math import sqrt, sin, cos, ceil, floor, pi
import numpy as np
from shapely import Polygon, box, constrained_delaunay_triangles, get_parts
from shapely.geometry.polygon import orient
from mesh import Pair,Mesh
from granite import build_bank

SLOPE=13.5/48
TRACK_Z=5.55
HALFWAY=3.66
SOUTH_EDGE=TRACK_Z-HALFWAY
NORTH_EDGE=TRACK_Z+HALFWAY
LEVELS=(.62,4.60,8.72,13.10)
BASE=-.09
# The retaining lines bend around the parcel passage, works yard and booking hall.
LINES={
 'south':[
  [(-24,-10.03),(SOUTH_EDGE,-10.03)],
  [(-24,-1.98),(-16.10,-1.98),(-14.18,2.70),(-5.37,2.70),(-3.52,-2.61),(SOUTH_EDGE,-2.61)],
  [(-24,10.2),(-12.2,10.2),(-10.45,9.72),(SOUTH_EDGE,9.72)]],
 'north':[
  [(NORTH_EDGE,-10.05),(13.15,-10.05),(14.35,-9.32),(24,-9.32)],
  [(NORTH_EDGE,2.83),(24,2.83)],
  [(NORTH_EDGE,9.48),(16.66,9.48),(17.42,12.50),(24,12.50)]]}

def grade(x):
 return .38+(x+24)*SLOPE

def quarter_turn(x,z):
 return z,-x

def cut(line,z):
 return float(np.interp(z,[v[0] for v in line],[v[1] for v in line]))

def apron(x,z):
 side='south' if z<TRACK_Z else 'north'
 return LEVELS[sum(x>=cut(line,z) for line in LINES[side])]

# Each stair has a full-base landing midway up the flight.
STAIR_WIDTH=2.20
STAIR_LENGTH=6.45
TREAD=(STAIR_LENGTH-1.25)/16
# start x, z, terrace index (set from footprints and surveyed entrance clearances)
GATES=[
 (-11.47,-13.50,0),(-10.28,-3.50,0),
 (2.45,-8.75,1),(2.45,-12.75,1),
 (8.76,-22.50,2),(3.52,-5.75,2),
 (-9.57,22.20,0),(-11.87,11.95,0),
 (-1.75,22.65,1),(2.44,14.78,1),
 (12.25,21.70,2),(3.35,12.10,2)]

def stair_height(x,gate):
 a,z,k=gate;u=min(STAIR_LENGTH-.000001,max(0,x-a))
 if u<8*TREAD:n=int(u/TREAD)+1
 elif u<8*TREAD+1.25:n=8
 else:n=9+int((u-8*TREAD-1.25)/TREAD)
 return LEVELS[k]+(LEVELS[k+1]-LEVELS[k])*min(n,16)/16

def surface(x,z):
 if x< -24.00001 or x>24.00001 or z< -24.00001 or z>24.00001:return BASE
 if SOUTH_EDGE < z < NORTH_EDGE:return grade(x)-.39
 for gate in GATES:
  a,zz,k=gate
  if a<=x<=a+STAIR_LENGTH and abs(z-zz)<STAIR_WIDTH/2:return stair_height(x,gate)
 return apron(x,z)

def ground_uv(x,z):
 return (x/48+.5,z/48+.5)

def polygons(shape):
 if shape.geom_type=='Polygon':return [shape]
 return [part for part in get_parts(shape) if part.geom_type=='Polygon' and part.area>1e-7]

def top_triangle(g,coords,h):
 a=[(v[0],h,v[1]) for v in coords]
 if np.cross(np.subtract(a[1],a[0]),np.subtract(a[2],a[0]))[1]<0:a=a[::-1]
 uv=[ground_uv(x,z) for x,_,z in a]
 g.m.add(a,uv);g.c.add(a,uv)

def cliff_panel(g,points,uv,normal):
 p=np.asarray(points)
 if np.dot(np.cross(p[1]-p[0],p[2]-p[0]),normal)<0:p=p[::-1];uv=uv[::-1]
 g.c.add(p,uv)
 # Split the photograph at each tile boundary so clamping and repeating samplers agree.
 face=[np.asarray([*point,*coord]) for point,coord in zip(p,uv)]
 def clip(vertices,axis,limit,sign):
  out=[]
  if not vertices:return out
  prev=vertices[-1];lo=(prev[axis]-limit)*sign
  for cur in vertices:
   hi=(cur[axis]-limit)*sign
   if (hi>0 and lo<0) or (hi<0 and lo>0):out.append(prev+(cur-prev)*(lo/(lo-hi)))
   if hi>=0:out.append(cur)
   prev,lo=cur,hi
  return out
 def tiles(axis):
  values=[v[axis] for v in face];a=floor(min(values));b=max(a,ceil(max(values)-1e-10)-1)
  return range(a,b+1)
 for u in tiles(3):
  strip=clip(clip(face,3,u,1),3,u+1,-1)
  for v in tiles(4):
   section=clip(clip(strip,4,v,1),4,v+1,-1)
   if len(section)<3:continue
   for j in range(1,len(section)-1):
    triangle=[section[0],section[j],section[j+1]]
    g.m.add([a[:3] for a in triangle],[np.clip(a[3:]-(u,v),0,1) for a in triangle])

def retaining_cap(stone,x0,z0,x1,z1,high,boundary):
 if boundary:return
 dx=x1-x0;dz=z1-z0;length=sqrt(dx*dx+dz*dz)
 if length<.0001:return
 nx,nz=dz/length,-dx/length;count=max(1,int(ceil(length/.58)))
 for i in range(count):
  a=i/count;b=(i+1)/count;m=(a+b)/2
  if high-surface(x0+dx*m+nx*.003,z0+dz*m+nz*.003)<.022:continue
  stone.beam((x0+dx*a-nx*.02,high-.12,z0+dz*a-nz*.02),(x0+dx*b-nx*.02,high-.12,z0+dz*b-nz*.02),.16,.19,'concrete')

def outside(x,z):
 return abs(abs(x)-24)<.001 or abs(abs(z)-24)<.001

def closed_profile(mesh,section,front,back):
 # A CCW section in x/y, with both z caps and outward-facing edge quads.
 triangles=get_parts(constrained_delaunay_triangles(Polygon(section)))
 for z,side in [(front,-1),(back,1)]:
  for face in triangles:
   xy=list(face.exterior.coords)[:3]
   (x0,y0),(x1,y1),(x2,y2)=xy
   if ((x1-x0)*(y2-y0)-(y1-y0)*(x2-x0))*side<0:xy.reverse()
   mesh.tri([(x,y,z) for x,y in xy],'darkiron')
 for (x0,y0),(x1,y1) in zip(section,section[1:]+section[:1]):
  mesh.quad([(x0,y0,front),(x1,y1,front),(x1,y1,back),(x0,y0,back)],'darkiron')

def landforms():
 ground=Pair('survey-mat');rock=Pair('railway-foundation');stone=Pair('terrace-coping')
 banks={}
 for side,(lo,hi) in {'south':(-24,SOUTH_EDGE),'north':(NORTH_EDGE,24)}.items():
  areas=[]
  boundaries=[[(lo,-24),(hi,-24)]]+LINES[side]+[[(lo,24),(hi,24)]]
  for k,(left,right) in enumerate(zip(boundaries,boundaries[1:])):
   poly=Polygon([(x,z) for z,x in left]+[(x,z) for z,x in reversed(right)])
   for a,zc,i in GATES:
    poly=poly.difference(box(a,zc-STAIR_WIDTH/2,a+STAIR_LENGTH,zc+STAIR_WIDTH/2))
   for p in polygons(poly):
    p=orient(p,sign=1)
    areas.append((LEVELS[k],p))
    for tri in get_parts(constrained_delaunay_triangles(p)):
     xy=list(tri.exterior.coords)[:3]
     pts=[(x,LEVELS[k],z) for x,z in xy]
     if np.cross(np.subtract(pts[1],pts[0]),np.subtract(pts[2],pts[0]))[1]<0:pts.reverse()
     ground.c.add(pts,[ground_uv(x,z) for x,_,z in pts])
    for ring in [p.exterior,*p.interiors]:
     pts=list(ring.coords)
     for (x,z),(xx,zz) in zip(pts,pts[1:]):
      retaining_cap(stone,x,z,xx,zz,LEVELS[k],outside((x+xx)/2,(z+zz)/2))
  banks[side]=build_bank(side,areas,ground,BASE,LEVELS)
 foundation_collider=Mesh('railway-foundation-collider')
 closed_profile(foundation_collider,[(-24,BASE),(24,BASE),(24,grade(24)-.39),(-24,grade(-24)-.39)],SOUTH_EDGE,NORTH_EDGE)
 # The physical core continues underneath each rail, all the way to both board edges.
 l,r=-24,24;s,n=SOUTH_EDGE,NORTH_EDGE
 for x in range(-24,24):
  a=float(x);b=a+1;hs=grade(a)-.39;he=grade(b)-.39
  cliff_panel(rock,[(a,hs,s),(a,hs,n),(b,he,n),(b,he,s)],[(0,0),(0,1),(1,1),(1,0)],(-SLOPE,1,0))
  for z,norm in [(s,(0,0,-1)),(n,(0,0,1))]:
   cliff_panel(rock,[(a,BASE,z),(b,BASE,z),(b,he,z),(a,hs,z)],[(a/5,BASE/5),(b/5,BASE/5),(b/5,he/5),(a/5,hs/5)],norm)
 for x,norm in [(l,(-1,0,0)),(r,(1,0,0))]:
  hh=grade(x)-.39
  cliff_panel(rock,[(x,BASE,s),(x,BASE,n),(x,hh,n),(x,hh,s)],[(0,0),(1.25,0),(1.25,hh/5),(0,hh/5)],norm)
 # Bottom closes the complete solid against the permanent 3-inch platform.
 cliff_panel(rock,[(l,BASE,s),(r,BASE,s),(r,BASE,n),(l,BASE,n)],[(0,0),(1,0),(1,1),(0,1)],(0,-1,0))
 # Each opening has permanent granite underneath the separately loaded treads.
 for a,z,k in GATES:
  low,high=LEVELS[k:k+2];mid=(low+high)/2
  profile=[(a,low-.16),(a+8*TREAD,mid-.16),(a+8*TREAD+1.25,mid-.16),(a+STAIR_LENGTH,high-.16)]
  front=z-STAIR_WIDTH/2;back=z+STAIR_WIDTH/2
  closed_profile(foundation_collider,[(a,BASE+.009),(a+STAIR_LENGTH,BASE+.009)]+profile[::-1],front,back)
  for (x,v),(xx,w) in zip(profile,profile[1:]):
   uv=[(0,0),(0,1),((xx-x)/4,1),((xx-x)/4,0)]
   cliff_panel(rock,[(x,v,front),(x,v,back),(xx,w,back),(xx,w,front)],uv,(-(w-v),xx-x,0))
  # The top fills the opening. Vertical faces sit just inside the flight's sides.
  # They remain opaque when viewed across or underneath an unoccupied stairwell.
  front+=.014;back-=.014
  for (x,v),(xx,w) in zip(profile,profile[1:]):
   for zz,norm in [(front,(0,0,-1)),(back,(0,0,1))]:
    cliff_panel(rock,[(x,BASE+.009,zz),(xx,BASE+.009,zz),(xx,w,zz),(x,v,zz)],[(x/5,0),(xx/5,0),(xx/5,w/5),(x/5,v/5)],norm)
  for (x,v),side in [(profile[0],-1),(profile[-1],1)]:
   xx=x-side*.014
   cliff_panel(rock,[(xx,BASE+.009,front),(xx,BASE+.009,back),(xx,v,back),(xx,v,front)],[(0,0),(.45,0),(.45,v/5),(0,v/5)],(side,0,0))
 # Capstones are set into the granite. Their physics is supplied by the retaining face.
 rock.c=foundation_collider
 stone.c.box(0,-.075,0,.04,.02,.04,'darkiron')
 return ground,rock,banks,stone
