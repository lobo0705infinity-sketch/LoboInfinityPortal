"""Render the exported OBJ meshes themselves, not generated concept imagery."""
import os
os.environ['PYOPENGL_PLATFORM']='egl'
from pathlib import Path
import json,math,io
import numpy as np
np.infty=np.inf
import trimesh,pyrender
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];A=ROOT/'Assets';P=ROOT/'Preview'
atlas=Image.open(A/'old-quarter-material-atlas.jpg').convert('RGB')
placements=json.loads((ROOT/'Source'/'layout.json').read_text())
def pose(x,y,z,angle=0):
 t=np.eye(4);r=math.radians(angle);t[:3,:3]=[[math.cos(r),0,math.sin(r)],[0,1,0],[-math.sin(r),0,math.cos(r)]];t[:3,3]=[x,y,z];return t
def lookat(eye,target,up=[0,1,0]):
 eye,target=np.array(eye,float),np.array(target,float);z=eye-target;z/=np.linalg.norm(z);x=np.cross(up,z);x/=np.linalg.norm(x);y=np.cross(z,x)
 t=np.eye(4);t[:3,:3]=np.stack([x,y,z],axis=1);t[:3,3]=eye;return t
cache={}
def mesh(name):
 if name in cache:return cache[name]
 m=trimesh.load(A/(name+'.obj'),process=False,force='mesh')
 m.visual=trimesh.visual.texture.TextureVisuals(uv=m.visual.uv,image=atlas)
 mat=pyrender.MetallicRoughnessMaterial(baseColorTexture=atlas,metallicFactor=.05,roughnessFactor=.9,doubleSided=False)
 cache[name]=pyrender.Mesh.from_trimesh(m,material=mat,smooth=False);return cache[name]
def scene(items):
 s=pyrender.Scene(bg_color=[.15,.17,.19,1],ambient_light=[.40,.40,.40])
 for p in items:s.add(mesh(p['mesh']),pose=pose(p['x'],p['y'],p['z'],p.get('angle',0)))
 for eye,intensity in [([25,50,20],2.8),([-30,30,-10],1.7)]:s.add(pyrender.DirectionalLight(color=[1,1,.97],intensity=intensity),pose=lookat(eye,[0,0,0]))
 return s
def render(s,path,eye,target,mag=34,size=(1500,1500),up=[0,1,0]):
 s.add(pyrender.OrthographicCamera(xmag=mag,ymag=mag*size[1]/size[0],znear=.1,zfar=300),pose=lookat(eye,target,up))
 r=pyrender.OffscreenRenderer(*size)
 im,depth=r.render(s,flags=pyrender.RenderFlags.SHADOWS_DIRECTIONAL)
 buffer=io.BytesIO();Image.fromarray(im.copy()).save(buffer,format='PNG')
 encoded=buffer.getvalue()
 assert encoded[-12:]==b'\x00\x00\x00\x00IEND\xaeB`\x82'
 assert path.write_bytes(encoded)==len(encoded)
 assert path.read_bytes()==encoded
 r.delete()
 # GPU resources belong to the destroyed EGL context; rebuild them next render.
 cache.clear()

mission=[dict(mesh='mission-console-40mm',x=v,y=4.6,z=v,angle=45) for v in [-16/math.sqrt(2),0,16/math.sqrt(2)]]
render(scene(placements+mission),P/'actual-mesh-angled.png',[59,72,66],[0,4,0],34,(1700,1500))
render(scene(placements+mission),P/'actual-mesh-overhead.png',[0,100,0.001],[0,4.6,0],25,(1600,1600),[0,0,-1])
# A close view exposes real door and window openings and the excavated technology.
render(scene(placements+mission),P/'actual-mesh-detail.png',[31,31,30],[7,5,1],17,(1600,1200))
for state in [1,2,3]:
 items=[dict(mesh='annex-state-'+str(state),x=0,y=0,z=0,angle=0),dict(mesh='civic-state-'+str(state),x=10,y=0,z=0,angle=0),dict(mesh='ruin-state-'+str(state),x=-10,y=0,z=0,angle=0)]
 render(scene(items),P/f'building-states-{state}.png',[23,25,35],[0,2,0],20,(1800,850))

im=Image.open(P/'actual-mesh-overhead.png').convert('RGB');d=ImageDraw.Draw(im,'RGBA')
def px(x,z):return (800+x*32,800+z*32)
for cx,cz,color in [(24,-24,(64,169,236,45)),(-24,24,(238,151,62,45))]:
 pts=[px(cx,cz)]
 for t in np.linspace(0,math.pi/2,120):pts.append(px(cx-math.copysign(24*math.cos(t),cx),cz-math.copysign(24*math.sin(t),cz)))
 d.polygon(pts,fill=color);d.line(pts[1:],fill=(*color[:3],255),width=5)
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',22)
examples=[(-20,-20),(-20,-10),(-6,-6),(6,6),(20,10),(20,20)]
for i,(x,z) in enumerate(examples):
 x1,y1=px(x,z);d.ellipse((x1-16,y1-16,x1+16,y1+16),outline=(90,255,154,255),width=3);d.text((x1+20,y1-14),str(i+1),fill=(90,255,154,255),font=font)
d.rectangle((0,0,1600,78),fill=(12,18,23,235));d.text((25,14),'OLD QUARTER EXCAVATION | 48 x 48 in | THE DIG',fill='white',font=font)
d.text((25,43),'Coloured arcs: 24 in corner DZs. Green rings: one legal example of six Tech placements.',fill=(200,220,220,255),font=font)
im.save(P/'deployment-and-placement-check.png')
print('Rendered exported geometry: angled, overhead, detail, floor states and deployment check.')
