from pathlib import Path
import json,math
import numpy as np
from PIL import Image,ImageDraw,ImageFilter
from shapely.geometry import Polygon,box,LineString
from shapely import affinity,contains_xy
from shapely.ops import unary_union
R=Path(__file__).resolve().parents[1];A=R/'Assets';N=4096;rng=np.random.default_rng(1011)
b=json.loads((R/'Source/R15-layout.json').read_text())['ObjectStates'][0]
def xy(x,z):return ((24-z)*N/48,(24-x)*N/48)
# Multiscale aggregate and irregular wear, with no directional light/shadow baked in.
def noise(n):return np.array(Image.fromarray(rng.integers(0,256,(n,n),dtype=np.uint8)).resize((N,N),Image.Resampling.BICUBIC),np.float32)/255-.5
macro=noise(32);mids=noise(220);fine=noise(1100);grain=rng.normal(0,1,(N,N)).astype(np.float32)
asphalt=np.clip(np.array([66,72,73])+ (macro*17+mids*8+fine*6+grain*2)[:,:,None],0,255).astype(np.uint8)
concrete=np.clip(np.array([144,145,136])+(macro*15+mids*12+fine*7+grain*2)[:,:,None],0,255).astype(np.uint8)
im=Image.fromarray(asphalt);mask=Image.new('L',(N,N));md=ImageDraw.Draw(mask)
# Aprons follow actual transformed collider envelopes including all 14 buildings.
aprons=[]
for o in b['ContainedObjects']:
 if not ({'building','building-state'} & set(o.get('Tags',[]))):continue
 t=o['Transform'];name=o['CustomMesh']['ColliderURL'].split('/')[-1]
 vs=[(-float(l.split()[1])*t['scaleX'],float(l.split()[3])*t['scaleZ']) for l in (A/name).read_text().splitlines() if l.startswith('v ')]
 p=Polygon(vs).convex_hull;p=affinity.rotate(p,-t['rotY'],origin=(0,0));p=affinity.translate(p,t['posX'],t['posZ']).buffer(.50,join_style=2);aprons.append(p)
# Dedicated pedestrian surfaces follow the passenger platform and station apron chain.
platforms=[]
for o in b['ContainedObjects']:
 if 'platform' not in o.get('Tags',[]):continue
 t=o['Transform'];f=A/o['CustomMesh']['ColliderURL'].split('/')[-1]
 v=[(-float(l.split()[1])*t['scaleX'],float(l.split()[3])*t['scaleZ']) for l in f.read_text().splitlines() if l.startswith('v ')]
 q=affinity.translate(affinity.rotate(Polygon(v).convex_hull,-t['rotY'],origin=(0,0)),t['posX'],t['posZ'])
 platforms.append(q.buffer(.4,join_style=2))
walk=unary_union(aprons+platforms)
for p in getattr(walk,'geoms',[walk]):md.polygon([xy(x,z) for x,z in p.exterior.coords],fill=255)
im.paste(Image.fromarray(concrete),(0,0),mask)
d=ImageDraw.Draw(im)
def lines(poly,color,width):
 for q in getattr(poly,'geoms',[poly]):
  if hasattr(q,'coords'):d.line([xy(*v) for v in q.coords],fill=color,width=width)
# Narrow expansion joints respect the measured apron boundaries.
for p in aprons:
 x0,z0,x1,z1=p.bounds
 for x in np.arange(math.floor(x0/2)*2,x1,2):lines(p.intersection(LineString([(x,z0),(x,z1)])),(111,116,111),2)
 for z in np.arange(math.floor(z0/2)*2,z1,2):lines(p.intersection(LineString([(x0,z),(x1,z)])),(111,116,111),2)
 lines(p.boundary,(104,112,109),3)
# Repairs and stains are irregular patches rather than hard-edged flat rectangles.
layer=Image.new('RGBA',(N,N));ld=ImageDraw.Draw(layer)
for i in range(210):
 x,z=rng.uniform(-23.7,23.7,2);rad=rng.uniform(.12,.8);pts=[]
 for a in np.arange(0,math.tau,math.tau/11):
  r=rad*rng.uniform(.6,1.3);pts.append(xy(x+math.cos(a)*r,z+math.sin(a)*r*.65))
 ld.polygon(pts,fill=(26,32,33,int(rng.integers(12,45))))
layer=layer.filter(ImageFilter.GaussianBlur(4));im=Image.alpha_composite(im.convert('RGBA'),layer);d=ImageDraw.Draw(im)
# Broken, faint sealed cracks and utility trench repairs.
for i in range(95):
 x,z=rng.uniform(-23.5,23.5,2);pts=[xy(x,z)]
 for j in range(int(rng.integers(3,11))):x+=rng.normal(.08,.10);z+=rng.uniform(.08,.28);pts.append(xy(x,z))
 d.line(pts,fill=(34,43,43,140),width=int(rng.integers(1,4)))
# Drains, covers and paint fit in free ground, not beneath the buildings.
cover=unary_union(aprons+[box(-5.7,-6.3,6.8,15.7)])
from shapely.geometry import Point
for x,z in [(-21,6),(-10,20),(-21,-6),(-6,-3),(8,18),(22,-11),(11,-11),(20,2),(-12,-15),(5,-20)]:
 if cover.contains(Point(x,z)):continue
 a=xy(x-.35,z+.48);c=xy(x+.35,z-.48);d.rectangle([(min(a[0],c[0]),min(a[1],c[1])),(max(a[0],c[0]),max(a[1],c[1]))],fill=(35,44,45,255),outline=(129,133,123,255),width=2)
 for zz in np.arange(z-.38,z+.39,.10):d.line([xy(x-.27,zz),xy(x+.27,zz)],fill=(92,102,100,255),width=3)
# Small loading bay corner marks and worn pedestrian stripes, with masked paint.
paint=Image.new('RGBA',(N,N));pd=ImageDraw.Draw(paint)
for x,z in [(-21,11),(21,18),(-10,-22),(21,-5),(8,-21)]:
 for sign in [-1,1]:
  pd.line([xy(x+sign*1.2,z-.7),xy(x+sign*1.2,z+.7)],fill=(193,169,101,160),width=6)
for x in np.arange(-10,-3,.65):pd.polygon([xy(x,-7.4),xy(x+.24,-7.4),xy(x+.24,-6.2),xy(x,-6.2)],fill=(196,194,170,190))
alpha=np.array(paint.getchannel('A'),np.float32);wear=np.clip((fine+.5)*1.7,0,1);coords=(np.arange(N)+.5)*48/N-24;zz,xx=np.meshgrid(-coords,-coords);alpha*=wear*(~contains_xy(unary_union(aprons),xx,zz));paint.putalpha(Image.fromarray(alpha.astype(np.uint8)));im=Image.alpha_composite(im,paint)
im.convert('RGB').save(A/'redline-r15-ground.jpg',quality=95,subsampling=0)
print('R15 mat rebuilt from latest save: %d actual building aprons' % len(aprons))
