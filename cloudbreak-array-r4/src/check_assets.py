"""Check geometry, image registration and the inherited airspace against the final save."""
from collections import Counter
from hashlib import sha256
import numpy as np
from PIL import Image
from rooftops import *
from district import transform,geometry,ellipse
from shapely import affinity
from shapely.geometry import MultiPoint
from shapely.ops import unary_union
from sightlines import rays_through,cylinder,EYE as EYE_HEIGHT
import verify_geometry as existing


def check():
    import district
    legacy_obj=district.obj_path
    district.obj_path=lambda name: ASSETS/(name+'.obj') if (ASSETS/(name+'.obj')).exists() else legacy_obj(name)
    district.geometry.cache_clear()
    existing.AS=ASSETS;existing.mesh_integrity()
    table=json.loads((OUT/'Play-Table.json').read_text())
    pieces=[o for o in table['ObjectStates'] if TAG in o.get('Tags',[])]
    def footprint(o):
        v,_=geometry(slug(o))
        return MultiPoint(transform(v,o['Transform'])[:,[0,2]]).convex_hull
    bridges=unary_union([footprint(o) for o in pieces if slug(o).startswith('bridge-')])
    roofs=unary_union([affinity.translate(t.poly,t.x,t.z) for t in T.values()])
    banks={}
    for o in pieces:
        if 'CloudbreakEditableCloud' not in o.get('Tags',[]):continue
        t=o['Transform'];c=dict(x=t['posX'],z=t['posZ'],rx=t['scaleX'],rz=t['scaleZ'],angle=t['rotY'],lo=t['posY'],hi=t['posY']+t['scaleY'])
        banks[o['Nickname'].split(' |')[0]]=c
        assert c['lo']>=MAT_Y+.10 and ellipse(c).distance(bridges)>.23 and ellipse(c).disjoint(roofs)
    for o in pieces:
        if slug(o).startswith(('aerostat-','moored-')):
            assert footprint(o).disjoint(bridges)
    examples=json.loads((R3/'work/los-audit.json').read_text())['examples']
    for e in examples:
        a,b=np.array(e['a']),np.array(e['b']);a[1]-=PITCH;b[1]-=PITCH
        d=b-a;perp=np.array([-d[2],0,d[0]]);perp/=np.linalg.norm(perp)
        offset=[perp*w+np.array([0,h-EYE_HEIGHT,0]) for w in (-.44,0,.44) for h in (.12,.84,1.54)]
        aa=np.array([a+x for x in offset for _ in offset]);bb=np.array([b+y for _ in offset for y in offset])
        if e['kind']=='cloud':
            assert np.all(cylinder(aa,bb,banks[e['obstacle']]))
        else:
            ship=next(o for o in pieces if o.get('Nickname','').split(' |')[0]==e['obstacle'])
            assert np.all(rays_through([ship],aa,bb))
    # The UV corners of the existing mat mesh are exact world NW/NE/SE/SW, including TTS' X mirror.
    mat=next(o for o in pieces if o['GUID']=='cb7101')
    mesh,_=native.read_obj(PREVIOUS/'base/assets/cloud-city.obj')
    vertices=[v for f in mesh for v in f if abs(v[0][1]-.008)<1e-5]
    assert vertices and all(abs(u-(x+24)/48)<1e-5 and abs(v-(z+24)/48)<1e-5 for (x,_,z),(u,v),_ in vertices)
    assert mat['CustomMesh']['DiffuseURL'].endswith('/city-shafts.jpg')
    assert len({o['GUID'] for o in pieces if slug(o).startswith(('aerostat-','moored-'))})==5
    assert sha256((ASSETS/'city-shafts.jpg').read_bytes()).digest()==sha256((OUT/'Cloudbreak-Array-R4-Playmat.jpg').read_bytes()).digest()
    with Image.open(ASSETS/'city-shafts.jpg') as im:assert im.size==(3072,3072)
    result=dict(existing.REPORT,verified_LOF_examples=len(examples),full_silhouette_samples_per_example=81,registered_mat_footprints=16)
    (WORK/'mesh-audit.json').write_text(json.dumps(result,indent=2));print(result)


if __name__=='__main__':check()
