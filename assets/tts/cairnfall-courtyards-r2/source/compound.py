"""Join triangular collision prisms only when their union is provably convex."""
from collections import defaultdict,Counter
import numpy as np
from scipy.spatial import ConvexHull

def intersection_volume(a,b):
    points=[]
    def inside(p,h):return np.max(p@h.equations[:,:3].T+h.equations[:,3],axis=1)<=.00000006
    for h,other in [(a,b),(b,a)]:
        verts=h.points;points.extend(verts[inside(verts,other)])
        edges=np.unique(np.sort(np.vstack([h.simplices[:,[0,1]],h.simplices[:,[1,2]],h.simplices[:,[2,0]]]),axis=1),axis=0)
        start=verts[edges[:,0]];end=verts[edges[:,1]];vec=end-start;eq=other.equations
        den=vec@eq[:,:3].T;dist=start@eq[:,:3].T+eq[:,3]
        t=np.divide(-dist,den,out=np.full_like(dist,-2),where=abs(den)>1.e-10)
        ei,pi=np.where((t>=0)&(t<=1));q=start[ei]+vec[ei]*t[ei,pi,None]
        if len(q):points.extend(q[inside(q,other)])
    pts=np.unique(np.round(points,8),axis=0)
    if len(pts)<4 or np.linalg.matrix_rank(pts[1:]-pts[0],tol=.0000001)<3:return 0.
    return ConvexHull(pts).volume

def join_groups(obj):
    faces=defaultdict(list)
    for group,face in obj.faces:faces[group].append(face)
    groups={};retain=[]
    for i,(name,fac) in enumerate(faces.items()):
        if name.startswith('roof-planter'):
            retain.extend((name,f) for f in fac);continue
        indices={w[0] for f in fac for w in f}
        coords=frozenset(tuple(obj.v[v].round(7))for v in indices)
        groups[i]=(coords,ConvexHull(np.array(sorted(coords))))
    initial=len(groups)
    def volume():return sum(h.volume for _,h in groups.values())
    # Removing a hull contained by another hull also preserves the union, including door and window openings.
    removed=0
    for i in sorted(list(groups),key=lambda k:groups[k][1].volume):
        if i not in groups:continue
        points,h=groups[i];p=np.array(sorted(points))
        for j,(_,k) in groups.items():
            if j==i or k.volume<h.volume-1.e-8 or np.any(h.min_bound<k.min_bound-.0000001) or np.any(h.max_bound>k.max_bound+.0000001):continue
            if (k.equations[:,:3]@p.T+k.equations[:,3,None]).max()<=.0000001:
                del groups[i];removed+=1;break
    baseline=volume();overlap_total=0.
    while True:
        shared=defaultdict(list)
        for i,(coordinates,_) in groups.items():
            for v in coordinates:shared[v].append(i)
        matches=Counter()
        for rows in shared.values():
            for n,i in enumerate(rows):
                for j in rows[n+1:]:matches[(min(i,j),max(i,j))]+=1
        # The end of one block can meet a larger flat face without sharing the same vertex indices.
        ids=list(groups)
        lows=np.array([groups[i][1].min_bound for i in ids]);highs=np.array([groups[i][1].max_bound for i in ids])
        lo=np.maximum(lows[:,None,:],lows[None,:,:]);hi=np.minimum(highs[:,None,:],highs[None,:,:])
        for ii,jj in np.argwhere(np.triu(np.all(hi>=lo-.0000001,axis=2)&(np.sum(hi-lo>.00001,axis=2)>=2),1)):
            i,j=sorted((ids[ii],ids[jj]));matches.setdefault((i,j),0)
        changed=False
        for (i,j),count in sorted(matches.items(),key=lambda s:-s[1]):
            if i not in groups or j not in groups:continue
            a,h=groups[i];b,k=groups[j];pa=np.array(sorted(a));pb=np.array(sorted(b))
            # A supporting plane of either piece separates their interiors.
            def separate(h,points):return np.any(np.min(h.equations[:,:3]@points.T+h.equations[:,3,None],axis=1)>=-.0000001)
            separate_interiors=separate(h,pb) or separate(k,pa)
            allpoints=a|b;c=ConvexHull(np.array(sorted(allpoints)));vol=h.volume+k.volume
            if c.volume>vol+max(1.e-7,vol*1.e-8):continue
            overlap=0. if separate_interiors else intersection_volume(h,k)
            vol-=overlap
            if abs(c.volume-vol)>max(1.e-8,vol*1.e-8) or len(c.simplices)>240:continue
            groups[i]=(allpoints,c);del groups[j];changed=True;overlap_total+=overlap
        if not changed:break
    assert abs(volume()+overlap_total-baseline)<max(1.e-7,baseline*1.e-8)
    index={tuple(v.round(7)):i for i,v in enumerate(obj.v)};combined=[]
    for i,(coordinates,h) in groups.items():
        points=h.points;indices=[index[tuple(v)] for v in points]
        for tri,eq in zip(h.simplices,h.equations):
            a,b,c=tri
            if np.dot(np.cross(points[b]-points[a],points[c]-points[a]),eq[:3])<0:b,c=c,b
            combined.append(('convex_'+str(i),[(indices[t],)for t in (a,b,c)]))
    obj.faces=combined+retain
    print('Exact collision groups',initial,'to',len(groups),'plus roof planter groups',len(set(g for g,_ in retain)),flush=True)
