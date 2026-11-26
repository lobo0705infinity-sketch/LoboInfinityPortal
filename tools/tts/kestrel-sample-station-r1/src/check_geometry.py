from survey import *
from assemble import build_bag, room, FILETAG
from station import SITES
from scipy.spatial import ConvexHull
from shapely.ops import unary_union
from shapely.geometry import LineString,box
from PIL import ImageDraw,Image
import math,re,sys
def component_sections(o,height):
    cm=o.get('CustomMesh',{});u=cm.get('ColliderURL') or cm.get('MeshURL')
    if not u:return []
    if '/'+PREFIX+'/' in u:path=ASSETS/u.rsplit('/',1)[-1]
    else:path=local(u)
    if not path.is_file():return []
    vertices=[];groups={};current=0
    for l in path.read_text(errors='replace').splitlines():
        t=l.split()
        if not t:continue
        if t[0]=='v':vertices.append(list(map(float,t[1:4])))
        elif t[0] in ('o','g'):current+=1
        elif t[0]=='f':
            ix=[int(s.split('/')[0])for s in t[1:]];ix=[i-1 if i>0 else len(vertices)+i for i in ix]
            e=groups.setdefault(current,set());e.update(tuple(sorted((a,b)))for a,b in zip(ix,ix[1:]+ix[:1]))
    w=world(vertices,o['Transform']);out=[]
    for edges in groups.values():
        v=w[np.array(list(edges))];aa=v[:,0];bb=v[:,1];h=height-aa[:,1];dh=bb[:,1]-aa[:,1];good=np.abs(dh)>1e-8
        if not np.any(good):continue
        t=h[good]/dh[good];sel=(t>=-1e-7)&(t<=1.0000001)
        pts=aa[good][sel]+(bb-aa)[good][sel]*t[sel,None]
        if len(pts)<3:continue
        region=MultiPoint(pts[:,[0,2]]).convex_hull
        if region.area>1e-9:out.append(region)
    return out
def static(o):
    return o['GUID']!='c70000' and not o['GUID'].startswith('c7b') and 'platform' not in o['Nickname'].lower()
def scene_sections(bag,high):
    return {o['GUID']:unary_union(component_sections(o,GRADE+high))for o in bag['ContainedObjects'] if static(o)}
def edge_runs(reg,height):
    h=np.load(WORK/'relief.npy');out={}
    solids=unary_union(list(reg.values()))
    for name in ['west','east','south','north']:
        for offset in [.02,.10,.49,.79]:
            edge=24-offset
            pt=lambda t: {'west':(-edge,t),'east':(edge,t),'south':(t,-edge),'north':(t,edge)}[name]
            line=LineString([pt(-24),pt(24)])
            remaining=line.difference(solids);segs=[]
            for ln in (remaining.geoms if hasattr(remaining,'geoms') else [remaining]):
                if ln.geom_type!='LineString' or ln.is_empty:continue
                a,b=ln.coords[0],ln.coords[-1];span=ln.length
                if span<.001:continue
                # Sample the actual lunar surface too. Narrow metal blockers use exact polygon intersections.
                count=max(1,int(np.ceil(span/.05)));u=np.linspace(0,1,count+1);pos=np.array(a)+(np.array(b)-a)*u[:,None];ix=np.clip(np.rint((pos+24)*RES).astype(int),0,SIDE-1);open_=h[ix[:,1],ix[:,0]]<GRADE+height
                labs,num=ndimage.label(open_)
                for j in range(1,num+1):
                    inds=np.flatnonzero(labs==j)
                    if len(inds):segs.append(span*(inds[-1]-inds[0])/count)
            out[name+str(offset)]=round(max(segs,default=0),2)
    return out
def targets(b,reg):
    # A miniature's base must have a collision-free path from BOTH 12-inch deployment zones.
    # First clear floor footprints conservatively, then test centres on the 40 mm objective's contact ring.
    n=961;factor=20;mask=Image.new('1',(n,n));d=ImageDraw.Draw(mask)
    raw=footprints(b)
    for g,poly in raw.items():
        if g.startswith('c7f'):continue
        if g in ('e51009','e5100a','e51001','c7002b','c70030','c70012','c7c100'):poly=reg[g]
        items=poly.geoms if hasattr(poly,'geoms') else [poly]
        for geo in items:
            if geo.geom_type!='Polygon':continue
            d.polygon([((x+24)*factor,(z+24)*factor)for x,z in geo.exterior.coords],fill=1)
            for hole in geo.interiors:d.polygon([((x+24)*factor,(z+24)*factor)for x,z in hole.coords],fill=0)
    occupied=np.array(mask);rel=ndimage.zoom(np.load(WORK/'relief.npy'),(n/SIDE,n/SIDE),order=1)
    gz,gx=np.gradient(rel,1/factor);occupied|=np.hypot(gx,gz)>1.22;occupied[[0,-1],:]=True;occupied[:,[0,-1]]=True
    # Real objective bodies keep the base centre out of their own footprint.
    grid_z,grid_x=np.ogrid[:n,:n];xd=grid_x/factor-24;zd=grid_z/factor-24
    obj_radius=20/25.4
    for z in (-20,0,20):
        occupied|=np.hypot(xd,zd-z)<obj_radius
    ds=ndimage.distance_transform_edt(~occupied)/factor;report={}
    for mm in (25,40):
        radius=mm/50.8;legal=ds>=radius;lab,num=ndimage.label(legal,np.ones((3,3)))
        from_w=set(np.unique(lab[:,1:12*factor]));from_e=set(np.unique(lab[:,-12*factor:-1]));common=(from_w&from_e)-{0}
        for z in [-20,0,20]:
            ring=np.abs(np.hypot(xd,zd-z)-(radius+obj_radius))<.042
            usable=ring & np.isin(lab,list(common));zz,xx=np.nonzero(usable)
            sectors=set((int((math.atan2(iz/factor-24-z,ix/factor-24)+math.tau+.0001)/(math.pi/4))%8)for iz,ix in zip(zz,xx))
            assert len(sectors)>=2,(mm,z,sectors)
            report[f'{mm}mm at (0,{z})']=len(sectors)
    return report
def clearance_to_walls():
    b=build_bag();lookup={o['GUID']:o for o in b['ContainedObjects']}
    rows={}
    for ht in [.22,.75,1.25,1.55]:
        for desc,ids,ends in [
          ('crew link',['c70030','e51009','c70012'],[(19,11.4),(19,15.05)]),
          ('expedition link',['c7002b','e5100a','c7c100'],[(1.56,8.18),(7.60,8.18)]),
          ('dust lock',['e51001'],[(10.2,-13.36),(10.2,-10.08)])]:
            bodies=[]
            for g in ids:
                root=lookup[g];bodies.append(root)
                for ch in root.get('ChildObjects',[]):
                    if all(abs(ch['Transform'][k])<.0001 for k in ('posX','posY','posZ','rotX','rotY','rotZ')):
                        bodies.append(dict(ch,Transform=root['Transform']))
            wall=unary_union([p for body in bodies for p in component_sections(body,GRADE+ht)])
            path=LineString(ends);w=path.distance(wall)*2;rows.setdefault(desc,[]).append(round(w,3) if np.isfinite(w) else None)
    return rows
if __name__=='__main__':
    b=build_bag();a=scene_sections(ORIGINAL,1.5);ra=edge_runs(a,1.5);c=scene_sections(b,1.5);rc=edge_runs(c,1.5)
    q={'edgeBefore':ra,'edgeAfter':rc,'routesToObjectives':targets(b,c),'facilityThroatInches':clearance_to_walls()}
    print(json.dumps(q,indent=1),flush=True);dump(WORK/'geometry-qa.json',q)
    assert all(v<33 for v in rc.values()),rc
    for rows in q['facilityThroatInches'].values():assert all(v and v>=25/25.4 for v in rows),rows
