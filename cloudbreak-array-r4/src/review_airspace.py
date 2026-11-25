"""Photograph both broadsides from model space using the exported game OBJ and its own texture."""
import math,sys
from mathutils import Vector
import bpy
def portraits(ctx):
    scene=ctx['scene'];work=ctx['W']/'fleet';work.mkdir(exist_ok=True)
    scene.render.film_transparent=True;scene.render.resolution_x=940;scene.render.resolution_y=420
    scene.cycles.samples=16;scene.cycles.use_denoising=False
    camera=bpy.data.cameras.new('Portrait');cam=bpy.data.objects.new('Camera',camera);scene.collection.objects.link(cam);scene.camera=cam;camera.type='ORTHO'
    light=bpy.data.lights.new('Soft sun','SUN');light.energy=2.8;light.angle=math.radians(20);sun=bpy.data.objects.new('Sun',light);scene.collection.objects.link(sun)
    files=ctx['file3']
    for model,texture in [('moored-aerostat','compass'),('aerostat-ferry','gojal'),('aerostat-survey','vissiorama'),('aerostat-post','shangmei'),('aerostat-service','accesstel')]:
        ob=ctx['include'](model,files(model+'.obj'),files('fleet-'+texture+'.jpg'),dict(posX=0,posY=0,posZ=0,rotY=0,scaleX=1,scaleY=1,scaleZ=1))
        lower=ob.bound_box;low=Vector(tuple(min(v[n] for v in lower) for n in range(3)));hi=Vector(tuple(max(v[n] for v in lower) for n in range(3)))
        aim=(low+hi)*.5;span=hi-low
        for sg in (1,-1):
            cam.location=aim+Vector((sg*11.5,2.35,1.52));cam.rotation_euler=(aim-cam.location).to_track_quat('-Z','Y').to_euler();camera.ortho_scale=max(span.y*1.16,span.z*2.5)
            sun.location=aim+Vector((sg*8,-4,9));sun.rotation_euler=(aim-sun.location).to_track_quat('-Z','Y').to_euler()
            scene.render.filepath=str(work/(texture+('-starboard' if sg==1 else '-port')+'.png'));bpy.ops.render.render(write_still=True)
        bpy.data.objects.remove(ob,do_unlink=True)
