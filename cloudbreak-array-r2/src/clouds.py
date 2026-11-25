from project import *
from scipy.ndimage import distance_transform_edt
from shapely import contains_xy
from shapely.prepared import prep
from shapely.geometry import box,Point
FREEPAD=.30
def eligible():
 obstacles=[affinity.translate(t.poly,t.x,t.z)for t in T.values()]+[bridge_poly(b,.09) for b in bridges]
 # Actual parked airship outline and tether ends get their own air pocket.
 aero=next(o for o in world if o['Nickname'].startswith('Mistral'))
 x,z=center(aero);obstacles.append(box(x-2.13,z-3.7,x+1.45,z+3.65))
 full=unary_union(obstacles);available=box(-23.68,-23.68,23.68,23.68).difference(full.buffer(FREEPAD,join_style='round'));return full,available
def ellipse(x,z,rx,rz):
 return affinity.scale(Point(x,z).buffer(1,quad_segs=20),rx,rz,origin=(x,z))
def place():
 obstacles,air=eligible();pred=prep(air);rng=np.random.default_rng(76);rank=[]
 # Search clear gaps independently of building states and bridge elevation.
 sizes=[(3.1,1.65),(2.5,1.42),(3.1,1.06),(2.05,1.2),(2.45,.83),(1.59,.89),(1.30,.75)]
 for rx,rz in sizes:
  for a,b in [(rx,rz),(rz,rx)]:
   for x in np.arange(-22.4,22.7,.42):
    for z in np.arange(-22.4,22.7,.48):
     if not pred.contains(Point(x,z)):continue
     # A conservative classifying rectangle speeds the majority of cells.
     if not pred.contains(Point(x+a,z)) or not pred.contains(Point(x-a,z)) or not pred.contains(Point(x,z+b)) or not pred.contains(Point(x,z-b)):continue
     p=ellipse(x,z,a,b)
     if pred.covers(p):rank.append((p.area*(.91+rng.random()*.18),p,float(x),float(z),a,b))
 rank.sort(reverse=True,key=lambda it:it[0]);selected=[]
 for n in range(13):
  if not rank:break
  def score(v):
   minD=min([math.hypot(v[2]-u[2],v[3]-u[3])for u in selected]+[15])
   return v[0]*(min(minD,13)/13)**.82
  best=max(rank,key=score);selected.append(best)
  rank=[v for v in rank if math.hypot(best[2]-v[2],best[3]-v[3])>5.55 and best[1].distance(v[1])>1.4]
 labels=['Observatory veil','Intake fog','Highbank drift','Maritime inversion','North drift','Serra mist','Rainworks steam','Pier inversion','Western wisp','Stratus pocket','Archive drift','Glasshouse bank','Isobar vapour']
 out=[]
 for n,(_,p,x,z,a,b) in enumerate(selected):
  # Precisely bounded vertical volumes obstruct different tabletop levels.
  lo=[3.55,5.48,7.04,4.15,6.14,3.7,5.18][n%7];hi=lo+[3.9,4.6,4.9,5.3,4.2][n%5]
  out.append(dict(name=labels[n],x=round(x,4),z=round(z,4),rx=a,rz=b,lo=lo,hi=round(hi,4),variant=n%3))
 assert len(out)>=10
 (WORK/'clouds.json').write_text(json.dumps(out,indent=1));print(len(out),'clouds, min clearance',round(min(obstacles.distance(i[1])for i in selected),3))
def sculpt(index):
 # Three independently sculpted banks; the normalized geometry fits the rules ellipse.
 from scipy.interpolate import RegularGridInterpolator
 from scipy.ndimage import gaussian_filter
 rng=np.random.default_rng(182+index*71);n=64;rings=34
 centers=[(np.zeros(3),.55)]
 for k in range(90):
  direction=rng.normal(size=3);direction/=np.linalg.norm(direction)
  centers.append((direction*rng.uniform(.32,.80),rng.uniform(.105,.30)))
 vec=np.array([v for v,r in centers]);rr=np.array([r for v,r in centers])
 def point(i,j):
  th=i*math.tau/n;lat=j*math.pi/rings-math.pi/2;c=math.cos(lat);d=np.array([c*math.cos(th),math.sin(lat),c*math.sin(th)])
  b=vec@d;disc=rr*rr-(vec*vec).sum(axis=1)+b*b;v=max(.50,np.max(np.where(disc>0,b+np.sqrt(np.maximum(disc,0)),0)))
  micro=.015*math.sin(d[0]*42+d[2]*8)*math.cos(d[1]*29+index)+.009*math.cos(d[2]*59+d[0]*7)
  v=min(.978,v+micro)
  return tuple(d*v)
 points={(i,j):point(i,j)for i in range(n)for j in range(rings+1)};m=Mesh()
 def raw(i,j):return points[i%n,max(0,min(rings,j))]
 for i in range(n):
  for j in range(rings):
   q=[(i,j),(i,j+1),(i+1,j+1),(i+1,j)];vs=[raw(a,b)for a,b in q]
   ns=[]
   for a,b in q:
    va=np.array(raw(a+1,b))-np.array(raw(a-1,b));vb=np.array(raw(a,b+1))-np.array(raw(a,b-1))
    d0=np.array(raw(a,b));d0=d0/np.linalg.norm(d0);v=np.cross(vb,va)
    if np.dot(v,d0)<0:v=-v
    v=v/max(.000001,np.linalg.norm(v));v=(v*.60+d0*.40);v/=np.linalg.norm(v);ns.append(tuple(v))
   # Muted vapor texture baked at each vertex from its own normal, height and curvature.
   f=[((p[0],(p[1]+1)/2,p[2]),(max(.012,min(.989,.42+.25*nn[1]-.18*nn[0]+.11*nn[2]+.09*p[1])),.5+.45*math.sin(p[2]*3+p[0])),nn) for p,nn in zip(vs,ns)]
   for ids in [(0,1,2),(0,2,3)]:m.faces.append(tuple(f[k]for k in ids))
 m.solids.append((rect(0,0,.02,.02),-1.36,-1.345))
 m.save('vapour-'+str(index))
def tex():
 from PIL import Image
 rng=np.random.default_rng(47);x,y=np.meshgrid(np.linspace(0,1,768),np.linspace(0,1,512));m=1/(1+np.exp(-((x-.44)*5)))
 low=np.array([116,137,154]);high=np.array([250,248,239]);v=low+m[:,:,None]*(high-low)
 noise=np.sin(8*y+4*x)+.7*np.sin(19*y-3*x)+rng.normal(0,.72,x.shape)
 Image.fromarray(np.uint8(np.clip(v+noise[:,:,None],0,255))).save(AS/'cloudlight.jpg',quality=90)
if __name__=='__main__':
 place();tex()
 for i in range(3):sculpt(i)
