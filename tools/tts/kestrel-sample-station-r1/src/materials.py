"""A shared, dust-worn station atlas; lettered enamel plates have their own UV islands."""
from base import *
from PIL import Image,ImageDraw,ImageFont,ImageFilter
from scipy import ndimage
import random
SIZE=256
SWATCH={'ivory':(203,201,181),'graphite':(53,62,64),'teal':(55,108,110),'saffron':(211,151,64),
 'steel':(139,151,151),'foil':(178,144,81),'seal':(42,44,44),'basalt':(121,116,112),'cloth':(165,162,145),
 'glass':(39,69,78),'grate':(85,94,94),'light':(226,200,142)}
LABELS={'intake':('01','SAMPLE INTAKE','DUST LOCK   /   INBOUND'),
 'corevault':('02','COLD CHAIN','SEALED CORES   /   TRANSIT'),
 'power':('03','ARRAY BUS','PV FIELD   /   ISOLATOR'),
 'suits':('04','SUITPORTS','EVA   /   CREW QUARTERS'),
 'drill':('05','CORE RIG','WEST RIM   /   GEOLOGY'),
 'water':('06','H₂O RESERVE','HABITAT   /   LOOP B'),
 'westshield':('07','CRYO ANNEX','THERMAL   /   WEST'),
 'northshield':('08','NAVIGATION','OPTICS   /   CLEAN SIDE')}
KEYS=list(SWATCH)+list(LABELS)
COLS=4;ROWS=5
def rect(key):
 n=KEYS.index(key);return n%COLS*SIZE,n//COLS*SIZE
def uv(key,u,v):
 x,y=rect(key);return ((x+4+(SIZE-8)*u)/(COLS*SIZE),1-(y+4+(SIZE-8)*(1-v))/(ROWS*SIZE))
def font(sz,weight='Bold'):
 return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-'+weight+'.ttf',sz)
def generate():
 rng=np.random.default_rng(46);r=random.Random(31);N=SIZE;y,x=np.mgrid[:N,:N];atlas=Image.new('RGB',(COLS*N,ROWS*N))
 for key,col in SWATCH.items():
  broad=ndimage.gaussian_filter(rng.normal(0,1,(N,N)),8);broad=broad/(broad.std()+.0001)
  grain=rng.normal(0,1,(N,N));p=2.4*broad+2.2*grain
  if key=='steel':p+=ndimage.gaussian_filter(grain,(.2,12))*11
  if key=='basalt':p=broad*7+grain*10+ndimage.gaussian_filter(grain,.9)*21
  if key=='foil':p+=np.abs(np.sin(x*.095+y*.041+2.2*np.sin(y*.045)))*13+np.abs(np.sin(y*.09-x*.08+1.7*np.sin(x*.031)))*10
  if key=='cloth':p+=3*((x%4==0)|(y%4==0))
  if key=='glass':p+=12*np.exp(-((x+y*.85-111)/24)**2)
  if key=='grate':p-=((x%11<3)&(y%9<6))*46
  mat=Image.fromarray(np.uint8(np.clip(np.array(col)+p[:,:,None],0,255)));d=ImageDraw.Draw(mat)
  if key in ('steel','teal','ivory','saffron','graphite'):
   for _ in range(95):
    xx=r.randrange(N);yy=r.randrange(N);ln=r.randint(1,11)
    d.line([(xx,yy),(xx+ln,yy+r.choice([-1,0,1,1]))],fill=tuple(max(0,v-r.randint(14,38)) for v in col))
  atlas.paste(mat,rect(key))
 for key,(num,line,sub) in LABELS.items():
  im=Image.new('RGB',(N,N),(35,57,62));d=ImageDraw.Draw(im)
  d.rounded_rectangle((6,9,249,246),radius=8,outline=(153,168,165),width=3);d.rectangle((11,14,245,51),fill=(199,149,74))
  d.text((19,16),'KESTREL    /    '+num,font=font(23),fill=(31,44,47))
  words=line.split(' ');label='\n'.join(words)
  size=49
  while size>24 and max(d.textlength(t,font=font(size)) for t in words)>218:size-=1
  d.multiline_text((18,62),label,font=font(size),fill=(230,228,205),spacing=0,stroke_width=0)
  d.line([(18,184),(236,184)],fill=(122,152,149),width=2);d.text((18,190),sub,font=font(13),fill=(217,222,201))
  for i in range(20):
   a=19+i*4;d.rectangle((a,217,a+(2 if i%3 else 3),229),fill=(174,188,177))
  for cx,cy in ((10,11),(244,11),(10,243),(244,243)):
   d.ellipse((cx-2,cy-2,cx+2,cy+2),fill=(168,173,163))
  atlas.paste(im,rect(key))
 atlas.save(ASSETS/'station-finishes.jpg',quality=91,subsampling=0,optimize=True)
if __name__=='__main__': generate()

def tint_hulls():
    reference=next(o for o in ORIGINAL['ContainedObjects'] if o['GUID']=='c70033')['CustomMesh']['DiffuseURL']
    im=Image.open(local(reference)).convert('RGB');w,h=im.size
    for name,roof,wall in [('flight',(151,105,69),(209,197,176)),('laboratory',(66,119,121),(192,204,198))]:
        out=im.copy()
        for idx,tint,strength in [(2,roof,.89),(0,wall,.47)]:
            x=(idx%4)*w//4;y=(idx//4)*h//3;box=(x,y,(idx%4+1)*w//4,(idx//4+1)*h//3)
            a=np.asarray(im.crop(box)).astype(float);lum=a@np.array([.25,.62,.13]);new=np.clip(np.array(tint)+(lum-np.median(lum))[:,:,None]*.86,0,255)
            out.paste(Image.fromarray(np.uint8(a*(1-strength)+new*strength)),(x,y))
        out.save(ASSETS/(name+'-hull.jpg'),quality=89,subsampling=0,optimize=True)
