from plan import *
from build_station import build
import render
def prepare():
 for name in ('tech-coffin.obj','tech-coffin.png'):
  path=W/name
  if not path.exists():path.symlink_to(r2.WORK/name)
 render.WORK=W;render.build_bag=build;render.local=resource;render.manifest()
 # Use the same camera basis, material interpretation, and lighting as the R2 comparison.
 from render_r2 import prepare as r2prepare
 src=(r2.W/'blender-r2.py').read_text()
 views=[('overhead',(.001,85,0),(0,6.2,0),50,1280,1280),('overview',(62,69,0),(0,6.55,0),57,1480,1120),('crew',(32.0,26.8,7.1),(13.0,7.25,13.06),21.50,1000,690),('science',(-30.0,26.0,2.20),(-13.0,7.3,-9.0),25.1,1100,710)]
 start=src.index('views=');end=src.index("if '--'",start)
 src=src[:start]+'views='+repr(views)+'\n'+src[end:]
 (W/'blender-r3.py').write_text(src)
 quick=src.replace('sc.cycles.samples=16','sc.cycles.samples=4').replace('resolution_percentage=100','resolution_percentage=65').replace("name+'.png'","name+'-inspect.png'")
 (W/'blender-quick.py').write_text(quick)
if __name__=='__main__':prepare()
