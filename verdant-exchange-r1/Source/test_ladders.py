"""Verify ladder orientation, real mounts, rung heights and S2 roof landings."""
from pathlib import Path
import json,math
import numpy as np
from scipy.spatial import ConvexHull
import trimesh
from shapely.geometry import Polygon,Point,MultiPoint
from shapely.ops import unary_union

ROOT=Path(__file__).resolve().parents[1]
layout=json.loads((ROOT/'Source/layout.json').read_text())
specs=json.loads((ROOT/'Source/buildings.json').read_text())
cache={}
def load(name):
    if name in cache:return cache[name]
    path=ROOT/'Assets'/name
    mesh=trimesh.load(path,force='mesh',process=False);mesh.vertices[:,0]*=-1
    triangles=mesh.vertices[mesh.faces]
    vertices=[];indices=[];groups=[]
    for line in path.read_text().splitlines():
        p=line.split()
        if not p:continue
        if p[0]=='v':vertices.append([-float(p[1]),float(p[2]),float(p[3])])
        elif p[0]=='o':
            if indices:groups.append(sorted(set(indices)))
            indices=[]
        elif p[0]=='f':indices.extend(int(x.split('/')[0])-1 for x in p[1:])
    if indices:groups.append(sorted(set(indices)))
    parts=[];v=np.array(vertices)
    if '-collider'in name:
        for g in groups:
            ps=v[g];parts.append((ps.min(axis=0),ps.max(axis=0),ConvexHull(ps).equations))
    cache[name]=(triangles,parts);return cache[name]
def contains(parts,p):
    p=np.array(p)
    return any(np.all(p>=lo-1e-5)and np.all(p<=hi+1e-5)and np.all(eq[:,:3]@p+eq[:,3]<1e-5)for lo,hi,eq in parts)
def clip(poly,y,above):
    out=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        ia=a[1]>=y if above else a[1]<=y;ib=b[1]>=y if above else b[1]<=y
        if ia:out.append(a)
        if ia!=ib:out.append(a+(b-a)*((y-a[1])/(b[1]-a[1])))
    return out
checks=[];mounts=0;landings=0
for item in [q for q in layout if q['kind']in ['building','building-state']]:
    spec=next(s for s in specs if item['label'].startswith(s['name']+' |'))
    assert len(item['ladders'])==(2 if spec['floors']==2 else 1),item['label']
    visual,_=load(item['mesh']+'.obj');collider,parts=load(item['mesh']+'-collider.obj')
    for ladder in item['ladders']:
        angle=math.radians(ladder['angle']);normal=np.array([math.sin(angle),0,math.cos(angle)])
        across=np.array([math.cos(angle),0,-math.sin(angle)])
        origin=np.array([ladder['x'],0,ladder['z']])
        def local(dx,y,dz):return origin+across*dx+np.array([0,y,0])+normal*dz
        assert ladder['clear_width']>25/25.4
        assert max(ladder['rungs'])+.035<ladder['landing_y']-.12
        for dx in [-.55,.55]:
            for y in ladder['anchors']:
                assert contains(parts,local(dx,y,ladder['stand_off']+.07)),('unattached bracket',item['label'],ladder['kind'],dx,y)
                mounts+=1
            for y in np.arange(ladder['base_y']+.10,ladder['landing_y']+.51,.20):
                assert contains(parts,local(dx,y,0)),('broken rail',item['label'],y)
        # Probe the mounting pier/post at every rung. No window or door may
        # sit behind the climbing run; archive rails extend above the eaves.
        for y in ladder['rungs']:
            visible_wall_height=3.25*(1 if 'Ground floor exposed'in item['label']else spec['floors'])
            if ladder['kind']!='greenhouse'and y>visible_wall_height:continue
            for dx in [-.55,.55]:
                depth=.07 if ladder['kind']=='greenhouse'else .15
                assert contains(parts,local(dx,y,ladder['stand_off']+depth)),('opening behind ladder',item['label'],y)
            assert contains(parts,local(0,y,0)),('missing rung',item['label'],y)
        kind=ladder['kind'];roofed='Roof on'in item['label']
        present=(kind=='greenhouse'or(kind=='exterior'and roofed)or(kind=='interior'and'Ground floor exposed'not in item['label']))
        if present:
            if kind=='greenhouse':centre=(ladder['x'],ladder['z']+.65)
            elif kind=='interior':centre=(spec['w']/2-.85-.66-.52,-spec['d']/2+.85)
            else:centre=(-spec['w']/2+.35,ladder['z'])
            foot=Point(*centre).buffer(25/25.4/2,resolution=32)
            y=ladder['landing_y']
            for ts,kind2 in [(visual,'visual'),(collider,'collider')]:
                horizontal=ts[np.all(np.isclose(ts[:,:,1],y,atol=1e-5),axis=1)]
                floor=unary_union([Polygon(t[:,[0,2]])for t in horizontal])
                assert foot.difference(floor).area<1e-5,('unsupported landing',item['label'],kind,kind2)
                paths=[(foot,y+.05,y+1.65,'landing')]
                if kind=='interior':
                    hatch=Point(ladder['x'],-spec['d']/2+.75).buffer(25/25.4/2,resolution=32)
                    assert hatch.intersection(floor).area<1e-5,('hatch bridged by floor',item['label'],kind2)
                    paths.append((hatch,y+.05,y+1.65,'hatch'))
                    approach=Point(ladder['x'],-spec['d']/2+1.0).buffer(25/25.4/2,resolution=32)
                    paths.append((approach,ladder['base_y']+.05,ladder['base_y']+1.65,'lower approach'))
                for area,low,high,label in paths:
                    body=ts[(ts[:,:,1].max(axis=1)>low)&(ts[:,:,1].min(axis=1)<high)]
                    for tri in body:
                        ps=clip(clip(list(tri),low,True),high,False)
                        if ps:
                            shape=MultiPoint([(v[0],v[2])for v in ps]).convex_hull
                            assert not shape.intersects(area),('blocked '+label,item['label'],kind,kind2,shape.bounds)
            landings+=1
        checks.append({'building':item['label'],'kind':kind,'mounted':True,'landing_visible':present})
assert len(checks)==36,len(checks)
report={'status':'passed','physical_ladders':16,'ladder_instances_across_30_building_states':len(checks),'actual_mount_points_checked':mounts,'supported_clear_25_mm_landings':landings,'rungs_end_below_destination':True,'wall_window_and_door_conflicts':0,'visual_and_collision_geometry_checked':True,'live_TTS_tested':False,'checks':checks}
(ROOT/'Source/ladder-validation.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items()if k!='checks'},indent=2))
