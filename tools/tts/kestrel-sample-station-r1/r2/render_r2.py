from common import *
from assemble_r2 import build
import render

def prepare():
    for name in ['tech-coffin.obj','tech-coffin.png']:
        target=W/name
        if not target.exists():target.symlink_to(WORK/name)
    render.WORK=W;render.build_bag=build;render.local=resource
    render.manifest()
    src=(ROOT/'src/blender_scene.py').read_text()
    src=src.replace("R=Path(__file__).resolve().parents[1];W=R/'work'","W=Path(__file__).resolve().parent")
    src=src.replace("sc.cycles.samples=9;sc.cycles.use_denoising=False","sc.cycles.samples=16;sc.cycles.use_denoising=False")
    src=src.replace("(0,0,-1,0),(0,1,0,0)","(0,0,1,0),(0,1,0,0)").replace("(p[0],-p[2],p[1])","(p[0],p[2],p[1])")
    views=[('overview',(56,49,-14),(0,6.7,0),67,1510,1080),('overhead',(.001,85,0),(0,6.2,0),50,1280,1280),
      ('west',(-37,16,-8.84),(-20.1,6.46,-8.84),14.0,1152,730),
      ('assay',(5.7,18.1,-15.6),(15.6,7.90,-7.7),10.50,1120,720),
      ('algae',(-12.0,24,-13.7),(-12.0,7.15,-9.13),6.55,1120,720),
      ('bay',(20.55,18.25,9.4),(22.40,7.06,16.98),7.70,1120,720),
      ('cartway',(23.7,33.6,-9.7),(12.82,7.24,-14.0),20.9,1120,720)]
    begin=src.index('views=');end=src.index("if '--'",begin)
    src=src[:begin]+'views='+repr(views)+'\n'+src[end:]
    (W/'blender-r2.py').write_text(src)
if __name__=='__main__':prepare()
