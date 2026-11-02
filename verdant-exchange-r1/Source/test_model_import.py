"""TTS OBJ import-budget regression, including UV seam expansion and all states."""
from pathlib import Path
import json,math
ROOT=Path(__file__).resolve().parents[1]
bag=json.loads((ROOT/'Map-Bags/Verdant-Exchange-Uplink-Center-R4.json').read_text())['ObjectStates'][0]
objects=[q for o in bag['ContainedObjects'] for q in [o]+list(o.get('States',{}).values())]
rows=[]
def parse(path):
 v=[];uv=[];faces=[];groups=[];part=[]
 for line in path.read_text().splitlines():
  x=line.split()
  if not x:continue
  if x[0]=='v':v.append(tuple(map(float,x[1:4])))
  elif x[0]=='vt':uv.append(tuple(map(float,x[1:3])))
  elif x[0]=='o':
   if part:groups.append(part)
   part=[]
  elif x[0]=='f':
   assert len(x)==4,(path,'Non-triangulated face')
   face=[tuple(map(int,t.split('/')))for t in x[1:]]
   assert all(1<=p[0]<=len(v)for p in face)
   faces.append(face);part.append(face)
 if part:groups.append(part)
 assert all(math.isfinite(a)for p in v for a in p)
 return v,uv,faces,groups
seen=set()
for o in objects:
 cm=o.get('CustomMesh')
 if not cm:continue
 for field in ['MeshURL','ColliderURL']:
  name=cm[field].rsplit('/',1)[-1]
  if name in seen:continue
  seen.add(name);p=ROOT/'Assets'/name;v,uv,faces,groups=parse(p)
  if field=='MeshURL':
   used={t for f in faces for t in f}
   assert len(v)<20000 and len(used)<20000,(name,'TTS visual import budget',len(v),len(used))
   assert len(faces)*3<60000,(name,'Conservative triangle-corner budget')
   assert all(len(t)==2 and 1<=t[1]<=len(uv)for f in faces for t in f)
   rows.append({'name':name,'positions':len(v),'uv_expanded_vertices':len(used),'triangles':len(faces),'triangle_corners':len(faces)*3})
  else:
   assert cm['Convex']is True,(name,'Compound colliders must use convex component mode')
   assert all(len(g)<256 for g in groups),(name,'Collider component exceeds triangle limit')
   assert all(len({t[0]for f in g for t in f})<256 for g in groups)
for o in bag['ContainedObjects']:
 if 'building' not in o.get('Tags',[]):continue
 assert 'Ground floor exposed' in o['Nickname'],o['Nickname']
 states=o['States'];roof=states[str(max(map(int,states)))]
 assert 'Roof on'in roof['Nickname']
 if '3'in states:assert 'Upper floor exposed'in states['2']['Nickname']
script=next(o['LuaScript']for o in bag['ContainedObjects']if o['GUID']=='b9fffe')
assert 'thickness=.085/width'in script and 'thickness=.055/width'in script
report={'status':'passed','visual_models':len(rows),'all_meshes_including_colliders':len(seen),'maximum_uv_expanded_vertices':max(x['uv_expanded_vertices']for x in rows),'maximum_triangle_corners':max(x['triangle_corners']for x in rows),'building_state_order':'lowest floor first; fully roofed last','compound_collider_mode':'passed','deployment_line_world_width_inches':.055,'official_reference':'https://kb.tabletopsimulator.com/custom-content/custom-model/','live_TTS_import':'Not verified in this environment','models':rows}
(ROOT/'Source/model-import-validation.json').write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items()if k!='models'},indent=2))
