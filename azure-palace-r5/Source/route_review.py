"""Compare courtyard detours from fixed deployment points, allowing either side of each objective."""
from pathlib import Path
import math
import numpy as np,shapely
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra
from site_check import *
from scipy.spatial import cKDTree
vdata=np.load(ROOT/'Review/roofs.npz');v=vdata['v'];X,Z=np.meshgrid(v,v);h=v[1]-v[0]
rad=25/25.4/2
hard=union_all([*envelopes().values(),*court_hulls().values(),pool]);legal=field.buffer(-rad-.08).difference(union_all([hard.buffer(rad+.045),*[p.buffer(.7874+rad)for p in objectives]]))
inside=shapely.contains_xy(legal.buffer(-.5*h*math.sqrt(2)),X,Z);rr,cc=np.where(inside);idx=np.arange(X.size).reshape(X.shape);fr=[];to=[];le=[]
for y,x in [(0,1),(1,0),(1,1),(1,-1)]:
    i,j=rr+y,cc+x;ok=(i>=0)&(i<len(v))&(j>=0)&(j<len(v));a,b,i,j=rr[ok],cc[ok],i[ok],j[ok];ok=inside[i,j];f,t=idx[a[ok],b[ok]],idx[i[ok],j[ok]];fr.extend([f,t]);to.extend([t,f]);le.extend([np.full(len(f),h*math.hypot(x,y))]*2)
fr=np.concatenate(fr);to=np.concatenate(to);le=np.concatenate(le)
def graph(w):return csr_matrix((w,(fr,to)),shape=(X.size,X.size))
base=graph(le);seg=[segments(OUT/(k+'-1-col.obj'),k,1.57)for k in poses]+[segments(OUT/(k+'-court-col.obj'),k,1.57)for k in sites];seg.append(section(R2/'Assets/basin-court-collision.obj',1.57));block=MultiLineString(np.vstack(seg).tolist());shapely.prepare(block);results={}
gridpts=np.c_[X[rr,cc],Z[rr,cc]];tree=cKDTree(gridpts)
for side,sign,enemy in [('west',-1,'east'),('east',1,'west')]:
 for obj in objectives:
    key=side+('-north' if obj.y>0 else '-south')
    _,obs=tree.query([12.4*(-sign),obj.y-.9]);eye=gridpts[obs]
    rays=shapely.linestrings(np.stack((np.tile(eye,(len(gridpts),1)),gridpts+.00001),axis=1));ground=np.zeros(X.shape);ground[rr,cc]=(~shapely.intersects(block,rays)).astype(float)
    # Each observer counts independently. One inch visible to two positions records two observer-inches.
    view=vdata[enemy].astype(float)+ground;seen=view.ravel();cross=(seen[fr]+seen[to])*.5
    protected=graph(le*(1+3.4*cross));targets=idx[inside&(np.hypot(X-obj.x,Z-obj.y)<2.16)]
    starts=idx[inside&(sign*X>=12.5)&(sign*X<=16.8)&(abs(Z-obj.y)<8)]
    startpoints=sorted(starts,key=lambda g:abs(Z.ravel()[g]-obj.y)+.6*abs(X.ravel()[g]-14*sign))[::max(1,len(starts)//35)];best=None
    for start in startpoints:
        d1,p1=dijkstra(base,indices=start,return_predecessors=True);d2,p2=dijkstra(protected,indices=start,return_predecessors=True)
        goals=targets[np.isfinite(d1[targets])]
        if not len(goals) or np.min(d1[goals])>26:continue
        def report(goal,prev):
            path=[goal]
            while path[-1]!=start:path.append(prev[path[-1]])
            a=np.array(path);dl=np.hypot(np.diff(X.ravel()[a]),np.diff(Z.ravel()[a]))
            return float(dl.sum()),float((dl*(seen[a[:-1]]+seen[a[1:]])*.5).sum()),a
        short=[report(i,p1)for i in goals if d1[i]<=np.min(d1[goals])+2.0];long=[report(i,p2)for i in goals]
        for da,ea,pa in short:
            for db,eb,pb in long:
                if not (da+.15<=db<=1.55*da and ea-eb>=1.5 and set(pa)^set(pb)):continue
                score=ea-eb-.28*(db-da)-.07*da
                if best is None or score>best[0]:
                    xy=lambda i:[round(X.ravel()[i],2),round(Z.ravel()[i],2)]
                    best=score,dict(start=xy(start),ground_observer=eye.round(2).tolist(),direct_goal=xy(pa[0]),sheltered_goal=xy(pb[0]),direct_inches=round(da,2),sheltered_inches=round(db,2),direct_observer_inches=round(ea,2),sheltered_observer_inches=round(eb,2))
    results[key]=None if best is None else best[1]
write(ROOT/'Review/courtyard-routes.json',results)
print(json.dumps(results,indent=1),flush=True)
