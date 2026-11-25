"""Place air traffic and elevated banks in open gaps that intercept previously clear rooftop views."""
from sightlines import *
from airframes import SHIPS
import shapely
from shapely import contains_xy
from shapely.prepared import prep
from dataclasses import dataclass
from functools import cached_property
from itertools import cycle
@dataclass
class Site:
 kind:str;key:str;x:float;z:float;y:float;low:float;high:float;rx:float;rz:float
 angle:float;scale:float;outline:object;indices:np.ndarray
def legal_centers(local,available):
 xs,zs=np.meshgrid(np.arange(-23.15,23.3,.48),np.arange(-23.1,23.36,.53))
 x,z=xs.ravel(),zs.ravel();ok=contains_xy(available,x,z)
 p=np.array(local.exterior.coords)[:-1];step=max(1,len(p)//14)
 for dx,dz in p[::step]:
  idx=np.flatnonzero(ok)
  if not idx.size:return []
  ok[idx]=contains_xy(available,x[idx]+dx,z[idx]+dz)
 idx=np.flatnonzero(ok);valid=[];pre=prep(available)
 for i in idx:
  q=affinity.translate(local,x[i],z[i])
  if pre.covers(q):valid.append((round(x[i],3),round(z[i],3),q))
 return valid
def cloud_template(rx,rz):return affinity.scale(Point(0,0).buffer(1,quad_segs=24),rx,rz,origin=(0,0))
def applicable(A,B,x,z,rad):
 d=B[:,[0,2]]-A[:,[0,2]];q=A[:,[0,2]]-np.array([x,z]);t=np.clip(-np.sum(q*d,axis=1)/np.sum(d*d,axis=1),.01,.99)
 return np.flatnonzero(np.sum((q+t[:,None]*d)**2,axis=1)<rad*rad)
def generate(A,B,kind):
 air=box(-23.75,-23.75,23.75,23.75).difference(obstacles().buffer(.28,quad_segs=8))
 specs=[]
 if kind=='ship':
  for s in SHIPS:
   mesh,_=geometry('aerostat-'+s['key']);p=MultiPoint(mesh[:,[0,2]]).convex_hull
   for scale in (1.05,.93,.82):
    for a in range(0,180,15):
     q=affinity.rotate(affinity.scale(p,scale,scale,origin=(0,0)),-a,origin=(0,0))
     specs.append((s['key'],q,a,scale,s['rx']*scale,s['rz']*scale,s['ry']*scale,mesh[:,1].min()*scale,mesh[:,1].max()*scale))
 else:
  sizes=[(4.1,1.26),(3.60,1.53),(3.25,1.16),(2.74,1.41),(2.66,1.02),(2.18,1.12),(2.38,.81),(1.60,.87),(1.44,.72)]
  for s,(w,d) in enumerate(sizes):
   for aa in (0,30,45,60,90,120,135,150):
    rx,rz=w,d;raw=affinity.rotate(cloud_template(w,d),-aa,origin=(0,0));half=2.28 if rz>=1.05 else 1.88
    specs.append((str(s%3),raw,aa,1,rx,rz,half,-half,half))
 candidates=[]
 for key,p,a,scale,rx,rz,ry,lo,hi in specs:
  for x,z,outline in legal_centers(p,air):
   idx=applicable(A,B,x,z,max(rx,rz)*1.08)
   if len(idx)<2:continue
   for y in (8.9,10.0,11.65,12.65,13.8,15.0):
    ix=idx[body_mask(A[idx],B[idx],x,y,z,rx*(.92 if kind=='ship'else .75),ry*(.92 if kind=='ship'else .75),rz*(.92 if kind=='ship'else .75),a)]
    if len(ix)>=3:candidates.append(Site(kind,key,x,z,y,y+lo,y+hi,rx,rz,a,scale,outline,ix))
 return candidates
def clear(site,others):
 for p,lo,hi,kind,x,z in others:
  near=math.hypot(x-site.x,z-site.z)
  if site.kind=='ship' and kind=='ship' and near<7.7:return False
  if site.kind=='cloud' and kind=='newcloud' and near<3.55 and abs(site.y-(hi+lo)/2)<4.6:return False
  if min(hi,site.high)+.52<max(lo,site.low):continue
  if p.distance(site.outline)<(.43 if site.kind=='ship'or kind=='ship' else .31):return False
 return True
def decide(A,B,labels):
 occ=[(ellipse(c),c['lo'],c['hi'],'low',c['x'],c['z'])for c in LOW]
 existing=OLD_MOOR['Transform'];occ.append((silhouette(OLD_MOOR),6.85,11.1,'ship',existing['posX'],existing['posZ']))
 selected=[];covered=np.zeros(len(A),dtype=bool);counts=Counter(labels)
 distances=np.linalg.norm((A-B)[:,[0,2]],axis=1);w=np.array([(1+.48*min(d/31,1.5))/max(3,counts[lab])**.44 for d,lab in zip(distances,labels)])
 for typ in ('ship','cloud'):
  sites=generate(A,B,typ);print(typ,len(sites),'candidate placements',flush=True)
  for n in range(4 if typ=='ship' else 14):
   avail=[]
   if typ=='ship':current=SHIPS[n]['key']
   else:current=None
   for e in sites:
    if current and e.key!=current:continue
    if typ=='ship' and n==1 and e.y<14.8:continue
    if typ=='ship' and n==3 and e.x>-8.5:continue
    score=np.sum(w[e.indices]*(~covered[e.indices]))
    if score<=0:continue
    # Give both higher roofs and one-storey approaches a share of the new cover.
    layer=(15.0,11.65,13.0,10.0,13.0,15.0,11.65,13.0,10.0,15.0,11.65,13.0,11.65,13.8)[n]
    score*=.78+.29*math.exp(-((e.y-layer)/1.55)**2)
    score*=.85+.13*min(1.45,(e.rx*e.rz/2.8)**.5)
    if selected:
     sep=min(math.hypot(e.x-v.x,e.z-v.z)+.31*abs(e.y-v.y) for v in selected)
     score*=.52+.48*min(1,sep/8.0)
    avail.append((score,e))
   best=None
   for _,e in sorted(avail,key=lambda it:-it[0]):
    if clear(e,occ):best=e;break
   if best is None:
    if typ=='ship':raise ValueError('no viable placement for '+str(current))
    break
   e=best;selected.append(e);covered[e.indices]=True;occ.append((e.outline,e.low,e.high,'newcloud'if typ=='cloud'else'ship',e.x,e.z))
   # Eliminate impossible intersections once rather than during later scoring passes.
   sites=[s for s in sites if (typ!='ship' or s.key!=e.key) and clear(s,[occ[-1]])]
   print(n,e.key,e.x,e.z,e.y,'intercepts',len(e.indices),'coverage',int(covered.sum()),flush=True)
 return selected
if __name__=='__main__':
 data=np.load(WORK3/'baseline.npz');sel=data['visible'];A,B,labels=[data[k][sel]for k in ('A','B','labels')];chosen=decide(A,B,labels)
 design={'ships':[],'high':[]};names=['Crown inversion','Switchyard roll','Upper cirrus shelf','Sunward billow','Array stratus','Harbour fog crest','North cap cloud','Rainband crest','Thermal shelf','Corridor stratocumulus','Drifting silverbank','East weather front','Upper vapour ribbon','Brush cloud']
 for s in chosen:
  if s.kind=='ship':design['ships'].append(dict(key=s.key,transform=xform(s.x,s.y,s.z,s.angle,s.scale,s.scale,s.scale)))
  else:
   i=len(design['high']);design['high'].append(dict(name=names[i],x=s.x,z=s.z,rx=s.rx,rz=s.rz,lo=round(s.low,3),hi=round(s.high,3),variant=i%3,angle=s.angle))
 (WORK3/'airspace.json').write_text(json.dumps(design,indent=2));print('Finished',len(design['ships']),len(design['high']),flush=True)
