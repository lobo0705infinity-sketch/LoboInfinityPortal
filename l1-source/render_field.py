import sys,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from render_models import *
data=json.loads((ROOT/'battle-bag.json').read_text());validation=json.loads((ROOT/'validation.json').read_text())
poses={v['guid']:v for v in validation['surface_contact']}
clear();mesh(ASSETS/'field.obj',ASSETS/'field.jpg');mesh(ASSETS/'palms.obj',ASSETS/'lagash-guard.png')
for o in data['ContainedObjects']:
 if o['GUID'] not in poses:continue
 cm=o['CustomMesh'];p=poses[o['GUID']]['position'];r=poses[o['GUID']]['rotation']
 ob=mesh(ASSETS/cm['MeshURL'].rsplit('/',1)[1],ASSETS/cm['DiffuseURL'].rsplit('/',1)[1],(p['x'],p['z'],p['y']))
 ob.rotation_euler=(math.radians(r['x']),math.radians(r['z']),-math.radians(r['y']))
scene((78,-102,114),(0,0,0),130)
for ob in bpy.data.objects:
 if ob.type=='LIGHT':ob.data.energy=70000;ob.location*=14;ob.data.size=90
s=bpy.context.scene;s.render.resolution_x=1600;s.render.resolution_y=1400;s.cycles.samples=12
s.render.filepath=str(OUT/'field.png');bpy.ops.render.render(write_still=True)
