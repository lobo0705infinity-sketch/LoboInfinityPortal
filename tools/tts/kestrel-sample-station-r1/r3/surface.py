"""Cast the built-up campus and its roads into the visible/physical lunar surface."""
from plan import *
from build_station import build
from cartway import station_route
from shapely.geometry import box,LineString,Polygon
from shapely.ops import unary_union
from shapely import points,distance
from shapely.affinity import affine_transform
from PIL import Image,ImageDraw,ImageFilter,ImageFont
from scipy import ndimage
import numpy as np,math
import ground,survey
survey.local=resource
def ground_plan():
 pad={}
 for k,rs in PADS.items():
  p=unary_union([box(*v) for v in rs]);pad[k]=p.buffer(.18,join_style=3).buffer(-.29,join_style=3).buffer(.11,join_style=3)
 roads=[LineString(p) for p in ROADS];tugs=[LineString([(z,x) for x,z in g.coords]) for g in station_route()]
 return pad,roads,tugs
def grade():
 pad,roads,tugs=ground_plan();b=build();fp=survey.footprints(b)
 elements=list(pad.values())+[g.buffer(1.13) for g in roads+tugs]
 # Physical footprint projection into photo coordinates. Keep the original ramp/pit.
 for g,s in fp.items():
  if g not in ('e52010',) and not g.startswith('c7f'):elements.append(affine_transform(s,[0,1,1,0,0,0]).buffer(.14))
 g=unary_union(elements)
 pts=points(ground.Z.ravel(),ground.X.ravel())
 d=distance(pts,g).reshape(ground.X.shape)
 h=np.load(r2.W/'native-heights.npy');level=ground.LEVEL
 above=np.maximum(0,h-level)*ground.smooth(d/.66)
 h=level+np.minimum(0,h-level)+above
 ground.OUT=A
 dz,dx=np.gradient(h,ground.STEP);norm=np.stack([-dx,np.ones_like(h),-dz],axis=-1);norm/=np.linalg.norm(norm,axis=-1,keepdims=True)
 for i in range(2):
  for j in range(2):ground.tile(i*80,j*80,h,norm,1+2*i+j)
 np.save(W/'heights.npy',h)
def art():
 pad,roads,tugs=ground_plan();n=2048;s=n/48
 rng=np.random.default_rng(608)
 def pix(p):return tuple((np.array(p)+24)*s)
 def geom(g):
  im=Image.new('L',(n,n));d=ImageDraw.Draw(im)
  for p in (g.geoms if hasattr(g,'geoms')else [g]):
   if p.is_empty:continue
   d.polygon([pix(x)for x in p.exterior.coords],fill=255)
   for hole in p.interiors:d.polygon([pix(x)for x in hole.coords],fill=0)
  return im
 def layer():return Image.new('L',(n,n))
 def line(d,pts,w,val=255):d.line([pix(p) for p in pts],fill=val,width=max(1,round(w*s)),joint='curve')
 def rect(d,x,y,w,h,val=255):d.rectangle([pix((x,y)),pix((x+w,y+h))],fill=val)
 native=next(o for o in r2.ORIGINAL['ContainedObjects']if o['GUID']=='c7b000')
 im=Image.open(resource(native['CustomMesh']['DiffuseURL'])).convert('RGB').resize((n,n)).transpose(Image.Transpose.ROTATE_270)
 base=np.array(im,dtype='float32');luma=base.mean(axis=2);grain=luma-ndimage.gaussian_filter(luma,4)
 noise=rng.normal(0,1,(n,n)).astype('float32');cloud=ndimage.gaussian_filter(noise,13);dust=ndimage.gaussian_filter(luma,12);dust-=np.mean(dust)
 wear=3.4*noise+cloud*(1.80/cloud.std())+.17*dust
 def mix(mask,color,opacity=.95,texture=.32):
  nonlocal base
  a=np.asarray(mask,dtype='float32')[:,:,None]*(opacity/255.)
  base+=a*(np.array(color,dtype='float32')[None,None,:]+(texture*grain+wear)[:,:,None]-base)
 foundation=unary_union(list(pad.values()))
 mix(geom(foundation.buffer(.29)).filter(ImageFilter.GaussianBlur(6.0)),(96,93,89),.65,.70)
 palette={'science':(113,124,124),'power':(66,78,83),'crew':(137,144,137),'flight':(94,101,105),'station':(107,121,121)}
 for k,p in pad.items():
  mix(geom(p),palette[k],.88,.37)
  mix(geom(p.difference(p.buffer(-.087))),(77,83,79),.83,.44)
  # Individual expansion joints and patches vary within each family of precast slabs.
  seams=layer();sd=ImageDraw.Draw(seams);bolts=layer();bd=ImageDraw.Draw(bolts);a,b,c,e=p.bounds
  xi=np.arange(a+.22,c,1.84 if k!='flight' else 2.48);yi=np.arange(b+.25,e,2.05 if k!='power' else 2.65)
  for y in yi:line(sd,[(a,y),(c,y)],.035)
  for j,y in enumerate(yi):
   for x0 in xi:
    x=x0+(.48 if j%2 else 0);line(sd,[(x,y),(x,min(e,y+(yi[1]-yi[0])))],.032)
    for t in [.11,.22]:rect(bd,x+.08,y+t,.041,.048)
  clip=np.asarray(geom(p.buffer(-.12)))
  mix(Image.fromarray(np.minimum(np.asarray(seams),clip)),(48,56,56),.7,.18)
  mix(Image.fromarray(np.minimum(np.asarray(bolts),clip)),(39,46,46),.8,.25)
 # Granular service roads are legible at table height and terminate at actual thresholds.
 for i,g in enumerate(roads+tugs):
  width=2.12 if i<len(roads) else 1.66
  mix(geom(g.buffer(width/2+.12,cap_style=2,join_style=3)).filter(ImageFilter.GaussianBlur(2.6)),(143,140,127),.74,.60)
  mix(geom(g.buffer(width/2,cap_style=2,join_style=3)),(72,79,82) if i<len(roads) else (60,64,65),.89,.55)
  tread=layer();td=ImageDraw.Draw(tread);slots=layer();sd=ImageDraw.Draw(slots)
  for sign in [-1,1]:
   off=g.offset_curve(sign*width*.31)
   if off.geom_type=='LineString':line(td,off.coords,.095,255)
  for travel in np.arange(.46,g.length-.18,1.09):
   p0=np.array(g.interpolate(travel).coords[0]);along=np.array(g.interpolate(travel+.05).coords[0])-np.array(g.interpolate(travel-.05).coords[0]);along/=np.linalg.norm(along);v=np.array([-along[1],along[0]])
   line(sd,[p0-v*(width*.49),p0+v*(width*.49)],.025)
  mix(tread,(44,49,49),.63,.60);mix(slots,(48,50,48),.66,.46)
 # Covered power and coolant runs stop at the inverter, tower and actual array footings.
 ducts=layer();high=layer();dd,hd=ImageDraw.Draw(ducts),ImageDraw.Draw(high)
 runs=[[(19.0,-18.7),(19.0,-7.05),(16.0,-7.05),(15.60,-6.64),(15.60,-5.62)],[(19.0,-18.7),(20.4,-20.15)]]
 for v in [-17.10,-12.58,-8.06]:runs.append([(18.07,v+.42),(19.0,v+.42)])
 for pts in runs:
  line(dd,pts,.34);line(hd,pts,.19)
 mix(ducts,(41,51,53),.91,.24);mix(high,(132,143,140),.87,.19)
 stripe,light=layer(),layer();sd,ld=ImageDraw.Draw(stripe),ImageDraw.Draw(light)
 for u,v in [(-.83,-11.68),(-.83,-8.32),(6.98,2.45),(10.62,2.45)]:
  for j in range(4):line(ld,[(u-.32+j*.20,v-.17),(u-.32+j*.20,v+.17)],.10)
 for v in [-18.5,-14.5,-10.3,-6.7]:
  for u in (9.19,18.62):line(sd,[(u,v),(u,v+.69)],.08)
 for v in (-16.9,-12.69,-8.48):
  for u in (11.35,16.65):
   for sign in (-1,1):line(ld,[(u+sign*1.87,v-.99),(u+sign*1.87,v-1.51),(u+sign*1.4,v-1.51)],.056)
 for v in np.arange(3.1,13.,.53):line(sd,[(-23.53,v),(-23.03,v+.28)],.12)
 for u in np.arange(14.80,19.24,.38):line(sd,[(u,21.30),(u+.19,21.10)],.083)
 for u,v in [(-11.69,8.52),(-11.68,11.9),(5.58,8.4),(-7.00,-4.82),(13.1,14.2)]:
  for i in range(4):line(ld,[(u+i*.22,v),(u+i*.22+.12,v)],.075)
 mix(stripe,(220,170,76),.88,.42);mix(light,(203,204,179),.85,.52)
 stamps=layer();st=ImageDraw.Draw(stamps)
 face='/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf'
 for pos,txt,sz in [((-10.7,-22.28),'LAB  01',.61),((9.15,-19.00),'PV  /  02',.46),((15.67,6.49),'MED  /  03',.42),((-20.62,2.48),'FLIGHT  04',.44),((-.96,22.47),'W 04',.32)]:
  st.text(pix(pos),txt,font=ImageFont.truetype(face,round(sz*s)),fill=255,anchor='lt',stroke_width=0)
 mix(stamps,(210,207,180),.79,.47)
 result=Image.fromarray(np.uint8(np.clip(base,0,255))).transpose(Image.Transpose.ROTATE_90)
 result.save(A/'station-ground.jpg',quality=92,optimize=True)
if __name__=='__main__':
 import sys
 (grade if 'mesh' in sys.argv else art)()
