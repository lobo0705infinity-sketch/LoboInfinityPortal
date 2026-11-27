"""The surveyed station terrain, in site coordinates. +x is uphill before placement."""
from math import sqrt, sin, cos, ceil, floor, pi
import numpy as np
from shapely import Polygon, box, constrained_delaunay_triangles, get_parts
from shapely.geometry.polygon import orient
from mesh import Pair

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

def exposed_wall(rock,stone,x0,z0,x1,z1,high,boundary):
 dx=x1-x0;dz=z1-z0;length=sqrt(dx*dx+dz*dz)
 if length<.0001:return
 # Polygons are oriented CCW in the x/z plan; the exterior lies to the right.
 nx,nz=dz/length,-dx/length
 count=max(1,int(ceil(length/.58)))
 def sample(t):
  x=x0+dx*t;z=z0+dz*t
  return x,z,surface(x+nx*.003,z+nz*.003)
 for i in range(count):
  a=i/count;b=(i+1)/count;cx,cz,low=sample((a+b)/2)
  if high-low<.022:continue
  x,z,_=sample(a);xx,zz,_=sample(b)
  # Ramps on the other side of a boundary are continuous.
  if abs(cz-SOUTH_EDGE)<.002 or abs(cz-NORTH_EDGE)<.002:
   h0,h1=grade(x)-.39,grade(xx)-.39
  else:h0=h1=low
  if h0>=high and h1>=high:continue
  h0=min(high-.002,h0);h1=min(high-.002,h1)
  normal=(nx,0,nz)
  # A natural face is rough below its dressed cap. Stay inside the board perimeter.
  def profile(x,z,t):
   face=.14+.16*sin(x*1.8+z*.77)+.055*sin(x*2.2-z*2.6)
   return (1 if not boundary else -1)*max(.03,face)*sin(pi*t)
  for ta,tb in ((0,.27),(.27,.58),(.58,.84),(.84,1)):
   va=[];ua=[]
   for px,pz,bot,t in [(x,z,h0,ta),(xx,zz,h1,ta),(xx,zz,h1,tb),(x,z,h0,tb)]:
    y=bot+(high-bot)*t;shift=profile(px,pz,t)
    va.append((px+nx*shift,y,pz+nz*shift))
    # The photographic stone repeats every 5.2 inches along the face.
    ua.append(((px*.79+pz*.72)/5.2,y/5.2))
   cliff_panel(rock,va,ua,normal)
  if not boundary:
   # The coping is fitted to the terrace lip. Keep it below the walking surface.
   stone.beam((x-nx*.02,high-.12,z-nz*.02),(xx-nx*.02,high-.12,zz-nz*.02),.16,.19,'concrete')

def outside(x,z):
 return abs(abs(x)-24)<.001 or abs(abs(z)-24)<.001

def landforms():
 ground=Pair('survey-mat');rock=Pair('mountain-core');stone=Pair('station-stairways')
 for side,(lo,hi) in {'south':(-24,SOUTH_EDGE),'north':(NORTH_EDGE,24)}.items():
  boundaries=[[(lo,-24),(hi,-24)]]+LINES[side]+[[(lo,24),(hi,24)]]
  for k,(left,right) in enumerate(zip(boundaries,boundaries[1:])):
   poly=Polygon([(x,z) for z,x in left]+[(x,z) for z,x in reversed(right)])
   for a,zc,i in GATES:
    poly=poly.difference(box(a,zc-STAIR_WIDTH/2,a+STAIR_LENGTH,zc+STAIR_WIDTH/2))
   for p in polygons(poly):
    p=orient(p,sign=1)
    for tri in get_parts(constrained_delaunay_triangles(p)):top_triangle(ground,list(tri.exterior.coords)[:3],LEVELS[k])
    for ring in [p.exterior,*p.interiors]:
     pts=list(ring.coords)
     for (x,z),(xx,zz) in zip(pts,pts[1:]):
      exposed_wall(rock,stone,x,z,xx,zz,LEVELS[k],outside((x+xx)/2,(z+zz)/2))
 # The physical core continues underneath each rail, all the way to both board edges.
 l,r=-24,24;s,n=SOUTH_EDGE,NORTH_EDGE
 for x in range(-24,24):
  a=float(x);b=a+1
  hs=grade(a)-.39;he=grade(b)-.39
  cliff_panel(rock,[(a,hs,s),(a,hs,n),(b,he,n),(b,he,s)],[(0,0),(0,1),(1,1),(1,0)],(-SLOPE,1,0))
  for z,norm in [(s,(0,0,-1)),(n,(0,0,1))]:
   for t in np.linspace(0,1,5)[:-1]:
    aa=a+t;bb=aa+.25;plate=apron((aa+bb)/2,z)
    h0=grade(aa)-.39;h1=grade(bb)-.39
    if (h0+h1)/2>plate+.0005:
     cliff_panel(rock,[(aa,plate,z),(bb,plate,z),(bb,h1,z),(aa,h0,z)],[(aa/5,plate/5),(bb/5,plate/5),(bb/5,h1/5),(aa/5,h0/5)],norm)
 for x,norm in [(l,(-1,0,0)),(r,(1,0,0))]:
  hh=grade(x)-.39
  cliff_panel(rock,[(x,BASE,s),(x,BASE,n),(x,hh,n),(x,hh,s)],[(0,0),(1.25,0),(1.25,hh/5),(0,hh/5)],norm)
 # Bottom closes the complete solid against the permanent 3-inch platform.
 cliff_panel(rock,[(l,BASE,-24),(r,BASE,-24),(r,BASE,24),(l,BASE,24)],[(0,0),(1,0),(1,1),(0,1)],(0,-1,0))
 for i,g in enumerate(GATES):
  a,z,level=g;low=LEVELS[level];high=LEVELS[level+1]
  # Plinth quality and physical collision match the visible tread and riser.
  intervals=[]
  for j in range(8):intervals.append((a+j*TREAD,a+(j+1)*TREAD,low+(high-low)*(j+1)/16))
  intervals.append((a+8*TREAD,a+8*TREAD+1.25,(high+low)/2))
  for j in range(8):intervals.append((a+8*TREAD+1.25+j*TREAD,a+8*TREAD+1.25+(j+1)*TREAD,low+(high-low)*(j+9)/16))
  for t0,t1,topy in intervals:
   stone.box((t0+t1)/2,BASE,z,t1-t0,topy-BASE,STAIR_WIDTH,'ashlar',True,'concrete')
  # Handrails bend level at the half landing. Both approaches remain wide and unobstructed.
  for sign in (-1,1):
   zrail=z+sign*(STAIR_WIDTH/2-.06);base=a+.11
   points=[(base,stair_height(base,g)+.74,zrail),(a+8*TREAD-.03,(low+high)/2+.74,zrail),(a+8*TREAD+1.28,(low+high)/2+.74,zrail),(a+STAIR_LENGTH-.10,high+.74,zrail)]
   for x,y,zz in points:stone.cyl((x,y-.76,zz),(x,y,zz),.039,'darkiron',8)
   for p,q in zip(points,points[1:]):stone.beam(p,q,.071,.070,'darkiron')
 return ground,rock,stone
