"""Four individually marked civilian airframes sharing one photographic material atlas."""
from district import *
from PIL import Image,ImageDraw,ImageFont
from scipy.ndimage import gaussian_filter
from scipy.spatial import ConvexHull
from contextlib import contextmanager
SHIPS=[
 dict(key='ferry',name='Meridian passenger ferry',reg='HP-08',letter='HARMONY TRANSIT',rx=1.51,ry=1.29,rz=3.42,col=(207,165,89),stripe=(29,77,83),job='A glazed passenger gondola with twin ducted propulsors.'),
 dict(key='survey',name='Cirrus weather survey blimp',reg='WX-17',letter='CIVIC WEATHER SERVICE',rx=1.27,ry=1.13,rz=3.13,col=(205,213,209),stripe=(38,95,123),job='A weather radar gondola and a twin-fin tail.'),
 dict(key='post',name='Kestrel express mail blimp',reg='PX-24',letter='HARMONY POST',rx=1.13,ry=1.03,rz=2.69,col=(185,196,175),stripe=(38,97,72),job='A compact courier hull with two sealed parcel panniers.'),
 dict(key='service',name='Beacon inspection blimp',reg='IV-06',letter='ARRAY MAINTENANCE',rx=1.29,ry=1.13,rz=2.92,col=(192,188,175),stripe=(154,64,44),job='A service gondola with amber beacons and a camera turret.')]
BYKEY={v['key']:v for v in SHIPS}
W=2048
def boxuv(rect,u,v):
 x,y,w,h=rect;return ((x+u*w)/W,1-(y+(1-v)*h)/W)
def hullrect(i):return (8,8+i*353,2032,333)
def signrect(i):return (8+510*i,1431,490,128)
MATN=['teal','zinc','charcoal','bronze','cream','ceramic','red','glass','yellow','louver','timber','route','black','bench','hazard','light']
def matrect(name):
 i=MATN.index(name) if name in MATN else 1
 return (8+(i%8)*255,1580+(i//8)*229,235,209)
def paint():
 photo=Image.open(AS2/'civic-r2.jpg').convert('RGB');atlas=Image.new('RGB',(W,W),(52,61,64));rng=np.random.default_rng(71222);sfont='/usr/share/fonts/truetype/dejavu/DejaVuSansCondensed-Bold.ttf'
 if not Path(sfont).exists():sfont='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
 for i,ship in enumerate(SHIPS):
  x,y,w,h=hullrect(i);xx,yy=np.meshgrid(np.linspace(0,1,w),np.linspace(0,1,h));noise=rng.normal(0,1.4,(h,w));slow=gaussian_filter(rng.normal(0,1,(h,w)),8);slow/=slow.std();weave=1.3*np.sin(xx*math.pi*1000)+.8*np.sin(yy*math.pi*600)
  slow=.022*slow+.018*np.sin(yy*2*np.pi)**2-.025*np.cos(xx*9)
  col=np.array(ship['col']);stripe=np.array(ship['stripe'])
  # Seamed gores with tapering hull livery and lightly streaked fabric.
  lateral=np.abs(np.sin(yy*2*np.pi));width=(.10+.24*np.sin(xx*np.pi)**.5)
  body=np.broadcast_to(col,(h,w,3)).copy()
  if ship['key']=='ferry':width+=.19*(1-xx)
  if ship['key']=='post':width+=.09*np.cos(xx*np.pi*2+.7)
  if ship['key']=='service':width+=.24*np.exp(-((xx-.23)/.09)**2)
  body[lateral<width]=stripe
  body[(lateral>width+.022)&(lateral<width+.055)]=[209,188,134]
  if ship['key']=='survey':body[(xx>.81)&(xx<.87)]=stripe
  for band in (.11,.19,.30,.41,.52,.63,.74,.85,.92):
   ss=np.abs(xx-band+.0016*np.sin(2*np.pi*yy));slow-=.12*np.exp(-(ss/.0011)**2);slow+=.045*np.exp(-((ss-.002)/.001)**2)
  gore=(yy*14)%1;slow-=.135*np.exp(-((np.minimum(gore,1-gore))/.037)**2)
  pix=np.clip(body*(1+slow[:,:,None])+(noise+weave)[:,:,None],0,255).astype('uint8')
  atlas.paste(Image.fromarray(pix),(x,y))
  sx,sy,ww,hh=signrect(i);patch=Image.new('RGB',(ww,hh),tuple(np.clip(stripe*.8,0,255).astype(int)));d=ImageDraw.Draw(patch)
  d.rounded_rectangle((3,4,ww-4,hh-5),12,outline=(205,210,190),width=3)
  d.text((18,6),ship['reg'],fill=(247,240,218),font=ImageFont.truetype(sfont,61));d.text((20,86),ship['letter'],fill=(227,227,202),font=ImageFont.truetype(sfont,25))
  atlas.paste(patch,(sx,sy))
 for name in MATN:
  i=native.TILES.index(name);x,y,w,h=native.RECT[i];dest=matrect(name);crop=photo.crop((x,y,x+w,y+h)).resize((dest[2],dest[3]),Image.Resampling.LANCZOS)
  if name=='glass':
   a=np.asarray(crop).astype(float);a=(a-a.mean())*.10+np.array([34,71,82]);crop=Image.fromarray(np.uint8(np.clip(a,0,255)))
  atlas.paste(crop,dest[:2])
 atlas.save(NEW/'airship-liveries.jpg',quality=93,subsampling=0,optimize=True)
def surfaces(m,points,faces,mat):
 for i in faces:m.face([tuple(points[j]) for j in i],mat)
def bake_collider(name,parts):
 lines=['# Convex solid airship parts'];offset=0
 for n,points in enumerate(parts):
  p=np.unique(np.round(points,5),axis=0);h=ConvexHull(p);kept=h.vertices.tolist();idx={k:j for j,k in enumerate(kept)};mid=p[kept].mean(axis=0)
  lines.extend([f'o Airframe{n:02}',f'g Airframe{n:02}'])
  lines+=['v '+native.row((-x,y,z)) for x,y,z in p[kept]]
  assert len(h.simplices)<=255
  for tri in h.simplices:
   a,b,c=tri
   if np.dot(np.cross(p[b]-p[a],p[c]-p[a]),p[a]-mid)<0:b,c=c,b
   lines+=['f '+' '.join(str(offset+idx[k]+1)for k in (a,c,b))]
  offset+=len(kept)
 (NEW/(name+'-col.obj')).write_text('\n'.join(lines)+'\n')
def emit(ship,index):
 m=native.Mesh();rx,ry,rz=[ship[n] for n in ('rx','ry','rz')];N=48;L=29;parts=[]
 def pos(t,theta):
  q=math.sin(t)*(1+.065*math.cos(t));return np.array([rx*q*math.cos(theta),ry*q*math.sin(theta),-rz*math.cos(t)])
 def norm(t,a):
  p=pos(t,a);v=p/np.square([rx,ry,rz]);return v/max(.001,np.linalg.norm(v))
 for i in range(L):
  for j in range(N):
   coords=[(i,j),(i,j+1),(i+1,j+1),(i+1,j)];pts=[pos(t*math.pi/L,k*math.tau/N) for t,k in coords]
   if i==0:coords.pop(1);pts.pop(1)
   elif i==L-1:coords.pop(2);pts.pop(2)
   direct_face(m,pts,[boxuv(hullrect(index),t/L,k/N)for t,k in coords],[norm(t*math.pi/L,k*math.tau/N)for t,k in coords])
 parts.append([pos(t*math.pi/11,a*math.tau/12)for t in range(12)for a in range(12)])
 for sg in (-1,1):
  # Flush painted registration panels curve across the hull and read correctly from either side.
  for k in range(8):
   coords=[(k/8,0),((k+1)/8,0),((k+1)/8,1),(k/8,1)];pts=[]
   for u,v in coords:
    z=sg*(u-.5)*rz*.79;y=(v-.48)*ry*.35;t=math.acos(-z/rz);q=math.sin(t)*(1+.065*math.cos(t));x=sg*(rx*math.sqrt(max(.001,q*q-(y/ry)**2))+.009);pts.append((x,y,z))
   direct_face(m,pts,[boxuv(signrect(index),u,v)for u,v in coords]);direct_face(m,pts[::-1],[boxuv(signrect(index),u,v)for u,v in coords[::-1]])
 old=native.uv;native.uv=lambda key,u,v:boxuv(matrect(key),u,v)
 try:
  dc={'ferry':1.18,'survey':.86,'post':.77,'service':.81}[ship['key']];length=rz*(1.03 if ship['key']=='ferry' else .74);bottom=-ry-.58
  shell=[(-dc*.50,-length*.34),(-dc*.38,-length*.50),(dc*.38,-length*.50),(dc*.50,-length*.34),(dc*.49,length*.30),(dc*.34,length*.49),(-dc*.34,length*.49),(-dc*.49,length*.3)]
  m.prism(shell,bottom,.13,'charcoal','zinc',True);m.prism(shell,bottom+.12,.43,'glass','glass',True);m.prism(shell,bottom+.54,.075,'zinc','cream',True)
  for s in [-1,1]:
   for z in np.linspace(-length*.35,length*.31,6 if ship['key']=='ferry' else 4):m.box(s*dc*.495,bottom+.13,z,.041,.42,.039,'zinc')
   m.box(s*dc*.501,bottom+.20,0,.045,.038,length*.72,'bronze')
   # Cantilevered electric nacelles and tail surfaces, without support rods to the table.
   m.beam((s*dc*.35,bottom+.32,-.20),(s*(rx*.92),-.64,-.69),.12,'teal')
   m.ball(s*rx*.91,-.64,-.65,.19,.19,.45,'zinc',14,7)
   parts.append([(s*rx*.91+.19*math.cos(a),-.64+.19*math.sin(a),-.65+z)for a in np.linspace(0,math.tau,8,endpoint=False)for z in (-.33,.33)])
   for a in (0,120,240):
    a=math.radians(a);m.beam((s*rx*.91,-.64,-1.11),(s*rx*.91+.30*math.cos(a),-.64+.30*math.sin(a),-1.13),.052,'charcoal')
   theta=math.radians(35 if ship['key'] in ('survey','service') else 9);wide=rx*1.03
   pp=np.array([[s*.31,.06,-rz*.56],[s*wide,wide*math.sin(theta),-rz*.93],[s*wide,wide*math.sin(theta),-rz*1.04],[s*.19,.12,-rz*.92]])
   off=np.array([0,.048,0]);points=np.vstack([pp-off,pp+off]);surfaces(m,points,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'teal' if ship['key']!='service' else 'red');parts.append(points)
  if ship['key'] in ('service','post','ferry'):
   pts=np.array([[0,.27,-rz*.47],[0,ry*.97,-rz*.91],[0,ry*.95,-rz*1.06],[0,.21,-rz*.91]]);off=np.array([.05,0,0]);p=np.vstack([pts+off,pts-off]);surfaces(m,p,[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],'red' if ship['key']=='service' else 'teal');parts.append(p)
  if ship['key']=='survey':
   m.ball(0,bottom-.13,.37,.29,.24,.32,'cream',16,9);m.box(0,bottom-.14,-.52,.50,.15,.51,'louver')
  if ship['key']=='post':
   for s in [-1,1]:
    m.box(s*.46,bottom+.03,-.14,.30,.25,1.19,'cream','teal',True)
    for z in (-.49,.19):m.box(s*.46,bottom+.03,z,.31,.27,.07,'bronze')
  if ship['key']=='service':
   m.ball(0,bottom-.095,.47,.15,.17,.18,'charcoal',12,6)
   for s in [-1,1]:m.ball(s*.28,bottom+.61,.37,.065,.075,.065,'yellow',8,5)
 finally:native.uv=old
 for poly,lo,hi in m.solids:parts.append([(x,y,z)for x,z in poly for y in (lo,hi)])
 name='aerostat-'+ship['key'];export(m,name);bake_collider(name,parts)
if __name__=='__main__':
 paint()
 for i,s in enumerate(SHIPS):emit(s,i)
