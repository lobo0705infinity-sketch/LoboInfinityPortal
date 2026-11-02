"""Audit exported visual/collision geometry in every building's entry aisle."""
from pathlib import Path
import json
import numpy as np
import trimesh
from shapely.geometry import MultiPoint, box

ROOT=Path(__file__).resolve().parents[1]
bag=json.loads((ROOT/'Map-Bags/Verdant-Exchange-Uplink-Center-R4.json').read_text())['ObjectStates'][0]
objects=bag['ContainedObjects']
specs=json.loads((ROOT/'Source/buildings.json').read_text())
cache={}
def triangles(url):
    name=url.rsplit('/',1)[-1]
    if name not in cache:
        mesh=trimesh.load(ROOT/'Assets'/name,force='mesh',process=False)
        mesh.vertices[:,0]*=-1
        cache[name]=mesh.vertices[mesh.faces]
    return cache[name]
def clip(poly,level,above):
    result=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        inside_a=a[1]>=level if above else a[1]<=level
        inside_b=b[1]>=level if above else b[1]<=level
        if inside_a:result.append(a)
        if inside_a!=inside_b:result.append(a+(b-a)*((level-a[1])/(b[1]-a[1])))
    return result
checked=[]
for spec in specs:
    root=next(o for o in objects if o['GUID']==spec['main'])
    beds=[o for o in objects if o['Nickname'].startswith(spec['name']+' | Planting bed')]
    for state in [root]+list(root['States'].values()):
        levels=1 if 'Ground floor exposed'in state['Nickname'] else spec['floors']
        for level in range(levels):
            y=3.25*level
            # Ground thresholds and the full entry route must be clear. Upper
            # floors have windows rather than external doors, so stop inside.
            inset=-.35 if level==0 else .30
            aisle=box(-.70,-spec['d']/2+inset,.70,spec['d']/2-inset)
            for o in [state]+beds:
                for field in ['MeshURL','ColliderURL']:
                    ts=triangles(o['CustomMesh'][field])
                    selected=ts[(ts[:,:,1].max(axis=1)>y+.20)&(ts[:,:,1].min(axis=1)<y+1.80)]
                    for tri in selected:
                        clipped=clip(clip(list(tri),y+.20,True),y+1.80,False)
                        if not clipped:continue
                        shape=MultiPoint([(p[0],p[2])for p in clipped]).convex_hull
                        assert not shape.intersects(aisle),(state['Nickname'],level,field,shape.bounds)
            checked.append({'building':spec['name'],'state':state['Nickname'].split(' | ')[-1],'floor':level+1,'clear_aisle_width_inches':1.40})

equipment=[o for o in objects if o['Nickname'].startswith(('Tanks cluster','Cooler cluster'))]
assert len(equipment)==10
for o in equipment:
    y=o['Transform']['posY']
    assert abs(y-.83)<1e-6
    assert y+.16<1.0 # Whole support plinth lies below the mat top.
    assert abs((y+.16)-1.0)<=.011 # Equipment bottoms stay seated in the mat.
report={'status':'passed','building_states':sum(1+len(o['States'])for o in objects if 'building'in o.get('Tags',[])),'floor_aisles_checked':len(checked),'visual_and_collision_geometry':True,'clear_aisle_width_inches':1.40,'25_mm_base_clearance':True,'sunken_equipment_plinths':len(equipment),'plinth_top_below_mat_inches':.01,'checks':checked,'live_TTS_tested':False}
(ROOT/'Source/doorway-scatter-validation.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items()if k!='checks'},indent=2))
