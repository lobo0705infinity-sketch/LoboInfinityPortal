from project import *
from fixtures import SIZE
from shapely.ops import nearest_points
from shapely.geometry import LineString
from shapely.prepared import prep
from functools import lru_cache
from collections import Counter
def roof_base(t):
 faces,solid=base_model(slug(t.obj));h=t.n*PITCH
 def cap(f):
  ys=[v[0][1] for v in f];return all(min(abs(y-h-.52),abs(y-h-.585))<.0002 for y in ys) and any(abs(y-h-.585)<.0002 for y in ys)
 last=max(i for i,f in enumerate(faces) if cap(f))
 lastc=max(i for i,(_,lo,hi) in enumerate(solid)if abs(lo-h)<1e-4 and abs(hi-h-.52)<1e-4)
 return faces[:last+1],solid[:lastc+1]
@lru_cache(None)
def structure(k,l):
 t=T[k];h=l*PITCH
 _,ss=roof_base(t) if l==t.n else base_model('tower-'+k+'-'+str(l+1))
 floor=unary_union([Polygon(p) for p,lo,hi in ss if abs(hi-h)<.02])
 obstacles=unary_union([Polygon(p) for p,lo,hi in ss if lo<h+1.66 and hi>h+.06]);return floor,obstacles
@lru_cache(None)
def hatch(k):
 t=T[k];f,_=structure(k,1);p=t.poly.difference(f)
 if k=='n' and t.n==1:raise ValueError
 # All first upper floors retain the same ladder opening.
 poly=max(([p]if p.geom_type=='Polygon' else list(p.geoms)),key=lambda v:v.area)
 return poly
def pieces(p):return [v for v in getattr(p,'geoms',[p])if v.geom_type=='Polygon']
def access(t,l):
 floor,obs=structure(t.key,l);nav=floor.difference(obs).buffer(-.53,join_style='round')
 # Approach points for each landing, ladder shaft and mission terminal on this plane.
 ss=[Point(x,z)for x,z,_,_ in bridge_landings(t,l)]
 hd=hatch(t.key).centroid
 if l==0 or not floor.covers(hd):
  ss.append(nearest_points(nav,hd)[0])
 else:ss.append(hd)
 ob=O.get(t.key)
 if ob and ob[0]==l:
  pt=Point(ob[1],ob[2]);ss.append(nearest_points(nav.difference(pt.buffer(1.36)),pt)[0])
 anchors=[nearest_points(nav,p)[0] if not nav.covers(p) else p for p in ss]
 # Keep ports and the ladder's full opening usable when changing state.
 reserve=unary_union([*(a.buffer(.88)for a in anchors),hatch(t.key).buffer(.40),*([Point(ob[1],ob[2]).buffer(1.98)] if ob and ob[0]==l else [])])
 return floor,obs,anchors,reserve
FURN={'a':['potting','trolley','rack'],'b':['seat','dispatch','seat','trolley'],'c':['pump','trolley','rack'],'d':['archive','rack','archive'],'e':['dispatch','rack','desk'],'f':['dispatch','trolley','rack'],'g':['desk','instrument','desk'],'h':['instrument','desk','trolley'],'i':['rack','trolley','pump'],'j':['pump','desk','trolley'],'k':['seat','dispatch','seat'],'l':['dispatch','rack','trolley'],'m':['potting','rack','trolley'],'n':['instrument','archive','desk'],'o':['seat','desk','archive'],'p':['pump','trolley','rack']}
ROOF={'a':['greenhouse','planter','chest','hvac','planter','vent','cabinet'],'b':['greenhouse','hvac','chest','cabinet','bench','planter','drum','vent'],'c':['pump','drum','chest','vent','cabinet'],'d':['hvac','chest','vent','planter','cabinet'],'e':['radome','hvac','chest','cabinet','planter','vent'],'f':['greenhouse','drum','chest','cabinet','planter','vent'],'g':['hvac','chest','vent','cabinet','radome','planter'],'h':['greenhouse','radome','weather','cabinet','planter','chest','hvac'],'i':['drum','chest','cabinet','hvac','bench'],'j':['hvac','vent','pump','chest','cabinet'],'k':['greenhouse','chest','seat','hvac','planter','vent'],'l':['greenhouse','chest','cabinet','hvac','drum','planter','bench','vent'],'m':['greenhouse','planter','planter','hvac','chest','cabinet'],'n':['weather','radome','cabinet','hvac','chest','planter'],'o':['greenhouse','bench','planter','hvac','chest','cabinet','vent'],'p':['vent','chest','pump','cabinet','drum']}
def footprint_of(kind,x,z,a):
 w,d=SIZE[kind];return box(x-(w if a%180==0 else d)/2,z-(d if a%180==0 else w)/2,x+(w if a%180==0 else d)/2,z+(d if a%180==0 else w)/2)
def green_ports(x,z,a):
 w,d=SIZE['greenhouse'];inside=w-.24;bw=1.13;lane=(inside-2*bw)/3
 u=[-inside/2+lane/2+i*(lane+bw) for i in range(3)];ports=[]
 for k in [-1,1]:
  for sx in u:
   sz=k*(d/2+.63);p=affinity.translate(affinity.rotate(Point(sx,sz),-a,origin=(0,0)),x,z);ports.append(p)
 return ports
def layout(t,l):
 roof=l==t.n;floor,obs,anchors,reserve=access(t,l)
 desired=ROOF[t.key] if roof else (FURN[t.key][l%3:]+FURN[t.key][:l%3])*2
 target=len(desired) if roof else min(6,max(2,round(floor.area/23)))
 store=[];rects=[];exits=[];rng=np.random.default_rng(9331+ord(t.key)*41+l*7)
 raw=floor.difference(obs);walkr=.515
 def reach(candidate,ports):
  space=raw.difference(unary_union(rects+[candidate])).buffer(-walkr,quad_segs=4)
  comps=pieces(space)
  # Relative connectivity of the original approach points is preserved.
  for base in pieces(raw.buffer(-walkr,quad_segs=4)):
   required=[v for v in [*anchors,*exits,*ports] if base.buffer(.015).covers(v)]
   if required and not any(all(comp.buffer(.025).covers(v) for v in required) for comp in comps):return False
  return True
 for kind in desired:
  if len(store)>=target:break
  found=None
  for margin in ([.62,.36] if roof else [1.10,.72,.39]):
   allowed=raw.buffer(-margin,quad_segs=3).difference(reserve)
   if not allowed.area:continue
   predicate=prep(allowed);avoid=unary_union([p.buffer(1.14,quad_segs=4) for p in rects]+[p.buffer(.61) for p in exits])
   occupied=prep(avoid);cs=[];x0,z0,x1,z1=floor.bounds
   for a in (0,90):
    w,d=SIZE[kind];w,d=(w,d)if a==0 else(d,w)
    step=.39 if kind=='greenhouse' else .48
    for x in np.arange(x0+w/2+.20,x1-w/2-.1,step):
     for z in np.arange(z0+d/2+.20,z1-d/2-.1,step):
      fp=box(x-w/2,z-d/2,x+w/2,z+d/2)
      if not predicate.covers(fp) or occupied.intersects(fp):continue
      edge=fp.distance(floor.boundary);spread=min([fp.distance(v)for v in rects]+[5.0])
      # Freestanding islands alternate across center and flank. Match local roof use.
      middle=(len(store)%3==1 or (not roof and len(store)%2==0))
      score=(min(edge,3.2)*.95 if middle else -abs(edge-(.82 if roof else 1.16))*.66)+min(spread,3)*.22+rng.uniform(0,.55)
      cs.append((score,float(x),float(z),a,fp))
   for _,x,z,a,fp in sorted(cs,reverse=True,key=lambda p:p[0])[:30]:
    ports=green_ports(x,z,a) if kind=='greenhouse' else []
    if ports and not all(raw.covers(v.buffer(.52)) and not avoid.intersects(v.buffer(.45)) for v in ports):continue
    if not reach(fp,ports):continue
    found=(kind,round(x,4),round(z,4),a);rects.append(fp);exits.extend(ports);store.append(found);break
   if found:break
  if not found and not roof and not store:
   continue
 return store
def main():
 d={}
 for k,t in T.items():
  d[k]={}
  for l in range(t.n+1):d[k][l]=layout(t,l)
  print(k,[len(d[k][l])for l in d[k]],flush=True)
 (WORK/'arrangement.json').write_text(json.dumps(d,indent=1))
if __name__=='__main__':main()
