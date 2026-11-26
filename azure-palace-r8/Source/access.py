"""Sweep base disks from both deployment zones to 32 points of contact on each objective, with the new props loaded."""
import json,math
from scipy.spatial import cKDTree
from shapely import contains_xy
from layout import *
specs=json.loads((ROOT/'Source/scatter.json').read_text())
shapes={q['slug']:pose(outline(q['slug']),*q['pose']) for q in specs}
for name,geo in shapes.items():
    assert plan.field.covers(geo) and geo.distance(plan.field.boundary)>.6
    assert geo.distance(baseline)>.2 and geo.distance(protected)>.16,(name,geo.distance(baseline))
    assert all(other==name or geo.distance(v)>1.6 for other,v in shapes.items())
new=union_all([baseline,*shapes.values()])
spacing=.148
v=np.arange(-24,24.0001,spacing);X,Z=np.meshgrid(v,v)
metrics={}
def test(mm):
    radius=mm/25.4/2;nominal=.5*40/25.4
    body=new.buffer(radius+.035);other=union_all([body,*[o.buffer(nominal+radius)for o in plan.objectives]])
    floor=plan.field.buffer(-radius-.01).difference(other).buffer(-spacing*.71-.001)
    grid,_=label(contains_xy(floor,X,Z),[[0,1,0],[1,1,1],[0,1,0]])
    positive=set(grid[X>=12+radius].ravel())-{0}
    negative=set(grid[X<=-12-radius].ravel())-{0}
    shared=positive&negative
    assert shared
    viable=np.isin(grid,list(shared));i,j=np.where(viable);cells=np.c_[X[i,j],Z[i,j]];tree=cKDTree(cells)
    def contact(p,objective=None):
        for k in tree.query_ball_point(p,.85):
            line=LineString([cells[k],p])
            if not body.disjoint(line):continue
            if objective is not None and line.distance(objective)<nominal+radius-1e-5:continue
            return True
        return False
    rings=[]
    for o in plan.objectives:
        count=0
        for a in np.linspace(0,2*np.pi,32,endpoint=False):
            count+=contact((o.x+(nominal+radius)*np.cos(a),o.y+(nominal+radius)*np.sin(a)),o)
        assert count==32,(mm,o,count)
        rings.append(count)
    stair_points=[(0,-6.34-radius),(0,4.34+radius),(3.34+radius,-1),(-3.34-radius,-1)]
    assert all(contact(q) for q in stair_points)
    return dict(console_contact_angles=rings,pool_stairs=4,deployment_sides=2)
for mm in (25,40):metrics[str(mm)]=test(mm)
metrics['clearances_inches']={k:{'nearest_existing_solid':round(g.distance(baseline),3),'nearest_pool_stair':round(min(g.distance(s)for s in plan.steps),3),'nearest_console_center':round(min(g.distance(o)for o in plan.objectives),3)}for k,g in shapes.items()}
print(json.dumps(metrics,indent=2),flush=True);(ROOT/'Review/access.json').write_text(json.dumps(metrics,indent=2))
