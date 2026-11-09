"""Code-native measured ground and typographic signage; no generated image edits."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import json,math
ROOT=Path(__file__).resolve().parents[2];A=ROOT/'Assets';N=3072
rng=np.random.default_rng(17426)
noise=rng.normal(0,4.0,(N,N,1));base=np.zeros((N,N,3))+[76,73,67]+noise
# Subtle broad wear at metre scale, not uniform gravel or baked geometry.
coarse=Image.fromarray(rng.integers(70,150,(128,128),dtype=np.uint8)).resize((N,N),Image.Resampling.BICUBIC).filter(ImageFilter.GaussianBlur(25))
base+=((np.array(coarse,dtype=float)-110)/5)[:,:,None]
im=Image.fromarray(np.uint8(np.clip(base,0,255)));d=ImageDraw.Draw(im)
def xy(x,z):return ((x+24)*N/48,(24-z)*N/48)
def rect(x0,z0,x1,z1,fill,width=1,outline=None):
 a=xy(x0,z1);b=xy(x1,z0);d.rectangle([a,b],fill=fill,outline=outline,width=width)
# Drain covers are flush, not painted obstacles.
for x,z in [(-12,-15),(12,15),(-12,12),(12,-12),(-3,0),(3,0),(-22,-11),(22,11)]:
 rect(x-.25,z-.48,x+.25,z+.48,(55,59,60))
 for zz in np.arange(z-.4,z+.41,.1):d.line([xy(x-.20,zz),xy(x+.20,zz)],fill=(104,108,107),width=2)
# R3: multiple credible station surfaces, drainage, repairs and worn markings.
# Paint is clipped away from real building pads and modeled rail/platform decks.
import ast
from shapely.geometry import Point, box as shape_box
from shapely import affinity, contains_xy
from shapely.ops import unary_union
from architecture import plan
tree=ast.parse((Path(__file__).parent/'build_map.py').read_text())
specs=[(q['name'],-q['z'],q['x'],q['w'],q['d'],q['floors'],q['role'],q['shape'],(q['angle']-90)%360) for q in json.loads((ROOT/'Source/R7-building-layout.json').read_text())]
aprons=[]
for name,x,z,w,h,f,role,style,angle in specs:
 poly=affinity.translate(affinity.rotate(plan(w,h,style).buffer(.60,join_style=2),-angle,origin=(0,0)),x,z)
 aprons.append(poly)
 pts=[xy(x,z)for x,z in poly.exterior.coords]
 d.polygon(pts,fill=(139,138,128))
 # Concrete joints and small chips, limited to the actual shaped apron.
 bx0,bz0,bx1,bz1=poly.bounds
 for xx in np.arange(bx0,bx1,1.25):
  line=poly.intersection(__import__('shapely').geometry.LineString([(xx,bz0),(xx,bz1)]))
  for seg in getattr(line,'geoms',[line]):
   if hasattr(seg,'coords'):d.line([xy(*q)for q in seg.coords],fill=(108,110,104),width=2)
 for zz in np.arange(bz0,bz1,1.25):
  line=poly.intersection(__import__('shapely').geometry.LineString([(bx0,zz),(bx1,zz)]))
  for seg in getattr(line,'geoms',[line]):
   if hasattr(seg,'coords'):d.line([xy(*q)for q in seg.coords],fill=(108,110,104),width=2)
exclude=unary_union(aprons+[shape_box(-24,-12.45,24,-8.6),shape_box(-24,8.6,24,12.45),shape_box(-12,-9.1,8, -5.4),shape_box(-8,5.4,12,9.1)])
layer=Image.new('RGBA',(N,N));ld=ImageDraw.Draw(layer)
def lpoly(points,fill):ld.polygon([xy(*p)for p in points],fill=fill)
def line(points,fill,width=2):ld.line([xy(*p)for p in points],fill=fill,width=width)
# Broad resurfaced asphalt and worn concrete service strips, not random decals.
for x0,z0,x1,z1,color in [(-24,-8.0,24,-4.7,(39,48,53,110)),(-24,4.7,24,8.0,(78,85,84,90)),(-13,-24,-10.8,24,(123,121,106,65)),(10.8,-24,13,24,(123,121,106,65)),(-7.0,-4.2,7.0,4.2,(101,106,103,65))]:
 lpoly([(x0,z0),(x1,z0),(x1,z1),(x0,z1)],color)
# Irregular, low-contrast repairs, stains and aggregate variations.
stains=Image.new('RGBA',(N,N));st=ImageDraw.Draw(stains)
for i in range(180):
 x,z=rng.uniform(-23,23,2);rx,rz=rng.uniform(.08,.65,2)
 pts=[(x+rx*math.cos(a)*rng.uniform(.8,1.2),z+rz*math.sin(a)*rng.uniform(.8,1.2))for a in np.linspace(0,math.tau,24,endpoint=False)]
 st.polygon([xy(*p)for p in pts],fill=(28,36,40,int(rng.integers(18,50))))
stains=stains.filter(ImageFilter.GaussianBlur(8))
layer=Image.alpha_composite(layer,stains);ld=ImageDraw.Draw(layer)
for z in (-6.5,6.5):
 for x in np.arange(-22.5,23,2.6):
  line([(x,z-.65),(x+.9,z-.65)],(195,180,113,135),width=5)
 # Two close, irregular tire tracks down each service lane.
 for offset in (-.31,.31):
  pts=[(x,z+offset+.025*math.sin(x*3))for x in np.arange(-24,24.1,.2)]
  line(pts,(20,28,32,65),width=7)
# Outlined maintenance bays and chevrons give the yard a station-specific use.
for x,z in [(-18,-6.1),(18,6.1),(-7,17),(7,-17)]:
 w,h=3.4,1.55
 for a,b in [((x-w/2,z-h/2),(x+w/2,z-h/2)),((x-w/2,z+h/2),(x+w/2,z+h/2)),((x-w/2,z-h/2),(x-w/2,z+h/2)),((x+w/2,z-h/2),(x+w/2,z+h/2))]:line([a,b],(204,180,96,180),width=4)
 for xx in np.arange(x-w/2+.12,x+w/2-.2,.45):line([(xx,z-h/2+.12),(min(xx+.35,x+w/2-.1),z-h/2+.48)],(198,174,91,155),width=5)
# Crossings now share the exclusion mask with road paint.
for z in [-17,17]:
 for xx in [-3.5,-2.8,-2.1,-1.4,-.7,0,.7,1.4,2.1,2.8,3.5]:
  lpoly([(xx-.12,z-.7),(xx+.12,z-.7),(xx+.12,z+.7),(xx-.12,z+.7)],(175,173,157,255))
# Utility trenches and inspection plates are flush; all depth comes from models.
for x,z in [(-12.0,-18),(12,18),(-4,-2.6),(4,2.6),(-21,8),(21,-8),(-6,19),(6,-19)]:
 lpoly([(x-.48,z-.32),(x+.48,z-.32),(x+.48,z+.32),(x-.48,z+.32)],(33,42,46,235))
 for zz in np.arange(z-.24,z+.25,.09):line([(x-.39,zz),(x+.39,zz)],(139,145,141,220),width=2)
# Hairline cracks branch along the old asphalt repairs, never painted relief.
for i in range(95):
 x,z=rng.uniform(-24,24,2);pts=[(x,z)]
 for j in range(int(rng.integers(3,9))):
  x+=rng.uniform(-.20,.20);z+=rng.uniform(.12,.32);pts.append((x,z))
 line(pts,(20,27,30,110),width=1)
 if len(pts)>4:line([pts[2],(pts[2][0]+.32,pts[2][1]+.24)],(20,27,30,90),width=1)
# Mask service paint and repairs using the measured physical footprint.
coords=(np.arange(N)+.5)*48/N-24
xx,zz=np.meshgrid(coords,-coords)
mask=Image.fromarray(np.uint8(~contains_xy(exclude,xx,zz))*255)
alpha=np.minimum(np.array(layer.getchannel('A')),np.array(mask)).astype(np.float32)
# Paint and repairs have worn, granular edges instead of flat decal polygons.
wear=np.array(Image.fromarray(rng.integers(70,255,(768,768),dtype=np.uint8)).resize((N,N),Image.Resampling.BILINEAR),dtype=np.float32)/255
layer.putalpha(Image.fromarray(np.uint8(alpha*wear)))
im=Image.alpha_composite(im.convert('RGBA'),layer).convert('RGB')
# Fine mixed aggregate and scuffed surface variation spans all material regions.
arr=np.array(im,dtype=np.int16)
arr+=rng.normal(0,2.4,(N,N,1)).astype(np.int16)
im=Image.fromarray(np.uint8(np.clip(arr,0,255)))
im.resize((2048,2048),Image.Resampling.LANCZOS).save(A/'redline-r7-ground.jpg',quality=94,subsampling=0)
