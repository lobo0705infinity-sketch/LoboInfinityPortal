"""Render the exported OBJ geometry, not generated concept artwork."""
import bpy,math,json,sys
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1];A=R/'Assets'
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
atlas=bpy.data.images.load(str(A/'azure-material-atlas.png'))
mats=[]
for i in range(16):
 m=bpy.data.materials.new('Resort material '+str(i));m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=atlas;m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color']);p.inputs['Roughness'].default_value=.38 if i in[3,7,10]else .77;p.inputs['Metallic'].default_value=.72 if i==3 else .05
 mats.append(m)
def objfile(file,name,texture=None):
 vs=[];uv=[];faces=[];uvface=[]
 for line in(A/file).read_text().splitlines():
  q=line.split()
  if not q:continue
  if q[0]=='v':x,y,z=map(float,q[1:]);vs.append((-x,z,y))
  elif q[0]=='vt':uv.append(tuple(map(float,q[1:3])))
  elif q[0]=='f':
   idx=[p.split('/')for p in q[1:]];faces.append([int(p[0])-1 for p in idx]);uvface.append([int(p[1])-1 for p in idx])
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(vs,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
 for m in mats:mesh.materials.append(m)
 if texture:
  m=bpy.data.materials.new(name+' lettering');m.use_nodes=True;t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(A/texture));p=m.node_tree.nodes.get('Principled BSDF');m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color']);p.inputs['Roughness'].default_value=.62;mesh.materials.append(m)
 layer=mesh.uv_layers.new()
 for poly,ui in zip(mesh.polygons,uvface):
  coords=[uv[j]for j in ui]
  for li,co in zip(poly.loop_indices,coords):layer.data[li].uv=co
  u=sum(c[0]for c in coords)/len(coords);v=sum(c[1]for c in coords)/len(coords);poly.material_index=min(15,int(u*4)+4*(3-min(3,int(v*4))))
  if texture:poly.material_index=16
 return o
manifest=json.loads((R/'Source/geometry-manifest.json').read_text());by={x['slug']:x for x in manifest};layout=json.loads((R/'Source/layout.json').read_text())
mode=sys.argv[sys.argv.index('--')+1]if '--'in sys.argv else'overview'
if mode=='scatter':
 items=[r for r in manifest if r['kind']=='scatter']
 for i,r in enumerate(items):
  o=objfile(r['states'][0]['mesh'],r['name']);o.location=((i%4-1.5)*4.7,(i//4-.5)*5.5,0)
else:
 for i,it in enumerate(layout):
  r=by[it['slug']];o=objfile(r['states'][it.get('state',1)-1]['mesh'],r['name']+str(i));o.location=(it['x'],it['z'],0);o.rotation_euler[2]=math.radians(-it['rot'])
  if r.get('sign'):
   sign=objfile(r['sign']['mesh'],r['name']+' sign',r['sign']['texture']);sign.location=o.location;sign.rotation_euler=o.rotation_euler
# Plain backdrop outside the playable board.
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-3.08 if mode!='scatter'else-.03));p=bpy.context.object
mat=bpy.data.materials.new('Backdrop');mat.diffuse_color=(.18,.22,.24,1);p.data.materials.append(mat)
world=bpy.data.worlds.new('Soft coastal daylight');bpy.context.scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.66,.77,.84,1);world.node_tree.nodes['Background'].inputs[1].default_value=.65
bpy.ops.object.light_add(type='AREA',location=(-22,-30,48));light=bpy.context.object;light.data.energy=23000;light.data.shape='DISK';light.data.size=32
bpy.ops.object.light_add(type='SUN',location=(20,-20,40));bpy.context.object.data.energy=2;bpy.context.object.rotation_euler=(.4,-.5,-.3);bpy.context.object.data.angle=.15
if mode=='scatter':pos=(15,-22,19);target=(0,0,1);scale=23
else:pos=(56,-68,65);target=(0,0,1.5);scale=76
bpy.ops.object.camera_add(location=pos);cam=bpy.context.object;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=scale;bpy.context.scene.camera=cam
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=40;scene.cycles.use_denoising=False;scene.render.resolution_x=1800;scene.render.resolution_y=1400;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.filepath=str(R/'Review'/('Azure-Palace-'+mode+'.png'));scene.view_settings.view_transform='AgX'if 'AgX'in [x.identifier for x in bpy.types.ColorManagedViewSettings.bl_rna.properties['view_transform'].enum_items]else'Standard'
bpy.ops.wm.save_as_mainfile(filepath=str(R/'Review'/('Azure-Palace-'+mode+'.blend')))
bpy.ops.render.render(write_still=True)
