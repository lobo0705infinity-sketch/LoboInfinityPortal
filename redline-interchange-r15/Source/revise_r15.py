from pathlib import Path
import sys,json,copy
R=Path(__file__).resolve().parents[1];A=R/'Assets';S=R/'Source/Authoring';sys.path.insert(0,str(S));sys.path.insert(0,str(R/'Source'))
ns={'__file__':str(S/'build_map.py')};exec((S/'build_map.py').read_text().split('\nSPECS=')[0],ns)
import architecture
from clean_overlap_r13 import clean
specs=json.loads((S/'buildings.json').read_text());changed=[];reports=[]
for spec in specs:
 if spec['name'] not in ['Parcel Office','North Service Office']:continue
 key=spec['name'].lower().replace(' ','-')
 for level in range(spec['floors']+1):
  suffix='ground' if level==0 else 'roof';stem=key+'-'+suffix
  architecture.GAP=1.8
  old=ns['station_building'](spec['w'],spec['d'],spec['floors'],level,spec['role'],spec['shape'])
  temp=A/('baseline-'+stem+'.obj');old[0].write(temp)
  assert temp.read_bytes()==(A/('r11-'+stem+'.obj')).read_bytes(),stem+' authoring source mismatch'
  temp.unlink()
  # Frames project 0.0275 inches into either edge: 1.105 - .055 = 1.05 clear.
  architecture.GAP=1.105
  mesh=ns['station_building'](spec['w'],spec['d'],spec['floors'],level,spec['role'],spec['shape'])
  raw=A/('r15-raw-'+stem+'.obj');mesh[0].write(raw)
  dst=A/('r15-'+stem+'.obj');reports.append(clean(raw,dst));raw.unlink();changed.append(dst.name)
  architecture.GAP=1.05
  collision=ns['station_building'](spec['w'],spec['d'],spec['floors'],level,spec['role'],spec['shape'])[1]
  dst=A/('r15-'+stem+'-collider.obj');collision.write(dst,compound=True);changed.append(dst.name)
bag=json.loads((R/'Saved-Objects/Redline-Interchange-R14-Custom-Layout-Mat.json').read_text())
scene=json.loads((R/'Saves/Redline-Interchange-R14-Custom-Layout-Mat.json').read_text())
rotated=[];door_objects=[];attachments=[]
for o in bag['ObjectStates'][0]['ContainedObjects']:
 mesh=o.get('CustomMesh',{}).get('MeshURL','').rsplit('/',1)[-1]
 if mesh.startswith('r13-signal-relay-house-'):
  rotated.append(o['GUID'])
  for q in [o]+list(o.get('States',{}).values()):q['Transform']['rotY']=(q['Transform']['rotY']+90)%360
 if mesh.startswith(('r13-parcel-office-','r13-north-service-office-')):
  door_objects.append(o['GUID'])
  for q in [o]+list(o.get('States',{}).values()):
   cm=q['CustomMesh'];old=cm['MeshURL'].rsplit('/',1)[-1];stem=old.removeprefix('r13-').removesuffix('.obj')
   cm['MeshURL']='R15/r15-'+stem+'.obj';cm['ColliderURL']='R15/r15-'+stem+'-collider.obj'
# Rotate canopies sharing a building origin. Mesh geometry contains local attachment offset.
for o in bag['ObjectStates'][0]['ContainedObjects']:
 if 'entrance canopy' not in o.get('Nickname','').lower():continue
 for house in bag['ObjectStates'][0]['ContainedObjects']:
  if house['GUID'] not in rotated:continue
  t,u=o['Transform'],house['Transform']
  if (t['posX']-u['posX'])**2+(t['posZ']-u['posZ'])**2<.01:
   for q in [o]+list(o.get('States',{}).values()):q['Transform']['rotY']=(q['Transform']['rotY']+90)%360
   attachments.append(o['GUID'])
changed_by_guid={o['GUID']:o for o in bag['ObjectStates'][0]['ContainedObjects']}
for i,o in enumerate(scene['ObjectStates']):
 if o['GUID'] in changed_by_guid:scene['ObjectStates'][i]=copy.deepcopy(changed_by_guid[o['GUID']])
(R/'Source/R15-layout.json').write_text(json.dumps(bag,indent=2));(R/'Source/R15-scene.json').write_text(json.dumps(scene,indent=2))
(R/'Source/R15-new-assets.json').write_text(json.dumps(changed+['redline-r15-ground.jpg'],indent=2))
(R/'Source/R15-geometry-validation.json').write_text(json.dumps(dict(clear_door_mm=1.05*25.4,collider_gap_mm=1.05*25.4,doors_changed=door_objects,rotated_buildings=rotated,rotated_attachments=attachments,surface_cleanup=reports),indent=2))
print('Door buildings:',door_objects,'Rotated:',rotated,'Canopies:',attachments,flush=True)
p=(R/'Source/ground_r14.py').read_text().replace('R14-layout','R15-layout').replace('redline-r14-ground','redline-r15-ground').replace('R14 mat','R15 mat');(R/'Source/ground_r15.py').write_text(p)
