from pathlib import Path
import sys,bpy,json,math
from mathutils import Vector,Matrix
from functools import lru_cache
from hashlib import sha1
project=Path(__file__).resolve().parents[1];r=project/'review';r.mkdir(exist_ok=True);cache=json.loads((project/'base/cache.json').read_text())
def file(url):
 if '/cairnfall-courtyards-r2/' in url:return project/'assets'/url.rsplit('/',1)[-1]
 p=Path(cache[url]);return p if p.is_absolute() else (project.parent/p if (project.parent/p).exists() else project/'cache'/p.name)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
@lru_cache(None)
def mat(path):
 m=bpy.data.materials.new(path.name);m.use_nodes=True
 nodes=m.node_tree.nodes;shader=nodes.get('Principled BSDF');shader.inputs['Roughness'].default_value=.78
 t=nodes.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(path),check_existing=True);t.interpolation='Linear'
 m.node_tree.links.new(t.outputs['Color'],shader.inputs['Base Color']);return m
@lru_cache(None)
def data(path,texture):
 v=[];u=[];poly=[];tex=[]
 for row in path.read_text(errors='replace').splitlines():
  if row.startswith('v '):
   x,h,z=map(float,row.split()[1:4]);v.append((-x,z,h))
  elif row.startswith('vt '):u.append(tuple(map(float,row.split()[1:3])))
  elif row.startswith('f '):
   f=[a.split('/')for a in row.split()[1:]];poly.append([int(a[0])-1 for a in f]);tex.extend([int(a[1])-1 if len(a)>1 and a[1] else 0 for a in f])
 m=bpy.data.meshes.new(path.stem);m.from_pydata(v,[],poly);m.update()
 if u:
  layer=m.uv_layers.new(name='UVMap');layer.data.foreach_set('uv',[n for index in tex for n in u[index]])
 m.materials.append(mat(texture));return m
def add(name,m):o=bpy.data.objects.new(name,m);scene.collection.objects.link(o);return o
def put(name,o,path,tex):
 e=add(name,data(path,tex));t=o['Transform'];e.location=(t['posX'],t['posZ'],t['posY']-4);e.scale=(t['scaleX'],t['scaleZ'],t['scaleY'])
 w=Matrix(((1,0,0),(0,0,1),(0,1,0)));q=Matrix.Rotation(math.radians(t['rotY']),3,'Y')@Matrix.Rotation(math.radians(t['rotX']),3,'X')@Matrix.Rotation(math.radians(t['rotZ']),3,'Z')
 e.rotation_mode='QUATERNION';e.rotation_quaternion=(w@q@w).to_quaternion()
bag=json.loads((project/'release/Cairnfall-Sanctuary.json').read_bytes())['ObjectStates'][0]
for o in bag['ContainedObjects']:
 if o.get('CustomMesh'):
  c=o['CustomMesh'];put(o['GUID'],o,file(c['MeshURL']),file(c['DiffuseURL']))
world=bpy.data.worlds.new('Exterior daylight');scene.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.72,.80,.94,1);world.node_tree.nodes['Background'].inputs[1].default_value=.72
sun=bpy.data.lights.new('Afternoon sun','SUN');sun.energy=2.6;sun.angle=math.radians(13);l=add('Key daylight',sun);l.rotation_euler=(math.radians(30),math.radians(-34),math.radians(-28))
bpy.ops.mesh.primitive_plane_add(size=250,location=(0,0,-3.16));back=bpy.context.object;back.name='Studio floor';m=bpy.data.materials.new('Dark slate');m.diffuse_color=(.038,.064,.076,1);back.data.materials.append(m)
cam=bpy.data.cameras.new('Review camera');co=add('Review camera',cam);scene.camera=co;cam.type='ORTHO';cam.clip_end=500
scene.render.engine='CYCLES';scene.cycles.samples=20;scene.cycles.use_denoising=False;scene.render.threads_mode='FIXED';scene.render.threads=8;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.view_settings.exposure=.44;scene.view_settings.look='AgX - Medium High Contrast';scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB'
shots={
 'overview':((0,0,1.6),(-39,-1.0,77),54.8,(1450,1370)),
 'service':((-14.1,-4.02,1.1),(-2.2,14.0,13.5),17.3,(1080,830)),
 'laundry':((-14.65,.05,1.06),(-5.1,8.8,5.0),5.95,(970,660)),
 'refectory':((-13.05,-8.65,1.06),(3.9,7.7,4.4),6.45,(970,660)),
 'shrine':((7.78,-17.04,1.22),(-.8,7.1,3.65),5.7,(940,620)),
 'clinic-roof':((16.96,-10.51,3.86),(-8.6,3.3,11.2),11.1,(950,680)),
 'archive-roof':((-2.50,7.65,4.43),(-11.4,-2.4,9.8),13.7,(960,680)),
 'plan':((0,0,0),(0,.00001,90),51,(1250,1250))}
for name,(target,delta,width,res) in shots.items():
 if '--' in sys.argv and name not in sys.argv[sys.argv.index('--')+1:]:continue
 co.location=Vector(target)+Vector(delta);co.rotation_euler=(-Vector(delta)).to_track_quat('-Z','Y').to_euler();cam.ortho_scale=width
 # Keep the detail cameras clear of foreground structures. The overview shows the complete table.
 for entry in bag['ContainedObjects']:
  entity=scene.objects.get(entry['GUID'])
  if entity:
   focus={'clinic-roof':{'a35a98','cfac10','d4be76'},'archive-roof':{'783d94','cfa212'},'laundry':{'cfa210','31a8a1'},'refectory':{'cfa211','2404c4'},'shrine':{'cfa214'}}.get(name)
   entity.hide_render=bool(focus and entry['GUID'] not in focus and entry['GUID'] not in {'47200d','15f5d6'})
 scene.render.resolution_x,scene.render.resolution_y=res;scene.render.filepath=str(r/(name+'.png'));bpy.ops.render.render(write_still=True)
