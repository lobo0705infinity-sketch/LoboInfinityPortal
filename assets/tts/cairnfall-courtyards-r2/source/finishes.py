"""Masonry, timber and cloth based on the sanctuary's existing photographic material sheet."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import materials
from materials import tile,tint,panel
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'assets'
NAMES=['stone','oak','boards','patina','iron','canvas','linen','green','grain','slate','soil','wicker','brass','stores','books','shrine']
materials.INDEX.clear();materials.INDEX.update({n:i for i,n in enumerate(NAMES)})
def build():
 from scene import bag,local
 sheet=Image.open(local(bag()['ContainedObjects'][70]['CustomMesh']['DiffuseURL'])).convert('RGB')
 specs=[(0,(154,147,126),.75),(12,(111,77,48),.82),(12,(135,105,69),.67),(3,(80,108,100),.9),(6,(64,62,55),.53),(9,(153,144,112),.59),(9,(207,198,170),.66),(3,(64,85,76),.7),(9,(161,132,85),.70),(2,(80,83,80),.74),(4,(70,60,38),.63),(12,(140,112,73),.77),(6,(155,127,75),.60),(3,(52,71,57),.59),(12,(67,50,37),.54),(3,(68,83,73),.48)]
 atlas=Image.new('RGB',(2048,2048));normal=Image.new('RGB',(1024,1024),(128,128,255));rng=np.random.default_rng(11892)
 for i,(name,(pick,base,con)) in enumerate(zip(NAMES,specs)):
  tex=tint(tile(sheet,pick),base,con)
  a=np.asarray(tex).astype(float);yy,xx=np.indices((512,512))
  if name=='stone':
   # Random split-face blocks with recessed, weathered bed and head joints.
   cut=np.zeros((512,512));y=-4
   while y<512:
    ht=int(rng.integers(73,113));x=int(rng.integers(-150,-20))
    while x<512:
     width=int(rng.integers(119,245));region=(xx>=x)&(xx<x+width)&(yy>=y)&(yy<y+ht)
     cut[region]=rng.normal(0,5);ed=np.minimum.reduce((xx-x,x+width-xx,yy-y,y+ht-yy))
     cut[region&(ed<=1)]=-38;cut[region&(ed>1)&(ed<4)]=-15;cut[region&(ed>=4)&(ed<5)]=6
     x+=width
    y+=ht
   a+=cut[:,:,None]
  elif name in ('oak','boards'):
   sample=tile(sheet,12).resize((135,512),Image.Resampling.LANCZOS).resize((512,512),Image.Resampling.BICUBIC)
   lamp=np.array(sample.convert('L'),float);a+=.36*(lamp-lamp.mean())[:,:,None]
   wave=3.2*np.sin(yy*.21 +.68*np.sin(xx*.018+yy*.013)) +1.5*np.cos(yy*.56+xx*.004)
   if name=='boards':wave-=np.where((yy%73)<3,26,0)
   a+=wave[:,:,None]
  elif name in ('linen','canvas','grain'):
   a+=(2.5*np.sin(xx*1.7)+2.1*np.cos(yy*1.73))[:,:,None]
  elif name=='slate':
   for y in range(0,512,103):
    a[max(0,y-2):y+2]-=24
    shift=(y//103)*67%124
    for x in range(shift,512,126):a[y:min(y+103,512),x:x+2]-=18
  elif name=='wicker':a+=(4*np.sin(yy*.5+np.sin(xx*.16))+3*np.sin(xx*.42))[:,:,None]
  tex=Image.fromarray(np.uint8(np.clip(a,0,255)))
  if name=='stores':panel(tex,'REFECTORY','KITCHEN DELIVERIES')
  if name=='books':panel(tex,'ARCHIVE','BOOK RETURNS')
  if name=='shrine':
   d=ImageDraw.Draw(tex);c=(184,154,88);d.rounded_rectangle((23,23,489,489),22,outline=c,width=6)
   for radius,width in [(133,6),(119,2),(68,6)]:
    d.ellipse((256-radius,241-radius,256+radius,241+radius),outline=c,width=width)
   for n in range(12):
    ang=n*np.pi/6;d.line((256+76*np.sin(ang),241+76*np.cos(ang),256+107*np.sin(ang),241+107*np.cos(ang)),fill=c,width=4)
   d.polygon([(256,180),(278,232),(320,242),(278,251),(256,304),(236,251),(193,242),(236,231)],fill=c)
   d.text((256,435),'PILGRIMS’ REST',fill=(225,214,176),font=materials.fonts(30),anchor='mm')
  h=np.asarray(tex.convert('L'),float)/255;dy,dx=np.gradient(h);n=np.stack((-dx,dy,np.ones_like(h)),axis=-1);n/=np.linalg.norm(n,axis=-1,keepdims=True)
  atlas.paste(tex,((i%4)*512,(i//4)*512));normal.paste(Image.fromarray(np.uint8((n+1)*127.5)).resize((256,256),Image.Resampling.LANCZOS),((i%4)*256,(i//4)*256))
 atlas.save(OUT/'courtyard-materials.jpg',quality=92,subsampling=0,optimize=True);normal.save(OUT/'courtyard-relief.png',optimize=True)
if __name__=='__main__':build()
