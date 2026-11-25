"""A framed, walk-through enclosure fitted to the original three greenhouse aisles."""
from district import *
from PIL import Image,ImageFilter
from scipy.ndimage import gaussian_filter
def png():
 s=512;y,x=np.mgrid[0:s,0:s]/(s-1);rng=np.random.default_rng(47)
 edge=np.minimum.reduce([x,1-x,y,1-y]);refl=np.exp(-((x*.80+y*.37-.69)/.105)**2)+.45*np.exp(-((x*.80+y*.37-.85)/.055)**2)
 tone=np.array([183.,218.,226.])[None,None,:]+refl[:,:,None]*19
 tone-=np.exp(-edge/.026)[:,:,None]*np.array([28,12,9]);tone+=gaussian_filter(rng.normal(0,1,(s,s)),2)[:,:,None]*2.2
 # Fine condensate droplets gather along the gasket and leave most of the view clear.
 for _ in range(430):
  xx=rng.integers(3,s-3);yy=rng.integers(3,s-3)
  if min(xx,yy,s-xx,s-yy)>s*.15 and rng.random()>.18:continue
  tone[yy,xx]-=10;tone[yy-1,xx]+=12
 a=np.zeros((s,s,4),dtype=np.uint8);a[:,:,:3]=np.clip(tone,0,255).astype(np.uint8);a[:,:,3]=255
 Image.fromarray(a).save(NEW/'horticultural-glass.png',optimize=True)
def make():
 glass=native.Mesh();metal=native.Mesh();w=6.10;d=3.05;post=.12;ridge=3.0;side_x=w/2-post/2
 def pane(v):
  uv=[(0,0),(1,0),(1,1),(0,1)]if len(v)==4 else [(0,0),(1,0),(.5,1)]
  direct_face(glass,v,uv);direct_face(glass,v[::-1],uv[::-1])
 def frame(a,b,width=.034):metal.beam(a,b,width,'zinc')
 for sg in (-1,1):
  xx=sg*side_x
  for sign in (-1,1):
   z0,z1=(-1.47,-.012) if sign<0 else (.012,1.47)
   pane([(xx,.28,z0),(xx,.28,z1),(xx,2.26,z1),(xx,2.26,z0)])
   for i in range(3):
    a=abs(xx)*i/3;b=abs(xx)*(i+1)/3
    def high(x):return ridge-(ridge-2.27)*x/abs(xx)
    pane([(sg*a,high(a),z0),(sg*b,high(b),z0),(sg*b,high(b),z1),(sg*a,high(a),z1)])
  glass.solids.append((native.rect(xx,0,.048,d-.12),.27,2.27))
  for z in (-1.46,0,1.46):
   for y in (.37,1.21,2.15):metal.box(xx+sg*.034,y,z,.03,.065,.066,'bronze')
 for sg in (-1,1):
  z=sg*(d/2-.061)
  # Open sliding doors park over each growing bed. Both ends admit all three 25 mm routes.
  for center in (-1.165,1.165):
   a,b=center-.54,center+.54
   pane([(a,.035,z),(b,.035,z),(b,2.10,z),(a,2.10,z)])
   glass.solids.append((native.rect(center,z,b-a,.038),.035,2.1))
   for x in (a+.021,b-.021):metal.box(x,.03,z,.042,2.11,.056,'teal')
   metal.box(center,.035,z,b-a,.065,.055,'teal')
   for ss in (-.25,0,.25):metal.box(center+ss,1.38,z+.025,.11,.024,.013,'cream')
   metal.box(center-.39,.82,z+sg*.045,.035,.27,.044,'bronze')
  pane([(-side_x,2.10,z),(side_x,2.10,z),(side_x,2.27,z),(-side_x,2.27,z)])
  pane([(-side_x,2.27,z),(side_x,2.27,z),(0,ridge,z)])
  frame((-side_x,2.12,z),(side_x,2.12,z),.052)
  for sx in (-1,1):
   x=sx*1.165;frame((x,2.12,z),(x,ridge-(ridge-2.27)*abs(x)/side_x,z))
  # These soffits are above the full standing S2 silhouette. The sloped roof remains click-through.
  glass.solids.append((native.rect(0,z,w-.13,.038),2.105,2.265))
 metal.solids.append((native.rect(side_x,0,.025,.025),.33,.37))
 export(glass,'greenhouse-glazing');export(metal,'greenhouse-door-hardware');png()
if __name__=='__main__':make()
