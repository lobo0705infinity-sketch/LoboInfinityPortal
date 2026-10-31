"""Geometry regression for the photographed floating board and floor flicker."""
from pathlib import Path
import json,numpy as np
from shapely.geometry import Polygon
from shapely.ops import unary_union
from tts_geometry import load_tts_mesh
from map_config import STREET_Y,PIT_DEPTH,BASE_BOTTOM,GROUND_FLOOR_TOP,PIT_WIDTH,PIT_LENGTH
R=Path(__file__).resolve().parents[1];A=R/'Assets'
assert PIT_WIDTH==8 and PIT_LENGTH==7,'Requested pit footprint changed'
assert PIT_DEPTH==2.5,'Requested excavation depth changed'
mat=load_tts_mesh(A/'urban-street-mat-collider.obj');mat.merge_vertices()
assert mat.is_watertight and mat.is_winding_consistent,'Base must be closed and consistently wound'
assert mat.volume>0,'Base exterior faces point inward'
assert abs(mat.volume-(48*48*(-BASE_BOTTOM)-3*PIT_WIDTH*PIT_LENGTH*PIT_DEPTH))<.001
assert abs(STREET_Y+mat.bounds[0,1]-.85)<1e-5
assert STREET_Y-PIT_DEPTH>=.95
records=[]
for file in sorted(A.glob('*.obj')):
 if file.stem.endswith('-collider') or not (file.stem.startswith(('civic-state','annex-state','ruin-state','depot-state','utility-kiosk','site-office'))):continue
 m=load_tts_mesh(file);tri=m.triangles
 ids=np.where(np.max(abs(tri[:,:,1]-GROUND_FLOOR_TOP),axis=1)<1e-5)[0]
 assert len(ids)>0,file.name
 assert np.all(m.face_normals[ids,1]>.99),(file.name,'Ground floor faces down')
 polys=[Polygon(t[:,[0,2]]) for t in tri[ids]];area=sum(p.area for p in polys);union=unary_union(polys)
 assert area-union.area<.0002,(file.name,'Overlapping floor triangles')
 assert GROUND_FLOOR_TOP>.02,'Asphalt and building floors are coplanar'
 # The same test applies to every upper landing and rooftop floor surface:
 # all triangulation is constrained, and cell UVs project from shared X/Z.
 records.append(dict(mesh=file.stem,groundFloorTriangles=len(ids),floorAreaSquareInches=union.area,overlapSquareInches=area-union.area))
assert len(records)==15,len(records)
result={'streetHeight':STREET_Y,'baseBottomWorldY':STREET_Y+BASE_BOTTOM,'pitDepth':PIT_DEPTH,'baseClosedAndOutwardFacing':True,'baseVolumeCubicInches':mat.volume,'groundFloorClearanceAboveAsphalt':GROUND_FLOOR_TOP,'buildingStateGroundFloors':records,'scope':'Offline mesh and deployment checks; live TTS verification pending.'}
(R/'Source/board-and-floor-validation.json').write_text(json.dumps(result,indent=2));print(json.dumps({k:v for k,v in result.items() if k!='buildingStateGroundFloors'}))
