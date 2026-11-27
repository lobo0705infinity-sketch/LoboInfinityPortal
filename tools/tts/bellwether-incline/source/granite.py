"""Build a shared, closed triangle surface for the two terraced banks."""
from collections import defaultdict
from math import ceil, floor, hypot, sin, pi
import numpy as np
from shapely import Polygon, constrained_delaunay_triangles, get_parts
from shapely.geometry.polygon import orient
from mesh import Mesh, Pair

def point(x,z):
    return (round(x,5),round(z,5))

def edges(loop):
    return zip(loop,loop[1:]+loop[:1])

def texture_u(p):
    return (p[0]*.79+p[1]*.72)/5.2

def segment_points(a,b):
    dx=b[0]-a[0];dz=b[1]-a[1]
    length=hypot(dx,dz)
    count=max(1,ceil(length/1.15))
    cuts={i/count for i in range(count+1)}
    u,v=texture_u(a),texture_u(b)
    if abs(v-u)>1e-8:
        for seam in range(floor(min(u,v))+1,ceil(max(u,v))):
            t=(seam-u)/(v-u)
            if .001<length*t and .001<length*(1-t):cuts.add(t)
    return [point(a[0]+dx*t,a[1]+dz*t) for t in sorted(cuts)]

def node_rings(areas):
    # A terrace end, a stair recess and the next terrace may meet the same
    # straight board edge. Everyone must use the same breakpoints on that edge.
    ring_sets=[]
    for height,poly in areas:
        rings=[[point(*p) for p in list(r.coords)[:-1]] for r in [poly.exterior,*poly.interiors]]
        ring_sets.append((height,rings))
    vertices={p for _,rings in ring_sets for r in rings for p in r}
    joins=defaultdict(list);regions=[]
    for height,rings in ring_sets:
        loops=[]
        for ring in rings:
            loop=[]
            for a,b in edges(ring):
                dx,dz=b[0]-a[0],b[1]-a[1];length2=dx*dx+dz*dz
                def parameter(p):return ((p[0]-a[0])*dx+(p[1]-a[1])*dz)/length2
                interior=[p for p in vertices if 0<parameter(p)<1 and abs((p[0]-a[0])*dz-(p[1]-a[1])*dx)<1e-5]
                parts=[a,*sorted(interior,key=parameter),b]
                for p,q in zip(parts,parts[1:]):
                    if p==q:continue
                    key=tuple(sorted((p,q)))
                    joins[key].append((height,p,q))
                    loop.append(p)
            loops.append(loop)
        regions.append((height,loops))
    return regions,joins

def build_bank(name,areas,top,base,levels):
    regions,joins=node_rings(areas)
    samples={edge:segment_points(*edge) for edge in joins}
    def oriented_samples(a,b):
        points=samples[tuple(sorted((a,b)))]
        return points if a==points[0] else points[::-1]
    bank=Pair('granite-bank-'+name)
    height_nodes={base,*levels,0.0,5.2,10.4}
    for a,b in zip([base,*levels[:-1]],levels):
        if b-a>1:
            height_nodes.update((a+(b-a)/3,a+2*(b-a)/3))
    height_nodes=sorted(height_nodes)
    uvflat=[(0,0),(0,1),(1,1),(1,0)]
    for high,rings in regions:
        dense=[]
        for ring in rings:
            pts=[]
            for a,b in edges(ring):pts.extend(oriented_samples(a,b)[:-1])
            dense.append(pts)
        poly=Polygon(dense[0],dense[1:])
        for face in get_parts(constrained_delaunay_triangles(poly)):
            pts=list(face.exterior.coords)[:3]
            # A CCW polygon in x/z faces down in a Y-up world.
            a,b,c=pts
            if (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])<0:pts.reverse()
            bank.m.add([(x,base,z) for x,z in pts],[(.1,.1),(.1,.9),(.9,.9)])
            pts.reverse()
            top.m.add([(x,high,z) for x,z in pts],[(x/48+.5,z/48+.5) for x,z in pts])
    for key,owners in joins.items():
        assert 1<=len(owners)<=2,(key,owners)
        high,a,b=max(owners)
        low=min(owner[0] for owner in owners) if len(owners)==2 else base
        if low==high:continue
        dx,dz=b[0]-a[0],b[1]-a[1];length=hypot(dx,dz);nx,nz=dz/length,-dx/length
        path=oriented_samples(a,b)
        layers=[h for h in height_nodes if low-1e-6<=h<=high+1e-6]
        assert abs(layers[0]-low)<1e-6 and abs(layers[-1]-high)<1e-6
        exterior=all(abs(abs(p[0])-24)<1e-6 for p in (a,b)) and abs(dx)<1e-6 or all(abs(abs(p[1])-24)<1e-6 for p in (a,b)) and abs(dz)<1e-6
        def wall_point(p,y):
            # All adjoining faces meet on one straight line at a surveyed joint.
            # The rock relief is confined between those joints and terrace elevations.
            if p==a or p==b or y==base or y in levels:return (p[0],y,p[1])
            last=base;next_level=levels[0]
            for h in levels:
                next_level=h
                if h>=y:break
                last=h
            band=(y-last)/(next_level-last)
            end_weight=min(1.,hypot(p[0]-a[0],p[1]-a[1])/.95,hypot(p[0]-b[0],p[1]-b[1])/.95)
            relief=(.084+.028*sin(1.34*p[0]+.87*p[1])+.019*sin(.7*p[0]-1.48*p[1]))*sin(pi*band)*end_weight
            # Exterior walls stay within the 48-inch board.
            if exterior:relief=-relief
            return (p[0]+nx*relief,y,p[1]+nz*relief)
        for p,q in zip(path,path[1:]):
            tile=floor((texture_u(p)+texture_u(q))/2)
            up=np.clip(texture_u(p)-tile,0,1);uq=np.clip(texture_u(q)-tile,0,1)
            for y,yy in zip(layers,layers[1:]):
                row=floor((y+yy)/(2*5.2));v=np.clip(y/5.2-row,0,1);vv=np.clip(yy/5.2-row,0,1)
                # Consistent outward winding, including the inward-facing recess walls.
                corners=[wall_point(p,y),wall_point(p,yy),wall_point(q,yy),wall_point(q,y)]
                coords=[(up,v),(up,vv),(uq,vv),(uq,v)]
                bank.m.add([corners[0],corners[1],corners[2]],[coords[0],coords[1],coords[2]])
                bank.m.add([corners[0],corners[2],corners[3]],[coords[0],coords[2],coords[3]])
        bank.c.add([(a[0],low,a[1]),(a[0],high,a[1]),(b[0],high,b[1]),(b[0],low,b[1])],uvflat)
    return bank
