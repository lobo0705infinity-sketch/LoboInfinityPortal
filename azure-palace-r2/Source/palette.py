from pathlib import Path
import numpy as np, math, random, json
from PIL import Image,ImageDraw,ImageFont,ImageOps,ImageFilter
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'Assets';OLD=ROOT/'original'/'Assets'
if not OLD.is_dir():OLD=ROOT.parent/'azure-palace-r1'/'Assets'
RNG=np.random.default_rng(241125);random.seed(241125)
src=Image.open(OLD/'azure-material-atlas.png').convert('RGB')
RES=Image.Resampling
def swatch(i,n):
 w,h=src.size;c=i%4;r=i//4
 return src.crop((round(w*c/4)+3,round(h*r/4)+3,round(w*(c+1)/4)-3,round(h*(r+1)/4)-3)).resize((n,n),RES.LANCZOS)
def lumen(a):return a[...,0]*.2126+a[...,1]*.7152+a[...,2]*.0722
def noise(n,grid,sd):
 q=RNG.normal(0,sd,(grid,grid)).astype('float32')
 return np.asarray(Image.fromarray(q).resize((n,n),RES.BICUBIC))
def material(i,n,mean,strength=1,variation=1):
 a=np.asarray(swatch(i,n),dtype='float32');y=lumen(a); tint=np.array(mean,dtype='float32')
 dif=(y-np.median(y))*strength+noise(n,12,variation)
 return Image.fromarray(np.uint8(np.clip(tint+dif[:,:,None]+(a-a.mean((0,1))-(y-y.mean())[:,:,None])*.32,0,255)))
def font(n,serif=False,bold=False):
 stem='P052-Bold' if serif and bold else 'P052-Roman' if serif else 'NimbusSansNarrow-Bold' if bold else 'NimbusSans-Regular'
 return ImageFont.truetype('/usr/share/fonts/opentype/urw-base35/'+stem+'.otf',int(n))
def fit(d,s,w,start,serif=False,bold=False):
 n=start
 while n>11:
  f=font(n,serif,bold)
  if d.textlength(s,font=f)<=w:return f
  n-=1
 return font(n,serif,bold)
def stroke_rect(d,r,c,w=1):d.rectangle(r,outline=c,width=w)
N=512
palette=[(212,195,165),(28,105,104),(200,208,189),(161,120,64),(198,179,148),(118,122,117),(61,66,64),(25,71,83),(117,78,49),(220,214,197),(199,181,151),(48,47,44),(155,142,118),(77,61,47),(61,146,146),(65,102,68)]
arch=Image.new('RGB',(N*4,N*4))
for i,c in enumerate(palette):
 m=material(i,N,c,.78 if i in (0,4) else 1.0,2)
 arch.paste(m,((i%4)*N,(i//4)*N))
arch.save(OUT/'palace-materials.jpg',quality=92,subsampling=0,optimize=True)
# The whole courtyard gets a continuous UV layout: storm-washed stone courses, thresholds, seam wear, drains.
S=3072;ppi=S/48
court=Image.new('RGB',(S,S));cr=random.Random(84319)
source_grain=np.asarray(ImageOps.grayscale(swatch(6,900)),dtype='float32')
source_grain=source_grain-np.median(source_grain)
row=0;y=-19
while y<S:
 ht=cr.choice([46,52,57,63,68,75]);x=-cr.randrange(1,185)
 while x<S:
  w=cr.choice([89,107,125,141,152,179,197]);e=cr.uniform(-6,9)
  xx,yy=cr.randrange(0,690),cr.randrange(0,799)
  g=source_grain[yy:yy+ht,xx:xx+w]*(.23+cr.random()*.12)
  sy,sx=np.mgrid[:ht,:w];fine=RNG.normal(0,2,(ht,w));vein=np.exp(-((sy-cr.uniform(-40,40)-sx*cr.uniform(.10,.45)-3*np.sin(sx/18))/cr.uniform(.85,1.6))**2)*cr.uniform(3,13)
  a=g+fine+vein+e+1.3*np.sin(sx/43+sy/37)
  a[:,0:2]-=9;a[0:2,:]-=9;a[2:3,:]+=8;a[:,2:3]+=7;a[-1:,:]-=5
  c=np.array([61,83,89]) if row%7!=3 else np.array([65,85,88])
  tile=np.uint8(np.clip(a[:,:,None]+c+np.array([cr.randrange(-3,4),0,cr.randrange(-2,3)]),0,255))
  court.paste(Image.fromarray(tile),(x,y));x+=w
 y+=ht;row+=1
def uv(x,z):return ((x+24)*ppi,(24-z)*ppi)
def worldline(d,line,fill,width=2):
 d.line([uv(x,z) for x,z in line],fill=fill,width=width,joint='curve')
def wr(d,box,c,w):
 x0,z0,x1,z1=box;worldline(d,[(x0,z0),(x1,z0),(x1,z1),(x0,z1),(x0,z0)],c,w)
d=ImageDraw.Draw(court)
# Tarnished metal borders are interrupted at the middle of each approach.
for distance,col,width in [(.46,(92,97,87),11),(.46,(129,115,79),3),(.60,(41,63,70),4)]:
 xx=3+distance;zz0=-6-distance;zz1=4+distance
 for sg in [-1,1]:
  for zz,b in [(zz0,-1.95),(zz1,-.05)]:worldline(d,[(sg*xx,b),(sg*xx,zz),(sg*1.12,zz)],col,width)
# Paired drain channels embedded in selected paved areas.
for x,z,axis,length in [(-2.35,7.6,0,3.35),(2.35,-9.5,0,3.35),(4.0,1.9,0,2.5),(-4.0,-3.9,0,2.5),(-11,8,1,2.75),(11,-8,1,2.75),(-9,21,1,2.45),(9,-21,1,2.45),(-21,-4.8,0,2.1),(21,4.8,0,2.1)]:
 def pp(a,b):return(x+(a if axis else b),z+(b if axis else a))
 for off,c,wid in [(0,(33,48,51),12),(0,(78,82,70),9)]: worldline(d,[pp(-length/2,off),pp(length/2,off)],c,wid)
 for a in np.arange(-length/2+.055,length/2-.018,.088):worldline(d,[pp(a,-.054),pp(a+.028,.054)],(29,49,53),2)
# Traces of dampness, blue-slate variation and wind-driven weathering span courses.
large=noise(S,26,4)+noise(S,83,2.9)
ca=np.asarray(court).astype('float32');ca=np.uint8(np.clip(ca+large[:,:,None],0,255));court=Image.fromarray(ca)
gtex=Image.new('RGB',(4096,4096),(64,78,78));gtex.paste(court,(8,8));gtex.paste(arch.resize((960,960),RES.LANCZOS),(3120,8))
gtex.save(OUT/'court-and-basin.jpg',quality=90,subsampling=0,optimize=True)
court.thumbnail((800,800));court.save(ROOT/'Review'/'paving-study.jpg',quality=86)
# TTS loads this one shared sheet for architectural art, signage, inlays and interior floor finishes.
SIZE=3072;atlas=Image.new('RGB',(SIZE,SIZE),(45,47,46));cells={}
def cell(k,i,img):
 atlas.paste(img.resize((N,N),RES.LANCZOS),((i%6)*N,(i//6)*N));cells[k]=i
art=Image.open(ROOT/'artsrc'/'coastal-art.png').convert('RGB');aw,ah=art.size
for i,name in enumerate(['egret','swell','citrus','promenade']):
 x=i%2;y=i//2
 im=art.crop((round(aw*x/2)+4,round(ah*y/2)+4,round(aw*(x+1)/2)-4,round(ah*(y+1)/2)-4))
 cell(name,i,im)
cell('frame',4,material(3,N,(133,102,59),.67));cell('edge',5,material(7,N,(30,49,51),.5))
labels=[('sunward-wing','SUNWARD','HOTEL WING','sun'),('seaward-wing','SEAWARD','HOTEL WING','wave'),('azure-spa','AZURE','THERMAL SPA','drop'),('terrace-restaurant','TERRACE','RESTAURANT','leaf'),('north-villa','NORTH','GUEST VILLA','north'),('east-villa','EAST','GUEST VILLA','east'),('south-villa','SOUTH','GUEST VILLA','south'),('west-villa','WEST','GUEST VILLA','west'),('reception','PALACE','RECEPTION','arc'),('cafe','POOLSIDE','CAFÉ','cup'),('laundry','LINEN','LAUNDRY','fold'),('pool-equipment','POOL','ENGINEERING','gear')]
def emblem(d,k,x=256,y=143,scale=1):
 col=(217,186,127);w=5
 def pts(v):return [(x+i*scale,y+j*scale) for i,j in v]
 def line(v):d.line(pts(v),fill=col,width=w,joint='curve')
 def ellipse(u):d.ellipse((x-u*scale,y-u*scale,x+u*scale,y+u*scale),outline=col,width=w)
 if k=='sun':
  ellipse(22)
  for i in range(12):
   a=i*math.pi/6;line([(31*math.sin(a),31*math.cos(a)),(49*math.sin(a),49*math.cos(a))])
 elif k=='wave':
  for dy in [-15,0,15]:line([(i,dy+9*math.sin(i/18)) for i in range(-53,54)])
 elif k in ['north','south','west','east']:
  ellipse(44);rot={'north':0,'east':90,'south':180,'west':270}[k]*math.pi/180
  def spin(u,v):return(u*math.cos(rot)-v*math.sin(rot),u*math.sin(rot)+v*math.cos(rot))
  d.polygon(pts([spin(0,-35),spin(10,10),spin(0,2),spin(-10,10)]),fill=col);line([spin(0,5),spin(0,28)])
 elif k in ['leaf','drop']:
  if k=='drop':line([(0,-48),(-22,-11),(-27,11),(-18,29),(0,37),(18,29),(27,10),(22,-11),(0,-48)])
  else:line([(-39,23),(-27,-11),(2,-29),(41,-32),(32,1),(10,20),(-39,23),(20,-16)])
 elif k=='arc':
  for xx in [-46,-26,0,26,46]:line([(xx,33),(xx,-10)])
  line([(-50,-10),(-30,-26),(0,-39),(30,-26),(50,-10)])
 elif k=='cup':
  line([(-35,-14),(23,-14),(19,19),(7,30),(-14,30),(-29,20),(-35,-14)]);line([(23,-8),(39,-8),(43,6),(36,14),(22,14)]);line([(-44,38),(42,38)])
 elif k=='fold':
  for j in range(3):line([(-39,-23+j*18),(25,-23+j*18),(39,-14+j*18),(37,-9+j*18),(-40,-9+j*18)])
 else:
  ellipse(32);ellipse(13)
  for j in range(8):
   a=j*math.pi/4;line([(math.sin(a)*33,math.cos(a)*33),(math.sin(a)*45,math.cos(a)*45)])
def plaque(i,top,sub,key):
 im=material(1,N,(22+(i%3)*3,56+(i%4)*2,61+(i%2)*2),.30,1.1);dr=ImageDraw.Draw(im)
 stroke_rect(dr,(10,10,N-11,N-11),(109,91,61),4);stroke_rect(dr,(18,18,N-19,N-19),(174,145,97),2)
 emblem(dr,key,256,137,.88)
 dr.text((256,255),top,font=fit(dr,top,440,100,True,True),fill=(246,228,190),anchor='mm',stroke_width=0)
 dr.line((98,321,414,321),fill=(153,126,83),width=3)
 dr.text((256,375),sub,font=fit(dr,sub,420,49,False,True),fill=(227,212,181),anchor='mm')
 for xx in [31,481]:
  for yy in [31,481]:dr.ellipse((xx-4,yy-4,xx+4,yy+4),fill=(167,143,105))
 return im
for i,(slug,name,typ,mark) in enumerate(labels):cell('sign-'+slug,i+6,plaque(i,name,typ,mark))
def surface(i,kind):
 col={'suite':(167,139,108),'villa':(167,108,65),'spa':(98,164,151),'restaurant':(141,98,68),'lobby':(192,177,146),'cafe':(167,112,77),'utility':(121,133,127),'roof':(151,150,141)}[kind]
 im=material({'suite':4,'villa':8,'spa':14,'restaurant':8,'lobby':2,'cafe':4,'utility':5,'roof':5}[kind],N,col,.55,2);d=ImageDraw.Draw(im)
 if kind in ('villa','restaurant'):
  for y in range(0,N,48):
   d.line((0,y,N,y),fill=tuple(max(0,c-36) for c in col),width=3)
   for x in range((y//48%3)*53,N,160):d.line((x,y,x,y+47),fill=tuple(c-31 for c in col),width=2)
 elif kind=='cafe':
  im=Image.blend(im,Image.new('RGB',(N,N),col),.24);d=ImageDraw.Draw(im)
  for y in range(0,N,64):
   for x in range(0,N,64):
    d.rectangle((x+1,y+1,x+62,y+62),outline=(128,87,61),width=2)
    if (x//64+y//64)%3==0:d.polygon([(x+32,y+15),(x+48,y+32),(x+32,y+47),(x+16,y+32)],outline=(216,175,128),width=2)
 elif kind in ('suite','lobby','roof'):
  for y in range(0,N,85):
   d.line((0,y,N,y),fill=tuple(c-27 for c in col),width=2)
   for x in range((y//85%2)*59,N,128):d.line((x,y,x,y+85),fill=tuple(c-23 for c in col),width=2)
 elif kind=='spa':
  for p in range(0,N,32):
   d.line((0,p,N,p),fill=(147,180,162),width=2);d.line((p,0,p,N),fill=(147,180,162),width=2)
 else:
  for j in range(4800):
   x=random.randrange(N);y=random.randrange(N);c=random.choice([(94,111,104),(154,155,134),(68,86,80)])
   d.point((x,y),fill=c)
 return im
for i,k in enumerate(['suite','villa','spa','restaurant','lobby','cafe','utility','roof']):cell(k,18+i,surface(i,k))
def diagram(key):
 im=material(1,N,(32,75,74) if key=='water' else (86,84,72),.23)
 d=ImageDraw.Draw(im);fg=(219,216,180);br=(188,155,98)
 d.text((35,27),'PUMP CIRCUIT' if key=='water' else 'LINEN SERVICE',font=font(38,False,True),fill=fg)
 d.line((34,83,474,83),fill=br,width=4)
 for i in range(3):
  y=151+95*i
  d.line((60,y,168,y,168,y+17,327,y+17,327,y,455,y),fill=fg,width=5)
  d.ellipse((189,y-5,225,y+32),outline=br,width=4);d.rectangle((342,y-14,392,y+14),outline=br,width=4)
  d.text((66,y+20),(['INTAKE','FILTER','RETURN'] if key=='water' else ['RECEIVE','WASH','PRESS'])[i],font=font(17),fill=fg)
 d.line((35,425,475,425),fill=br,width=2);d.text((35,450),'AZURE PALACE  /  FACILITIES',font=font(18),fill=fg);return im
cell('water',26,diagram('water'));cell('linen',27,diagram('linen'))
for i,(key,c,b) in enumerate([('runner-blue',(46,83,91),(179,151,102)),('runner-russet',(142,78,60),(206,169,116)),('runner-sage',(75,112,100),(200,179,127))]):
 im=material(9,N,c,.52);d=ImageDraw.Draw(im)
 for a in [12,22,42]:stroke_rect(d,(a,a,N-a-1,N-a-1),b,3 if a==22 else 2)
 for j in range(46,470,32):
  for y in [34,478]:d.line((j-7,y,j,y-6,j+7,y),fill=b,width=2)
 for cx,cy in ((256,256),(256,138),(256,374)):
  for a in (14,25):d.line((cx-a,cy,cx,cy-a,cx+a,cy,cx,cy+a,cx-a,cy),fill=b,width=2)
 cell(key,28+i,im)
cell('teal',31,material(1,N,(39,111,107),.56));cell('basalt',32,material(6,N,(61,82,84),.53));cell('wood',33,material(8,N,(121,76,45),.84));cell('ceramic',34,material(2,N,(222,210,177),.45));cell('stone',35,material(4,N,(205,184,151),.82))
atlas.save(OUT/'arts-and-finishes.jpg',quality=92,subsampling=0,optimize=True)
(ROOT/'Source'/'atlas-cells.json').write_text(json.dumps(cells,indent=2))
print('Created 3 shared texture sheets',[(p.name,p.stat().st_size) for p in OUT.glob('*.jpg')])
