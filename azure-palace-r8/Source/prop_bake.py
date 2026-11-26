"""Bake nondirectional contact shading and original materials to a mip-safe diffuse texture for each TTS mesh."""
from pathlib import Path
import json,math,sys
import bpy
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'Assets';SRC=ROOT/'Review/unbaked'

def parse(path):
    verts=[];tex=[];normals=[];faces=[];indices=[]
    for ln in path.read_text().splitlines():
        a=ln.split()
        if not a:continue
        if a[0]=='v':
            x,y,z=map(float,a[1:]);verts.append((-x,z,y))
        elif a[0]=='vt':tex.append(tuple(map(float,a[1:])))
        elif a[0]=='vn':
            x,y,z=map(float,a[1:]);normals.append((-x,z,y))
        elif a[0]=='f':
            row=[tuple(int(i)-1 for i in p.split('/'))for p in a[1:]]
            indices.append(row);faces.append([p[0]for p in row])
    return verts,tex,normals,faces,indices

def bake(slug):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    v,uv,norm,f,corner=parse(SRC/(slug+'.obj'))
    mesh=bpy.data.meshes.new(slug);mesh.from_pydata(v,[],f);mesh.update()
    obj=bpy.data.objects.new(slug,mesh);bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active=obj;obj.select_set(True)
    base=mesh.uv_layers.new(name='Source finishes')
    for poly,row in zip(mesh.polygons,corner):
        poly.use_smooth=True
        for loop,p in zip(poly.loop_indices,row):base.data[loop].uv=uv[p[1]]
    mesh.normals_split_custom_set([norm[p[2]]for row in corner for p in row])
    base_name='Source finishes'
    unique=mesh.uv_layers.new(name='Finished prop');mesh.uv_layers.active=unique;unique.active_render=True
    bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(64),island_margin=.0025,margin_method='FRACTION',area_weight=.25,correct_aspect=True,scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    mat=bpy.data.materials.new('Weathered resort finishes');obj.data.materials.append(mat);mat.use_nodes=True
    nt=mat.node_tree;nt.nodes.clear();nodes=nt.nodes
    uvnode=nodes.new('ShaderNodeUVMap');uvnode.uv_map=base_name
    src=nodes.new('ShaderNodeTexImage');src.image=bpy.data.images.load(str(SRC/'resort-prop-finishes.jpg'))
    nt.links.new(uvnode.outputs['UV'],src.inputs['Vector'])
    ao=nodes.new('ShaderNodeAmbientOcclusion');ao.samples=18;ao.inputs['Distance'].default_value=.33;ao.only_local=True
    mix=nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=.56
    nt.links.new(src.outputs['Color'],mix.inputs[1]);nt.links.new(ao.outputs['Color'],mix.inputs[2])
    shader=nodes.new('ShaderNodeEmission');nt.links.new(mix.outputs[0],shader.inputs[0])
    out=nodes.new('ShaderNodeOutputMaterial');nt.links.new(shader.outputs[0],out.inputs['Surface'])
    target=nodes.new('ShaderNodeTexImage');img=bpy.data.images.new(slug,width=1536,height=1536,alpha=False);target.image=img;nodes.active=target
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=2;scene.cycles.device='CPU'
    scene.view_settings.view_transform='Standard';scene.render.image_settings.file_format='JPEG';scene.render.image_settings.quality=91
    bpy.ops.object.bake(type='EMIT',margin=7,margin_type='EXTEND',uv_layer='Finished prop')
    img.save_render(str(OUT/(slug+'-diffuse.jpg')),scene=scene)
    # Preserve the original vertices, shading and TTS handedness. Only UVs have changed.
    lines=['# Azure Palace | '+slug+' | baked contact shadows','g '+slug]
    lines+=['v %.6f %.6f %.6f'%(-x,z,y)for x,y,z in v]
    lines+=['vn %.6f %.6f %.6f'%(-x,z,y)for x,y,z in norm]
    coords={};tris=[]
    layer=mesh.uv_layers['Finished prop']
    for poly,row in zip(mesh.polygons,corner):
        new=[]
        for loop,p in zip(poly.loop_indices,row):
            key=tuple(round(float(k),7) for k in layer.data[loop].uv);j=coords.setdefault(key,len(coords)+1)
            new.append(f'{p[0]+1}/{j}/{p[2]+1}')
        tris.append('f '+' '.join(new))
    lines+=['vt %.7f %.7f'%xy for xy in coords]
    (OUT/(slug+'.obj')).write_text('\n'.join(lines+tris)+'\n')
    print('Baked',slug,len(f),'triangles;',len(coords),'unique UVs',flush=True)
if __name__=='__main__':
    items=sys.argv[sys.argv.index('--')+1:] if '--'in sys.argv else [item['slug'] for item in json.loads((ROOT/'Source/scatter.json').read_text())]
    for item in items:bake(item)
