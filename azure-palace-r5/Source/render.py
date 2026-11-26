"""Render the textures and OBJ geometry referenced by the actual TTS save."""
import bpy, json, math, sys
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[1]
OLD=R.parent/'azure2'
modes=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['overview','pool','room','previous']
def render(mode):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene=bpy.context.scene
    path=(R.parent/'azure4' if mode in ('before','door-before') else R)/'Release'/'Play-Table.json'
    roots=[o for o in json.loads(path.read_bytes())['ObjectStates'] if any(t.startswith('LoboMap:') for t in o.get('Tags',[])) and o.get('CustomMesh')]
    materials={}; meshes={}
    def local(url):
        name=url.rsplit('/',1)[-1]
        if '/azure-palace-r5/' in url: folders=(R/'Assets',)
        elif '/azure-palace-r4/' in url: folders=(R.parent/'azure4'/'Assets',)
        elif '/azure-palace-r2/' in url: folders=(OLD/'Assets',)
        else: folders=(OLD/'original'/'Assets',OLD/'original'/'deps')
        for d in folders:
            if (d/name).is_file():return d/name
        raise FileNotFoundError(url)
    def material(file):
        if file not in materials:
            m=bpy.data.materials.new(file.stem);m.use_nodes=True
            nodes=m.node_tree.nodes;shader=nodes.get('Principled BSDF')
            tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(file),check_existing=True)
            m.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])
            shader.inputs['Roughness'].default_value=.75
            shader.inputs['Specular IOR Level'].default_value=.22
            materials[file]=m
        return materials[file]
    def model(m):
        file,tex=local(m['MeshURL']),local(m['DiffuseURL']);key=(file,tex)
        if key in meshes:return meshes[key]
        vertices=[];uv=[];faces=[];face_uv=[]
        for line in file.read_text().splitlines():
            bits=line.split()
            if not bits:continue
            if bits[0]=='v':
                x,y,z=map(float,bits[1:4]);vertices.append((-x,z,y))
            elif bits[0]=='vt':uv.append(tuple(map(float,bits[1:3])))
            elif bits[0]=='f':
                f=[p.split('/')for p in bits[1:]]
                faces.append([int(p[0])-1 for p in f])
                face_uv.append([int(p[1])-1 if len(p)>1 and p[1] else -1 for p in f])
        mesh=bpy.data.meshes.new(file.stem);mesh.from_pydata(vertices,[],faces);mesh.update();mesh.materials.append(material(tex))
        layer=mesh.uv_layers.new()
        for poly,ui in zip(mesh.polygons,face_uv):
            for li,j in zip(poly.loop_indices,ui):layer.data[li].uv=uv[j] if j>=0 else (0,0)
        meshes[key]=mesh;return mesh
    def add(root,t,at_origin=False):
        mesh=root.get('CustomMesh')
        if mesh:
            obj=bpy.data.objects.new(root['Nickname'],model(mesh));bpy.context.collection.objects.link(obj)
            if not at_origin:obj.location=(t['posX'],t['posZ'],t['posY']-3.9);obj.rotation_euler[2]=math.radians(-t['rotY'])
            obj.scale=(t['scaleX'],t['scaleZ'],t['scaleY'])
        for child in root.get('ChildObjects',[]):
            ct=child['Transform']
            assert all(ct[k]==0 for k in ('posX','posY','posZ','rotX','rotY','rotZ'))
            add(child,t,at_origin)
    room={'door-before':'Terrace Restaurant','door-after':'Terrace Restaurant','plant':'Pool Equipment Room','terrace':'Terrace Restaurant','spa':'Azure Spa'}.get(mode)
    data=next((o for o in roots if o.get('Nickname')==room),None)
    for o in roots:
        if room and o['Nickname']!=room and 'recessed resort ground' not in o['Nickname']:continue
        add(o,o['Transform'])
    detail=False
    def framepoint(obj,u,v,h):
        t=obj['Transform'];a=math.radians(t['rotY']);return (t['posX']+math.cos(a)*u+math.sin(a)*v,t['posZ']-math.sin(a)*u+math.cos(a)*v,h)
    if True:
        bpy.ops.mesh.primitive_plane_add(size=400,location=(0,0,-.013 if detail else -3.03))
        m=bpy.data.materials.new('Backdrop');m.diffuse_color=(.12,.157,.168,1);bpy.context.object.data.materials.append(m)
    world=bpy.data.worlds.new('Coastal daylight');scene.world=world;world.use_nodes=True
    bg=world.node_tree.nodes['Background'];bg.inputs[0].default_value=(.70,.80,.91,1);bg.inputs[1].default_value=.55
    bpy.ops.object.light_add(type='SUN',location=(-10,-22,35))
    sun=bpy.context.object;sun.rotation_euler=(Vector((0,0,0))-sun.location).to_track_quat('-Z','Y').to_euler();sun.data.energy=2.25;sun.data.angle=.17
    bpy.ops.object.light_add(type='AREA',location=(-15,-22,40));light=bpy.context.object;light.data.energy=10500;light.data.shape='DISK';light.data.size=27
    light.rotation_euler=(Vector((0,0,0))-light.location).to_track_quat('-Z','Y').to_euler()
    if mode in ('door-before','door-after'):
        # Same cut, lens and camera. A physical-size round base marks the opening in each proof only.
        t=0 if mode=='door-before' else .73
        cx,cz,cy=framepoint(data,t,3.67,.245)
        bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=25/25.4/2,depth=.095,location=(cx,cz,cy+.0475))
        mat=bpy.data.materials.new('25 mm reference base');mat.diffuse_color=(.042,.065,.064,1);bpy.context.object.data.materials.append(mat)
        bpy.ops.mesh.primitive_torus_add(major_segments=64,minor_segments=6,major_radius=.444,minor_radius=.011,location=(cx,cz,cy+.10))
        mat=bpy.data.materials.new('Reference rim');mat.diffuse_color=(.87,.65,.20,1);bpy.context.object.data.materials.append(mat)
        pos=framepoint(data,.41,11.0,2.72);target=framepoint(data,.41,2.88,1.49);scale=5.1;size=(930,720)
    elif mode=='plant':
        pos=framepoint(data,9.2,-6.0,6.5);target=framepoint(data,3.45,-.10,1.18);scale=11.1;size=(1150,845)
    elif mode=='terrace':
        pos=framepoint(data,-10.8,-8.8,7.9);target=framepoint(data,-3.78,-.70,1.12);scale=13.2;size=(1150,845)
    elif mode=='spa':
        pos=framepoint(data,12.7,-9.7,9.1);target=framepoint(data,4.95,-.18,.89);scale=13.3;size=(1100,805)
    elif mode=='overhead':
        pos=(0,0,75);target=(0,0,0);scale=51.8;size=(1200,1200)
    elif mode.startswith('sweep'):
        num=int(mode.removeprefix('sweep'));ang=math.radians(14+num*45);pos=(61*math.cos(ang),61*math.sin(ang),35+3*(num%2));target=(0,0,1.0);scale=69;size=(660,475)
    else:
        pos=(64,-6,62);target=(0,0,1.05);scale=58.8;size=(1600,1250)
    bpy.ops.object.camera_add(location=pos);cam=bpy.context.object
    cam.rotation_euler=(0,0,0) if mode in ('overhead','oldtop') else (Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO';cam.data.ortho_scale=scale;scene.camera=cam
    scene.render.engine='CYCLES';scene.cycles.samples=10 if mode.startswith('sweep') else 28;scene.cycles.use_denoising=False
    scene.render.resolution_x,scene.render.resolution_y=size;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGB';scene.view_settings.view_transform='AgX'
    scene.render.filepath=str(R/'Review'/(mode+'.png'));bpy.ops.render.render(write_still=True)
for mode in modes:render(mode)
