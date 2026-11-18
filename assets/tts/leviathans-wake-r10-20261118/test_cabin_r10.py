"""Check subtraction-only cabin edits, front preservation and removed collision."""
from pathlib import Path
from collections import Counter
import json
import numpy as np
R=Path(__file__).resolve().parent
def triangles(path):
    v=[];uv=[];out=[]
    for line in path.read_text().splitlines():
        p=line.split()
        if not p:continue
        if p[0]=='v':v.append(tuple(map(float,p[1:])))
        elif p[0]=='vt':uv.append(tuple(map(float,p[1:])))
        elif p[0]=='f':
            out.append(tuple((v[int(t.split('/')[0])-1],uv[int(t.split('/')[1])-1]) for t in p[1:]))
    return out
checks=[];removed={}
def check(name,value):
    assert value,name
    checks.append(name)
for state in (1,2):
    for suffix in ('','-collider'):
        name=f'detached-cabin-state-{state}{suffix}.obj'
        old=Counter(triangles(R/'collision-reference'/name));new=Counter(triangles(R/'assets'/name))
        gone=old-new
        check(name+' only removes existing triangles',not(new-old) and bool(gone))
        check(name+' retains front entrance, seats and hull',all(all(v[0][2]<-.9 for v in tri) for tri in gone))
        removed[name]=sum(gone.values())
        if not suffix:
            # Every rear doorway face and both furniture groups are absent.
            check(name+' removes furniture surface triangles',sum(n for tri,n in gone.items() if all(-2.1<v[0][2]<-.9 for v in tri))>250)
            check(name+' removes rear access frame',sum(n for tri,n in gone.items() if all(v[0][2]<-2.4 for v in tri))>50)
        else:
            # Cabinet formerly occupied the right rear model-placement spot.
            pts=np.array([v[0] for tri in new for v in tri])
            check(name+' has no former cabinet collision',not np.any((pts[:,0]>1.5)&(pts[:,0]<3.4)&(pts[:,2]>-1.9)&(pts[:,2]<-1.1)&(pts[:,1]>.31)&(pts[:,1]<1.7)))
            check(name+' has no removed rear posts',not any(all(1.1<abs(v[0][0])<1.4 and v[0][2]<-2.5 for v in tri) for tri in new))
report={'passed':True,'count':len(checks),'checks':checks,'removed_triangles':removed,'live_tts_tested':False}
(R/'cabin-validation-r10.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS',len(checks),'cabin geometry and collision checks')
