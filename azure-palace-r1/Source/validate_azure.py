from pathlib import Path
import json,sys,re,copy
import numpy as np,trimesh
R=Path(__file__).resolve().parents[1];A=R/'Assets'
records=json.loads((R/'Source/geometry-manifest.json').read_text());report={'passed':False,'meshes':0,'collider_parts':0,'roof_support':[],'door_access':[],'pool_stairs':[],'live_tts_tested':False}
for r in records:
 for st in r['states']+([r['sign']]if r.get('sign')else[]):
  v=[];parts=[];part=[]
  for line in(A/st['collider']).read_text().splitlines():
   if line.startswith('o '):
    if part:parts.append(part)
    part=[]
   elif line.startswith('v '):v.append(list(map(float,line.split()[1:])))
   elif line.startswith('f '):part.append([int(i)-1 for i in line.split()[1:]])
  if part:parts.append(part)
  assert len(v)<25000,(r['slug'],'collider vertex budget')
  for p in parts:
   assert len(p)<255
   m=trimesh.Trimesh(v,p,process=True);m.remove_unreferenced_vertices();assert m.is_watertight,(st['collider'],'open collider');assert m.volume>1e-8
  m=trimesh.load(A/st['mesh'],force='mesh',process=False);assert len(m.vertices)<65000;assert np.isfinite(m.vertices).all();report['meshes']+=1;report['collider_parts']+=len(parts)
 if r['kind']=='building':
  m=trimesh.load(A/r['states'][0]['collider'],force='mesh');height=r['states'][0]['bounds'][4]
  pts,_,_=m.ray.intersects_location([[0,height+3,0]],[[0,-1,0]]);assert len(pts)>0
  assert pts[:,1].max()>height-1.1,(r['slug'],'roof missing');report['roof_support'].append(r['slug'])
  # Short ray through each actual front doorway, below the arch and sign.
  front=-float(r['footprint'][1]-(1.8 if len(r['states'])>2 else .4))/2
  pts,_,_=m.ray.intersects_location([[0,1.5,front-.55]],[[0,0,1]])
  assert not any(front-.54<p[2]<front+.45 for p in pts),(r['slug'],'door filled by collider');report['door_access'].append(r['slug'])
g=next(r for r in records if r['kind']=='ground');m=trimesh.load(A/g['states'][0]['collider'],force='mesh')
for label,points in [('south',[(0,-4.2-i*.3)for i in range(6)]),('north',[(0,2.2+i*.3)for i in range(6)]),('west',[(-1.2-i*.3,1)for i in range(6)]),('east',[(1.2+i*.3,1)for i in range(6)])]:
 heights=[]
 for x,z in points:
  hits,_,_=m.ray.intersects_location([[-x,4,z]],[[0,-1,0]]);assert len(hits);heights.append(float(max(hits[:,1])))
 assert all(b>=a-.001 for a,b in zip(heights,heights[1:])),(label,heights)
 assert heights[0]<-.6 and heights[-1]>-.25,(label,heights);report['pool_stairs'].append({'exit':label,'heights':heights})
# Preserve all other map setups byte-for-byte at the JSON object level.
old=json.loads(Path('/workspace/scratch/aea066a92a75/base-release/Workshop-Save.json').read_text());new=json.loads((R/'Release/Workshop-Save.json').read_text());oldby={o['GUID']:o for o in old['ObjectStates']};newby={o['GUID']:o for o in new['ObjectStates']}
for guid,o in oldby.items():
 if guid!='810108':assert o==newby[guid],('unrelated object changed',guid)
def walk(o):
 yield o
 for q in o.get('ContainedObjects',[])+o.get('ChildObjects',[]):yield from walk(q)
 for q in o.get('States',{}).values():yield from walk(q)
for filename in ['Azure-Palace.json','Azure-Palace-Scatter.json','Play-Table.json']:
 d=json.loads((R/'Release'/filename).read_text());seen=set()
 for root in d['ObjectStates']:
  for o in walk(root):
   if filename!='Play-Table.json':assert o['GUID']not in seen,(filename,o['GUID']);seen.add(o['GUID'])
   for k in ['ColorDiffuse','ColorState']:
    if k in o:assert isinstance(o[k],dict)and all(isinstance(o[k].get(c),(int,float))for c in ['r','g','b'])
   for k,u in o.get('CustomMesh',{}).items():
    if k.endswith('URL')and u and(filename!='Play-Table.json'or'AzurePalaceR1'in o.get('GMNotes','')):assert u.startswith('https://')
report['unchanged_collection_objects']=len(oldby)-1;report['passed']=True
(R/'Review/geometry-validation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
