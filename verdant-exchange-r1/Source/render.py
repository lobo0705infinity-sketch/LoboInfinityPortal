"""Preview the exact OBJ files and placements included in the TTS bag."""
import os
os.environ['PYOPENGL_PLATFORM']='egl'
from pathlib import Path
import numpy as np
np.infty=np.inf
import json,math
import trimesh,pyrender
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1]
(ROOT/'Previews').mkdir(exist_ok=True)
BAG=json.loads((ROOT/'Map-Bags/Verdant-Exchange-Uplink-Center-R1.json').read_text())['ObjectStates'][0]
cache={}
def pose(eye,target,up=[0,1,0]):
 eye,target=np.array(eye,float),np.array(target,float);z=eye-target;z/=np.linalg.norm(z);x=np.cross(up,z);x/=np.linalg.norm(x);y=np.cross(z,x)
 p=np.eye(4);p[:3,:3]=np.stack([x,y,z],axis=1);p[:3,3]=eye;return p
def transform(o):
 t=o['Transform'];a=math.radians(t['rotY']);p=np.eye(4);p[:3,:3]=[[math.cos(a),0,math.sin(a)],[0,1,0],[-math.sin(a),0,math.cos(a)]];p[:3,3]=[t['posX'],t['posY'],t['posZ']];return p
def mesh(o):
 cm=o['CustomMesh'];name=cm['MeshURL'].rsplit('/',1)[-1]
 if name in cache:return cache[name]
 m=trimesh.load(ROOT/'Assets'/name,force='mesh',process=False);m.vertices[:,0]*=-1;m.faces=m.faces[:,::-1]
 tex=Image.open(ROOT/'Assets'/cm['DiffuseURL'].rsplit('/',1)[-1]).convert('RGB')
 m.visual=trimesh.visual.texture.TextureVisuals(uv=m.visual.uv,image=tex)
 glass=cm['MaterialIndex']==4
 mat=pyrender.MetallicRoughnessMaterial(baseColorTexture=tex,baseColorFactor=[.76,.9,.91,.26] if glass else [1.,1.,1.,1.],metallicFactor=.10 if glass else .04,roughnessFactor=.32 if glass else .90,doubleSided=glass,alphaMode='BLEND' if glass else 'OPAQUE')
 cache[name]=pyrender.Mesh.from_trimesh(m,material=mat,smooth=False);return cache[name]
def render(name,eye,target,mag,size=(1800,1500),state=1,detail=False):
 s=pyrender.Scene(bg_color=[.12,.15,.14,1],ambient_light=[.48,.48,.48])
 for o in BAG['ContainedObjects']:
  if not o.get('CustomMesh'):continue
  if state>1 and 'glass' in o.get('Tags',[]):continue
  if detail and o.get('Nickname','').startswith('Verdant Exchange | 48'):continue
  if state>1 and o.get('States'):o=o['States'].get(str(state),o['States']['2'])
  s.add(mesh(o),pose=transform(o))
 for eye2,intensity in [([20,60,20],2.25),([-40,40,-20],.75)]:s.add(pyrender.DirectionalLight(color=[1,.99,.96],intensity=intensity),pose=pose(eye2,[0,0,0]))
 up=[0,0,-1] if 'Overhead' in name else [0,1,0]
 s.add(pyrender.OrthographicCamera(xmag=mag,ymag=mag*size[1]/size[0],znear=.1,zfar=300),pose=pose(eye,target,up))
 renderer=pyrender.OffscreenRenderer(*size);rgb,_=renderer.render(s,flags=pyrender.RenderFlags.SHADOWS_DIRECTIONAL);renderer.delete()
 im=Image.fromarray(rgb);draw=ImageDraw.Draw(im);draw.rectangle((0,0,size[0],85),fill=(22,39,35))
 font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',28)
 small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',17)
 draw.text((28,12),'VERDANT EXCHANGE  /  UPLINK CENTER  /  R1',font=font,fill=(239,237,213))
 draw.text((30,51),'Actual map geometry · 48 × 48 inches · '+('Roofs on' if state==1 else 'Interiors exposed')+' · 16-inch deployment zones',font=small,fill=(184,209,196))
 im.save(ROOT/'Previews'/name);cache.clear();print(name,flush=True)
render('Verdant-Exchange-Overview.png',[58,66,62],[0,2,0],35)
render('Verdant-Exchange-Overhead.png',[0,95,.01],[0,1,0],25.5,(1700,1700))
render('Verdant-Exchange-Interiors.png',[42,55,48],[0,1,0],32,state=3)
render('Verdant-Exchange-Laboratory-Detail.png',[-7,20,-1],[-16,2,-16],11,(1800,1350),state=3,detail=True)
render('Verdant-Exchange-Conservatory-Detail.png',[-22,20,23],[-16,2,4],11,(1800,1350),state=2,detail=True)
