import bpy, math, json
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
ASSETS=ROOT/'assets';OUT=ROOT/'render'
OUT.mkdir(exist_ok=True)

def clear():
    bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)

def material(path):
    mat=bpy.data.materials.new(path.stem);mat.use_nodes=True
    bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.85
    tex=mat.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(path),check_existing=True)
    mat.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
    # TTS's opaque, single-sided mesh faces are culled from the reverse side.
    # Explicit culling in Cycles also reveals winding mistakes during inspection.
    output=mat.node_tree.nodes.get('Material Output')
    geo=mat.node_tree.nodes.new('ShaderNodeNewGeometry')
    mix=mat.node_tree.nodes.new('ShaderNodeMixShader')
    transparent=mat.node_tree.nodes.new('ShaderNodeBsdfTransparent')
    mat.node_tree.links.new(geo.outputs['Backfacing'],mix.inputs[0])
    mat.node_tree.links.new(bs.outputs['BSDF'],mix.inputs[1])
    mat.node_tree.links.new(transparent.outputs[0],mix.inputs[2])
    mat.node_tree.links.new(mix.outputs[0],output.inputs['Surface'])
    return mat

def mesh(path,texture,location=(0,0,0)):
    vertices=[];uvs=[];faces=[]
    for line in path.read_text().splitlines():
        bits=line.split()
        if not bits:continue
        if bits[0]=='v':x,y,z=map(float,bits[1:4]);vertices.append((-x,z,y))
        elif bits[0]=='vt':uvs.append(tuple(map(float,bits[1:3])))
        elif bits[0]=='f':faces.append([tuple(int(x)-1 for x in b.split('/')[:2]) for b in bits[1:]])
    m=bpy.data.meshes.new(path.stem);m.from_pydata(vertices,[],[[v[0] for v in f] for f in faces]);m.update()
    uv=m.uv_layers.new(name='UVMap')
    for poly,face in zip(m.polygons,faces):
        for loop,(vi,ti) in zip(poly.loop_indices,face):uv.data[loop].uv=uvs[ti]
    obj=bpy.data.objects.new(path.stem,m);bpy.context.collection.objects.link(obj);obj.location=location
    obj.data.materials.append(material(texture))
    obj.visible_shadow=False
    return obj

def scene(camera_location,target,scale=4.7):
    s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=8;s.cycles.use_denoising=False;s.cycles.transparent_max_bounces=64
    s.world.color=(.32,.32,.32)
    bpy.ops.object.camera_add(location=camera_location);cam=bpy.context.object
    cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=scale;s.camera=cam
    for loc,energy,size in [((4,-4,8),1000,7),((-4,3,5),700,6)]:
        bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.data.energy=energy;l.data.shape='DISK';l.data.size=size
        l.rotation_euler=(Vector(target)-l.location).to_track_quat('-Z','Y').to_euler()
    s.render.resolution_x=700;s.render.resolution_y=760;s.render.resolution_percentage=100
    s.view_settings.view_transform='Standard';s.view_settings.look='Medium High Contrast' if 'Medium High Contrast' in [i.identifier for i in s.view_settings.bl_rna.properties['look'].enum_items] else 'None'
    s.render.image_settings.file_format='PNG';s.render.film_transparent=False

