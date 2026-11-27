"""Render the playtest OBJ assets and native Tech-Coffin prefab without changing the save."""
import bpy,json, math, sys
from mathutils import Matrix,Vector
from pathlib import Path
W=Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True);sc=bpy.context.scene
sc.render.engine='CYCLES';sc.cycles.samples=16;sc.cycles.use_denoising=False;sc.cycles.max_bounces=4;sc.cycles.transparent_max_bounces=5
sc.world=bpy.data.worlds.new('Lunar skylight');sc.world.use_nodes=True;bg=sc.world.node_tree.nodes.get('Background');bg.inputs[0].default_value=(.29,.34,.40,1);bg.inputs[1].default_value=.58
sc.render.film_transparent=True;sc.render.image_settings.file_format='PNG';sc.render.image_settings.color_mode='RGBA';sc.render.resolution_percentage=100
sc.view_settings.view_transform='AgX';sc.view_settings.exposure=.1
mats={};meshes={};imgs={}
def material(path,rgba,glass):
    key=(path,tuple(rgba),glass)
    if key in mats:return mats[key]
    m=bpy.data.materials.new(Path(path).name or 'Mission base');m.use_nodes=True;n=m.node_tree.nodes;links=m.node_tree.links;bs=n.get('Principled BSDF')
    bs.inputs['Roughness'].default_value=.32 if glass else .78
    if glass:
        bs.inputs['Base Color'].default_value=(*rgba[:3],1);bs.inputs['Alpha'].default_value=max(.045,min(.11,rgba[3]*.23));bs.inputs['Metallic'].default_value=.20
    elif path:
        if path not in imgs:imgs[path]=bpy.data.images.load(path,check_existing=True)
        tex=n.new('ShaderNodeTexImage');tex.image=imgs[path];mul=n.new('ShaderNodeMixRGB');mul.blend_type='MULTIPLY';mul.inputs[0].default_value=1;mul.inputs[2].default_value=(*rgba[:3],1)
        links.new(tex.outputs['Color'],mul.inputs[1]);links.new(mul.outputs[0],bs.inputs['Base Color'])
    else:bs.inputs['Base Color'].default_value=(*rgba[:3],1)
    mats[key]=m;return m
def mesh_for(row):
    key=(row['mesh'],row['image'],tuple(row['rgba']),row['glass'])
    if key in meshes:return meshes[key]
    vs=[];uv=[];faces=[];coords=[]
    for line in Path(row['mesh']).read_text(errors='replace').splitlines():
        cols=line.split()
        if not cols:continue
        if cols[0]=='v':vs.append((-float(cols[1]),float(cols[2]),float(cols[3])))
        elif cols[0]=='vt':uv.append((float(cols[1]),float(cols[2])))
        elif cols[0]=='f':
            ids=[q.split('/')for q in reversed(cols[1:])];faces.append([int(q[0])-1 for q in ids]);coords.extend([uv[int(q[1])-1] if len(q)>1 and q[1] else (0,0) for q in ids])
    geo=bpy.data.meshes.new(row['name']);geo.from_pydata(vs,[],faces);geo.update()
    if coords:
        layer=geo.uv_layers.new(name='Actual OBJ UVs');layer.data.foreach_set('uv',[c for pt in coords for c in pt])
    geo.materials.append(material(row['image'],row['rgba'],row['glass']));meshes[key]=geo;return geo
basis=Matrix(((1,0,0,0),(0,0,1,0),(0,1,0,0),(0,0,0,1)))
for row in json.loads((W/'render-scene.json').read_bytes()):
    mesh=mesh_for(row);ob=bpy.data.objects.new(row['name'],mesh);sc.collection.objects.link(ob);ob.matrix_world=basis@Matrix(row['t'])
sun=bpy.data.lights.new('Low-angle sunlight','SUN');sun.energy=3.6;sun.angle=math.radians(3);lamp=bpy.data.objects.new('Sun',sun);sc.collection.objects.link(lamp);lamp.rotation_euler=Vector((.58,-.64,-1.20)).to_track_quat('-Z','Y').to_euler()
camera=bpy.data.cameras.new('Table');c=bpy.data.objects.new('Table',camera);sc.collection.objects.link(c);sc.camera=c;camera.type='ORTHO';camera.clip_end=350
def tt(p):return Vector((p[0],p[2],p[1]))
views=[('overhead', (0.001, 85, 0), (0, 6.2, 0), 50, 1280, 1280), ('overview', (62, 69, 0), (0, 6.55, 0), 57, 1480, 1120), ('crew', (32.0, 26.8, 7.1), (13.0, 7.25, 13.06), 21.5, 1000, 690), ('science', (-30.0, 26.0, 2.2), (-13.0, 7.3, -9.0), 25.1, 1100, 710)]
if '--' in sys.argv:
    names=sys.argv[sys.argv.index('--')+1:];views=[v for v in views if v[0] in names]
for name,eye,look,scale,w,h in views:
    c.location=tt(eye);c.rotation_euler=(tt(look)-c.location).to_track_quat('-Z','Y').to_euler();camera.ortho_scale=scale;sc.render.resolution_x=w;sc.render.resolution_y=h;sc.render.filepath=str(W/(name+'.png'));bpy.ops.render.render(write_still=True)
