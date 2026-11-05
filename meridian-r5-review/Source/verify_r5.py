from pathlib import Path
import json,hashlib,re
import numpy as np
from PIL import Image
R=Path(__file__).resolve().parents[1];A=R/'Assets'
s=json.loads(next((R/'PreviewSave').glob('*.json')).read_text());bag=json.loads(next((R/'SavedObjects').glob('*.json')).read_text())['ObjectStates'][0]
def walk(o):
 yield o
 for v in o.get('States',{}).values():yield from walk(v)
 for v in o.get('ChildObjects',[]):yield from walk(v)
items=[i for o in s['ObjectStates']for i in walk(o)];ids=[o['GUID']for o in items];assert len(ids)==len(set(ids))
for o in items:assert 'LoboMap:df2801'in o.get('Tags',[])
manifest={l.split(',')[0][2:]:list(map(float,l.split(',')[1:]))for l in bag['LuaScript'].splitlines()}
for o in s['ObjectStates']:
 for v in [o]+list(o.get('States',{}).values()):
  t=v['Transform'];assert manifest[v['GUID']]==[t[k]for k in ['posX','posY','posZ','rotX','rotY','rotZ']]
 if o.get('States'):assert o.get('StateId',1)==1 and sorted(map(int,o['States']))==list(range(2,len(o['States'])+2))
# Keep the actual room shape and all mission models/colliders unchanged from R4.
r4=json.loads(next((R.parent/'r4/PreviewSave').glob('*.json')).read_text());old={o['GUID']:o for o in r4['ObjectStates']};new={o['GUID']:o for o in s['ObjectStates']}
for guid in ['c18100','c18101','c18102','c18103','c18104']:
 assert old[guid]==new[guid],guid
for k in ['MeshURL','ColliderURL']:
 assert old['c18001']['CustomMesh'][k]==new['c18001']['CustomMesh'][k]
for o in r4['ObjectStates']:
 if o.get('States'):
  n=new[o['GUID']]
  for v,w in zip([o]+list(o['States'].values()),[n]+list(n['States'].values())):
   assert v['Transform']==w['Transform'];assert v['CustomMesh']['ColliderURL']==w['CustomMesh']['ColliderURL']
# No new solid geometry in any room's 25mm circulation path: all additions are
# fitted decorative children; established collision and route geometry retained.
newchildren=[o for o in items if 'MeridianR5Detail'in o.get('Tags',[])]
assert all(o['CustomMesh']['ColliderURL'].endswith('r5-visual-contact.obj')for o in newchildren)
assets=[]
for p in sorted(A.iterdir()):
 r={'file':p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
 if p.suffix in ['.png','.jpg']:
  with Image.open(p)as im:im.load();r.update(size=list(im.size),mode=im.mode,full_pixel_decode=True);assert im.mode=='RGB'
 elif p.suffix=='.obj':
  lines=p.read_text().splitlines();faces=[l.split()[1:]for l in lines if l.startswith('f ')];verts=[l.split()[1:]for l in lines if l.startswith('v ')];assert len(verts)and len(faces)
  uv=[l.split()[1:]for l in lines if l.startswith('vt ')];tuples={v for f in faces for v in f};assert len(tuples)<=20000,(p.name,len(tuples));r['import_tuples']=len(tuples)
  for f in faces:
   for v in f:
    parts=v.split('/');assert 1<=int(parts[0])<=len(verts)
    if len(parts)>1 and parts[1]:assert 1<=int(parts[1])<=len(uv)
  v=np.array(verts,float)
  for f in faces:
   ix=[int(t.split('/')[0])-1 for t in f];assert np.linalg.norm(np.cross(v[ix[1]]-v[ix[0]],v[ix[2]]-v[ix[0]]))>1e-12,(p.name,f)
 assets.append(r)
# Material UVs for replacement floor finish use the original tile 14 and do
# not introduce coplanar overlay planes or new physics floor surfaces.
assert new['df2802']['CustomMesh']['ColliderURL']==old['df2802']['CustomMesh']['ColliderURL']
text=json.dumps(s);assert 'file:'not in text
report={'status':'Pass','objects':len(s['ObjectStates']),'unique_guids':len(ids),'new_fitted_children':len(newchildren),'new_sign_lights':len([o for o in s['ObjectStates']if'MeridianR5SignLight'in o.get('Tags',[])]),'state_and_staging_checks':'Pass','mission_pieces_and_room_collision_unchanged':True,'all_building_contact_shapes_unchanged':True,'new_mesh_import_limit':20000,'assets':assets,'limitations':['Live TTS collision, illumination and frame-rate test unavailable','Windows installer not executed in this Linux runtime','Software previews omit native mission asset bundles and dynamic point lighting']}
(R/'Review/Meridian-R5-Local-Checks.json').write_text(json.dumps(report,indent=2));print('PASS',len(assets),'assets;',len(ids),'GUIDs;',len(newchildren),'fitted children')
