"""Remove overlapping co-facing triangles from opaque architectural surfaces, preserving finish UVs."""
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor
from itertools import combinations
from pathlib import Path
import json
import numpy as np
import shapely as sh
from rooftops import ASSETS, WORK, AS2, R3, native

# Within four thousandths of an inch the backing surface can flicker through a finish.
DEPTH = .0041
MIN_AREA = .000001
ROUNDING_AREA = .00008

def layer(face):
    u,v=np.mean([v[1] for v in face],axis=0)
    x,y=u*4096,(1-v)*4096
    if x>3072 or y>3072: return 4
    idx=int(x//384)+8*int(y//384)
    return 3 if idx in (9,14,21,34,36) else 1

def on_plane(faces):
    p=np.asarray([[v[0] for v in tri] for tri in faces])
    normals=np.cross(p[:,1]-p[:,0],p[:,2]-p[:,0])
    length=np.linalg.norm(normals,axis=1)
    normals/=np.maximum(length,1e-12)[:,None]
    groups=defaultdict(list)
    for i,n in enumerate(normals):
        if length[i]>1e-8:groups[tuple(np.round(n,5))].append(i)
    return p,groups

def competing(faces, minimum=MIN_AREA):
    xyz,groups=on_plane(faces)
    cuts=defaultdict(list); count=[0,0]; covered=0.
    for key,ids in groups.items():
        if len(ids)<2:continue
        normal=np.asarray(key);axis=np.argmax(abs(normal))
        xy=np.delete(xyz[ids],axis,axis=2)
        d=np.einsum('ij,j->i',xyz[ids,0],normal)
        poly=sh.polygons(xy)
        by_id=np.array(ids)
        for start in range(0,len(ids),150):
            a,b=sh.STRtree(poly).query(poly[start:start+150])
            a+=start
            keep=(a<b)&(np.abs(d[a]-d[b])<=DEPTH)
            a,b=a[keep],b[keep]
            if not len(a):continue
            intersects=sh.intersection(poly[a],poly[b]);areas=sh.area(intersects)
            keep=areas>minimum
            for aa,bb,area in zip(a[keep],b[keep],areas[keep]):
                i,j=by_id[aa],by_id[bb];delta=d[aa]-d[bb]
                exact=abs(delta)<.000012
                if exact:
                    front=aa if (layer(faces[i]),-poly[aa].area,i)>(layer(faces[j]),-poly[bb].area,j) else bb
                else:front=aa if delta>0 else bb
                behind=bb if front==aa else aa
                cuts[by_id[behind]].append(poly[front])
                count[int(not exact)]+=1;covered+=area
    return cuts, count, covered

def retessellate(tri,masks):
    pos,uv,norm=(np.array([v[field] for v in tri]) for field in range(3))
    normal=np.cross(pos[1]-pos[0],pos[2]-pos[0]);axis=np.argmax(abs(normal))
    xy=np.delete(pos,axis,axis=1)
    rest=sh.difference(sh.Polygon(xy),sh.union_all(masks))
    if rest.is_empty or rest.area<=MIN_AREA:return []
    transform=np.linalg.inv(np.stack([xy[1]-xy[0],xy[2]-xy[0]],axis=1))
    result=[]
    for part in sh.get_parts(sh.constrained_delaunay_triangles(rest)):
        if part.area<MIN_AREA:continue
        points=np.asarray(part.exterior.coords)[:3]
        s=(points-xy[0])@transform.T
        bary=np.column_stack([1-s.sum(axis=1),s]);p=bary@pos
        if np.dot(np.cross(p[1]-p[0],p[2]-p[0]),normal)<0:bary=bary[[0,2,1]]
        ns=bary@norm;ns/=np.maximum(np.linalg.norm(ns,axis=1)[:,None],1e-10)
        result.append(tuple(zip(map(tuple,bary@pos),map(tuple,bary@uv),map(tuple,ns))))
    return result

def clean(faces):
    cuts,count,area=competing(faces)
    result=[]
    for i,f in enumerate(faces):
        if i in cuts:result.extend(retessellate(f,cuts[i]))
        else:result.append(f)
    return result,dict(exact_pairs=count[0],near_pairs=count[1],overlap_square_inches=round(area,4))

def do_file(spec):
    src=Path(spec);native.AS=ASSETS
    faces=native.read_obj(src)[0]
    out=native.Mesh()
    if src.stem.startswith('tower-'):
        from corners import add
        _,key,level=src.stem.split('-')
        out.solids=list(native.read_obj(src.with_name(src.stem+'-col.obj'))[1])
        add(out,key,int(level))
    out.faces,stats=clean(faces+out.faces);out.save(src.stem)
    native.read_obj.cache_clear();actual=native.read_obj(ASSETS/src.name)[0]
    _,after,area=competing(actual,ROUNDING_AREA)
    stats.update(remaining_above_rounding=sum(after),residual_area=round(area,6),input_faces=len(faces),output_faces=len(actual))
    print(src.stem,stats,flush=True)
    return src.stem,stats

def main():
    old=WORK/'fleet/old-mesh'
    src=[p for p in sorted(old.glob('tower-*.obj')) if '-col' not in p.stem]
    src.extend(p for p in sorted(AS2.glob('bridge-*.obj')) if '-col' not in p.stem)
    src.append(R3/'assets/greenhouse-door-hardware.obj')
    with ProcessPoolExecutor(max_workers=4) as pool:audit=dict(pool.map(do_file,src))
    (WORK/'surface-audit.json').write_text(json.dumps(audit,indent=2))

if __name__=='__main__':main()
