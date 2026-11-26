"""Audit the OBJs actually referenced by every state in the map and optional furniture."""
from collections import Counter
import json, math
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]
def revision(n):
    for candidate in [ROOT.parent/f'azure{n}',ROOT.parent/f'azure-palace-r{n}']:
        if candidate.is_dir():return candidate
    raise FileNotFoundError(n)

def local_url(url):
    name=url.rsplit('/',1)[-1];rev=re.search(r'/azure-palace-r(\d+)/',url)
    if rev and int(rev[1])!=1:
        candidate=revision(int(rev[1]))/'Assets'/name
        if candidate.is_file():return candidate
    r2=revision(2)
    for folder in [r2/'original/Assets',r2/'original/deps',ROOT.parent/'azure-palace-r1/Assets']:
        if (folder/name).is_file():return folder/name
    raise FileNotFoundError(url)

def objects(node):
    yield node
    for child in [*node.get('ChildObjects',[]),*node.get('ContainedObjects',[]),*node.get('States',{}).values()]:
        yield from objects(child)

def measure(path,collider=False):
    counts=[0,0,0];keys=set();triangles=Counter();group='model'
    for ln in path.read_text().splitlines():
        words=ln.split()
        if not words:continue
        tag=words[0]
        if tag in ('v','vt','vn'):
            counts[('v','vt','vn').index(tag)]+=1
            assert all(math.isfinite(float(k)) for k in words[1:]),path
        elif tag in ('o','g'):group=' '.join(words[1:])
        elif tag=='f':
            assert len(words)>=4,path
            for corner in words[1:]:
                ids=[]
                for i,k in enumerate(corner.split('/')):
                    if not k:ids.append(None);continue
                    n=int(k);index=n-1 if n>0 else counts[i]+n
                    assert 0<=index<counts[i],(path,corner)
                    ids.append(index)
                keys.add(tuple(ids))
            triangles[group]+=len(words)-3
    assert counts[0] and len(keys)<25000,(path,len(keys))
    if collider:assert max(triangles.values())<256,(path,max(triangles.values()))
    return {'vertices':len(keys),'triangles':sum(triangles.values())}

def verify():
    visual=set();colliders=set()
    for name in ['Azure-Palace.json','Azure-Palace-Scatter.json']:
        saved=json.loads((ROOT/'Release'/name).read_bytes())
        for root in saved['ObjectStates']:
            for obj in objects(root):
                m=obj.get('CustomMesh',{})
                if m.get('MeshURL'):visual.add(m['MeshURL'])
                if m.get('ColliderURL'):colliders.add(m['ColliderURL'])
    result={u:measure(local_url(u))for u in sorted(visual)}
    for u in sorted(colliders):measure(local_url(u),True)
    assert not any(u.endswith(('/east-villa-court.obj','/azure-spa-court.obj'))for u in visual)
    changed=[v for u,v in result.items()if '/azure-palace-r8/'in u]
    assert len(changed)==4 and all(v['triangles']*3<25000 for v in changed)
    (ROOT/'Review/model-import.json').write_text(json.dumps(result,indent=1))
    print(f'{len(visual)} visual models, {len(colliders)} collision files. Largest imported vertex count: {max(v["vertices"] for v in result.values())}.')
if __name__=='__main__':verify()
