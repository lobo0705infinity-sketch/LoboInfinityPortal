import bpy,math,pathlib,json,hashlib,re,sys,ast,types
from mathutils import Vector
ROOT=pathlib.Path('/workspace/scratch/0a8319f0878e');ASSETS=ROOT/'aurora-source/assets/tts/aurora-visual-20261114';OUT=ROOT/'inspection/final-renders';OUT.mkdir(exist_ok=True)
tree=ast.parse((ROOT/'aurora-source/scripts/aurora-visual-refresh-20261114.py').read_text());ns={'re':re};exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in ('role_for','sign_for')],type_ignores=[]),'roles','exec'),ns);mod=types.SimpleNamespace(**ns)
data=json.load(open(ROOT/'baseline/Workshop-Save.json'));themes=json.load(open(ROOT/'inspection/themes.json'));inv={r['guid']:r for r in json.load(open(ROOT/'inspection/asset-inventory.json'))['bags']};themed={t[1]:t for t in themes}
jobs=[];seen=set()
for bag in data['ObjectStates']:
 if bag.get('GUID') not in inv:continue
 loc=re.sub(r' R\d+$','',bag['Nickname'].split(' · ')[1]);t=themed[loc];slug=t[0]
 if slug in seen:continue
 seen.add(slug)
 objs=[o for o in bag['ContainedObjects'] if o.get('GUID') in inv[bag['GUID']]['buildings']]
 o=objs[0];role=mod.role_for(o.get('Nickname',''));sign=mod.sign_for(o.get('Nickname',''),t);paths=[]
 for st in [o,*o.get('States',{}).values()]:
  m=st['CustomMesh'];key=(m['MeshURL'],m['DiffuseURL'],slug,role,sign);name=slug+'-'+hashlib.sha256('|'.join(map(str,key)).encode()).hexdigest()[:14]+'.obj';paths.append((ASSETS/name,st['Transform']))
 if not all(p.exists() for p,tf in paths):continue
 if (OUT/(slug+'.png')).exists():continue
 jobs.append((slug,paths[:2]))
for slug,paths in jobs:
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 for mat in list(bpy.data.materials):bpy.data.materials.remove(mat)
 mat=bpy.data.materials.new(slug);mat.use_nodes=True;nodes=mat.node_tree.nodes;tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(ASSETS/(slug+'.png')),check_existing=True);mat.node_tree.links.new(tex.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color']);nodes.get('Principled BSDF').inputs['Roughness'].default_value=.68
 objects=[];sizes=[]
 for p,tf in paths:
  bpy.ops.wm.obj_import(filepath=str(p),forward_axis='Z',up_axis='Y');obj=bpy.context.selected_objects[0];obj.data.materials.clear();obj.data.materials.append(mat)
  obj.scale=(tf['scaleX'],tf['scaleZ'],tf['scaleY']);bpy.context.view_layer.update();pts=[obj.matrix_world@Vector(v) for v in obj.bound_box];lo=Vector(tuple(min(p[i] for p in pts) for i in range(3)));hi=Vector(tuple(max(p[i] for p in pts) for i in range(3)));obj.location-=Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z));objects.append(obj);sizes.append(hi-lo)
 width=max(s.x for s in sizes);depth=max(s.y for s in sizes);height=max(s.z for s in sizes);sep=width+2
 for i,obj in enumerate(objects):obj.location.x=(i-(len(objects)-1)/2)*sep+obj.location.x
 extent=max(sep*len(objects),depth*1.8,height*2.5)
 bpy.ops.mesh.primitive_plane_add(size=extent*8,location=(0,0,-.035));floor=bpy.context.object;fm=bpy.data.materials.new('Backdrop');fm.diffuse_color=(.17,.2,.23,1);floor.data.materials.append(fm)
 world=bpy.context.scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.5,.58,.68,1);world.node_tree.nodes['Background'].inputs[1].default_value=.8
 for xyz,power,size in [((.3,-.6,1),80,1),((-.6,.5,.8),60,.7),((.6,.6,.9),50,.7)]:
  pos=Vector(xyz)*extent;bpy.ops.object.light_add(type='AREA',location=pos);light=bpy.context.object;light.data.energy=power*extent;light.data.size=size*extent;light.rotation_euler=(Vector((0,0,height*.4))-pos).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add(location=Vector((.55,-.9,.8))*extent);cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,height*.4))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=extent*1.07;bpy.context.scene.camera=cam
 s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=12;s.cycles.use_denoising=False;s.render.resolution_x=1200;s.render.resolution_y=760;s.render.resolution_percentage=100;s.render.filepath=str(OUT/(slug+'.png'));s.view_settings.view_transform='AgX';bpy.ops.render.render(write_still=True);print('RENDERED',slug,flush=True)
