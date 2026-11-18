"""Separate convex pieces: no hull may bridge the playable deck to its walls.

Visual meshes are immutable. Author coordinates mirror X on OBJ export, exactly
as cover_mesh.Mesh.write does. Deck triangles match doubledeck()'s visible fan.
"""
from pathlib import Path
import json
import numpy as np
from scipy.spatial import ConvexHull
from scipy.spatial.transform import Rotation
R=Path(__file__).resolve().parent
OUTLINE=[(-4,2.65,-2.6),(-3.3,2.59,-2.75),(-2.8,2.73,-2.55),(-2.6,2.75,-2.9),(-1.8,2.61,-2.68),(-.6,2.90,-2.78),(.3,2.86,-2.56),(.7,2.94,-2.91),(1.4,3.02,-2.82),(2.2,2.92,-2.65),(3.9,3.14,-2.55),(4.02,3.17,.7),(3.6,3.13,2.72),(1.2,2.99,2.85),(-2.3,2.79,2.7),(-4,2.66,2.18)]
def read_obj(p):
    vs=[];fs=[]
    for line in p.read_text().splitlines():
        a=line.split()
        if a and a[0]=='v':vs.append([float(x)for x in a[1:4]])
        elif a and a[0]=='f':fs.append([int(x.split('/')[0])-1 for x in a[1:]])
    return np.array(vs),np.array(fs)
def components(p):
    v,f=read_obj(p);u,ix=np.unique(v,axis=0,return_inverse=True);parents=list(range(len(u)))
    def root(i):
        while parents[i]!=i:i=parents[i]
        return i
    for face in ix[f]:
        for i in face[1:]:parents[root(i)]=root(face[0])
    groups={}
    for i in range(len(u)):groups.setdefault(root(i),[]).append(i)
    return [u[g]for g in groups.values()]
def mirror(v):return np.asarray(v,float)*[-1,1,1]
def prism(top,offset):
    v=np.asarray(top,float)
    return mirror(np.vstack([v,v+offset]))
def box(center,size,angles=(0,0,0)):
    corners=np.array([(a,b,c)for a in [-.5,.5]for b in [-.5,.5]for c in [-.5,.5]])*size
    return mirror(Rotation.from_euler('xyz',angles,degrees=True).apply(corners)+center)
def build_parts(state):
    lower=components(R/'collision-reference/cover-double-deck-state-1-collider.obj')
    parts=[(f'support_{i+1:02}',v)for i,v in enumerate(lower)]
    if state==1:return parts
    for i,p in enumerate(OUTLINE):parts.append((f'deck_{i+1:02}',prism([(0,2.9,0),p,OUTLINE[(i+1)%len(OUTLINE)]],(0,-.18,0))))
    for x in [-3.6,3.65]:
        pts=[(x,2.9,-1.9),(x,2.9,2.6),(x+.12,5.02,2.4),(x-.22,4.55,.5),(x+.2,4.1,-1.4)]
        for i in range(1,len(pts)-1):parts.append((f'side_{x}_{i}',prism([pts[0],pts[i],pts[i+1]],(.14,0,0))))
    for label,pts,offset in [
        ('rear',[(-3.65,2.9,2.6),(3.7,3.15,2.6),(3.35,5.22,2.5),(.6,4.8,2.45),(-3.5,4.95,2.4)],(0,0,.14)),
        ('awning',[(-3.5,5.12,2.5),(3.3,5.30,2.4),(2.6,4.84,1.5),(-.2,5,1.3),(-3.6,4.7,1.6)],(0,-.13,0))]:
        for i in range(1,len(pts)-1):parts.append((f'{label}_{i}',prism([pts[0],pts[i],pts[i+1]],offset)))
    for n,x in enumerate([-2.7,-1.5,-.3]):
        for j,xx in enumerate([x-.46,x+.46]):parts.append((f'shelf_{n}_side_{j}',box((xx,3.65,2.05),(.08,1.15,.75))))
        for j,y in enumerate([3.1,3.6,4.15]):parts.append((f'shelf_{n}_board_{j}',box((x,y,2.05),(.98,.07,.76))))
    for i,(center,size,angles)in enumerate([
        ((-2.65,3.35,1.25),(.95,.42,.75),(15,12,-24)),
        ((-.4,3.17,1),(.82,.09,1.1),(4,-28,8)),
        ((-1.6,3.09,.9),(1.1,.08,.8),(5,22,12)),
        ((1.7,3.52,1.75),(.9,.65,.7),(17,-9,24))]):parts.append((f'debris_{i+1}',box(center,size,angles)))
    return parts
def write(state):
    lines=['# R10 compound collision: separate closed convex OBJ objects','s off'];base=0;normal=0;stats=[]
    for label,points in build_parts(state):
        v=np.unique(np.round(points,5),axis=0);h=ConvexHull(v)
        lines+=['o '+label,'g '+label]+['v %.5f %.5f %.5f'%tuple(p)for p in v]
        triangles=[]
        for face,equation in zip(h.simplices,h.equations):
            p=v[face];n=equation[:3]
            if np.dot(np.cross(p[1]-p[0],p[2]-p[0]),n)<0:face=face[::-1]
            normal+=1;lines.append('vn %.8f %.8f %.8f'%tuple(n));triangles.append((face,normal))
        lines+=['f '+' '.join(f'{base+int(i)+1}//{ni}'for i in f)for f,ni in triangles]
        stats.append({'part':label,'vertices':len(v),'triangles':len(triangles),'volume':h.volume})
        base+=len(v)
    p=R/'assets'/f'cover-double-deck-state-{state}-collider-r10.obj';p.write_text('\n'.join(lines)+'\n')
    return {'state':state,'file':p.name,'parts':len(stats),'vertices':base,'triangles':sum(s['triangles']for s in stats),'max_triangles_per_part':max(s['triangles']for s in stats),'components':stats}
if __name__=='__main__':
    report=[write(s)for s in [1,2]]
    (R/'deck-collision-build-r10.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps([{k:v for k,v in r.items()if k!='components'}for r in report]))
