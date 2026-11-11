from pathlib import Path
from itertools import product
from collections import Counter
import json
import numpy as np
from PIL import Image
from geometry import mesh
from slots import candidates

ROOT=Path(__file__).parent
SOURCE=ROOT/'source'
def filename(url):
    return url.rsplit('/',1)[-1]

def dimensions(textures):
    sizes={Image.open(SOURCE/filename(url)).size for url in textures}
    assert len(sizes)==1,sizes
    return sizes.pop()

def learn(src):
    v,u,f=mesh(src)
    groups={d:[] for d in (1,-1)}
    for k, indices, lower, upper in candidates(v,u,f):
        if upper[1]<1.35:continue
        uv=u[f[indices,:,1]].reshape(-1,2)
        groups[int(k[0])].append((float((lower[0]+upper[0])/2),float(lower[2]),float(lower[1]),float(upper[1]-lower[1]),float(upper[0]-lower[0]),uv.min(axis=0),uv.max(axis=0),float(k[2]),len(indices)))
    front=sorted(groups[1],key=lambda a:(a[1],a[0]))
    rear=list(groups[-1])
    assert len(front)==len(rear) and len(front) in (4,6,8,12),(src,len(front),len(rear))
    slots=[]
    for a in front:
        k=min(range(len(rear)),key=lambda i:abs(rear[i][0]-a[0])+abs(rear[i][1]-a[1]))
        b=rear.pop(k)
        assert abs(a[0]-b[0])<.25 and abs(a[1]-b[1])<.06,(src,a,b)
        slots.append((a,b))
    return slots

def group_sides(v,u,f,slots,ratio):
    positions=v[f[:,:,0]]
    uv=u[f[:,:,1]]
    norms=np.cross(positions[:,1]-positions[:,0],positions[:,2]-positions[:,0])[:,2]
    u0=uv.min(axis=1)
    u1=uv.max(axis=1)
    mean_x=positions[:,:,0].mean(axis=1)
    mean_u=uv[:,:,0].mean(axis=1)
    planar=np.ptp(positions[:,:,2],axis=1)<1e-6
    z=positions[:,:,2].mean(axis=1)
    claimed=set()
    present={}
    for index,(front,rear) in enumerate(slots):
        pair=[]
        for direction,(x,depth,_,_,width,lo,hi,slope,_) in ((1,front),(-1,rear)):
            edge_scale=np.array([ratio,1])
            a=(lo*edge_scale)-.001
            b=(hi*edge_scale)+.001
            slope=np.copysign(width/((hi[0]-lo[0])*ratio),slope)
            center_x=mean_x-slope*(mean_u-(lo[0]+hi[0])*ratio/2)
            matched=(np.sign(norms)==direction)&planar&(abs(z-depth)<.0001)&(abs(center_x-x)<.06)&np.all(u0>=a,axis=1)&np.all(u1<=b,axis=1)
            indices=np.flatnonzero(matched)
            pair.append(indices)
            assert claimed.isdisjoint(indices)
            claimed.update(indices)
        found=tuple(len(i)>60 for i in pair)
        assert found[0]==found[1],(index,list(map(len,pair)),ratio)
        if found[0]:present[index]=pair
    return present

def pattern(n,states,only_new):
    primary=(1,2) if only_new else (0,1,2)
    choice=None
    for values in product(primary,repeat=n):
        totals=Counter(values)
        if len(totals)!=len(primary) or max(totals.values())-min(totals.values())>1:continue
        counts=[Counter(values[i] for i in state) for state in states]
        if min(map(len,counts))<2:continue
        score=(sum((len(primary)-len(c))*4+max(c.values())-min(c.values()) for c in counts),
               sum(a==b for a,b in zip(values,values[1:])))
        if choice is None or score<choice[0]:choice=(score,values)
    assert choice is not None,(n,states)
    return choice[1]

if __name__=='__main__':
 plan=json.loads((ROOT/'plan.json').read_text())
 for kind,meshes in plan.items():
    first=next(iter(meshes))
    W,H=dimensions(meshes[first])
    slots=learn(SOURCE/filename(first))
    all_states=[]
    for url,textures in meshes.items():
        w,h=dimensions(textures)
        v,u,f=mesh(SOURCE/filename(url))
        present=group_sides(v,u,f,slots,W/w)
        counts=[tuple(map(len,p)) for p in present.values()]
        assert len({x[0] for x in counts})<4 and len({x[1] for x in counts})<4,(kind,url,counts)
        all_states.append(set(present))
        print(kind,filename(url),len(present),sorted(set(counts)))
    print('Pattern',pattern(len(slots),all_states,kind.startswith('Persian')))
