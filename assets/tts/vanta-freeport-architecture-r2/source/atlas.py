"""Photographic material and normal atlas, with readable enamel, prints, clocks and manifests."""
from design import *
from PIL import Image,ImageDraw,ImageFont,ImageFilter
import json,random
WH=(4096,2048)
# Albedo swatches preserve natural local colour variation, aggregate, grain and mortar.
surfaces={
 'brick':('brick_wall_001',(156,91,67),2.85),'darkbrick':('dark_brick_wall',(113,79,66),2.64),
 'limestone':('white_sandstone_blocks_02',(204,187,151),3.30),'plaster':('plastered_wall_02',(210,196,160),3.90),
 'panel':('corrugated_iron',(190,201,192),2.98),'riboxide':('corrugated_iron',(160,87,65),2.90),
 'navy':('blue_metal_plate',(48,76,91),2.65),'ink':('blue_metal_plate',(65,76,76),2.7),
 'copper':('green_metal_rust',(95,141,126),2.60),'oxide':('rusty_metal_shutter',(160,94,68),2.50),
 'oxblood':('blue_metal_plate',(130,61,52),2.8),'zinc':('metal_plate_02',(116,132,135),2.7),
 'slate':('grey_roof_tiles_02',(99,114,121),3.4),'deck':('concrete_floor_02',(139,141,132),3.5),
 'foot':('concrete_wall_006',(139,132,116),3.1),'timber':('weathered_planks',(151,114,79),3.2),
 'brass':('metal_plate_02',(185,148,90),2.80),'inside':('plastered_wall_02',(213,204,183),3.2),
 'tile':('concrete_floor_02',(162,175,168),3.2),'wood':('wood_table_001',(123,87,63),2.65),
 'glass':('blue_metal_plate',(97,147,151),2.9),'rubber':('metal_plate_02',(61,63,60),2.8),
 'packing':('plastered_wall_02',(202,194,164),2.4),'lamp':('plastered_wall_02',(250,213,147),2.3)
}
special=['clock','shipprint','map','manifest','screen','coldlog','rack','notice','releaseform','sample','glassblock','crate','filebacks','seal','meter','portcrest','board','way','evidence','coldsign','skylight']
art=list(plates)+special
# 24 photographic cells and 32 small art cells. Additional small cells occupy a second print bank only when needed.
# Seven remaining print cells also fit on the spare bottom half of the last material tile for flat lamp decals.
def slot(k):
 if k in surfaces:
  i=list(surfaces).index(k);return (i%6*512,i//6*512,512)
 i=art.index(k)
 if i<32:return (3072+(i%4)*256,i//4*256,256)
 return (5*512+(i-32)*128,3*512+384,128)
def uv(k,u,v):
 x,y,n=slot(k);pad=3 if n>=256 else 2
 # The lamp swatch avoids a narrow reserve for the smallest decals.
 usable_y=370 if k=='lamp' else n-2*pad
 return ((x+pad+u*(n-2*pad))/WH[0],1-(y+pad+(1-v)*usable_y)/WH[1])
def font(s,kind='sans'):
 file={'sans':'DejaVuSansCondensed-Bold','serif':'DejaVuSerif','mono':'DejaVuSansMono','bold':'DejaVuSans-Bold'}[kind]
 return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/'+file+'.ttf',int(s))
def fit(p,s,high,width,kind='sans'):
 while high>7 and p.textbbox((0,0),s,font=font(high,kind))[2]>width:high-=1
 return font(high,kind)
def emblem(d,x,y,r,c):
 d.ellipse((x-r,y-r,x+r,y+r),outline=c,width=max(1,int(r*.12)))
 d.polygon([(x-r*.58,y+r*.27),(x-r*.25,y-r*.45),(x,y+r*.05),(x+r*.46,y-r*.53),(x+r*.27,y+r*.36)],fill=c)
def plaque(k):
 n=512;im=Image.new('RGB',(n,n),(42,68,73));d=ImageDraw.Draw(im);cream=(231,219,187);gold=(198,161,99)
 if k in plates:
  name,subtitle=plates[k];red=k in ['quarantine','sealworks','inspection','bondloft'];bg=(112,55,42)if red else (36,69,77)
  d.rectangle((0,0,511,511),fill=bg);d.rounded_rectangle((12,14,499,498),radius=12,outline=gold,width=5)
  d.line((28,113,484,113),fill=gold,width=3);emblem(d,71,71,24,gold)
  d.text((275,73),'VANTA FREEPORT',font=font(38),anchor='mm',fill=cream)
  d.text((256,245),name,font=fit(d,name,108,447),anchor='mm',fill=cream,stroke_width=0)
  d.line((40,340,471,340),fill=gold,width=3)
  d.text((256,398),subtitle,font=fit(d,subtitle,31,438),anchor='mm',fill=cream)
  for x in (23,489):
   for y in(26,486):d.ellipse((x-3,y-3,x+3,y+3),fill=gold)
 elif k=='clock':
  d.rectangle((0,0,512,512),fill=(78,76,64));d.ellipse((12,12,500,500),fill=(213,201,164),outline=gold,width=13)
  for j in range(60):
   a=j*math.tau/60; rad=198 if j%5==0 else 215
   d.line((256+rad*math.sin(a),256-rad*math.cos(a),256+226*math.sin(a),256-226*math.cos(a)),fill=(45,54,50),width=7 if j%5==0 else 3)
  for j in (12,3,6,9):
   a=j*math.tau/12;d.text((256+161*math.sin(a),256-161*math.cos(a)),str(j),font=font(40,'serif'),anchor='mm',fill=(49,63,59))
  d.text((256,345),'VANTA',font=font(25,'serif'),anchor='mm',fill=(57,64,57));d.line((256,256,147,193),fill=(38,53,51),width=14);d.line((256,256,369,153),fill=(38,53,51),width=10);d.ellipse((245,245,267,267),fill=gold)
 elif k=='shipprint':
  d.rectangle((0,0,512,512),fill=(214,198,153));d.rectangle((22,20,490,491),outline=(85,105,102),width=5);d.text((256,62),'VANTA   FREEPORT',font=font(42,'serif'),anchor='mm',fill=(47,79,86));d.rectangle((40,107,473,390),fill=(166,187,177));d.ellipse((293,133,361,201),fill=(218,162,96))
  for i in range(7):
   xx=50+i*58;d.polygon([(xx,306),(xx,212-i%3*19),(xx+8,210-i%3*19),(xx+37,190-i%3*18),(xx+41,192-i%3*18),(xx+11,223-i%3*19),(xx+10,306)],fill=(75,107,110))
  d.polygon([(57,322),(128,313),(159,292),(319,288),(348,271),(385,267),(377,306),(450,303),(401,349),(101,353)],fill=(55,76,83));d.rectangle((65,356,452,366),fill=(205,151,101));d.text((255,438),'NIGHT MAIL  /  BERTH 04',font=font(27),anchor='mm',fill=(66,82,78))
 elif k=='map':
  d.rectangle((0,0,512,512),fill=(45,88,95))
  for i in range(0,513,24):d.line((i,0,i,512),fill=(63,105,108));d.line((0,i,512,i),fill=(63,105,108))
  r=random.Random(17)
  for row in range(4):
   for col in range(4):
    x=48+col*104+r.randrange(12);y=83+row*87+r.randrange(8);d.rectangle((x,y,x+r.randrange(41,76),y+r.randrange(28,54)),outline=cream,width=3)
  d.line([(54,367),(119,357),(153,303),(255,286),(339,171),(400,159)],fill=(226,166,84),width=8);d.text((29,21),'PORT SURVEY   /   04',font=font(26,'mono'),fill=cream)
 elif k=='glassblock':
  d.rectangle((0,0,512,512),fill=(100,143,139))
  for x in range(0,512,64):
   for y in range(0,512,64):
    d.rounded_rectangle((x+3,y+3,x+61,y+61),radius=8,fill=(120+(x//64%2)*6,163,154),outline=(193,207,182),width=3);d.line((x+10,y+47,x+15,y+14,x+45,y+10),fill=(159,187,171),width=3)
 elif k=='filebacks':
  d.rectangle((0,0,512,512),fill=(69,64,52));r=random.Random(219)
  for y in [15,172,333]:
   x=6
   while x<483:
    w=r.randint(19,42);color=r.choice([(143,115,83),(111,129,118),(171,143,103),(102,91,75)]);d.rounded_rectangle((x,y,x+w-2,y+137),radius=3,fill=color);d.rectangle((x+4,y+18,x+w-5,y+37),fill=(213,201,163));d.ellipse((x+w//2-3,y+107,x+w//2+3,y+113),fill=(55,64,59));x+=w+1
 elif k=='skylight':
  d.rectangle((0,0,512,512),fill=(100,144,150))
  for j in range(0,512,14):d.line((j,0,j,512),fill=(145,176,174),width=3)
 elif k=='portcrest':
  d.rectangle((0,0,512,512),fill=(44,77,80));emblem(d,256,232,156,gold);d.text((256,447),'PORT AUTHORITY',font=font(39,'serif'),anchor='mm',fill=cream)
 else:
  text={'manifest':('BILL OF LADING','VX-417','SEAL DISCREPANCY'),'coldlog':('COLD STORAGE','+04.0°C','SHORE POWER ACTIVE'),'screen':('DISPATCH DESK','BERTH 03','CLEARED / 14:25'),'rack':('SAMPLE HOLD','Q2-18','RETURN WITH SEAL'),'notice':('PORT AUTHORITY','NOTICE','PRESENT PAPERS'),'releaseform':('CLEARED FOR RELEASE','D-03','DISPATCH OFFICE'),'sample':('MATERIALS LAB','417 / B','WITNESS SAMPLE'),'crate':('BONDED CARGO','VX 417','HANDLE UPRIGHT'),'seal':('EVIDENCE','6B-18','RECORDED AT GATE 01'),'meter':('FREEPORT POWER','0418','SERVICE METER'),'board':('SHIFT REGISTER','BAY 02','MANIFESTS RECEIVED'),'way':('CUSTOMS ROUTE','Q2','INSPECTION REQUIRED'),'evidence':('EXAMINATION','VX-417','ENTRY 072'),'coldsign':('COLD ROOM','Q2','KEEP DOOR CLOSED')}[k]
  light=k not in ('screen','coldlog','way','meter');bg=(220,209,175)if light else (34,63,67);fg=(62,76,74) if light else (188,218,186)
  d.rectangle((0,0,512,512),fill=bg);d.rectangle((20,18,490,494),outline=fg,width=3);d.text((255,74),text[0],font=fit(d,text[0],36,428),anchor='mm',fill=fg);d.line((39,114,473,114),fill=fg,width=3)
  d.text((256,198),text[1],anchor='mm',font=fit(d,text[1],80,431,'mono'),fill=fg);d.text((256,275),text[2],anchor='mm',font=fit(d,text[2],26,422),fill=fg)
  for j in range(4):d.line((47,336+j*31,206,336+j*31),fill=fg,width=2);d.line((252,336+j*31,452-j*16,336+j*31),fill=fg,width=2)
 return im
def build():
 f=W/'texture-sources';manifest=json.loads((f/'sources.json').read_bytes());diff=Image.new('RGB',WH,(140,142,136));norm=Image.new('RGB',WH,(128,128,255))
 for k,(key,target,pitch) in surfaces.items():
  x,y,n=slot(k);c=np.asarray(Image.open(f/manifest[key]['color']['file']).convert('RGB').resize((n,n),Image.Resampling.LANCZOS),dtype=float)
  med=np.median(c.reshape((-1,3)),axis=0);l=(c-med)@np.array([.27,.54,.19]);keep=.78 if k in ('brick','darkbrick','timber','limestone')else .34
  rgb=np.array(target)+keep*(c-med)+(1-keep)*l[:,:,None];nr=np.asarray(Image.open(f/manifest[key]['normal']['file']).convert('RGB').resize((n,n),Image.Resampling.LANCZOS),dtype=float)
  if k=='glass':
   yy,xx=np.mgrid[:n,:n];rgb=np.array(target)+.19*l[:,:,None]+(26*np.exp(-((xx+.61*yy-261)/109)**2)-14*(yy/n))[:,:,None];nr[:]=[128,128,255]
  if k=='tile':
   yy,xx=np.mgrid[:n,:n];seam=(xx%64<2)|(yy%64<2);rgb[seam]*=.77
  diff.paste(Image.fromarray(np.uint8(np.clip(rgb,0,255))),(x,y));norm.paste(Image.fromarray(np.uint8(nr)),(x,y))
 for k in art:
  x,y,n=slot(k);diff.paste(plaque(k).resize((n,n),Image.Resampling.LANCZOS),(x,y));norm.paste((128,128,255),(x,y,x+n,y+n))
 diff.save(A/'freeport-facades.jpg',quality=94,subsampling=0,optimize=True);norm.save(A/'freeport-normal.jpg',quality=87,subsampling=0,optimize=True)
if __name__=='__main__':build()
