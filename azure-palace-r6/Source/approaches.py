"""Compare direct and sheltered outdoor routes from the same deployment point to two approaches to the same antenna using measured rooftop visibility."""
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra
from site_check import *
views=np.load(ROOT/'Review/roofs.npz');v=views['v'];X,Z=np.meshgrid(v,v);step=v[1]-v[0];radius=25/25.4/2
big=union_all([*envelopes().values(),*court_hulls().values(),pool]);walk=field.buffer(-radius-.12).difference(union_all([big.buffer(radius+.045),*[p.buffer(.7874+radius-.008)for p in objectives]]))
legal=shapely.contains_xy(walk.buffer(-step*math.sqrt(2)*.5),X,Z);ids=np.arange(X.size).reshape(X.shape);row,col=np.where(legal);fr=[];to=[];ll=[]
for dr,dc in [(0,1),(1,0),(1,1),(1,-1)]:
    rr,cc=row+dr,col+dc;ok=(rr>=0)&(rr<len(v))&(cc>=0)&(cc<len(v));i,j,rr,cc=row[ok],col[ok],rr[ok],cc[ok];ok=legal[rr,cc];f,t=ids[i[ok],j[ok]],ids[rr[ok],cc[ok]];fr.extend([f,t]);to.extend([t,f]);ll.extend([np.full(len(f),math.hypot(dr,dc)*step)]*2)
fr=np.concatenate(fr);to=np.concatenate(to);ll=np.concatenate(ll)
def graph(weights):return csr_matrix((weights,(fr,to)),shape=(X.size,X.size))
base=graph(ll);data={}
for side,sign,op in [('west',-1,'east'),('east',1,'west')]:
    seen=(views[op].ravel()>0).astype(float);cross=(seen[fr]+seen[to])*.5
    guarded=graph(ll*(1+3.30*cross))
    for objective in objectives:
        label=side+('-north' if objective.y>0 else '-south')
        starts=ids[legal&(sign*X>=12.5)&(sign*X<17.8)&(abs(Z-objective.y)<8)]
        goals=ids[legal&(np.hypot(X-objective.x,Z-objective.y)<2.18)]
        picks=[]
        # Rank representative pairs from the same stretch of deployment line. The route can use either accessible side of the antenna.
        ordered=sorted(starts,key=lambda g:abs(Z.ravel()[g]-objective.y)+.65*abs(X.ravel()[g]-13.5*sign))
        for start in ordered[::max(1,len(ordered)//18)][:18]:
            shortest,pa=dijkstra(base,indices=start,return_predecessors=True)
            slow,pb=dijkstra(guarded,indices=start,return_predecessors=True)
            accessible=goals[np.isfinite(shortest[goals])]
            if len(accessible)==0:continue
            direct_goal=accessible[np.argmin(shortest[accessible])]
            if shortest[direct_goal]>29:continue
            for goal in accessible:
                def trace(pred,endpoint):
                    a=[endpoint]
                    while a[-1]!=start:a.append(pred[a[-1]])
                    a=np.array(a);xp=X.ravel()[a];zp=Z.ravel()[a];dist=np.hypot(np.diff(xp),np.diff(zp))
                    return [float(dist.sum()),float((dist*(seen[a[1:]]+seen[a[:-1]])*.5).sum())]
                da,ea=trace(pa,direct_goal);db,eb=trace(pb,goal)
                if da+.08<db and db<1.6*da and ea-eb>1.50:
                    picks.append((ea-eb-.32*(db-da)-.018*da,dict(start=[round(X.ravel()[start],2),round(Z.ravel()[start],2)],direct_endpoint=[round(X.ravel()[direct_goal],2),round(Z.ravel()[direct_goal],2)],sheltered_endpoint=[round(X.ravel()[goal],2),round(Z.ravel()[goal],2)],direct_inches=round(da,2),sheltered_inches=round(db,2),visible_on_direct=round(ea,2),visible_on_sheltered=round(eb,2))))
        data[label]=max(picks,key=lambda t:t[0])[1] if picks else None
print(json.dumps(data,indent=1),flush=True);write(ROOT/'Review/route-options.json',data)
