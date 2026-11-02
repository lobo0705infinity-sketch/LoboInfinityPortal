"""Regression checks for R3's visible roof gaps, height balance and objectives."""
from pathlib import Path
import json, math
import numpy as np
import trimesh
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

ROOT=Path(__file__).resolve().parents[1]
bag=json.loads((ROOT/'Map-Bags/Verdant-Exchange-Uplink-Center-R3.json').read_text())['ObjectStates'][0]
objects=bag['ContainedObjects']
def triangles(key):
    mesh=trimesh.load(ROOT/'Assets'/key,force='mesh',process=False)
    mesh.vertices[:,0]*=-1
    return mesh.vertices[mesh.faces[:,::-1]]
def coverage(ts,axes):
    polys=[Polygon(t[:,axes]) for t in ts]
    return unary_union([p for p in polys if p.area>1e-10])
roof_checks=[]
for key in ['seed-vault','specimen-archive']:
    profile=Polygon([(-2.75,3.23),(2.75,3.23)]+[(2.75-i*5.5/14,3.25+.9*math.sin(i*math.pi/14))for i in range(15)])
    for suffix in ['.obj','-collider.obj']:
        ts=triangles(key+'-roof'+suffix)
        roof=ts[np.min(ts[:,:,1],axis=1)>=3.2499]
        footprint=box(-2.75,-3,2.75,3)
        assert footprint.difference(coverage(roof,[0,2])).area<1e-5
        for end in [-3.1,-2.9,2.9,3.1]:
            caps=ts[np.all(np.isclose(ts[:,:,2],end,atol=1e-5),axis=1)]
            assert profile.difference(coverage(caps,[0,1])).area<1e-5,(key,suffix,end)
        roof_checks.append(key+'-roof'+suffix)
    interior=triangles(key+'-state-2.obj')
    upper=interior[np.min(interior[:,:,1],axis=1)>3.25]
    assert coverage(upper,[0,2]).intersection(box(-2.4,-2.7,2.4,2.7)).area<1e-5,key

buildings=json.loads((ROOT/'Source/buildings.json').read_text())
layout=json.loads((ROOT/'Source/layout.json').read_text())
tall=[b for b in buildings if b['floors']>1]
assert len(tall)==2
for b in tall:
    for item in [q for q in layout if q['label'].startswith(b['name']+' |')]:
        ts=triangles(item['mesh']+'.obj').reshape(-1,3)
        angle=math.radians(item['angle'])
        xs=ts[:,0]*math.cos(angle)+ts[:,2]*math.sin(angle)+item['x']
        assert xs.min()>-8 and xs.max()<8,(b['name'],xs.min(),xs.max())
for name in ['Botanical Genetics Laboratory','Research Administration']:
    assert next(b for b in buildings if b['name']==name)['floors']==1
    roof=next(q for q in layout if q['label']==name+' | Roof on')
    assert roof['bounds'][1][1]==4.25
ground=next(o for o in objects if 'ground'in o.get('Tags',[]))
cm=ground['CustomMesh'];assert cm['MaterialIndex']==3
assert all(v==0 for k,v in cm['CustomShader'].items() if k!='SpecularColor')
assert set(cm['CustomShader']['SpecularColor'].values())=={0}
assert all(o['CustomMesh']['MaterialIndex']==4 for o in objects if 'glass'in o.get('Tags',[]))
template=json.loads((ROOT/'Source/console-template.json').read_text())
consoles=[o for o in objects if o.get('CustomAssetbundle')]
assert len(consoles)==3
assert sorted((o['Transform']['posX'],o['Transform']['posZ'])for o in consoles)==[(0,-12),(0,0),(0,12)]
ids=[]
for console in consoles:
    assert console['CustomAssetbundle']==template['CustomAssetbundle']
    for axis in 'XYZ':assert console['Transform']['scale'+axis]==template['Transform']['scale'+axis]
    assert len(console['ChildObjects'])==1
    assert console['ChildObjects'][0]['CustomMesh']==template['ChildObjects'][0]['CustomMesh']
    ids.extend([console['GUID'],console['ChildObjects'][0]['GUID']])
assert len(ids)==len(set(ids))
report={'status':'passed','closed_barrel_roof_visual_and_collider_meshes':roof_checks,'roofless_states_open':True,'deployment_zone_labs_height_inches':4.25,'tall_buildings_wholly_in_midfield':len(tall),'mat_material':'Wood, zero specular settings','approved_console_bundles':len(consoles),'mission_positions_preserved':True,'live_TTS_tested':False}
(ROOT/'Source/roof-height-material-validation.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
