import os
os.environ['PYOPENGL_PLATFORM']='egl'
from pathlib import Path
import json,math,hashlib
import numpy as np
np.infty=np.inf
import trimesh,pyrender
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parent;OUT=ROOT/'five-release';PRE=OUT/'Previews';PRE.mkdir(exist_ok=True)
HOST=json.loads((OUT/'Source/hosted-assets-validation.json').read_text());ASSETS={a['url']:a['path']for a in HOST['assets']if a['status']=='passed'}
REPO=ROOT/'five-portal/lobo-infinity-portal';REV='approved-five-map-update-20261102-r1';PUBLIC=REPO/'public/assets/maps'/REV
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',26)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',16)
def pose(eye,target,up):
 eye=np.array(eye,float);target=np.array(target,float);z=eye-target;z/=np.linalg.norm(z);x=np.cross(up,z);x/=np.linalg.norm(x);y=np.cross(z,x)
 p=np.eye(4);p[:3,:3]=np.stack([x,y,z],axis=1);p[:3,3]=eye;return p
def transform(o):
 t=o['Transform'];x,y,z=[math.radians(t[k])for k in ['rotX','rotY','rotZ']]
 rx=trimesh.transformations.rotation_matrix(x,[1,0,0]);ry=trimesh.transformations.rotation_matrix(y,[0,1,0]);rz=trimesh.transformations.rotation_matrix(z,[0,0,1])
 p=ry@rx@rz;p[:3,:3]=p[:3,:3]@np.diag([t['scaleX'],t['scaleY'],t['scaleZ']]);p[:3,3]=[t['posX'],t['posY'],t['posZ']];return p
for c in [c for c in json.loads((OUT/'Source/configs.json').read_text()) if c['key']=='halcyon']:
 b=json.loads((PUBLIC/(c['slug']+'.json')).read_text())['ObjectStates'][0];scene=pyrender.Scene(bg_color=[.12,.14,.15,1],ambient_light=[.47]*3);cache={};omitted=0
 for o in b['ContainedObjects']:
  cm=o.get('CustomMesh')
  if not cm:
   omitted+=o['Name']=='Custom_Assetbundle';continue
  url=cm['MeshURL'];texurl=cm.get('DiffuseURL','');key=(url,texurl)
  if key not in cache:
   assert url in ASSETS,url
   m=trimesh.load(ASSETS[url],file_type='obj',force='mesh',process=False);m.vertices[:,0]*=-1;m.faces=m.faces[:,::-1]
   if texurl:
    assert texurl in ASSETS,texurl
    tex=Image.open(ASSETS[texurl]).convert('RGB');m.visual=trimesh.visual.texture.TextureVisuals(uv=m.visual.uv,image=tex)
   else:tex=None
   tint=o.get('ColorDiffuse',{'r':1,'g':1,'b':1});glass=cm.get('MaterialIndex')==4
   mat=pyrender.MetallicRoughnessMaterial(baseColorTexture=tex,baseColorFactor=[tint.get(k,1)for k in ['r','g','b']]+[.35 if glass else 1],metallicFactor=.04,roughnessFactor=.9,doubleSided=glass,alphaMode='BLEND'if glass else'OPAQUE')
   cache[key]=pyrender.Mesh.from_trimesh(m,material=mat,smooth=False)
  scene.add(cache[key],pose=transform(o))
 for e,intensity in [([20,70,25],2.1),([-40,40,-25],.7)]:scene.add(pyrender.DirectionalLight(color=[1,.99,.96],intensity=intensity),pose=pose(e,[0,0,0],[0,1,0]))
 for kind,eye,mag,size in [('angled',[60,70,63],35,(1600,1400)),('overhead',[0,90,.01],25.8,(1500,1500))]:
  node=scene.add(pyrender.OrthographicCamera(xmag=mag,ymag=mag*size[1]/size[0],znear=.1,zfar=300),pose=pose(eye,[0,1,0],[0,0,-1]if kind=='overhead'else[0,1,0]))
  renderer=pyrender.OffscreenRenderer(*size);rgb,_=renderer.render(scene,flags=pyrender.RenderFlags.SHADOWS_DIRECTIONAL);renderer.delete();scene.remove_node(node)
  im=Image.fromarray(rgb);draw=ImageDraw.Draw(im);draw.rectangle((0,0,size[0],78),fill=(27,30,32));draw.text((24,10),c['name'].upper()+'  /  '+c['mission'].upper(),font=font,fill=(244,240,226));draw.text((24,47),'Approved layout · actual terrain geometry · saved building states'+(' · bundle markers omitted'if omitted else''),font=small,fill=(204,210,207))
  im.save(PRE/(c['key']+'-'+kind+'.png'));im.save(PUBLIC/(c['key']+'-'+kind+'.webp'),quality=88)
  if kind=='angled':
   for row in json.loads((OUT/'Source/new-map-index.json').read_text()):
    if row['map']==c['name']:im.save((OUT/row['path']).with_suffix('.png'))
  print(c['key'],kind,flush=True)
imgs=[Image.open(PUBLIC/(c['key']+'-angled.webp')).convert('RGB')for c in json.loads((OUT/'Source/configs.json').read_text())]
thumb=Image.new('RGB',(1500,1450),(22,25,29));draw=ImageDraw.Draw(thumb)
for i,im in enumerate(imgs):thumb.paste(im.resize((750,650)),((i%2)*750,80+(i//2)*450))
draw.rectangle((0,0,1500,80),fill=(22,25,29));draw.text((25,24),"LOBO'S INFINITY MAPS - FIVE MAP UPDATE R1",font=font,fill=(244,240,226));thumb.thumbnail((1100,1100));thumb.save(OUT/'Files/Lobo-Workshop-Current-Maps-and-Rules.png')
