"""Excise the lowest cumulative story while retaining the real upper floors, furniture and roofs."""
from collections import Counter
import math
import numpy as np
from PIL import Image, ImageOps
from shapely.geometry import Polygon
from shapely.ops import triangulate, unary_union
from rooftops import *
from design import hatch


def is_pump_window(face):
    x,y,w,h=ROOM_TILE
    u,v=np.mean([v[1] for v in face],axis=0)
    return x<4096*u<x+w and y<4096*(1-v)<y+h


def window_uv(vertex):
    position,(u,v),normal=vertex
    x,y,w,h=ROOM_TILE
    return position,((u*4096-x)/w,(v*4096-4096+y+h)/h),normal


def lower(vertex):
    (x,y,z),uv,normal=vertex
    return ((x,round(y-PITCH,5),z),uv,normal)


def subtract_shared(items,counts,key=lambda v:v):
    remaining=counts.copy()
    for item in items:
        ident=key(item)
        if remaining[ident]:
            remaining[ident]-=1
        else:
            yield item
    assert not any(remaining.values()),'Expected a cumulative R3 floor'


def solid_key(s):
    poly,lo,hi=s
    return tuple(sorted(poly)),lo,hi


def near(a,b):
    return abs(a-b)<1e-5


def interpolate(a,b,t):
    return tuple(tuple(x+t*(y-x) for x,y in zip(u,v)) for u,v in zip(a,b))


def half_plane(vertices,axis,plane,sign):
    inside=[];outside=[]
    for a,b in zip(vertices,vertices[1:]+vertices[:1]):
        da=(a[0][axis]-plane)*sign
        db=(b[0][axis]-plane)*sign
        if da<-1e-8:outside.append(a)
        elif da>1e-8:inside.append(a)
        else:inside.append(a);outside.append(a)
        if da*db < -1e-16:
            crossing=interpolate(a,b,da/(da-db))
            inside.append(crossing);outside.append(crossing)
    return inside,outside


def cut_face(face,port):
    """Carve a doorway through the actual glazing, sill and wall with interpolated UVs."""
    xmin,zmin,xmax,zmax=port.footprint().bounds
    corners=[v[0] for v in face]
    if (max(p[1] for p in corners)<=.016 or min(p[1] for p in corners)>=2.58 or
        max(p[0] for p in corners)<=xmin or min(p[0] for p in corners)>=xmax or
        max(p[2] for p in corners)<=zmin or min(p[2] for p in corners)>=zmax):return [face]
    kept=[];remaining=list(face)
    for axis,plane,sign in ((0,xmin,1),(0,xmax,-1),(2,zmin,1),(2,zmax,-1),(1,0,1),(1,2.58,-1)):
        if len(remaining)<3:break
        remaining,outer=half_plane(remaining,axis,plane,sign)
        for i in range(1,len(outer)-1):
            tri=(outer[0],outer[i],outer[i+1])
            a,b,c=(np.asarray(v[0]) for v in tri)
            if np.linalg.norm(np.cross(b-a,c-a))>1e-8:kept.append(tri)
    return kept


def convex_parts(shape):
    if shape.is_empty:return
    for poly in getattr(shape,'geoms',[shape]):
        if poly.geom_type!='Polygon' or poly.area<1e-5:continue
        if poly.convex_hull.area-poly.area<1e-6:
            yield poly.convex_hull
        else:
            yield from (p for p in triangulate(poly) if poly.covers(p.representative_point()) and p.area>1e-5)


def ring(p):
    coords=list(p.exterior.coords)[:-1]
    return coords if p.exterior.is_ccw else coords[::-1]


def cut_solid(s,port):
    fp,lo,hi=s;p=Polygon(fp);opening=port.footprint()
    if hi<=.016 or lo>=2.58 or p.intersection(opening).area<1e-8:return [s]
    result=[(ring(q),max(0.,lo),min(2.58,hi)) for q in convex_parts(p.difference(opening))]
    if lo<0:result.append((fp,lo,0))
    if hi>2.58:result.append((fp,2.58,hi))
    return result


def finish_jambs(mesh,port,roof_only):
    height=.585 if roof_only else 2.58
    n=port.center+port.inward*.017
    def piece(tangent,y,normal_width,tangent_width,h):
        x,z=port.xy(n,tangent)
        w,d=port.xy(normal_width,tangent_width)
        mesh.box(x,y,z,w,h,d,'zinc','teal',True)
    for offset in (-1.035,1.035):piece(port.tangent+offset,0,.31,.07,height)
    if not roof_only:piece(port.tangent,2.58,.31,2.14,.065)


def below_slab(face):
    ys=[v[0][1] for v in face]
    return max(ys)<=-.20+1e-7 and not all(near(y,-.22) for y in ys)


def emit(k):
    t=T[k]
    bottom=native.read_obj(old_file(k,1))[0]
    baseline=Counter(bottom)
    old_solids=native.read_obj(old_file(k,1,True))[1]
    base_solids=Counter(solid_key(s) for s in old_solids)
    foundation=[f for f in bottom if below_slab(f) and not is_pump_window(f)]
    photos=[tuple(window_uv(v) for v in f) for f in bottom if below_slab(f) and is_pump_window(f)]
    if photos:
        pane=native.Mesh();pane.faces=photos
        pane.save('lab-window-'+k)
    for state in range(1,t.n+1):
        prev=state+1
        m=native.Mesh();m.faces.extend(foundation)
        m.solids=[s for s in old_solids if s[1]<-2.9 and near(s[2],-.20)]
        assert len(m.solids)==1
        f=native.read_obj(old_file(k,prev))[0]
        s=native.read_obj(old_file(k,prev,True))[1]
        extra=list(subtract_shared(s,base_solids,solid_key))
        upper=[(p,round(lo-PITCH,5),round(hi-PITCH,5)) for p,lo,hi in extra]
        thickness=min(lo for poly,lo,hi in upper if near(hi,0))
        # Match the factory-filled structural seam and close the former downward ladder opening.
        m.prism(ring(t.poly),-.20,.20+thickness,'zinc','concrete',True)
        laid=unary_union([Polygon(poly) for poly,lo,hi in upper if near(hi,0)])
        fills=list(convex_parts(t.poly.difference(laid)))
        assert abs(sum(p.area for p in fills)-hatch(k).area)<.01,(k,state,'old stairwell')
        for patch in fills:m.prism(ring(patch),thickness,-thickness,'roofB' if t.n==1 else 'floorB','zinc',True)
        port=PORTS.get(k)
        for face in subtract_shared(f,baseline):
            lowered=tuple(lower(v) for v in face)
            assert min(v[0][1] for v in lowered)>-.17
            m.faces.extend(cut_face(lowered,port) if port else [lowered])
        for solid in upper:m.solids.extend(cut_solid(solid,port) if port else [solid])
        if port:finish_jambs(m,port,t.n==1)
        m.save(tower_name(k,state))
    native.read_obj.cache_clear()
    return len(photos)//2


def build():
    native.AS=ASSETS
    count={k:emit(k) for k in ROOFS}
    from build import ROOM
    assert {k for k,n in count.items() if n}=={k for k,rooms in ROOM.items() if 2 in rooms}
    # A single picking proxy inside the permanent foundation backs the decorative window object.
    proxy=native.Mesh();proxy.solids=[(native.rect(0,0,.10,.10),-1.51,-1.41)]
    proxy.save('lab-window-proxy')
    (ASSETS/'lab-window-proxy.obj').unlink()
    (WORK/'windows.json').write_text(json.dumps(count,indent=2))
    print('Towers',len(count),'meshes',sum(t.n for t in T.values()),'lab bays',sum(count.values()))


if __name__=='__main__':
    build()
