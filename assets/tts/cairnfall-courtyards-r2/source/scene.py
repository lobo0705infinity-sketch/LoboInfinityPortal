from pathlib import Path
from functools import lru_cache
from copy import deepcopy
import json,re
import numpy as np
from scipy.spatial.transform import Rotation
from shapely.geometry import LineString,Point,box,Polygon
from shapely.ops import polygonize
from shapely import union_all,make_valid
BASE=Path(__file__).resolve().parents[1]
R4=BASE/'assets'
FILES=json.loads((BASE/'base/cache.json').read_bytes())
def local(url):
    if '/cairnfall-courtyards-r2/' in url:return BASE/'assets'/url.rsplit('/',1)[-1]
    value=Path(FILES[url]);return value if value.is_absolute() else (BASE.parent/value if (BASE.parent/value).exists() else BASE/'cache'/value.name)
def bag(guid='100326'):
    name='Cairnfall-Sanctuary.json' if guid=='100326' else 'Cairnfall-Top40-Losers-R4.json'
    return json.loads((BASE/'base'/name).read_bytes())['ObjectStates'][0]
def poses(b):return {m[1]:tuple(float(x) for x in m[2].split(','))for m in re.finditer(r'^--([0-9a-f]{6}),([0-9eE.,+\-]+)\r?$',b['LuaScript'],re.M)}
keys=('posX','posY','posZ','rotX','rotY','rotZ')
def deployed(b):
    xyz=poses(b);oo=deepcopy(b['ContainedObjects'])
    for o in oo:o['Transform'].update(dict(zip(keys,xyz[o['GUID']])))
    return oo
@lru_cache(None)
def read(p):
    v=[];f=[]
    for l in p.read_text().splitlines():
        if l.startswith('v '):v.append(tuple(map(float,l.split()[1:4])))
        elif l.startswith('f '):
            q=[int(x.split('/')[0])-1 for x in l.split()[1:]]
            f.extend([q[0],q[i],q[i+1]] for i in range(1,len(q)-1))
    return np.array(v),np.array(f)
def mesh(o,phys=True,alternative=None):
    c=(alternative or o).get('CustomMesh')
    if not c:return np.empty((0,3,3))
    p,f=read(local(c['ColliderURL'] if phys and c.get('ColliderURL') else c['MeshURL']))
    t=o['Transform'];xyz=p*np.array([-t['scaleX'],t['scaleY'],t['scaleZ']])
    pos=Rotation.from_euler('YXZ',[t['rot'+k] for k in 'YXZ'],degrees=True).apply(xyz)+[t['pos'+k]for k in 'XYZ']
    return pos[f]
def section(tri,y):
    seg=[]
    if not tri.size:return Polygon()
    for t in tri[(tri[:,:,1].min(1)<y)&(tri[:,:,1].max(1)>y)]:
        l=[]
        for a,b in zip(t,np.roll(t,-1,axis=0)):
            if (a[1]<=y)!=(b[1]<=y):
                h=a+(b-a)*((y-a[1])/(b[1]-a[1]));l.append(tuple(np.round(h[[0,2]],4)))
        if len(l)==2 and l[0]!=l[1]:seg.append(LineString(l))
    if not seg:return Polygon()
    return union_all([*(p if p.is_valid else make_valid(p) for p in polygonize(seg)),union_all(seg).buffer(.004,quad_segs=2)],grid_size=.00001)
def footprint(tri):return union_all([Polygon(t[:,[0,2]])for t in tri if abs(np.cross(t[1]-t[0],t[2]-t[0])[1])>1.e-6],grid_size=.0001) if tri.size else Polygon()
def sight(tri,a,b):
    if not tri.size:return False
    a=np.array(a);b=np.array(b);d=b-a
    t=tri[np.all(tri.min(1)<=np.maximum(a,b)+1.e-6,axis=1)&np.all(tri.max(1)>=np.minimum(a,b)-1.e-6,axis=1)]
    if not t.size:return False
    e=t[:,1]-t[:,0];f=t[:,2]-t[:,0];h=np.cross(d,f);det=(e*h).sum(1);ok=abs(det)>1.e-8
    inv=np.divide(1,det,out=np.zeros_like(det),where=ok);delta=a-t[:,0];u=(delta*h).sum(1)*inv;q=np.cross(delta,e);v=(q*d).sum(1)*inv;dist=(q*f).sum(1)*inv
    return bool(np.any(ok&(u>=-1.e-7)&(v>=-1.e-7)&(u+v<=1.0000001)&(dist>1.e-5)&(dist<.99999)))
