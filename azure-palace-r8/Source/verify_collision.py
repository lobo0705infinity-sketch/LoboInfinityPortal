"""Verify the true model bounds, grounded tyres and cabinet feet, and sight through the buggy cab."""
from layout import *
import trimesh
from shapely.geometry import MultiLineString
from scipy.spatial import ConvexHull
spec=json.loads((ROOT/'Source/scatter.json').read_bytes())
rows={}
for item in spec:
    name=item['slug'];path=ROOT/'Assets'/(name+'-col.obj')
    hulls=plan.chunks(path);cloud=np.concatenate(hulls)
    for h in hulls:assert ConvexHull(h).volume>1.e-8
    visual=trimesh.load(ROOT/'Assets'/(name+'.obj'),force='mesh',process=False)
    lo=visual.bounds[0][1];floor=cloud[:,1].min()
    assert abs(lo)<.012 and abs(floor)<.012,(name,lo,floor)
    solid=trimesh.load(path,force='mesh',process=False)
    def lineclear(mesh,y,z):
        cross=trimesh.intersections.mesh_plane(mesh,plane_normal=(0,1,0),plane_origin=(0,y,0))
        seg=MultiLineString(np.stack((-cross[:,:,0],cross[:,:,2]),axis=2).tolist())
        return seg.disjoint(LineString([(-1.4,z),(1.4,z)]))
    if name=='porter-buggy':
        assert all(lineclear(m,1.40,.34)for m in (solid,visual)), 'cab must remain open'
        assert all(not lineclear(m,1.20,-1.20)for m in (solid,visual)), 'bags must interrupt sight'
    if name=='banquet-dolly':
        # Ray perpendicular to the circular stored tabletops, at an S2 figure's head height.
        for m in (solid,visual):
            cuts=trimesh.intersections.mesh_plane(m,plane_normal=(0,1,0),plane_origin=(0,1.57,0))
            edges=MultiLineString(np.stack((-cuts[:,:,0],cuts[:,:,2]),axis=2).tolist())
            assert edges.intersects(LineString([(0,-1.2),(0,1.2)]))
    rows[name]=dict(height_inches=round(float(visual.bounds[1,1]-lo),3),convex_parts=len(hulls))
(ROOT/'Review/physical-props.json').write_text(json.dumps(rows,indent=2));print(rows,flush=True)
