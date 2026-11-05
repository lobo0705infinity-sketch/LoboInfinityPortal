import os
os.environ['PYOPENGL_PLATFORM']='egl'
from pathlib import Path
import json,math
import numpy as np
np.infty=np.inf
import trimesh,pyrender
from PIL import Image,ImageDraw,ImageFont
R=Path(__file__).resolve().parents[1];P=R.parent
roots=[R/'Assets',P/'r4/Assets',P/'build/Assets',P/'r2/Meridian-Exchange-Double-Bind-R2-Review-Installer/Assets']
scene=json.loads(next((R/'PreviewSave').glob('*.json')).read_text());objects=scene['ObjectStates']
def path(u):
 n=u.rsplit('/',1)[-1]
 for root in roots:
  if(root/n).is_file():return root/n
 return None
def look(eye,target):
 eye=np.array(eye,float);eye[2]*=-1;target=np.array(target,float);target[2]*=-1;z=eye-target;z/=np.linalg.norm(z);up=np.array([0,1,0.]);x=np.cross(up,z);x/=np.linalg.norm(x);y=np.cross(z,x);p=np.eye(4);p[:3,:3]=np.column_stack([x,y,z]);p[:3,3]=eye;return p
def item(sc,o,pose=None):
 cm=o.get('CustomMesh');t=o['Transform'];p=np.eye(4)
 # Undo the authored OBJ X reflection, then reflect source Z to convert
 # the Unity left-handed scene and camera together into a right-handed renderer.
 p[:3,3]=[t['posX'],t['posY'],-t['posZ']]
 if pose is not None:p=pose@p
 if cm:
  f=path(cm.get('MeshURL',''));impath=path(cm.get('DiffuseURL',''))
  if f and impath:
   m=trimesh.load(f,force='mesh',process=False);m.apply_transform(np.diag([-1,1,-1,1]));im=Image.open(impath).convert('RGB')
   uv=m.visual.uv if hasattr(m.visual,'uv')else None
   if uv is not None:
    material=pyrender.MetallicRoughnessMaterial(baseColorTexture=pyrender.Texture(source=im,source_channels='RGB'),metallicFactor=0,roughnessFactor=.93,doubleSided=True)
    sc.add(pyrender.Mesh.from_trimesh(m,material=material,smooth=False),pose=p)
 for c in o.get('ChildObjects',[]):item(sc,c,p)
def render(selected,eye,target,scale,filename,title,w=1200,h=1000):
 sc=pyrender.Scene(bg_color=[.16,.20,.22,1],ambient_light=[.55,.55,.55])
 for o in selected:item(sc,o)
 cam=pyrender.OrthographicCamera(xmag=scale*w/h,ymag=scale,znear=.05,zfar=200);sc.add(cam,pose=look(eye,target))
 for e,p in [([-40,70,-30],1.7),([30,45,20],1.1)]:sc.add(pyrender.DirectionalLight(color=np.ones(3),intensity=p),pose=look(e,target))
 rr=pyrender.OffscreenRenderer(w,h);color,depth=rr.render(sc);rr.delete();im=Image.fromarray(color);d=ImageDraw.Draw(im);d.rectangle((0,0,w,55),fill=(18,31,35));d.text((20,15),title,font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',22),fill=(235,231,207));d.rectangle((0,h-30,w,h),fill=(18,31,35));d.text((20,h-25),'ACTUAL EXPORTED GEOMETRY / SOFTWARE RENDER — LIVE TTS REVIEW PENDING',font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',13),fill=(200,204,195));im.save(R/'Review'/filename);print(filename,flush=True)
if __name__=='__main__':
 render(objects,[-46,62,-44],[0,2,0],32,'Meridian-R5-Actual-Overview.png','MERIDIAN EXCHANGE R5 — OPEN INTERIORS',1600,1400)
 buildings=[o for o in objects if 'Multi-state'in o.get('Nickname','')and'tree'not in o['Nickname']]
 for idx,o in enumerate(buildings):
  t=o['Transform'];x,z=t['posX'],t['posZ'];render([o],[x-12,18,z-14],[x,t['posY']-1,z],8,f'interior-{idx:02d}.png',o['Nickname'].split(' · ')[0],900,760)
