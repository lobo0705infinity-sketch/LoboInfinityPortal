import os
os.environ['PYOPENGL_PLATFORM']='egl'
import numpy as np
np.infty=np.inf
import pyrender,trimesh
from PIL import Image,ImageDraw,ImageFont
import build_hut as b

def pose(eye,target):
 eye=np.array(eye,float);target=np.array(target,float);z=eye-target;z/=np.linalg.norm(z);x=np.cross([0,1,0],z);x/=np.linalg.norm(x);y=np.cross(z,x);p=np.eye(4);p[:3,:3]=np.stack([x,y,z],axis=1);p[:3,3]=eye;return p
for view in [3,2,1]:
 ps,_=b.build(view);scene=pyrender.Scene(bg_color=[.025,.035,.055,1],ambient_light=[.42,.42,.42]);texture=b.atlas
 # Material batches permit emissive lanterns and artwork without extra scene objects in TTS.
 for emissive in [False,True]:
  subset=[p for p in ps if (p[2]in ['amber','sign','cyan','pink'])==emissive];v,f,uv=b.merge(subset);v[:,0]*=-1;f=f[:,::-1]
  if len(v)==0:continue
  mesh=trimesh.Trimesh(vertices=v,faces=f,process=False);mesh.visual=trimesh.visual.texture.TextureVisuals(uv=uv,image=texture)
  mat=pyrender.MetallicRoughnessMaterial(baseColorTexture=texture,metallicFactor=.05,roughnessFactor=.85,doubleSided=True,emissiveTexture=texture if emissive else None,emissiveFactor=[.55]*3 if emissive else None)
  scene.add(pyrender.Mesh.from_trimesh(mesh,material=mat,smooth=False))
 ground=trimesh.creation.box(extents=[18,.15,16]);ground.apply_translation([0,-.14,0]);scene.add(pyrender.Mesh.from_trimesh(ground,material=pyrender.MetallicRoughnessMaterial(baseColorFactor=[.09,.12,.15,1],roughnessFactor=1)))
 for eye,power,col in [([4,20,-15],2.5,[1,.88,.75]),([-10,10,7],1.6,[.45,.75,1])]:scene.add(pyrender.DirectionalLight(color=col,intensity=power),pose=pose(eye,[0,2,0]))
 target=[0,3,0] if view==3 else [0,2,0];eye=[15,12,-21] if view==3 else [13,19,-18]
 scene.add(pyrender.PerspectiveCamera(yfov=.60,znear=.1,zfar=100),pose=pose(eye,target))
 r=pyrender.OffscreenRenderer(1400,1200);rgb,_=r.render(scene);r.delete();im=Image.fromarray(rgb);d=ImageDraw.Draw(im);d.rectangle((0,0,1400,75),fill=(15,21,29));fnt=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',28);d.text((25,18),'LO-BO’S NOODLE HUT / '+{3:'EXTERIOR',2:'UPPER FLOOR',1:'GROUND FLOOR'}[view],font=fnt,fill=(244,230,196));d.text((25,1160),'Actual exported geometry and textures · TTS playtest pending',font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',21),fill=(208,216,225));im.save(b.ROOT/'review'/f'view-{view}.png');print('rendered',view,flush=True)
