"""Project the actual compound colliders at model height and draw a planning proof."""
from functools import lru_cache
import math
import numpy as np,trimesh,shapely
from shapely.geometry import Polygon,Point,box,LineString,MultiLineString
from shapely import affinity,union_all
from common import *
from courts import sites,from_site,site_polygon
@lru_cache(None)
def chunks(file):
    cells=[];current=[]
    for line in Path(file).read_text().splitlines():
        if line.startswith('o ') and current:cells.append(np.asarray(current));current=[]
        elif line.startswith('v '):
            x,y,z=map(float,line.split()[1:]);current.append((-x,y,z))
    if current:cells.append(np.asarray(current))
    return cells
def move(shape,k):
    if k=='pool':return shape
    p=poses[k];return affinity.translate(affinity.rotate(shape,-p['rot'],origin=(0,0)),p['x'],p['z'])
def footprint(file,k,lo=.15,hi=1.60):
    pp=[]
    for v in chunks(file):
        if v[:,1].max()<lo or v[:,1].min()>hi:continue
        poly=shapely.MultiPoint(v[:,[0,2]]).convex_hull
        if not poly.is_empty and poly.area>1e-6:pp.append(poly)
    return move(union_all(pp),k)
field=box(-24,-24,24,24);pool=box(-3.18,-6.18,3.18,4.18)
objectives=[Point(0,-12),Point(0,12)]
steps=[box(-4.65,-2.35,-3,.35),box(3,-2.35,4.65,.35),box(-1.35,-7.65,1.35,-6),box(-1.35,4,1.35,5.65)]
def envelopes():
    return {k:move(box(-A.dims[k][0]/2-.13,-A.dims[k][1]/2-.13,A.dims[k][0]/2+.13,A.dims[k][1]/2+.13),k) for k in poses}
def court_hulls():
    hulls={k:footprint(OUT/(k+'-court-col.obj'),k) for k in sites}
    hulls['reception']=hulls['reception'].union(footprint(OUT/'reception-porter-lodge-col.obj','reception'))
    return hulls
@lru_cache(None)
def section(file,y):
    m=trimesh.load(file,force='mesh',process=False);s=trimesh.intersections.mesh_plane(m,plane_normal=(0,1,0),plane_origin=(0,y,0))
    return np.stack([-s[:,:,0],s[:,:,2]],axis=2) if len(s) else np.zeros((0,2,2))
def segments(file,k,y):
    s=section(file,y)
    if k!='pool':
        t=poses[k];a=math.radians(t['rot']);s=s@np.array([[math.cos(a),-math.sin(a)],[math.sin(a),math.cos(a)]])+[t['x'],t['z']]
    return s
def sight_data():
    segs=[segments(OUT/(k+'-1-col.obj'),k,1.57)for k in poses]+[segments(OUT/(k+'-court-col.obj'),k,1.57)for k in sites]
    ss=section(R2/'Assets/basin-court-collision.obj',1.57); segs.append(ss)
    whole=MultiLineString(np.vstack(segs).tolist());shapely.prepare(whole)
    z=np.linspace(-23.45,23.45,74);scores=[]
    for span in [12,17.5,23.35]:
        rays=shapely.linestrings([[(-span,float(x)),(span,float(j))]for x in z for j in z]);scores.append(int((~shapely.intersects(whole,rays)).sum()))
    return scores
def inspect():
    b=envelopes();c=court_hulls()
    from PIL import Image,ImageDraw,ImageFont
    n=1000;im=Image.new('RGB',(n+1,n+1),'#86aaa9');d=ImageDraw.Draw(im)
    def xy(x,z):return ((x+24)*n/48,(24-z)*n/48)
    def draw(p,color):
        if p.geom_type=='Polygon':
            d.polygon([xy(x,y)for x,y in p.exterior.coords],fill=color)
            for h in p.interiors:d.polygon([xy(x,y)for x,y in h.coords],fill='#86aaa9')
        elif hasattr(p,'geoms'):
            for o in p.geoms:draw(o,color)
    for kk in sites:draw(site_polygon(kk),'#a4b5a4')
    for kk in b:draw(b[kk],'#e5d6aa')
    for kk in c:draw(c[kk],'#2a584a')
    draw(pool,'#1dc8ce')
    for obj in objectives:draw(obj.buffer(.7874),'#cc4714')
    for k,prop in c.items():
        if not field.buffer(.001).covers(prop):print('outside',k,prop.bounds,flush=True)
        for j,building in b.items():
            if k!=j and prop.intersection(building).area>.001:print('BUILD CLASH',k,j,prop.intersection(building).area,flush=True)
        for j,q in c.items():
            if k<j and prop.intersection(q).area>.006:print('COURT CLASH',k,j,prop.intersection(q).area,flush=True)
        for j,obj in enumerate(objectives):
            if prop.distance(obj)<2.42:print('antenna',k,j,prop.distance(obj),flush=True)
        for i,s in enumerate(steps):
            if prop.distance(s)<.33:print('steps',k,i,prop.distance(s),flush=True)
        if prop.intersects(box(-3,-6,3,4)):print('pool water clash',k,flush=True)
    for k,p in poses.items():d.text(xy(p['x']-2,p['z']),k,fill='black')
    im.save(ROOT/'Review/plan.png')
    print('clear lanes',sight_data(),flush=True)
if __name__=='__main__':inspect()
