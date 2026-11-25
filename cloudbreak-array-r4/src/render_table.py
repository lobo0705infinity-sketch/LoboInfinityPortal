"""Offline photography of the same OBJ files, texture coordinates and transforms loaded by TTS."""
from pathlib import Path
import sys,json,math
import bpy
from mathutils import Vector
from functools import lru_cache
R=Path(__file__).resolve().parents[1];W=R/'work';O=R/'out';A=R/'assets';R3=next(p for p in (R.parent/'cloudbreak-array-r3',R.parent/'r3') if (p/'assets').is_dir());OLD=next(p for p in (R.parent/'cloudbreak-array-r2',R.parent/'r2') if (p/'src/project.py').is_file());BASE=OLD/'base/assets'
def file3(name):
 return next(d/name for d in (A,R3/'assets',OLD/'assets',BASE) if (d/name).is_file())
mode=sys.argv[-1];inside=mode in ('interiors','courier-floor')
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=24 if mode.startswith(('detail','eye','courier','ledge')) else 18;scene.cycles.use_denoising=False
scene.cycles.max_bounces=6;scene.cycles.transparent_max_bounces=12;scene.cycles.diffuse_bounces=2
scene.render.resolution_x,scene.render.resolution_y=((1100,730) if mode.startswith('detail') else (1580,1460))
if mode=='plan':scene.render.resolution_x=1150;scene.render.resolution_y=1150
if mode.startswith('eye'):scene.render.resolution_x=1040;scene.render.resolution_y=540
if mode.startswith(('courier','ledge')) or mode=='lab':scene.render.resolution_x=1460;scene.render.resolution_y=940
scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
world=bpy.data.worlds.new('Morning fill');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.68,.79,.89,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.55;scene.world=world
if mode.startswith(('eye','ledge')):
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
 if ('vapour-' in path or 'alto-' in path or 'cumulus-' in path or 'aerostat' in path) and fn:
  for poly in me.polygons:poly.use_smooth=True
  me.normals_split_custom_set([norm[i] for i in fn])
 return me
def include(name,path,tex,t):
 ob=bpy.data.objects.new(name,loadmodel(str(path),str(tex)));scene.collection.objects.link(ob);ob.location=(t['posX'],t['posZ'],t['posY']);ob.rotation_euler.z=-math.radians(t.get('rotY',0));ob.scale=(t['scaleX'],t['scaleZ'],t['scaleY']);return ob
if mode=='fleet-proof':
 sys.path.insert(0,str(R/'src'))
 from review_airspace import portraits
 portraits(globals())
 sys.exit(0)
p=json.loads((O/'Play-Table.json').read_text());obs=[o for o in p['ObjectStates'] if 'LoboMap:cb7100' in o.get('Tags',[])];cur={o['GUID'] for o in obs}
if inside:
 for o in obs:
  if o.get('States'):cur.discard(o['GUID']);cur.add(o['States']['1']['GUID'])
for o in obs:
 if o.get('States') and inside and (mode=='interiors' or o['GUID']=='892359'):o=o['States']['1']
 if mode.startswith('courier') and o['GUID'] not in ('892359','2094a3'):continue
 if mode.startswith('corner-') and not o.get('CustomMesh',{}).get('MeshURL','').endswith('tower-b-2.obj'):continue
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
 mesh_path=(W/'fleet/old-mesh'/name) if mode=='corner-before' else file3(name)
 texture_path=file3('civic-r2.jpg') if mode=='corner-before' else file3(tex)
 parent=include(o['Nickname'],mesh_path,texture_path,t)
 for child in o.get('ChildObjects',[]):
  cm=child['CustomMesh'];ch=include(child['Nickname'],file3(cm['MeshURL'].split('/')[-1]),file3(cm['DiffuseURL'].split('/')[-1]),child['Transform']);ch.parent=parent
# A dark studio ground keeps attention on the playable footprint and grounds the shadows.
ground=None
if not mode.startswith(('eye','ledge')):
 bpy.ops.mesh.primitive_plane_add(size=900,location=(0,0,.85));ground=bpy.context.object;g=bpy.data.materials.new('Studio slate');g.diffuse_color=(.028,.043,.055,1);ground.data.materials.append(g)
def sun(loc,target,energy,size):
 data=bpy.data.lights.new('Daylight','SUN');data.energy=energy;data.angle=math.radians(size);ob=bpy.data.objects.new('Daylight',data);scene.collection.objects.link(ob);ob.location=loc;ob.rotation_euler=(Vector(target)-Vector(loc)).to_track_quat('-Z','Y').to_euler()
sun((-30,-50,75),(0,0,1),3.1,15)
camera=bpy.data.cameras.new('Board camera');cam=bpy.data.objects.new('Camera',camera);scene.collection.objects.link(cam);scene.camera=cam;camera.type='ORTHO'
if mode=='roofs':aim=(0,0,6.1);loc=(22,-70,84);size=66
elif mode=='interiors':aim=(0,0,5);loc=(8,-29,108);size=58
elif mode=='plan':aim=(0,0,7);loc=(0,-.0001,155);size=52
elif mode.startswith('courier'):
 aim=(-18.95,15.125,5.2 if not inside else 4.1);loc=(-33.5,-9.,22.);size=19.3
elif mode=='cloud-detail':
 aim=(6.13,5.52,11.2);loc=(14.7,.7,15.0);size=12.5
elif mode.startswith('corner-'):
 aim=(1.5,-23.65,5.85);loc=(16.5,-44.8,12.9);size=11.8
 scene.render.resolution_x=1120;scene.render.resolution_y=650
elif mode=='lab':
 aim=(13.0,-23.82,2.67);loc=(11.8,-32.,5.2);size=7.9
elif mode.startswith('ledge'):
 options={'ledge':((18.1,5.65,2.0),(22.5,8.5,14.1),31),
          'ledge-east':((21.9,5.0,1.12),(22.2,3.5,9.1),41),
          'ledge-north':((-10.55,18.8,1.1),(-11.3,20.5,10.8),38)}
 aim,loc,camera.lens=options[mode];size=10
 camera.type='PERSP';camera.clip_start=.04
elif mode=='detail-green':aim=(-15.935,-15.58,8.61);loc=(-29,-23.9,18.5);size=9.7
elif mode.startswith('eye'):
 spec=json.loads((W/'los-audit.json').read_text())['examples'][int(mode[-1])];a,b=spec['a'],spec['b'];loc=(a[0],a[2],a[1]);aim=(b[0],b[2],b[1]);size=10
 camera.type='PERSP';camera.lens=34;camera.clip_start=.02
else:aim=(.55,.30,4.80);loc=(2,-23,46);size=11
cam.location=loc;cam.rotation_euler=(Vector(aim)-Vector(loc)).to_track_quat('-Z','Y').to_euler();camera.ortho_scale=size;camera.clip_end=500
if mode in ('roofs','interiors') or mode.startswith('courier'):
 bpy.context.view_layer.update()
 orient=cam.rotation_euler.to_matrix();inv=orient.transposed();bounds=[]
 for ob in scene.objects:
  if ob.type=='MESH' and ob!=ground:
   bounds.extend(inv@(ob.matrix_world@Vector(v)) for v in ob.bound_box)
 xmin,xmax=min(p.x for p in bounds),max(p.x for p in bounds);ymin,ymax=min(p.y for p in bounds),max(p.y for p in bounds)
 cp=inv@cam.location;cam.location+=orient@Vector(((xmin+xmax)/2-cp.x,(ymin+ymax)/2-cp.y,0))
 camera.ortho_scale=max(xmax-xmin,(ymax-ymin)*scene.render.resolution_x/scene.render.resolution_y)*1.085
name={'roofs':'Cloudbreak-Array-R4-Rooftops.png','ledge':'Cloudbreak-Array-R4-Skybridge.png'}
import os
if os.getenv('CLOUDBREAK_PROOF'):
 scene.render.resolution_percentage=52;scene.cycles.samples=5;scene.cycles.use_denoising=False
 scene.render.filepath=str(W/(mode+'-proof.png'))
else:scene.render.filepath=str(O/name[mode] if mode in name else W/(mode+'.png'))
if mode=='corner-orbit':
 scene.render.resolution_x=800;scene.render.resolution_y=460;scene.cycles.samples=6
 for frame in range(20):
  angle=.57+.32*math.sin(math.tau*frame/20);cam.location=Vector(aim)+Vector((21*math.sin(angle),-21*math.cos(angle),6.25))
  cam.rotation_euler=(Vector(aim)-cam.location).to_track_quat('-Z','Y').to_euler()
  scene.render.filepath=str(W/'fleet'/('orbit-%02d.png'%frame));bpy.ops.render.render(write_still=True)
else:bpy.ops.render.render(write_still=True)
