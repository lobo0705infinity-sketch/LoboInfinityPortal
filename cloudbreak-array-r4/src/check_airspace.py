"""Ray-test the exported visual and collision meshes at each exterior corner and both original high-cloud lanes."""
from collections import Counter
import json, math
from pathlib import Path
import numpy as np
import trimesh
from trimesh.ray.ray_pyembree import RayMeshIntersector
from shapely.geometry import MultiPoint
from shapely.ops import unary_union
from shapely import affinity
from rooftops import *
from corners import bands,returns
from fleet import FLEET
import district
from district import ellipse,geometry,transform
from sightlines import rays_through,EYE
from build_save import MAP_RULES,HARMONY_RULES,CONFIG

def probe(key,level):
    code=tower_name(key,level)
    outline=T[key].poly;starts=[];ends=[]
    def across(path,heights):
        for a,b in zip(path,path[1:]):
            edge=b-a;edge/=np.linalg.norm(edge);n=np.array([-edge[1],edge[0]])
            for fraction in (.045,.22,.50,.78,.955):
                xy=a+(b-a)*fraction
                for y in heights:
                    x,z=xy-n*.27;starts.append([x,y,z])
                    x,z=xy+n*.275;ends.append([x,y,z])
    for path in returns(outline):across(path,[-2.6,-1.45,-.41])
    sections=list(bands(key,level))
    for h,height,path,finish in sections:across(path,[h+q*height for q in (.08,.37,.69,.93)])
    A=np.array(starts);B=np.array(ends);ray=B-A;length=np.linalg.norm(ray,axis=1);direction=ray/length[:,None]
    for obj in [code,code+'-col']:
        pts,fs=geometry(obj);target=RayMeshIntersector(trimesh.Trimesh(pts,fs,process=False))
        hit=np.zeros(len(A),bool);xyz,idx,_=target.intersects_location(A,direction,multiple_hits=False)
        hit[idx]=np.linalg.norm(xyz-A[idx],axis=1)<length[idx]
        assert np.all(hit),(obj,int((~hit).sum()),A[~hit][:5])
    return len(A),len(sections)

def main():
    old=district.obj_path;district.obj_path=lambda name: ASSETS/(name+'.obj') if (ASSETS/(name+'.obj')).is_file() else old(name)
    data=json.loads((OUT/'Play-Table.json').read_text())
    objs=[o for o in data['ObjectStates'] if TAG in o.get('Tags',[])]
    tests=[probe(k,l) for k,t in T.items() for l in range(1,t.n+1)]
    current={o['Nickname'].split(' |')[0]:o for o in objs}
    banks=[o for o in objs if 'CloudbreakEditableCloud' in o.get('Tags',[])]
    def hull(o):return MultiPoint(transform(geometry(slug(o))[0],o['Transform'])[:,[0,2]]).convex_hull
    bridges=unary_union([hull(o) for o in objs if slug(o).startswith('bridge-')])
    roofs=unary_union([affinity.translate(t.poly,t.x,t.z) for t in T.values()])
    clear=[];ratios=[]
    for o in banks:
        t=o['Transform'];v,f=geometry(slug(o));arr=v*np.array([t['scaleX'],t['scaleY'],t['scaleZ']]);spans=np.ptp(arr,axis=0)
        ratios.append(spans[1]/min(spans[0],spans[2]))
        assert .67<ratios[-1]<1.50
        assert np.all(v[:,0]**2+v[:,2]**2<=1) and v[:,1].min()>=0 and v[:,1].max()<=1
        c=dict(x=t['posX'],z=t['posZ'],rx=t['scaleX'],rz=t['scaleZ'],angle=t['rotY'])
        boundary=ellipse(c);assert boundary.disjoint(roofs);clear.append(boundary.distance(bridges))
        assert clear[-1]>.24 and o['DragSelectable'] and o['Locked']
    examples=json.loads((R3/'work/los-audit.json').read_text())['examples'];hits={}
    for ex in examples:
        a,b=np.asarray(ex['a']),np.asarray(ex['b']);a[1]-=PITCH;b[1]-=PITCH
        d=b-a;n=np.array([-d[2],0,d[0]]);n/=np.linalg.norm(n)
        offsets=[n*w+[0,h-EYE,0] for w in (-.44,0,.44) for h in (.12,.84,1.54)]
        aa=np.array([a+x for x in offsets for _ in offsets]);bb=np.array([b+y for _ in offsets for y in offsets])
        v=rays_through([current[ex['obstacle']]],aa,bb);hits[ex['obstacle']]=int(v.sum())
    print('Physical silhouettes:',hits,flush=True)
    assert min(hits.values())==81,hits
    surfaces=json.loads((WORK/'surface-audit.json').read_text())
    assert all(v['remaining_above_rounding']==0 for v in surfaces.values())
    assert all(FLEET[slug(o)].owner in o['Nickname'] and o['CustomMesh']['DiffuseURL'].endswith(FLEET[slug(o)].key+'.jpg') for o in objs if slug(o) in FLEET)
    audit=dict(towers=len(T),states=len(tests),distinct_foundation_corners=4*len(T),tested_corner_sections=sum(x[1] for x in tests),
               corner_rays_per_mesh_type=sum(x[0] for x in tests),visual_and_physics_passed=True,
               overlaps_after_cleanup=0,surface_area_reporting_threshold_sq_in=.00008,
               banks=len(banks),physical_height_over_short_axis=[round(min(ratios),3),round(max(ratios),3)],
               minimum_default_zone_to_bridge_in=round(min(clear),3),silhouette_tests=hits,fleet_operators=[op.owner for op in FLEET.values()])
    print(audit);(WORK/'finished-geometry.json').write_text(json.dumps(audit,indent=2))
if __name__=='__main__':main()
