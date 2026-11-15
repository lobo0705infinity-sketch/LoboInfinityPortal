import json,math
from pathlib import Path
import numpy as np
import trimesh
from shapely.geometry import MultiPoint,box
from shapely.ops import unary_union

R=Path('repaired'); piv=json.loads((R/'Source/movable-collider-data.json').read_text())
old=json.loads(Path('original/Source/movable-collider-data.json').read_text())
records=json.loads((R/'Source/geometry-manifest.json').read_text())
checks=[]
def groups(path,rec):
 vs=[];fs=[];out=[]
 def add():
  if not fs:return
  m=trimesh.Trimesh(np.array(vs),np.array(fs),process=True)
  assert m.is_watertight and m.is_convex,(path.name,'invalid collider')
  assert len(m.faces)<255
  m.apply_transform(np.diag([-1,1,1,1]));m.apply_translation(piv[path.name.replace('-collision','')]['pivot'])
  m.apply_translation([-rec['x'],0,-rec['z']]);a=math.radians(-rec['rotation']);c,s=math.cos(a),math.sin(a)
  t=np.eye(4);t[:3,:3]=[[c,0,s],[0,1,0],[-s,0,c]];m.apply_transform(t);out.append(m)
 for line in path.read_text().splitlines():
  p=line.split()
  if not p:continue
  if p[0]=='o':add();fs=[]
  elif p[0]=='v':vs.append(list(map(float,p[1:])))
  elif p[0]=='f':fs.append([int(x)-1 for x in p[1:]])
 add();return out
def section(parts,y):
 polys=[]
 for m in parts:
  if not(m.bounds[0,1]<y<m.bounds[1,1]):continue
  seg=trimesh.intersections.mesh_plane(m,[0,1,0],[0,y,0])
  if len(seg):
   p=MultiPoint(seg.reshape(-1,3)[:,[0,2]]).convex_hull
   if p.area>1e-9:polys.append(p)
 return unary_union(polys)
for rec in records:
 for state in rec['states']:
  file=state['file'];assert piv[file]['pivot']==old[file]['pivot']
  parts=groups(R/'Assets'/state['collider'],rec)
  if rec['slug']=='intake-clinic':
   corridor=box(.425,2.4,1.625,4.3)
  elif rec['slug']=='laundry-vault':corridor=box(3.1,-.60,5.0,.60)
  else:corridor=box(-.475,-4.3,.725,-2.2)
  for y in [.55,.9,1.3,1.8,2.3]:
   occupied=section(parts,y);area=occupied.intersection(corridor).area
   assert area<1e-7,(file,y,'blocked entry',area)
  checks.append({'state':file,'convex_parts':len(parts),'entry_clear_at_heights':[.55,.9,1.3,1.8,2.3],'pivot_unchanged':True})
  if rec['slug']=='intake-clinic':
   assert section(parts,1.5).intersection(box(-2.2,-3.6,-.1,-3.4)).area>.35
  if file=='laundry-vault-2.obj':
   for x in [-4.44,4.44]:assert section(parts,4.0).contains(__import__('shapely').geometry.Point(x,0))
report={'result':'PASS','states':checks,'additional_checks':['Stair-blocked clinic door is solid in all three states','Both laundry end caps have solid collision','All compound collider components closed and convex with fewer than 255 triangles','Mesh pivots identical to existing assets'],'limitations':['Software geometry and rendering checks; live TTS loading and movement not tested']}
Path('geometry-validation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
