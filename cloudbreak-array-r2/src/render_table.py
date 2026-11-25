"""Offline photography of the same OBJ files, texture coordinates and transforms loaded by TTS."""
from pathlib import Path
import sys,json,math
import bpy
from mathutils import Vector
from functools import lru_cache
R=Path(__file__).resolve().parents[1];W=R/'work';O=R/'out';A=R/'assets';BASE=R/'base/assets'
mode=sys.argv[-1];inside=mode in ('interiors','detail-interior')
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=12 if mode.startswith('detail') else 18;scene.cycles.use_denoising=False
scene.cycles.max_bounces=3;scene.cycles.diffuse_bounces=2
scene.render.resolution_x,scene.render.resolution_y=((1100,730) if mode.startswith('detail') else (1580,1460))
scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
world=bpy.data.worlds.new('Morning fill');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.68,.79,.89,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.55;scene.world=world
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
@lru_cache(None)
def material(path):
 mat=bpy.data.materials.new(Path(path).stem);mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.72
 if path=='base':bs.inputs['Base Color'].default_value=(.09,.12,.14,1)
 else:
  tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(path,check_existing=True);tex.interpolation='Linear';mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
 return mat
@lru_cache(None)
def loadmodel(path,tex):
 v=[];vt=[];f=[];ft=[];norm=[];fn=[]
 for l in Path(path).read_text().splitlines():
  t=l.split()
  if not t:continue
  if t[0]=='v' or t[0]=='vn':
   x,y,z=map(float,t[1:4]);(v if t[0]=='v' else norm).append((-x,z,y))
  elif t[0]=='vt':vt.append(tuple(map(float,t[1:3])))
  elif t[0]=='f':
   face=[k.split('/')for k in t[1:]];f.append(tuple(int(a[0])-1 for a in face))
   if len(face[0])>1 and face[0][1]:ft.extend([int(a[1])-1 for a in face])
   if len(face[0])>2 and face[0][2]:fn.extend([int(a[2])-1 for a in face])
 me=bpy.data.meshes.new(Path(path).stem);me.from_pydata(v,[],f);me.materials.append(material(str(tex)));me.update()
 if ft:
  layer=me.uv_layers.new(name='Native UV');layer.data.foreach_set('uv',[u for i in ft for u in vt[i]])
 if 'vapour-' in path and fn:
  for poly in me.polygons:poly.use_smooth=True
  me.normals_split_custom_set([norm[i] for i in fn])
 return me
def include(name,path,tex,t):
 ob=bpy.data.objects.new(name,loadmodel(str(path),str(tex)));scene.collection.objects.link(ob);ob.location=(t['posX'],t['posZ'],t['posY']);ob.rotation_euler.z=-math.radians(t.get('rotY',0));ob.scale=(t['scaleX'],t['scaleZ'],t['scaleY']);return ob
p=json.loads((O/'Play-Table.json').read_text());obs=[o for o in p['ObjectStates'] if 'LoboMap:cb7100' in o.get('Tags',[])];cur={o['GUID'] for o in obs}
if inside:
 for o in obs:
  if o.get('States'):cur.discard(o['GUID']);cur.add(o['States']['1']['GUID'])
for o in obs:
 if o.get('States') and inside:o=o['States']['1']
 t=o['Transform']
 if 'CustomAssetbundle' in o:
  if inside:continue
  parent=include(o['Nickname'],W/'console-render.obj',W/'console-diffuse.jpg',t)
  for child in o.get('ChildObjects',[]):
   ch=include('40 mm objective base',R/'base/console-base.obj','base',child['Transform']);ch.parent=parent
  continue
 if 'CustomMesh' not in o:continue
 m=o['CustomMesh'];name=m['MeshURL'].split('/')[-1];tex=m['DiffuseURL'].split('/')[-1];base=A if (A/name).exists()else BASE
 if inside and 'bridge-'in name and mode=='detail-interior' and t['posY']>5:continue
 include(o['Nickname'],base/name,base/tex,t)
# A dark studio ground keeps attention on the playable footprint and grounds the shadows.
bpy.ops.mesh.primitive_plane_add(size=900,location=(0,0,.85));ground=bpy.context.object;g=bpy.data.materials.new('Studio slate');g.diffuse_color=(.028,.043,.055,1);ground.data.materials.append(g)
def sun(loc,target,energy,size):
 data=bpy.data.lights.new('Daylight','SUN');data.energy=energy;data.angle=math.radians(size);ob=bpy.data.objects.new('Daylight',data);scene.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector(target)-Vector(loc)).to_track_quat('-Z','Y').to_euler()
sun((-30,-50,75),(0,0,1),3.1,15)
camera=bpy.data.cameras.new('Board camera');cam=bpy.data.objects.new('Camera',camera);scene.collection.objects.link(cam);scene.camera=cam;camera.type='ORTHO'
if mode=='roofs':aim=(0,0,6.1);loc=(22,-70,84);size=66
elif mode=='interiors':aim=(0,0,5);loc=(8,-29,108);size=58
elif mode=='detail-green':aim=(-16.4,-16.1,8.4);loc=(-32,-15.2,23);size=10
else:aim=(.55,.30,4.80);loc=(2,-23,46);size=11
cam.location=loc;cam.rotation_euler=(Vector(aim)-Vector(loc)).to_track_quat('-Z','Y').to_euler();camera.ortho_scale=size;camera.clip_end=500
if mode in ('roofs','interiors'):
 bpy.context.view_layer.update()
 orient=cam.rotation_euler.to_matrix();inv=orient.transposed();bounds=[]
 for ob in scene.objects:
  if ob.type=='MESH' and ob!=ground:
   bounds.extend(inv@(ob.matrix_world@Vector(v)) for v in ob.bound_box)
 xmin,xmax=min(p.x for p in bounds),max(p.x for p in bounds);ymin,ymax=min(p.y for p in bounds),max(p.y for p in bounds)
 cp=inv@cam.location;cam.location+=orient@Vector(((xmin+xmax)/2-cp.x,(ymin+ymax)/2-cp.y,0))
 camera.ortho_scale=max(xmax-xmin,(ymax-ymin)*scene.render.resolution_x/scene.render.resolution_y)*1.085
scene.render.filepath=str(O/('Cloudbreak-Array-R2-'+('Rooftops' if mode=='roofs' else 'Interiors')+'.png') if mode in ('roofs','interiors') else W/(mode+'.png'));bpy.ops.render.render(write_still=True)
