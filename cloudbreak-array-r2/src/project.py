from model import *
from shapely.geometry import box,Point
from dataclasses import dataclass
from shapely.ops import unary_union
from shapely import affinity
BAG='cb7100'; TAG='LoboMap:'+BAG; MATERIAL='civic-r2.jpg'
BASE_Y=4.04;MAT_Y=1.04
play=json.loads((BASE/'r1/Play-Table.json').read_text())
world=[o for o in play['ObjectStates'] if TAG in o.get('Tags',[])]
def slug(o):return o.get('CustomMesh',{}).get('MeshURL','').split('/')[-1].replace('.obj','')
def center(o):
 t=o['Transform'];return t['posX'],t['posZ']
@dataclass
class Tower:
 key:str;name:str;obj:dict;n:int;x:float;z:float;poly:Polygon
 @property
 def w(self):return self.poly.bounds[2]-self.poly.bounds[0]
 @property
 def d(self):return self.poly.bounds[3]-self.poly.bounds[1]
 def local(self,x,z):return x-self.x,z-self.z
T={}
for o in world:
 if not slug(o).startswith('tower-'):continue
 k=slug(o).split('-')[1];_,ss=base_model(slug(o));T[k]=Tower(k,o['Nickname'].split(' |')[0],o,len(o['States']),*center(o),Polygon(ss[0][0]))
bridges=[o for o in world if 'skybridge |' in o['Nickname']]
missions=[o for o in world if 'mission' in o.get('Tags',[])]
O={}
for o in missions:
 x,z=center(o);t=next(t for t in T.values() if t.poly.contains(Point(*t.local(x,z))));O[t.key]=(round((o['Transform']['posY']-BASE_Y)/PITCH),*t.local(x,z),o)
def bridge_poly(o,pad=0):
 t=o['Transform'];fx=t['scaleX'];fz=t['scaleZ'];x,z=center(o);p=box(-2.01*fx,-2*fz,2.01*fx,2*fz)
 return affinity.translate(affinity.rotate(p,-t['rotY'],origin=(0,0)),x,z).buffer(pad,join_style='mitre')
def bridge_landings(t,l):
 fp=affinity.translate(t.poly,t.x,t.z);out=[]
 for o in bridges:
  if t.name not in o['Nickname'].split(' | ')[1].split(' - ') or round((o['Transform']['posY']-BASE_Y)/PITCH)!=l:continue
  bx,bz=center(o);a=o['Transform']['rotY'];d=2*o['Transform']['scaleZ']-.045
  pts=[(bx+sg*d*math.sin(math.radians(a)),bz+sg*d*math.cos(math.radians(a)))for sg in [-1,1]]
  px,pz=min(pts,key=lambda p:fp.distance(Point(*p)));x,z=t.local(px,pz)
  nx,nz=(0,(1 if z<0 else -1))if abs(math.cos(math.radians(a)))>.5 else ((1 if x<0 else -1),0)
  out.append((x+nx*.86,z+nz*.86,nx,nz))
 return out
