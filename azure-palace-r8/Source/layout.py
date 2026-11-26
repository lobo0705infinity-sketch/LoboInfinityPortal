"""Test the real scatter collision footprints against Azure Palace, including doors, ladders and pool approaches."""
import json,math,sys
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parents[1]
def rev(n):
    return next(p for p in (ROOT.parent/f'azure{n}',ROOT.parent/f'azure-palace-r{n}') if p.is_dir())
sys.path.insert(0,str(rev(7)/'Source'))
import site_check as plan
from architecture import dims,FRONT,BACK,DECK_REACH,ladder_centres
from shapely import affinity,union_all
from shapely.geometry import Point,box,LineString,MultiPoint
from scipy.ndimage import label

def pose(shape,x,z,angle):
    return affinity.translate(affinity.rotate(shape,-angle,origin=(0,0)),x,z)
def outline(slug):
    return union_all([MultiPoint(v[:,[0,2]]).convex_hull for v in plan.chunks(ROOT/'Assets'/(slug+'-col.obj'))])
buildings=plan.envelopes();courts=plan.court_hulls();baseline=union_all([*buildings.values(),*courts.values(),plan.pool])
# Include projecting steps, balustrades and the traversable space at their foot.
doors=[];ladder=[]
for slug,(w,d,*_) in dims.items():
    for s,u in [(1,BACK),(-1,FRONT)]:
        local_rect=box(u-.58,min(s*(d/2+.08),s*(d/2+1.55)),u+.58,max(s*(d/2+.08),s*(d/2+1.55)))
        doors.append(plan.move(local_rect,slug))
    if slug in ladder_centres:
        depth=-d/2-DECK_REACH-.16
        x=ladder_centres[slug]
        ladder.append(plan.move(box(x-.74,depth-1.40,x+.74,depth+.10),slug))
        # Roofed landings are kept free along the whole ladder face.
        ladder.append(plan.move(box(-1.5,depth,.15+x, -d/2+.05),slug))
protected=union_all(doors+ladder+plan.steps+[o.buffer(2.40)for o in plan.objectives])
def pt(slug,u,v):
    x,z=plan.world(slug,u,v);return (round(x,4),round(z,4))
def candidates():
    choices={
        'porter-buggy':('reception',[(3.86,6.52),(4.12,6.00),(3.93,5.66),(4.67,5.75),(3.77,7.0),(.25,8.70),(-4.21,4.70),(-3.89,5.75)], [0,180,90,270]),
        'banquet-dolly':('terrace-restaurant',[(2.71,4.56),(2.65,4.31),(2.73,4.82),(-2.62,4.50),(4.93,.87),(4.97,1.86),(3.20,4.45)],[0,90,180]),
        'housekeeping-cart':('north-villa',[(1.59,-4.43),(2.07,-4.34),(1.44,-4.3),(1.90,-4.70),(-2.60,-4.37),(-2.06,4.26),(1.95,-4.48)],[0,180]),
        'pool-loungers':('pool',[(-4.66,2.73),(-4.91,2.57),(-5.16,3.05),(-4.68,-4.39),(-4.94,-4.48),(-4.89,-4.74),(4.83,-4.42),(4.8,-4.57),(4.62,-4.18),(4.69,-3.96)], [265,275,282,258,87,97])}
    for slug,(loc,points,angles) in choices.items():
        shape=outline(slug);options=[]
        for j,(u,v) in enumerate(points):
            x,z=pt(loc,u,v) if loc!='pool' else (u,v)
            for k,a in enumerate(angles):
                yaw=((plan.poses[loc]['rot'] if loc!='pool' else 0)+a)%360;h=pose(shape,x,z,yaw)
                clear=h.distance(baseline);edge=h.distance(plan.field.boundary);safe=h.distance(protected)
                if clear>.20 and safe>.16 and plan.field.covers(h) and edge>.55:
                    options.append((j,k,(x,z,round(yaw,2)),round(clear,2),round(edge,2),round(safe,2)))
        print(slug,options[:13])
if __name__=='__main__':candidates()
