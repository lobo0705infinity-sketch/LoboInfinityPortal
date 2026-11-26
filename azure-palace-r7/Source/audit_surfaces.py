"""Independently measure positive-area coplanar overlaps, including the façade-to-court joints."""
from functools import lru_cache
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor
import numpy as np,shapely
from common import *
from courts import sites
def arrays(p):
    v=[];tr=[]
    for line in Path(p).read_text().splitlines():
        if line.startswith('v '):v.append([float(k) for k in line.split()[1:4]])
        elif line.startswith('f '):
            corners=[int(a.split('/')[0])-1 for a in line.split()[1:]]
            tr.extend((corners[0],corners[k],corners[k+1]) for k in range(1,len(corners)-1))
    return np.asarray(v)[np.asarray(tr)]
def count(parts):
    tri=np.concatenate(parts);owners=np.concatenate([np.full(len(p),j) for j,p in enumerate(parts)])
    n=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);lens=np.linalg.norm(n,axis=1);axis=np.argmax(abs(n),axis=1);valid=lens>1.e-7
    n=n/np.maximum(lens,1e-10)[:,None];facing=np.take_along_axis(n,axis[:,None],axis=1)[:,0]>0;n*=np.where(facing,1,-1)[:,None]
    groups=defaultdict(list);dp=(n*tri[:,0]).sum(1)
    for i in np.flatnonzero(valid):groups[tuple(np.round([*n[i],dp[i]],5))].append(i)
    same=[];joint=[]
    for g in groups.values():
        if len(g)<2:continue
        a=axis[g[0]];xy=tri[g][:,:,[j for j in range(3) if j!=a]]
        polys=shapely.polygons(xy);ii,jj=shapely.STRtree(polys).query(polys,predicate='intersects')
        sel=ii<jj;ii,jj=ii[sel],jj[sel]
        if not len(ii):continue
        ar=shapely.area(shapely.intersection(polys[ii],polys[jj]));ids=np.flatnonzero(ar>3.e-5)
        for k in ids:
            x,y=g[ii[k]],g[jj[k]]
            data=[round(float(ar[k]),6),bool(facing[x]==facing[y]),[round(float(a),4) for a in tri[x].mean(0)]]
            (same if owners[x]==owners[y] else joint).append(data)
    return same,joint
def run(t):
    name,files=t
    same,joint=count([arrays(p) for p in files])
    return name,{'within':len(same),'interfaces':len(joint),'same_facing':sum(q[1] for q in same+joint),'largest':sorted(same+joint,reverse=True)[:3]}
if __name__=='__main__':
    tasks=[(k+'-'+str(n),[OUT/(k+'-'+str(n)+'.obj'),OUT/(k+'-court.obj')]) for k,(_,_,c,_) in A.dims.items() for n in range(1,c+2)]
    tasks.append(('basin',[OUT/'recessed-pool.obj',OUT/'pool-court.obj']))
    with ProcessPoolExecutor(max_workers=4)as pool:reports=dict(pool.map(run,tasks))
    print(json.dumps({k:v for k,v in reports.items()if v['within'] or v['interfaces']},indent=1));write(ROOT/'Review/surfaces.json',reports)
