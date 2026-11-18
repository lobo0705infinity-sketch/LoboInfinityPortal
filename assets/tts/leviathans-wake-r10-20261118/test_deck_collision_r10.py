"""Validate exported collision solids against the unchanged rendered platform."""
from pathlib import Path
import json,collections
import numpy as np
from scipy.spatial import ConvexHull
from build_deck_collision_r10 import read_obj
R=Path(__file__).resolve().parent
def parts(path):
    vs=[];current=None;groups={}
    for line in path.read_text().splitlines():
        a=line.split()
        if not a:continue
        if a[0]=='v':vs.append([float(x)for x in a[1:4]])
        elif a[0]=='o':current=a[1];groups[current]=[]
        elif a[0]=='f':groups[current].append([int(x.split('/')[0])-1 for x in a[1:]])
    v=np.array(vs);return [(k,v,np.array(f))for k,f in groups.items()]
def height(eqs,x,z):
    hi=float('inf');lo=-float('inf')
    for a,b,c,d in eqs:
        q=-(a*x+c*z+d)
        if abs(b)<1e-9:
            if q< -1e-7:return None
        elif b>0:hi=min(hi,q/b)
        else:lo=max(lo,q/b)
    return hi if hi>=lo-1e-7 else None
def support(eqs,x,z):
    ys=[height(e,x,z)for e in eqs];ys=[y for y in ys if y is not None]
    return max(ys)if ys else None
def visual_deck():
    v=[];uv=[];deck=[]
    for line in (R/'assets/cover-double-deck-state-2.obj').read_text().splitlines():
        a=line.split()
        if not a:continue
        if a[0]=='v':v.append([float(x)for x in a[1:4]])
        elif a[0]=='vt':uv.append([float(x)for x in a[1:3]])
        elif a[0]=='f':
            tokens=[t.split('/')for t in a[1:]]
            tex=[uv[int(t[1])-1]for t in tokens]
            if all(.375<u<.5 and .875<w<=1 for u,w in tex):
                tri=np.array([v[int(t[0])-1]for t in tokens])
                if np.cross(tri[1]-tri[0],tri[2]-tri[0])[1]>0:deck.append(tri)
    assert len(deck)==16,len(deck)
    return deck
def deck_y(triangles,x,z):
    for t in triangles:
        ab=np.column_stack((t[1,[0,2]]-t[0,[0,2]],t[2,[0,2]]-t[0,[0,2]]))
        try:a,b=np.linalg.solve(ab,np.array([x,z])-t[0,[0,2]])
        except np.linalg.LinAlgError:continue
        if a>=-1e-8 and b>=-1e-8 and a+b<=1+1e-8:return t[0,1]+a*(t[1,1]-t[0,1])+b*(t[2,1]-t[0,1])
    return None
checks=[]
def check(label,value):assert value,label;checks.append(label)
def main():
    solids={};counts={}
    for state in [1,2]:
        groups=parts(R/'assets'/f'cover-double-deck-state-{state}-collider-r10.obj');solids[state]=[];counts[state]=len(groups)
        for name,v,f in groups:
            vertices=v[np.unique(f)];h=ConvexHull(vertices);solids[state].append(h.equations)
            edges=collections.Counter(tuple(sorted((int(a),int(b))))for face in f for a,b in zip(face,np.roll(face,-1)))
            check(f'{state}/{name}: closed convex solid below per-mesh limit',all(n==2 for n in edges.values())and len(f)<255 and len(vertices)<255 and h.volume>1e-8)
            centers=v[f].mean(1);normals=np.cross(v[f[:,1]]-v[f[:,0]],v[f[:,2]]-v[f[:,0]])
            check(f'{state}/{name}: outward normals',np.all(np.sum(normals*(centers-vertices.mean(0)),axis=1)>0))
    deck=visual_deck();errors=[]
    for x in np.linspace(-3.2,3.2,41):
        for z in np.linspace(-2.25,-.5,26):
            a=deck_y(deck,x,z);b=support(solids[2],x,z)
            assert a is not None and b is not None,(x,z,a,b)
            errors.append(abs(a-b))
    check('1066 open-deck points match the actual rendered deck',max(errors)<.0001)
    positions=[]
    for diameter in [25,40,55]:
        radius=diameter/25.4/2
        # The widest base needs clearance from the visibly leaning side wall.
        for x in ([-1.9,0,1.9]if diameter==55 else[-2.2,0,2.2]):
            z=-1.4;points=[(x,z)]+[(x+radius*np.cos(t),z+radius*np.sin(t))for t in np.linspace(0,2*np.pi,64,endpoint=False)]
            expected=max(deck_y(deck,a,b)for a,b in points)
            actual=max(support(solids[2],a,b)for a,b in points)
            check(f'{diameter}mm base at {x},{z}: supported by visible floor',abs(expected-actual)<.0001)
            positions.append({'diameter_mm':diameter,'x':x,'z':z,'bottom_y':actual})
    under=[np.array([x,y,z])for x in [-1.2,0,1.2]for y in [.2,1.2,2.4]for z in [-1.2,0,1.2]]
    check('Under-deck central passage remains empty',all(not np.all(e[:,:3]@p+e[:,3]<=1e-7)for p in under for e in solids[2]))
    check('Open state has no invisible deck or ceiling',support(solids[1],0,0)is None)
    old,_=read_obj(R/'collision-reference/cover-double-deck-state-2-collider.obj')
    old_y=height(ConvexHull(old).equations,0,0);new_y=support(solids[2],0,0)
    check('Whole-object convex envelope would block placement above the real deck',old_y-new_y>1)
    result={'passed':True,'checks':len(checks),'state_parts':counts,'max_deck_error_inches':max(errors),'old_whole_hull_center_y':old_y,'new_center_y':new_y,'base_support_checks':positions,'live_tts_tested':False}
    (R/'deck-collision-validation-r10.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))
if __name__=='__main__':main()
