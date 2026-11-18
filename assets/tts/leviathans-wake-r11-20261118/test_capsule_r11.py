"""Validate the real exported pod: closed compound parts and clear hatch path."""
from pathlib import Path
import json,collections,math
import numpy as np
from scipy.spatial import ConvexHull
from test_deck_collision_r10 import parts
R=Path(__file__).resolve().parent
checks=[]
def check(name,value):assert value,name;checks.append(name)
solids={};faces=0
for name,v,f in parts(R/'assets/escape-capsule-collider.obj'):
    vv=v[np.unique(f)];h=ConvexHull(vv);solids[name]=h.equations
    edges=collections.Counter(tuple(sorted((int(a),int(b))))for face in f for a,b in zip(face,np.roll(face,-1)))
    check(name+' is closed and below convex mesh limits',all(n==2 for n in edges.values()) and len(f)<255 and len(vv)<255 and h.volume>1e-8)
    center=v[f].mean(1);normals=np.cross(v[f[:,1]]-v[f[:,0]],v[f[:,2]]-v[f[:,0]])
    check(name+' normals point outward',np.all(np.sum(normals*(center-vv.mean(0)),axis=1)>0))
    faces+=len(f)
def hit(point):return [name for name,e in solids.items()if np.all(e[:,:3]@point+e[:,3]<=1e-7)]
samples=0
for x in np.linspace(-.78,.78,9):
    for y in np.linspace(.34,2.55,9):
        for z in np.linspace(-1.7,-.2,9):
            check('clear entrance '+str((x,y,z)),not hit(np.array([x,y,z])));samples+=1
check('Interior is hollow rather than a whole-pod box',not hit(np.array([0,1.4,-.3])))
check('Floor supports interior placement',hit(np.array([0,.29,-.55]))==['floor'])
check('Crown has real collision',bool(hit(np.array([0,2.8,0]))))
# A 25 mm base can rest on the front floor without touching the seat or shell.
for t in np.linspace(0,2*math.pi,49):
    p=np.array([math.cos(t)*25/50.8,.32,-.55+math.sin(t)*25/50.8])
    check('25 mm base clearance '+str(t),not hit(p))
v=[];uv=[];sign=[]
for line in (R/'assets/escape-capsule.obj').read_text().splitlines():
    p=line.split()
    if not p:continue
    if p[0]=='v':v.append(tuple(map(float,p[1:])))
    elif p[0]=='vt':uv.append(tuple(map(float,p[1:])))
    elif p[0]=='f':
        ix=[t.split('/')for t in p[1:]]
        if all(0<float(uv[int(t[1])-1][0])<.125 and .625<float(uv[int(t[1])-1][1])<.75 for t in ix):sign.extend(v[int(t[0])-1]for t in ix)
check('Rocinante lettering is above the clear entrance',bool(sign)and min(p[1]for p in sign)>2.60)
check('Visual mesh stays below 25k vertices',len(v)<25000)
check('Pod height remains 3.16 inches without spikes',abs(max(p[1]for p in v)-3.16)<1e-5)
report={'passed':True,'count':len(checks),'compound_parts':len(solids),'collider_triangles':faces,'entrance_samples':samples,'visual_vertices':len(v),'live_tts_tested':False}
(R/'capsule-validation-r11.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
