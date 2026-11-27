"""Local paint, metals, insulated panels and print islands for working freeport equipment."""
from yard import *
from PIL import Image,ImageDraw,ImageFont,ImageFilter
from scipy import ndimage
colors={'paint':(39,95,101),'slate':(55,65,68),'ivory':(195,199,191),'metal':(143,151,150),'rubber':(38,41,39),'safety':(200,136,47),'holdred':(158,63,51),'glass':(50,78,86),'grill':(66,73,70),'wood':(138,102,65),'wrap':(174,185,170),'concrete':(136,134,122),'tread':(90,98,97),'amber':(237,163,50),'lamp':(215,231,225),'fabric':(65,67,61)}
plates={'manifest':('VANTA / GATE 01','VX–417','SEAL EXCEPTION','REFER TO BAY Q2'),'inbound':('FREEPORT CUSTOMS','01','INBOUND SCALE','STOP AT READER'),'reefer':('VANTA COLD FREIGHT','VX–417','TEMP CONTROLLED','UNIT 08   /   20 FT'),'hold':('CUSTOMS CONTROL','HOLD','VX–417   /   Q2','SEAL UNDER REVIEW'),'display':('REFRIGERATION','+04.0°C','POWER  /  ONLINE','UNIT 08'),'serial':('INTERMODAL','VX 417','TARE   2 790 KG','CHECK  /  3'),'release':('VANTA TRANSFER','D–03','CLEARED FREIGHT','DOCK SERVICES'),'lift':('VANTA HANDLING','Q–12','ELECTRIC LIFT','2 500 KG'),'tag':('RECEIVING COPY','VX–417','HOLD  /  Q2','SEAL 6B-18'),'board':('FREEPORT INSPECTION','SEALS','CHECK / LOG / BAG','BENCH 02'),'scale':('AXLE SCALE','05 820','STABLE     KG','VANTA WEIGHING'),'dock':('OUTBOUND RELEASE','03','TRANSFER DOCK','AUTHORIZED LOADS'),'plate':('VANTA FREEPORT','VT 038','ELECTRIC YARD TUG','DEPOT PLATE'),'mark':('VANTA AUTHORITY','V / F','CUSTOMS YARD','PORT SERVICES')}
names=list(colors)+list(plates);N=256;SIZE=(2048,1024)
def uv(k,u,v):
 i=names.index(k);return ((i%8*N+3+250*u)/SIZE[0],1-(i//8*N+3+250*(1-v))/SIZE[1])
def font(s,mono=False):
 p='/usr/share/fonts/truetype/dejavu/'+('DejaVuSansMono-Bold' if mono else 'DejaVuSansCondensed-Bold')+'.ttf'
 return ImageFont.truetype(p,s)
def fit(d,s,max_px,width):
 while max_px>7 and d.textbbox((0,0),s,font=font(max_px))[2]>width:max_px-=1
 return font(max_px)
def build():
 rng=np.random.default_rng(417);atlas=Image.new('RGB',SIZE,(80,81,76));heights=np.full((SIZE[1],SIZE[0]),128.,np.float32)
 yy,xx=np.mgrid[:N,:N]
 for i,k in enumerate(names):
  x=i%8*N;y=i//8*N;grain=rng.normal(size=(N,N));broad=ndimage.gaussian_filter(grain,6);broad/=max(.01,broad.std())
  pat=grain*2.1+broad*2.6; relief=grain*.75
  if k in colors:
   base=np.array(colors[k]);edge=np.minimum.reduce([xx,yy,N-1-xx,N-1-yy])
   if k=='grill':
    grille=(xx%10<7)&(yy%7<4);pat-=grille*29;relief-=grille*32
   if k=='rubber':pat+=3*np.sin(xx/4);relief+=((xx%14)<2)*3
   if k=='glass':pat+=43*np.exp(-((xx+.72*yy-171)/52)**2)-12*(yy/N)
   if k=='tread':
    ridge=(((xx+yy)%24<5)&((xx//14)%2==0))|(((xx-yy)%24<5)&((xx//14)%2==1));pat+=ridge*18;relief+=ridge*12
   if k=='wood':pat+=7*np.sin(yy/2+1.2*np.sin(xx/31))+6*ndimage.gaussian_filter(grain,(.8,13))
   if k=='wrap':pat+=5*np.sin(yy*.46+.033*xx)+7*np.exp(-((xx+.25*yy-128)/19)**2)
   if k=='metal':pat+=14*ndimage.gaussian_filter(grain,(.25,8))
   if k=='concrete':pat+=5*grain;relief+=2*broad
   if k in ('ivory','safety','paint','holdred','slate'):pat-=(9*np.exp(-edge/9)+5*(yy/N)**4)
   px=base+pat[:,:,None];im=Image.fromarray(np.uint8(np.clip(px,0,255)));d=ImageDraw.Draw(im)
   if k in ('ivory','paint','safety','holdred','slate','metal'):
    for j in range(160):
     a,b=rng.integers(5,N-5,2);light=int(rng.choice([-24,-14,10]));color=tuple(int(t)for t in np.clip(base+light,0,255));ln=int(rng.integers(1,10));d.line((a,b,a+ln,b+int(rng.integers(-2,3))),fill=color)
  else:
   title,big,middle,foot=plates[k];alert=k in ('hold','tag','manifest');elect=k in ('scale','display')
   base=np.array((66,34,29) if alert else (23,45,42) if elect else (33,58,62))
   im=Image.fromarray(np.uint8(np.clip(base+pat[:,:,None],0,255)));d=ImageDraw.Draw(im)
   hi=(226,172,108) if alert else (159,216,182) if elect else (219,224,209)
   accent=(185,86,53) if alert else (74,128,116) if not elect else (55,91,76)
   d.rounded_rectangle((5,6,250,249),radius=6,outline=(143,156,147),width=2)
   d.rectangle((12,16,243,57),fill=accent);d.text((127,37),title,font=fit(d,title,25,218),anchor='mm',fill=(246,240,216))
   d.text((128,113),big,font=fit(d,big,76,226),anchor='mm',fill=hi)
   d.line((18,163,236,163),fill=hi,width=2);d.text((128,184),middle,font=fit(d,middle,25,224),anchor='mm',fill=hi)
   d.text((128,219),foot,font=fit(d,foot,18,218),anchor='mm',fill=(204,199,178))
   for a in (11,244):
    for b in (11,244):d.ellipse((a-2,b-2,a+2,b+2),fill=(143,142,129))
  atlas.paste(im,(x,y));heights[y:y+N,x:x+N]=128+relief
 atlas.save(A/'yard-machinery.jpg',quality=94,subsampling=0,optimize=True)
 dy,dx=np.gradient(ndimage.gaussian_filter(heights,.55));norm=np.stack([-dx*.055,dy*.055,np.ones_like(dx)],axis=-1);norm/=np.linalg.norm(norm,axis=-1,keepdims=True)
 Image.fromarray(np.uint8(np.clip((norm*.5+.5)*255,0,255))).save(A/'yard-machinery-normal.png',optimize=True)
if __name__=='__main__':build()
