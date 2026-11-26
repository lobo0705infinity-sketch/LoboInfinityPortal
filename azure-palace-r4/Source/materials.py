"""Make one shared, mip-safe atlas for the fitted outdoor furniture."""
from pathlib import Path
import json,math
import numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageOps,ImageFilter
R=Path(__file__).resolve().parents[1];OLD=R.parent/'azure2'/'Assets'
if not OLD.is_dir():OLD=R.parent/'azure-palace-r2'/'Assets'
N=384; COLS=8
mats=['limestone','sage','ceramic','bronze','travertine','roof','asphalt','glass','wood','fabric','enamel','rubber','rock','soil','mosaic','red',
      'teak','slate','oyster','canvas','stripe','brass','iron','green','leaf','blueleaf','newleaf','gravel','pooltile','reed','terrazzo','white',
      'bell','pool','plant','cafe','garden','linen','art','dining','towel','ivory','sea','tag','pressure','filter','menu','resort','tea','copper','steel','bay','artwork']
ids={name:i for i,name in enumerate(mats)}
def normal_font(size,bold=False,serif=False):
 f='P052-Bold' if bold and serif else 'P052-Roman' if serif else 'NimbusSansNarrow-Bold' if bold else 'NimbusSans-Regular'
 return ImageFont.truetype('/usr/share/fonts/opentype/urw-base35/'+f+'.otf',size)
def build():
 source=Image.open(OLD/'palace-materials.jpg').convert('RGB');arts=Image.open(OLD/'arts-and-finishes.jpg').convert('RGB')
 rng=np.random.default_rng(117026)
 def crop(im,n,i):
  b=im.width//n;x=i%n*b;y=i//n*b
  return im.crop((x+4,y+4,x+b-4,y+b-4)).resize((N,N),Image.Resampling.LANCZOS)
 old=[crop(source,4,i) for i in range(16)]
 def grain(i,color,contrast=1,axis=False):
  g=ImageOps.grayscale(old[i])
  if axis:g=g.resize((N//3,N)).resize((N,N),Image.Resampling.BICUBIC)
  a=np.asarray(g,dtype=float);a-=np.median(a)
  return np.clip(np.array(color)[None,None]+a[:,:,None]*contrast,0,255).astype(np.uint8)
 def tile(i,col,s=1):return Image.fromarray(grain(i,col,s))
 def canvas(col,stripe=False):
  a=grain(9,col,.42);y,x=np.indices((N,N));weave=((x%3==0)*4-(y%3==0)*3+rng.normal(0,1.8,(N,N)))[:,:,None]
  a=a.astype(float)+weave
  if stripe:
   pat=(x%60<21)[:,:,None];a=np.where(pat,a*np.array([.31,.59,.56]),a)
   a[:,(np.arange(N)%60==23),:]*=.67
  return Image.fromarray(np.uint8(a.clip(0,255)))
 def wood():
  a=grain(8,(129,87,52),.72,True).astype(float);y,x=np.indices((N,N));growth=np.sin(y*.18+3*np.sin(x*.011)+np.sin(x*.039+y*.018))*4+rng.normal(0,1,(N,N));a+=growth[:,:,None]
  for q in [0,94,191,290]:a[q:q+2]*=.51;a[q+2:q+3]=np.minimum(255,a[q+2:q+3]*1.12)
  return Image.fromarray(a.clip(0,255).astype(np.uint8))
 def leaves(col):
  a=tile(15,col,.55);d=ImageDraw.Draw(a)
  for q in range(125):
   y=int(rng.integers(N));x=int(rng.integers(N));v=int(rng.integers(1,9));k=tuple(min(255,c+v)for c in col);d.line((x,y,x+3,y-1),fill=k,width=1)
  return a
 def sign(title,second,style=0):
  bg=[(26,66,67),(93,70,48),(47,64,67)][style]
  im=tile(7,bg,.23);d=ImageDraw.Draw(im)
  d.rounded_rectangle((10,10,N-11,N-11),radius=14,outline=(177,150,98),width=5)
  d.rounded_rectangle((20,20,N-21,N-21),radius=10,outline=(104,119,103),width=2)
  d.line((112,105,272,105),fill=(184,157,105),width=2);d.polygon([(192,71),(207,87),(192,102),(177,87)],outline=(221,195,144),width=3)
  def fit(txt,maxsize,cap,serif=False):
   size=maxsize
   while size>9 and d.textlength(txt,font=normal_font(size,True,serif))>cap:size-=1
   return normal_font(size,True,serif)
  d.text((N/2,191),title,font=fit(title,76,N-58,True),fill=(244,229,196),anchor='mm')
  d.line((74,250,310,250),fill=(180,153,100),width=2);d.text((N/2,288),second,font=fit(second,36,N-64),fill=(218,209,182),anchor='mm')
  for x in [28,N-29]:
   for y in [28,N-29]:
    d.ellipse((x-3,y-3,x+3,y+3),fill=(164,139,91));d.line((x-1,y,x+2,y),fill=(62,71,61))
  return im
 extra={
 'teak':wood(),'slate':tile(6,(73,81,77),.48),'oyster':tile(0,(214,199,168),.70),'canvas':canvas((219,211,180)),'stripe':canvas((215,206,177),True),'brass':tile(3,(158,125,67),.78),'iron':tile(5,(52,61,59),.68),'green':tile(1,(37,89,78),.63),
 'leaf':leaves((43,83,51)),'blueleaf':leaves((67,111,96)),'newleaf':leaves((101,129,57)),'gravel':tile(12,(125,118,101),.91),'pooltile':crop(arts,6,31),'reed':tile(8,(164,130,86),.48),'terrazzo':tile(4,(173,157,130),.52),'white':tile(2,(224,216,193),.46),'towel':canvas((215,221,208)),'ivory':canvas((223,209,180)),'sea':canvas((69,122,119)),
 'tea':tile(2,(177,144,99),.60),'copper':tile(3,(149,100,66),.64),'steel':tile(5,(114,131,127),.75),'bay':tile(6,(106,110,99),.54),'artwork':crop(arts,6,1)}
 for key,t,sub,style in [('bell','ARRIVALS','BELL DESK',0),('pool','POOL CLUB','TOWELS',0),('plant','PLANT 02','FILTRATION',2),('cafe','POOLSIDE','CAFÉ TERRACE',0),('garden','SEA GARDEN','SPA WALK',0),('linen','LINEN','HOUSEKEEPING',2),('art','TIDELINE','PALACE COLLECTION',1),('dining','TERRACE','DINING ROOM',0),('tag','AP','BAGGAGE',1),('filter','FILTER 02','RETURN LINE',2),('menu','TERRACE','BAR MENU',0),('resort','AZURE','PALACE',0)]:
  extra[key]=sign(t,sub,style)
 meter=tile(2,(218,211,184),.3);dr=ImageDraw.Draw(meter);dr.ellipse((17,17,N-18,N-18),outline=(79,83,69),width=14)
 for a in np.linspace(-210,28,25):
  c,s=math.cos(math.radians(a)),math.sin(math.radians(a));dr.line((192+144*c,192+144*s,192+122*c,192+122*s),fill=(45,57,53),width=5)
 dr.line((192,192,252,83),fill=(144,71,44),width=7);dr.ellipse((182,182,202,202),fill=(59,69,61));extra['pressure']=meter
 atlas=Image.new('RGB',(N*8,N*8),(58,70,67))
 for name,j in ids.items():
  im=old[j] if j<16 else extra[name];x=(j%8)*N;y=(j//8)*N;atlas.paste(im,(x,y))
 atlas.save(R/'Assets/resort-fittings.jpg',quality=91,subsampling=0,optimize=True)
 (R/'Source/material-map.json').write_text(json.dumps(ids,indent=2))
if __name__=='__main__':build()
