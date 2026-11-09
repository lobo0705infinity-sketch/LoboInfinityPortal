import pathlib,json,math,re,sys
import numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter
from numba import njit
R=pathlib.Path(__file__).parent;A=R/'verdant-r5-preserved/Assets'
bag=json.load(open(R/'verdant-r5-preserved/Verdant-Exchange-R5.json'))['ObjectStates'][0]
if '--interiors' in sys.argv:
 for i,o in enumerate(bag['ContainedObjects']):
  matches=[v for v in o.get('States',{}).values() if 'Ground floor exposed' in v.get('Nickname','') or 'Growing bays exposed' in v.get('Nickname','')]
  if matches:bag['ContainedObjects'][i]=matches[0]
places={}
for l in bag['LuaScript'].splitlines():
 m=re.match('--([a-f0-9]{6}),(.+)',l)
 if m:places[m[1]]=[float(x) for x in m[2].split(',')]

def obj(path):
 v=[];uv=[];faces=[]
 for l in path.read_text().splitlines():
  t=l.split()
  if not t:continue
  if t[0]=='v':v.append([float(s) for s in t[1:4]])
  elif t[0]=='vt':uv.append([float(s) for s in t[1:3]])
  elif t[0]=='f':
   ids=[s.split('/') for s in t[1:]]
   for j in range(1,len(ids)-1):faces.append([ids[0],ids[j],ids[j+1]])
 vv=[];tt=[]
 for f in faces:
  vv.append([v[int(i[0])-1] for i in f]);tt.append([uv[int(i[1])-1] if len(i)>1 and i[1] else [0,0] for i in f])
 return np.array(vv,dtype=np.float64),np.array(tt,dtype=np.float64)

@njit
def raster(screen,depth,uv,shade,texture,img,zbuf):
 H,W,_=img.shape;TH,TW,_=texture.shape
 for n in range(len(screen)):
  a,b,c=screen[n];den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
  if abs(den)<.001:continue
  minx=max(0,int(min(a[0],b[0],c[0])));maxx=min(W-1,int(max(a[0],b[0],c[0]))+1)
  miny=max(0,int(min(a[1],b[1],c[1])));maxy=min(H-1,int(max(a[1],b[1],c[1]))+1)
  for y in range(miny,maxy+1):
   for x in range(minx,maxx+1):
    wa=((b[1]-c[1])*(x+.5-c[0])+(c[0]-b[0])*(y+.5-c[1]))/den
    wb=((c[1]-a[1])*(x+.5-c[0])+(a[0]-c[0])*(y+.5-c[1]))/den;wc=1-wa-wb
    if wa<0 or wb<0 or wc<0:continue
    z=wa*depth[n,0]+wb*depth[n,1]+wc*depth[n,2]
    if z<zbuf[y,x]:continue
    zbuf[y,x]=z
    u=wa*uv[n,0,0]+wb*uv[n,1,0]+wc*uv[n,2,0];v=wa*uv[n,0,1]+wb*uv[n,1,1]+wc*uv[n,2,1]
    tx=min(TW-1,max(0,int(u*TW)));ty=min(TH-1,max(0,int((1-v)*TH)))
    for k in range(3):img[y,x,k]=min(255,texture[ty,tx,k]*shade[n])

def render(name,top=False,size=1800):
 H=int(size*.84) if not top else size;W=size
 image=np.zeros((H,W,3),dtype=np.uint8);image[:]=[22,36,30];zbuffer=np.full((H,W),-1e9)
 camera=np.array([1,1.25,1.1]) if not top else np.array([0,1,0.00001]);camera=camera/np.linalg.norm(camera)
 right=np.cross(np.array([0,1,0]),camera);right/=np.linalg.norm(right);up=np.cross(camera,right)
 # Fit the full 48-inch square plus building height, reserving title space.
 scale=W/73 if not top else W/53
 texcache={};tris=0
 shadow=Image.new('L',(W,H));sd=ImageDraw.Draw(shadow);external=json.load(open(R/'verdant-r5-preserved/external-assets.json'))
 for o in bag['ContainedObjects']:
  if 'CustomMesh' not in o:continue
  x,y,z,rx,rot,rz=places[o['GUID']]
  if abs(x)>30 or abs(z)>30:continue
  mesh=o['CustomMesh'];fn=mesh['MeshURL'].split('/')[-1];p=A/fn
  if not p.exists():p=R/'verdant-assets'/fn
  if not p.is_file():p=R/external[mesh['MeshURL']]
  v,uv=obj(p);tris+=len(v)
  v*=np.array([o['Transform'].get('scaleX',1),o['Transform'].get('scaleY',1),o['Transform'].get('scaleZ',1)])
  c=math.cos(math.radians(rot));s=math.sin(math.radians(rot));v=v@np.array([[c,0,-s],[0,1,0],[s,0,c]])+np.array([x,y,z])
  for face in v:
   if face[:,1].max()<1.3:continue
   sh=face.copy();sh[:,0]+=(sh[:,1]-1)*.4;sh[:,2]+=(sh[:,1]-1)*.2;sh[:,1]=1
   sp=np.stack((sh@right*scale+W/2,-sh@up*scale+H*.57),axis=-1)
   if top:sp[:,1]=-sh[:,2]*scale+H*.53
   sd.polygon([tuple(x) for x in sp],fill=255)
  normals=np.cross(v[:,1]-v[:,0],v[:,2]-v[:,0]);normals/=np.maximum(1e-12,np.linalg.norm(normals,axis=1))[:,None]
  light=np.array([-.35,.85,-.4]);light/=np.linalg.norm(light)
  shade=.62+.38*np.abs(normals@light)
  scr=np.stack((v@right*scale+W/2,-v@up*scale+H*.57),axis=-1)
  if top:scr[:,:,1]=-v[:,:,2]*scale+H*.53
  fn=mesh['DiffuseURL'].split('/')[-1];tp=A/fn
  if not tp.exists():tp=R/'verdant-assets'/fn
  if not tp.is_file():tp=R/external[mesh['DiffuseURL']]
  if str(tp) not in texcache:texcache[str(tp)]=np.array(Image.open(tp).convert('RGB'))
  raster(scr,v@camera,uv,shade,texcache[str(tp)],image,zbuffer)
 yy,xx=np.mgrid[:H,:W];sx=(xx-W/2)/scale;sy=-(yy-H*.57)/scale
 if top:
  gx=(xx-W/2)/scale;gz=-(yy-H*.53)/scale
 else:
  inv=np.linalg.inv(np.array([[right[0],right[2]],[up[0],up[2]]]))
  gx=inv[0,0]*(sx-right[1])+inv[0,1]*(sy-up[1]);gz=inv[1,0]*(sx-right[1])+inv[1,1]*(sy-up[1])
 gd=gx*camera[0]+camera[1]+gz*camera[2];floor=abs(zbuffer-gd)<.075
 sm=np.array(shadow.filter(ImageFilter.GaussianBlur(1.4)))/255
 image=(image*(1-.28*sm*floor)[:,:,None]).astype(np.uint8)
 im=Image.fromarray(image);d=ImageDraw.Draw(im);font='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
 d.rectangle((0,0,W,100),fill='#102e25');d.text((28,18),'VERDANT EXCHANGE  /  LIVING COLLECTIONS',font=ImageFont.truetype(font,32),fill='#f4efdf')
 d.text((28,62),'DETAILED CAMPUS R5  /  actual map geometry  /  48 x 48 inches',font=ImageFont.truetype(font,20),fill='#b3c7b7')
 im.save(R/'verdant-r5-preserved'/name);print(name,tris,'triangles')
if '--interiors' in sys.argv:render('Verdant-R5-Interiors.jpg',size=2200)
else:
 render('Verdant-R5-Overview.jpg',size=2200)
 render('Verdant-R5-Overhead.jpg',True,size=2200)
