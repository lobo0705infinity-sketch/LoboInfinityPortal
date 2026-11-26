"""Photograph the actual save geometry and diffuse images, including the original console, for visual review."""
from pathlib import Path
import json,math,re,sys
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];CACHE=ROOT/'Review/cache'
def revision(n):
    return next(p for p in (ROOT.parent/f'azure{n}',ROOT.parent/f'azure-palace-r{n}') if p.is_dir())
def local(url):
    name=url.rsplit('/',1)[-1];match=re.search(r'/azure-palace-r(\d+)/',url)
    if match and int(match[1])>1:return revision(int(match[1]))/'Assets'/name
    return next(p/name for p in (revision(2)/'original/Assets',revision(2)/'original/deps')if(p/name).exists())
SPEC={s['slug']:s for s in json.loads((ROOT/'Source/scatter.json').read_bytes())}
jobs={'porter-buggy':((4.55,2.2,2.4),(0,-.04,.83),4.27,'Resort Reception'),
      'pool-loungers':((-2.7,2.1,2.30),(0,.06,.50),3.53,'Sunward Hotel Wing'),
      'banquet-dolly':((2.84,-4.5,2.55),(0,0,.90),3.24,'Terrace Restaurant'),
      'housekeeping-cart':((2.30,-3.71,1.82),(0,0,.70),2.48,'North Guest Villa')}
def render(mode):
    bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene
    show=mode in jobs; mats={};models={}
    def model(file,texture,native=False):
        if file in models:return models[file]
        verts=[];uv=[];norm=[];faces=[];corner=[]
        for line in file.read_text().splitlines():
            a=line.split()
            if not a:continue
            if a[0] in ('v','vn'):
                x,y,z=map(float,a[1:4]);(verts if a[0]=='v' else norm).append((-x,z,y))
            elif a[0]=='vt':uv.append(tuple(map(float,a[1:3])))
            elif a[0]=='f':
                row=[[int(i)-1 if i else None for i in c.split('/')]for c in a[1:]]
                faces.append([c[0]for c in row]);corner.append(row)
        mesh=bpy.data.meshes.new(file.stem);mesh.from_pydata(verts,[],faces);mesh.update()
        layer=mesh.uv_layers.new();use_norm=file.parent==ROOT/'Assets' and bool(norm)
        for p,row in zip(mesh.polygons,corner):
            if use_norm or native:p.use_smooth=True
            for loop,c in zip(p.loop_indices,row):
                if len(c)>1 and c[1] is not None:layer.data[loop].uv=uv[c[1]]
        if use_norm:mesh.normals_split_custom_set([norm[c[2]] for row in corner for c in row])
        if texture not in mats:
            m=bpy.data.materials.new(texture.stem);m.use_nodes=True;nt=m.node_tree
            src=nt.nodes.new('ShaderNodeTexImage');src.image=bpy.data.images.load(str(texture),check_existing=True)
            shader=nt.nodes.get('Principled BSDF');nt.links.new(src.outputs[0],shader.inputs['Base Color'])
            shader.inputs['Roughness'].default_value=.66 if use_norm else .77;shader.inputs['Specular IOR Level'].default_value=.26
            mats[texture]=m
        mesh.materials.append(mats[texture]);models[file]=mesh;return mesh
    def put(o,t):
        m=o.get('CustomMesh')
        if m:mesh=model(local(m['MeshURL']),local(m['DiffuseURL']))
        elif 'CustomAssetbundle' in o:mesh=model(CACHE/'native-console.obj',CACHE/'native-console.jpg',True)
        else:return
        obj=bpy.data.objects.new(o['Nickname'],mesh);bpy.context.collection.objects.link(obj)
        obj.location=(t['posX'],t['posZ'],t['posY']-3.9);obj.rotation_euler.z=-math.radians(t['rotY']);obj.scale=(t['scaleX'],t['scaleZ'],t['scaleY'])
        for child in o.get('ChildObjects',[]):put(child,t)
    play=json.loads((ROOT/'Release/Play-Table.json').read_bytes())
    for o in play['ObjectStates']:
        if 'LoboMap:87b699' not in o.get('Tags',[]) or o['GUID']=='8428d8':continue
        if mode=='console' and 'resort ground' not in o['Nickname'] and 'CustomAssetbundle' not in o:continue
        if show and not ('resort ground' in o['Nickname'] or o['Nickname']==jobs[mode][3] or o['Nickname']==SPEC[mode]['name']):continue
        put(o,o['Transform'])
    if show:
        off,point,ortho,_=jobs[mode];x,y,angle=SPEC[mode]['pose'];c=math.cos(math.radians(angle));s=math.sin(math.radians(angle))
        def world(u,v,z):return Vector((x+c*u+s*v,y-s*u+c*v,z))
        target=world(*point);eye=target+world(*off)-world(0,0,0)
        size=(980,660)
    elif mode=='console':
        target=Vector((0,-12,.64));eye=target+Vector((2.5,-3.6,2.5));ortho=3.35;size=(800,580)
    else:
        target=Vector((0,0,.90));eye=Vector((63.5,-4,65.4));ortho=58.8;size=(1350,1030)
        bpy.ops.mesh.primitive_plane_add(size=400,location=(0,0,-3.03));mat=bpy.data.materials.new('Backdrop');mat.diffuse_color=(.13,.15,.15,1);bpy.context.object.data.materials.append(mat)
    world=bpy.data.worlds.new('Reflected coastal daylight');scene.world=world;world.use_nodes=True
    bg=world.node_tree.nodes.get('Background');bg.inputs[0].default_value=(.76,.84,.93,1);bg.inputs[1].default_value=.72
    bpy.ops.object.light_add(type='SUN',location=(-15,-19,36));sun=bpy.context.object;sun.rotation_euler=(-sun.location).to_track_quat('-Z','Y').to_euler();sun.data.energy=2.15;sun.data.angle=math.radians(8)
    bpy.ops.object.camera_add(location=eye);cam=bpy.context.object;cam.rotation_euler=(target-eye).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=ortho;scene.camera=cam
    # Local fill brings the details out of the real architectural shade.
    if show or mode=='console':
        bpy.ops.object.light_add(type='AREA',location=eye+Vector((0,0,2)));fill=bpy.context.object;fill.data.energy=100;fill.data.shape='DISK';fill.data.size=5.5;fill.rotation_euler=(target-fill.location).to_track_quat('-Z','Y').to_euler()
    scene.render.engine='CYCLES';scene.cycles.samples=18 if show else 10;scene.cycles.use_denoising=False
    scene.render.resolution_x,scene.render.resolution_y=size;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX'
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.render.filepath=str(ROOT/'Review'/(mode+'.png'))
    bpy.ops.render.render(write_still=True)
for mode in (sys.argv[sys.argv.index('--')+1:] if '--'in sys.argv else [*jobs,'console','overview']):render(mode)
