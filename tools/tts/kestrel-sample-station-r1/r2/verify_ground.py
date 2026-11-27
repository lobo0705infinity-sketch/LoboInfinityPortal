from common import *
from assemble_r2 import build
from shapely.ops import unary_union
from shapely.geometry import Point,LineString
import numpy as np
import check_geometry as qa,survey
GRADE=6.25
resolution=10
axis=np.arange(481)/resolution-24
def tops(path):
    v,f=mesh(path);t=v[f]
    up=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0])[:,1]>1e-7
    faces=t[up].copy();faces[:,:,0]*=-1;faces[:,:,1]+=3
    area=np.cross(faces[:,1]-faces[:,0],faces[:,2]-faces[:,0])[:,1].sum()/-2
    return faces,area
def raster(paths,shift=(0.,0.)):
    xs=axis+shift[0];zs=axis+shift[1]
    low=np.full((481,481),np.inf);high=np.full_like(low,-np.inf);hits=np.zeros(low.shape,dtype=np.uint8);total=0
    for path in paths:
        faces,area=tops(path);assert abs(area-24*24)<1e-4,(path,area)
        for a,b,c in faces:
            p=np.array([a,b,c]);lo=p.min(0);hi=p.max(0)
            x0=xs.searchsorted(lo[0]-1e-7);x1=xs.searchsorted(hi[0]+1e-7,side='right')
            z0=zs.searchsorted(lo[2]-1e-7);z1=zs.searchsorted(hi[2]+1e-7,side='right')
            if x0==x1 or z0==z1:continue
            x=xs[None,x0:x1];z=zs[z0:z1,None]
            den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2])
            u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den
            v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den
            use=(u>=-1e-7)&(v>=-1e-7)&(u+v<=1.0000001);h=u*a[1]+v*b[1]+(1-u-v)*c[1]
            sm=np.s_[z0:z1,x0:x1];np.maximum(high[sm],np.where(use,h,-np.inf),out=high[sm])
            np.minimum(low[sm],np.where(use,h,np.inf),out=low[sm]);hits[sm]+=use
        total+=area
    valid=hits>0
    if shift==(0.,0.):assert valid.all()
    else:assert np.all(hits[:-1,:-1]==1),(hits[:-1,:-1].min(),hits[:-1,:-1].max())
    assert np.max(np.abs(high[valid]-low[valid]))<1e-5
    return high,total
visual=sorted(p for p in OUT.glob('highlands-*.obj') if 'collider' not in p.name);physics=sorted(OUT.glob('highlands-*-collider.obj'))
vis,area=raster(visual);phy,_=raster(physics)
assert np.max(abs(vis-phy))<1e-6
raster(visual,(.02731,.04137))
np.save(W/'relief.npy',phy)
terrain=read(DATA/'layout.json')['landforms'];x,z=np.meshgrid(axis,axis)
craters={}
for c in terrain:
    if c['kind']=='crater':
        cx,cz=c['center'];zone=np.hypot(x-cx,z-cz)<=c['radius']*1.31
        low,hi=phy[zone].min(),phy[zone].max()
        assert abs(low-GRADE)<1e-6 and hi-GRADE<.025,(c['name'],low,hi)
        craters[c['name']]=[round(low,4),round(hi,4)]
assert abs(phy[np.argmin(abs(axis-17)),np.argmin(abs(axis-22.3))]-(GRADE-.14))<.005
report={'surfaceArea':area,'groundGridSamples':phy.size,'coverageChecks':480**2,'maxColliderDifference':float(np.max(abs(vis-phy))),'formerSites':craters}
b=build();qa.WORK=W;qa.build_bag=build;qa.local=resource;survey.local=resource
sections=qa.scene_sections(b,1.5)
routes=qa.targets(b,sections);edges=qa.edge_runs(sections,1.5);doors=qa.clearance_to_walls()
assert max(edges.values())<32,edges
assert all(min(v)>25/25.4 for v in doors.values())
reg=survey.footprints(b)
bay=reg['e52010']
near={g:round(bay.distance(p),3) for g,p in reg.items() if g!='e52010' and p.distance(bay)<2}
assert all(v>.02 for v in near.values()),near
# A full infantry base can enter the recessed apron from its open end.
bay_walls=unary_union(qa.component_sections(next(o for o in b['ContainedObjects'] if o['GUID']=='e52010'),GRADE+.48))
bay_entry=LineString([(22.0,14.40),(22.0,15.35),(21.91,15.46)])
assert bay_walls.distance(bay_entry)>.492
screen=sections['e52010'];assert screen.intersection(LineString([(23.70,14.0),(23.70,19.7)])).length>3.
furnish={g:round(p.distance(LineString(read(W/'cartway.json')[0])),3) for g,p in reg.items() if g=='c70040'}
assert furnish['c70040']>.82,furnish
report.update(edgeRuns=edges,objectiveContact=routes,walkThroughDoors=doors,roverBayNeighbours=near,roverBayEntryDiameter=round(bay_walls.distance(bay_entry)*2,3))
write(W/'geometry-qa.json',report);print(json.dumps(report,indent=2),flush=True)
