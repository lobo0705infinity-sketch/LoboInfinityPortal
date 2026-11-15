"""R2 spa geometry. Actual recessed basins and a raised indoor soaking tub."""
import math
import numpy as np
from shapely.geometry import Polygon,box
from shapely.ops import triangulate,unary_union

POOLS=[
 {'name':'Crescent Courtyard Mineral Bath','slug':'courtyard-bath','x':-2.5,'z':-.5,'rx':.9,'rz':1.4,'rim':.25,'natural':False},
 {'name':'Eastern Natural Hot Spring','slug':'east-hot-spring','x':12,'z':-5.9,'rx':3.0,'rz':1.85,'rim':.4,'natural':True},
 {'name':'Western Mineral Soaking Bath','slug':'west-hot-spring','x':-15,'z':-5,'rx':2.4,'rz':1.5,'rim':.35,'natural':True},
]
def outline(spec,expand=0):
 pts=[]
 for a in np.linspace(0,2*math.pi,72,endpoint=False):
  f=1+(.055*math.sin(3*a+.7)+.035*math.sin(5*a))if spec.get('natural')else 1
  pts.append(((spec['rx']+expand)*math.cos(a)*f,(spec['rz']+expand)*math.sin(a)*f))
 return pts
def planar(m,poly,y,material):
 p=Polygon(poly);x0,z0,x1,z1=p.bounds
 for tri in triangulate(p):
  if not p.covers(tri):continue
  coords=list(tri.exterior.coords)[:3];k=len(m.v)
  m.face([(x,y,z)for x,z in coords[::-1]],material)
  # Continuous photographic water coordinates across all triangles.
  tile=6;c=tile%4;r=tile//4
  if material=='asphalt':
   for j,(x,yy,z)in enumerate(m.v[k:],k):m.uv[j]=[(c+.035+.93*(x-x0)/(x1-x0))/4,(3-r+.035+.93*(z-z0)/(z1-z0))/4]
def basin(Mesh,spec,base=0):
 m=Mesh();inner=outline(spec);outer=outline(spec,spec['rim']);bottom=base-.75;top=base+.125
 m.prism(inner,bottom,.125,'mosaic')
 for i,(a,b)in enumerate(zip(inner,inner[1:]+inner[:1])):
  oa,ob=outer[i],outer[(i+1)%len(outer)]
  # Stone-lined basin down into the ground, not a raised pedestal.
  m.face([(a[0],bottom,a[1]),(b[0],bottom,b[1]),(b[0],top,b[1]),(a[0],top,a[1])],'ceramic')
  m.face([(oa[0],base-.12,oa[1]),(oa[0],top,oa[1]),(ob[0],top,ob[1]),(ob[0],base-.12,ob[1])],'limestone')
  m.face([(a[0],top,a[1]),(b[0],top,b[1]),(ob[0],top,ob[1]),(oa[0],top,oa[1])],'travertine')
  # Fine recessed stone joints, with no protruding black rods across the coping.
  if i%6==0:
   pa=np.array(a)*.98+np.array(oa)*.02;pb=np.array(a)*.02+np.array(oa)*.98
   m.beam((pa[0],top+.001,pa[1]),(pb[0],top+.001,pb[1]),.003,'limestone')
 # Three broad submerged entry treads, set inside the basin's eastern end.
 for j in range(3):
  x=spec['rx']-.42-j*.35
  m.box(x,bottom+.125,0,.36,.20*(3-j),min(1.25,spec['rz']*1.1),'travertine')
 # Supply spout and drain detail anchored to the coping.
 x=-(spec['rx']+spec['rim']/2)
 m.cyl(x,base+.125,0,.055,.48,'bronze',12)
 m.beam((x,base+.6,0),(x+.3,base+.6,0),.07,'bronze')
 m.beam((x+.3,base+.6,0),(x+.3,base+.42,0),.06,'bronze')
 m.cyl(0,bottom+.126,0,.13,.015,'rubber',20)
 planar(m,inner,base-.10,'asphalt')
 return m,outer

def indoor_tub(Mesh):
 """Closed, finished stone soaking tub, with rolled coping and broad entry steps."""
 m=Mesh();n=96
 profiles=[(1.98,1.22,.25),(2.00,1.24,.38),(2.05,1.29,.88),
           (2.03,1.27,.96),(1.98,1.22,1.00),(1.72,.96,1.00),
           (1.66,.90,.94),(1.58,.82,.40)]
 rings=[[(rx*math.cos(a),yy,rz*math.sin(a))for a in np.linspace(0,2*math.pi,n,endpoint=False)]for rx,rz,yy in profiles]
 for j,(a,b)in enumerate(zip(rings,rings[1:])):
  for i in range(n):
   k=(i+1)%n;m.face([a[i],b[i],b[k],a[k]],'travertine'if j>=2 and j<=5 else'ceramic')
 bottom=[(x,z)for x,y,z in rings[-1]];m.prism(bottom,.25,.15,'mosaic')
 # Water is inset below the rolled lip, leaving a visible finished inner wall.
 water=[(1.63*math.cos(a),.87*math.sin(a))for a in np.linspace(0,2*math.pi,n,endpoint=False)]
 planar(m,water,.73,'asphalt')
 # Full-width, supported entry steps. Clear of the pavilion doors and benches.
 m.box(2.67,.25,0,1.30,.25,1.15,'travertine')
 m.box(2.36,.50,0,.68,.25,1.15,'travertine')
 for side in [-1,1]:
  pts=[(3.12,.5,side*.62),(3.12,1.15,side*.62),(2.88,1.30,side*.62),(2.18,1.30,side*.62),(1.98,1.05,side*.62)]
  for a,b in zip(pts,pts[1:]):m.beam(a,b,.045,'bronze')
 # Deck-mounted mixer with two valves and a curved gooseneck over the bowl.
 for z in [-.25,.25]:
  m.cyl(-1.87,1.0,z,.075,.08,'bronze',20)
  m.beam((-1.95,1.09,z),(-1.79,1.09,z),.035,'bronze')
 tap=[(-1.87,1.0,0),(-1.87,1.32,0),(-1.80,1.48,0),(-1.60,1.53,0),(-1.39,1.46,0),(-1.31,1.31,0)]
 for a,b in zip(tap,tap[1:]):m.beam(a,b,.07,'bronze')
 m.box(-1.65,.78,0,.035,.10,.20,'bronze')
 # Grouted base plinth hides the bowl underside and completes the lower edge.
 for i in range(n):
  k=(i+1)%n;a=rings[0][i];b=rings[0][k]
  m.face([(a[0],.25,a[2]),(a[0],.38,a[2]),(b[0],.38,b[2]),(b[0],.25,b[2])],'travertine')
 return m
def ground(Mesh):
 m=Mesh();holes=[]
 for spec in POOLS:
  holes.append(Polygon([(spec['x']+x,spec['z']+z)for x,z in outline(spec)]))
 p=box(-24,-24,24,24).difference(unary_union(holes))
 for tri in triangulate(p):
  if p.covers(tri):
   q=list(tri.exterior.coords)[:3];m.face([(x,0,z)for x,z in q[::-1]],'soil')
 m.box(0,-1.15,0,48,.15,48,'soil')
 for a,b in zip([(-24,-24),(24,-24),(24,24),(-24,24)],[ (24,-24),(24,24),(-24,24),(-24,-24)]):
  m.face([(a[0],-1,a[1]),(b[0],-1,b[1]),(b[0],0,b[1]),(a[0],0,a[1])],'soil')
 return m
