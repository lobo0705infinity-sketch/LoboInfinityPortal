from pathlib import Path
from collections import defaultdict
import numpy as np
from scipy.ndimage import uniform_filter
from geometry import mesh
from fetch import ROOT,file

GRID=160
PALETTE=[(51,37,27),(62,45,32),(119,92,65),(130,101,73),(109,83,59),(139,111,82),(66,49,35),(72,53,38),(61,45,32),(73,56,40)]
COLS,ROWS=5,2

def mesh_occupancy(data):
    v,u,f=data
    t=u[f[:,:,1]]
    lo=np.clip(np.floor(t.min(axis=1)*GRID).astype(int)-1,0,GRID-1)
    hi=np.clip(np.ceil(t.max(axis=1)*GRID).astype(int)+2,1,GRID)
    occ=np.zeros((GRID+1,GRID+1),dtype=int)
    for xs,ys,sign in [(lo[:,0],lo[:,1],1),(hi[:,0],lo[:,1],-1),(lo[:,0],hi[:,1],-1),(hi[:,0],hi[:,1],1)]:
        np.add.at(occ,(ys,xs),sign)
    return occ.cumsum(axis=0).cumsum(axis=1)[:GRID,:GRID]>0

def palette_slots(plan):
    occupied={}
    by_texture=defaultdict(list)
    for url,textures in plan.items():
        occupied[url]=mesh_occupancy(mesh(file(url)))
        for texture in textures:
            by_texture[texture].append(url)
    usage={texture:np.logical_or.reduce([occupied[url] for url in urls]) for texture,urls in by_texture.items()}
    layouts={}
    swatches=defaultdict(set)
    ordered=sorted(plan,key=lambda u:-len(plan[u]))
    for url in ordered:
        forbidden=np.logical_or.reduce([usage[t] for t in plan[url]])
        # Allow texture sharing at the identical position, but never partially overlap two palettes.
        reserved={slot for t in plan[url] for slot in swatches[t]}
        for unit in (3,2,1):
            ww,hh=COLS*unit,ROWS*unit
            sums=np.pad(forbidden,((1,0),(1,0))).cumsum(0).cumsum(1)
            scores=sums[hh:,ww:]-sums[:-hh,ww:]-sums[hh:,:-ww]+sums[:-hh,:-ww]
            scores[:1]=1
            scores[-1:]=1
            scores[:,:1]=1
            scores[:,-1:]=1
            available=np.argwhere(scores==0)
            preferred=sorted((s for s in reserved if s[2]==unit),key=lambda s:(s[1],s[0]))
            found=None
            for x,y,_ in preferred:
                if y<len(scores) and x<scores.shape[1] and scores[y,x]==0:
                    found=(x,y,unit)
                    break
            if found is None:
                for y,x in available:
                    if any(x<a+COLS*z and x+ww>a and y<b+ROWS*z and y+hh>b for a,b,z in reserved):
                        continue
                    found=(int(x),int(y),unit)
                    break
            if found is not None:break
        if found is None:
            raise RuntimeError(f'No free atlas space for {url}')
        layouts[url]=found
        for t in plan[url]:swatches[t].add(found)
    return layouts,swatches

def palette_uv(slot,index):
    x,y,n=slot
    return ((x+(index%COLS+.5)*n)/GRID,(y+(index//COLS+.5)*n)/GRID)

if __name__=='__main__':
    from collections import Counter
    import json
    plan=json.loads((ROOT/'plan.json').read_text())
    m,t=palette_slots(plan)
    print('Palette sizes',Counter(x[2] for x in m.values()))
    print('Unique locations',len(set(m.values())))
