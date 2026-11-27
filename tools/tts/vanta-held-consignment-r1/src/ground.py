"""Wear, staffing and inspection marks in the original single playing-surface texture."""
from yard import *
from PIL import Image,ImageDraw,ImageFont
from scipy import ndimage
N=2048
S=(N-1)/48.
def pixel(p):return ((24-p[0])*S,(24-p[1])*S)
def whole(points):return [tuple(int(round(i)) for i in pixel(p)) for p in points]
def build():
 root=next(o for o in originals()['ContainedObjects']if o['GUID']=='810008')
 base=np.asarray(Image.open(cache(root['CustomMesh']['DiffuseURL'])).convert('RGB').resize((N,N),Image.Resampling.LANCZOS),dtype=float)
 random=np.random.default_rng(617)
 texture=random.random((N,N),dtype=np.float32)
 coarse=ndimage.gaussian_filter(texture,2.2);coarse=(coarse-.5)/max(coarse.std(),1e-6)
 wear=np.clip(.75+.14*coarse+.23*(texture-.5),.09,.99);wear*=np.where(texture<.075,.19,1.)
 def layer(color,opacity,fn):
  nonlocal base
  im=Image.new('L',(N,N));d=ImageDraw.Draw(im);fn(d)
  amt=np.asarray(im,dtype=np.float32)/255*opacity*wear
  base=base*(1-amt[:,:,None])+np.array(color)*amt[:,:,None]
 def line(d,pts,wd=.075,fill=255):
  d.line(whole(pts),fill=fill,width=max(1,round(wd*S)),joint='curve')
 def stenc(d,txt,x,z,size,rot=0):
  f=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf',round(size*S))
  b=f.getbbox(txt);im=Image.new('L',(b[2]-b[0]+8,b[3]-b[1]+8));ImageDraw.Draw(im).text((4-b[0],4-b[1]),txt,font=f,fill=220)
  im=im.transpose(Image.Transpose.FLIP_LEFT_RIGHT).rotate(rot,expand=True,resample=Image.Resampling.BICUBIC);cx,cz=pixel((x,z));d._image.paste(im,(round(cx-im.width/2),round(cz-im.height/2)),im)
 def boxmarks(d,cx,cz,wx,wz,arm=.54):
  for sx in (-1,1):
   for sz in (-1,1):
    x=cx+sx*wx/2;z=cz+sz*wz/2
    line(d,[(x-sx*arm,z),(x,z),(x,z-sz*arm)])
 def tire(d):
  # Rubber darkens turning approaches, and fades before pedestrian crossings.
  for short in [[(-23.9,-.27),(-21.9,-.27),(-18.3,-.27),(-16.7,.20)], [(-8.9,.41),(-7.4,.40),(-5.8,-.52),(-4.8,-1.34)],[(4.6,-1.45),(5.7,-1.75),(6.9,-3.44),(7.16,-6.6),(7.3,-8.95),(8.5,-10.10),(10.0,-10.70),(13.15,-10.63)],[(8.50,-3.48),(8.60,-.13),(9.15,.40),(11.12,.50)]]:
   for off in (-.48,.48):
    points=np.array(short);t=np.gradient(points,axis=0);n=np.column_stack((-t[:,1],t[:,0]));n=n/np.linalg.norm(n,axis=1)[:,None];line(d,(points+off*n).tolist(),.22,180)
 layer((67,66,63),.31,tire)
 def inbound(d):
  # Painted approach, stop bar, bay footprints and diagonals on the isolation island.
  line(d,[(-23.9,-1.85),(-18.15,-1.85)],.095);line(d,[(-23.9,1.30),(-18.15,1.30)],.095)
  line(d,[(-23.47,-1.60),(-23.47,1.13)],.19)
  boxmarks(d,6.94,-17.00,3.90,6.05,.88)
  boxmarks(d,10.65,-11.38,2.58,2.07)
  boxmarks(d,18.60,-11.63,2.60,2.08)
  for cx,cz in [(.20,-21.70),(2.50,21.70)]:boxmarks(d,cx,cz,2.95,4.81,.51)
  for z in np.arange(-19.45,-14.7,.48):line(d,[(8.08,z),(8.70,z+.35)],.085)
  for x in np.arange(10.5,18.3,.64):line(d,[(x,-12.39),(x+.23,-12.65)],.08,200)
  stenc(d,'Q2',6.03,-13.30,.82);stenc(d,'HOLD',7.84,-13.30,.62)
  boxmarks(d,-14.80,-5.80,5.46,5.40,.55)
  boxmarks(d,-20.76,-9.00,2.48,2.02,.45)
  stenc(d,'02',-18.10,-7.6,.65)
  # Branch arrows appear at the actual changes of direction.
  for x,z,theta in [(-16.3,-.22,-3),(-6.2,-.44,-19),(6.25,-2.54,-50),(7.30,-8.63,-83),(9.55,-10.61,-8)]:
   a=math.radians(theta);u=np.array((math.cos(a),math.sin(a)));n=np.array((-u[1],u[0]));p=np.array((x,z))
   pol=[p+.51*u,p+.07*u+.23*n,p+.09*u+.071*n,p-.47*u+.071*n,p-.47*u-.071*n,p+.09*u-.071*n,p+.07*u-.23*n]
   d.polygon(whole(pol),fill=220)
 layer((219,169,81),.79,inbound)
 def dispatch(d):
  boxmarks(d,8.5,-4.12,2.45,6.38,.8);boxmarks(d,9.73,1.55,2.53,2.08)
  stenc(d,'D3',10.13,-7.53,.72)
  for xx in [9.48,10.03,10.58]:line(d,[(xx,-.28),(xx+.22,-.08),(xx,-.0)],.075)
  line(d,[(20.73,-.14),(23.98,-.14)],.085)
  for x in (16.4,20.5,23.1):line(d,[(x-.20,.40),(x+.09,.52),(x-.20,.64)],.076)
 layer((103,172,166),.72,dispatch)
 def pedestrian(d):
  # Staff bays by the inspection hall and a separate pedestrian crossing into Gate Intake.
  for x in (-16.64,-14.07,-11.49):
   line(d,[(x,-23.22),(x,-19.42)],.075)
  line(d,[(-16.67,-19.42),(-11.46,-19.42)],.095)
  stenc(d,'STAFF',-13.98,-23.59,.49)
  for x in np.arange(-20.9,-19.10,.34):line(d,[(x,1.55),(x,2.72)],.17,210)
  for z in np.arange(-7.30,-5.65,.34):line(d,[(10.0,z),(10.93,z)],.16,195)
  stenc(d,'GATE 01',-21.6,-2.28,.43)
 layer((215,212,195),.77,pedestrian)
 Im=Image.fromarray(np.uint8(np.clip(base,0,255)));Im.save(A/'freeport-ground.jpg',quality=93,subsampling=0,optimize=True)
if __name__=='__main__':build()
