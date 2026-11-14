import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from render_models import *
manifest=json.loads((ROOT/'figure-manifest.json').read_text())
for key in ['lagash-guard','lagash-levy','umma-spears','umma-slingers','lagash-command-army','umma-command-army','lagash-command-left','umma-command-right','lagash-cart-0','umma-cart-1','lagash-cart-2']:
 for state in ([0,1] if manifest[key]['command'] else [0,1,2] if key in ['lagash-guard','lagash-cart-0'] else [0]):
  for front in ([True,False] if state==0 or manifest[key]['command'] else [False]):
   out=OUT/f'{key}-{state}-{"front" if front else "rear"}.png'
   clear();v=manifest[key];obj=mesh(ASSETS/v['meshes'][state],ASSETS/v['textures'][state])
   height=max(v.co.z for v in obj.data.vertices)
   scene((0,8 if front else -8,5.5),(0,0,height*.43),max(4,height+1.1))
   bpy.context.scene.render.filepath=str(out);bpy.ops.render.render(write_still=True)
