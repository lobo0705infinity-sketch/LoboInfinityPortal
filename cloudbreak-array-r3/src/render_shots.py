"""Offline photography of the same OBJ files, texture coordinates and transforms loaded by TTS."""
from pathlib import Path
import sys,json,math
import bpy
from mathutils import Vector
from functools import lru_cache
R=Path(__file__).resolve().parents[1];W=R/'work';O=R/'out';A=R/'assets';OLD=next(p for p in (R.parent/'cloudbreak-array-r2',R.parent/'r2') if (p/'src/project.py').is_file());BASE=OLD/'base/assets'
def file3(name):
 return next(d/name for d in (A,OLD/'assets',BASE) if (d/name).is_file())
mode=sys.argv[-1];inside=mode in ('interiors','detail-interior')
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=24 if mode.startswith(('detail','eye')) else 18;scene.cycles.use_denoising=False
scene.cycles.max_bounces=6;scene.cycles.transparent_max_bounces=12;scene.cycles.diffuse_bounces=2
scene.render.resolution_x,scene.render.resolution_y=((1100,730) if mode.startswith('detail') else (1580,1460))
if mode=='plan':scene.render.resolution_x=1150;scene.render.resolution_y=1150
if mode.startswith('eye'):scene.render.resolution_x=1040;scene.render.resolution_y=540
scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
world=bpy.data.worlds.new('Morning fill');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.68,.79,.89,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.55;scene.world=world
if mode.startswith('eye'):
 env=world.node_tree.nodes.new('ShaderNodeTexEnvironment');env.image=bpy.data.images.load(str(file3('sky-day.jpg')));world.node_tree.links.new(env.outputs['Color'],world.node_tree.nodes['Background'].inputs['Color']);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.95
scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast'
@lru_cache(None)
def material(path):
 mat=bpy.data.materials.new(Path(path).stem);mat.use_nodes=True;bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.72
 if path=='base':bs.inputs['Base Color'].default_value=(.09,.12,.14,1)
 else:
  tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(path,check_existing=True);tex.interpolation='Linear';mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
 if Path(path).name=='horticultural-glass.png':
  bs.inputs['Roughness'].default_value=.13;bs.inputs['IOR'].default_value=1.47;bs.inputs['Coat Weight'].default_value=.48;bs.inputs['Transmission Weight'].default_value=.18;bs.inputs['Alpha'].default_value=.37
 return mat
@lru_cache(None)
def loadmodel(path,tex):
 v=[];vt=[];f=[];ft=[];norm=[];fn=[]
 seen=set()
 for l in Path(path).read_text().splitlines():
  t=l.split()
  if not t:continue
  if t[0]=='v' or t[0]=='vn':
   x,y,z=map(float,t[1:4]);(v if t[0]=='v' else norm).append((-x,z,y))
  elif t[0]=='vt':vt.append(tuple(map(float,t[1:3])))
  elif t[0]=='f':
   face=[k.split('/')for k in t[1:]];tri=tuple(int(a[0])-1 for a in face)
   if 'greenhouse-glazing' in path:
    k=tuple(sorted(tri))
    if k in seen:continue
    seen.add(k)
   f.append(tri)
   if len(face[0])>1 and face[0][1]:ft.extend([int(a[1])-1 for a in face])
   if len(face[0])>2 and face[0][2]:fn.extend([int(a[2])-1 for a in face])
 me=bpy.data.meshes.new(Path(path).stem);me.from_pydata(v,[],f);me.materials.append(material(str(tex)));me.update()
 if ft:
  layer=me.uv_layers.new(name='Native UV');layer.data.foreach_set('uv',[u for i in ft for u in vt[i]])
 if ('vapour-' in path or 'alto-' in path or 'aerostat-' in path) and fn:
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
  parent=include(o['Nickname'],OLD/'work/console-render.obj',OLD/'work/console-diffuse.jpg',t)
  for child in o.get('ChildObjects',[]):
   ch=include('40 mm objective base',OLD/'base/console-base.obj','base',child['Transform']);ch.parent=parent
  continue
 if 'CustomMesh' not in o:continue
 m=o['CustomMesh'];name=m['MeshURL'].split('/')[-1];tex=m['DiffuseURL'].split('/')[-1];base=A if (A/name).exists()else BASE
 if inside and 'bridge-'in name and mode=='detail-interior' and t['posY']>5:continue
 parent=include(o['Nickname'],file3(name),file3(tex),t)
 for child in o.get('ChildObjects',[]):
  cm=child['CustomMesh'];ch=include(child['Nickname'],file3(cm['MeshURL'].split('/')[-1]),file3(cm['DiffuseURL'].split('/')[-1]),child['Transform']);ch.parent=parent
# A dark studio ground keeps attention on the playable footprint and grounds the shadows.
ground=None
if not mode.startswith('eye'):
 bpy.ops.mesh.primitive_plane_add(size=900,location=(0,0,.85));ground=bpy.context.object;g=bpy.data.materials.new('Studio slate');g.diffuse_color=(.028,.043,.055,1);ground.data.materials.append(g)
def sun(loc,target,energy,size):
 data=bpy.data.lights.new('Daylight','SUN');data.energy=energy;data.angle=math.radians(size);ob=bpy.data.objects.new('Daylight',data);scene.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector(target)-Vector(loc)).to_track_quat('-Z','Y').to_euler()
sun((-30,-50,75),(0,0,1),3.1,15)
camera=bpy.data.cameras.new('Board camera');cam=bpy.data.objects.new('Camera',camera);scene.collection.objects.link(cam);scene.camera=cam;camera.type='ORTHO'
if mode=='roofs':aim=(0,0,6.1);loc=(22,-70,84);size=66
elif mode=='interiors':aim=(0,0,5);loc=(8,-29,108);size=58
elif mode=='plan':aim=(0,0,7);loc=(0,-.0001,155);size=52
elif mode=='detail-green':aim=(-15.935,-15.58,8.61);loc=(-29,-23.9,18.5);size=9.7
elif mode.startswith('eye'):
 spec=json.loads((W/'los-audit.json').read_text())['examples'][int(mode[-1])];a,b=spec['a'],spec['b'];loc=(a[0],a[2],a[1]);aim=(b[0],b[2],b[1]);size=10
 camera.type='PERSP';camera.lens=34;camera.clip_start=.02
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
name={'roofs':'Cloudbreak-Array-R3-Rooftops.png','detail-green':'Cloudbreak-Array-R3-Glasshouse.png'}
scene.render.filepath=str(O/name[mode] if mode in name else W/(mode+'.png'));bpy.ops.render.render(write_still=True)
