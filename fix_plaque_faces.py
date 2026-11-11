"""Remove the reverse-wound duplicates from each stand's existing plaque."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

def repair(obj, name):
    lines=obj.splitlines(keepends=True)
    vertices=[]
    uv_count=0
    faces=[]
    for i,line in enumerate(lines):
        if line.startswith('v '):
            vertices.append(tuple(map(float,line.split()[1:])))
        elif line.startswith('vt '):
            uv_count+=1
        elif line.startswith('f '):
            face=[tuple(int(k) for k in field.split('/')[:2]) for field in line.split()[1:]]
            faces.append((i,face))
    if name.startswith('persian-infantry-'):
        plaque=[(i,face) for i,face in faces if all(9<=v<=12 for v,t in face)]
    else:
        plaque=[(i,face) for i,face in faces if any(t>uv_count-6 for v,t in face)]
    assert len(plaque)==4,(name,len(plaque))
    front={}
    reverse={}
    for i,face in plaque:
        a,b,c=(vertices[v-1] for v,t in face)
        normal_y=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2])
        assert abs(normal_y)>1e-5,(name,face)
        key=tuple(sorted(face))
        side=front if normal_y>0 else reverse
        assert key not in side
        side[key]=i
    assert len(front)==len(reverse)==2 and front.keys()==reverse.keys(),name
    assert len({vertices[v-1] for f in front for v,t in f})==4,(name,front)
    # The plaque vertices belong to the plaque alone, so generating normals
    # from the remaining faces cannot average them with any base geometry.
    plaque_vertices={v for f in front for v,t in f}
    assert not any(plaque_vertices.intersection(v for v,t in face) for i,face in faces
                   if i not in (*front.values(),*reverse.values())),name
    dropped=set(reverse.values())
    fixed=''.join(l for i,l in enumerate(lines) if i not in dropped)
    assert len(fixed.splitlines())==len(lines)-2
    return fixed

def read_mesh(url, input_dir):
    if input_dir:
        return (input_dir/url.rsplit('/',1)[-1]).read_text()
    for attempt in range(3):
        try:
            with urlopen(url,timeout=45) as response:
                return response.read().decode()
        except OSError:
            if attempt==2:raise

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('plan',type=Path)
    parser.add_argument('output',type=Path)
    parser.add_argument('--inputs',type=Path)
    parser.add_argument('--workers',type=int,default=8)
    args=parser.parse_args()
    urls=json.loads(args.plan.read_text())
    assert len(urls)==len(set(urls))==257
    args.output.mkdir(parents=True,exist_ok=True)
    def one(url):
        name=url.rsplit('/',1)[-1]
        result=repair(read_mesh(url,args.inputs),name)
        data=result.encode()
        (args.output/name).write_bytes(data)
        return name,hashlib.sha256(data).hexdigest()
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        results=dict(pool.map(one,urls))
    assert len(results)==len(urls)
    (args.output/'SHA256SUMS.json').write_text(json.dumps(results,indent=2)+'\n')
    print('Removed 514 reverse faces from 257 stand meshes.',flush=True)
if __name__=='__main__':
    main()
