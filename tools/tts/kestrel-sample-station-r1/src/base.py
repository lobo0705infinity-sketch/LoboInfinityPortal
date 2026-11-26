from pathlib import Path
from hashlib import sha256, sha1
import json, os, time
from urllib.request import Request, urlopen
from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from scipy.spatial.transform import Rotation

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'data'; WORK=ROOT/'work'; ASSETS=ROOT/'assets'; CACHE=ROOT/'cache'; DIST=ROOT/'dist'
REPO='lobo0705infinity-sketch/LoboInfinityPortal'
PIN=json.loads((DATA/'api').read_bytes())['object']['sha']
PREFIX='assets/tts/kestrel-sample-station-r1'
RAW='https://raw.githubusercontent.com/'+REPO+'/'
ORIGINAL=json.loads((DATA/'original-bag.json').read_bytes())['ObjectStates'][0]
GRADE=6.25
def walk(o):
    yield o
    for c in o.get('ChildObjects',[])+list(o.get('States',{}).values()):
        yield from walk(c)
def dump(p,obj):
    p.write_text(json.dumps(obj,separators=(',',':'),ensure_ascii=False))
def local(u):
    def cached(key):return CACHE/(sha256(key.encode()).hexdigest()[:14]+'-'+(key.rstrip('/').split('/')[-1][:100]))
    path=cached(u)
    return cached(u.replace(RAW+PIN+'/',RAW+'main/')) if not path.exists() and u.startswith(RAW+PIN+'/') else path
def get(url):
    for i in range(4):
        try:
            with urlopen(Request(url,headers={'User-Agent':'Kestrel-TTS-Playtest'}),timeout=28) as r:return r.read()
        except OSError as e:
            if i==3 or getattr(e,'code',0)==404:raise
            time.sleep(.8+i)
def matrix(t):
    m=np.eye(4);m[:3,:3]=Rotation.from_euler('YXZ',[t['rotY'],t['rotX'],t['rotZ']],degrees=True).as_matrix()@np.diag([t['scaleX'],t['scaleY'],t['scaleZ']]);m[:3,3]=[t['posX'],t['posY'],t['posZ']];return m
def world(v,t):
    # TTS imports a right-handed Wavefront mesh into Unity by reflecting local X.
    q=np.array(v)*[-1,1,1];m=matrix(t);return q@m[:3,:3].T+m[:3,3]
def mesh(p):
    v=[];faces=[]
    for l in p.read_text(errors='replace').splitlines():
        if l.startswith('v '):v.append(list(map(float,l.split()[1:4])))
        elif l.startswith('f '):
            ids=[int(x.split('/')[0]) for x in l.split()[1:]];ids=[i-1 if i>0 else len(v)+i for i in ids]
            faces.extend([(ids[0],ids[k],ids[k+1])for k in range(1,len(ids)-1)])
    return np.array(v),np.array(faces,dtype=int)
if __name__=='__main__':
    tree={x['path']:x['sha'] for x in json.loads((DATA/'repo-tree.json').read_bytes())['tree'] if x['type']=='blob'}
    urls={u for root in ORIGINAL['ContainedObjects'] for o in walk(root) for payload in (o.get('CustomMesh',{}),o.get('CustomAssetbundle',{})) for k,u in payload.items() if k.endswith('URL') and u}
    def task(u):
        p=local(u);dest=u.replace(RAW+'main/',RAW+PIN+'/');b=p.read_bytes() if p.exists() else get(dest)
        if u.startswith(RAW+'main/'):
            assert sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==tree[u.split('/main/',1)[1]],u
        if not p.exists():p.write_bytes(b)
        return (u,p.name,len(b))
    with ThreadPoolExecutor(12) as pool:d=list(pool.map(task,sorted(urls)))
    dump(WORK/'source-assets.json',d);print(len(d),'source assets',sum(n for _,_,n in d),'bytes',flush=True)
