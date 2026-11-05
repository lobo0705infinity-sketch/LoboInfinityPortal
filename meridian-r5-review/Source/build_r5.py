from pathlib import Path
import sys,json,copy,hashlib,math,shutil,re
import numpy as np
from PIL import Image,ImageDraw,ImageFont,ImageFilter
R=Path(__file__).resolve().parents[1];P=R.parent;A=R/'Assets';sys.path.insert(0,str(R/'Source'))
from meshkit import Mesh
from architecture import bevel,rod
from bespoke import decoration
BASE='__MERIDIAN_R5_ASSETS__'
scene=json.loads(next((P/'r4/PreviewSave').glob('*.json')).read_text());objects=scene['ObjectStates']
source=P/'r2/Meridian-Exchange-Double-Bind-R2-Review-Installer'
records=json.loads((source/'Source/geometry-manifest.json').read_text());rec={r['slug']:r for r in records}
pivots=json.loads((source/'Source/movable-collider-data.json').read_text())
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
# Pack generated floor swatches into the existing authored material slot. Existing
# UVs, floor contact meshes and compound colliders stay byte-for-byte unchanged.
floors=Image.open(P.parent/'generated_images/exec-35d8bfcd-45c4-444a-8e6f-6f8e11758d90.png').convert('RGB')
atlas=Image.open(A/'meridian-atlas.png').convert('RGB');W,H=atlas.size;tw,th=W//4,H//4
normal=Image.open(P/'r4/Assets/meridian-normal-r4.png').convert('RGB')
names=['concourse','customs','freight','cafe','atelier','service','signals','ticket-office','pump-annex','dispatch','server-room']
for i,slug in enumerate(names):
 col,row=i%4,i//4;fw,fh=floors.size
 tile=floors.crop((round(col*fw/4),round(row*fh/3),round((col+1)*fw/4),round((row+1)*fh/3))).resize((tw,th),Image.Resampling.LANCZOS)
 im=atlas.copy();im.paste(tile,(2*tw,0 if slug=='server-room' else 3*th));im.save(A/f'r5-{slug}-atlas.jpg',quality=93,subsampling=0)
 # Low relief normals for the new surface only; preserve the verified R4 map elsewhere.
 gray=np.asarray(tile.convert('L'),float)/255;gy,gx=np.gradient(gray);n=np.stack([-gx*.6,-gy*.6,np.ones_like(gx)],axis=-1);n/=np.linalg.norm(n,axis=-1,keepdims=True)
 nt=Image.fromarray(np.uint8(np.clip((n*.5+.5)*255,0,255)))
 nm=normal.copy();nm.paste(nt.resize((nm.width//4,nm.height//4)),(nm.width//2,0 if slug=='server-room' else 3*nm.height//4));tmp=A/f'r5-{slug}-normal.tmp';nm.resize((1024,1024),Image.Resampling.LANCZOS).save(tmp,format='PNG');Image.open(tmp).load();tmp.replace(A/f'r5-{slug}-normal.png')
# Full-sheet UVs for the ground, using the latest hyperrealistic mat artwork.
mat=Image.open(P.parent/'generated_images/exec-c8ce2d01-cee5-4979-b677-bf2ea33e3cc4.png').convert('RGB');mat.resize((3072,3072),Image.Resampling.LANCZOS).save(A/'r5-meridian-mat.jpg',quality=95,subsampling=0)
for mode,fn in [('day','exec-3fb04f4d-16ab-4f7d-b056-1fd5b412230c.png'),('night','exec-0dd54120-1776-4678-93ab-35c3c777d840.png')]:
 im=Image.open(P.parent/'generated_images'/fn).convert('RGB');assert im.width==2*im.height
 im.resize((4096,2048),Image.Resampling.LANCZOS).save(A/f'r5-meridian-{mode}.jpg',quality=94,subsampling=0)
Image.new('RGB',(1024,512),(32,39,43)).save(A/'r5-background-off.jpg',quality=95)
# One texture sheet contains precisely typeset text, icons, bevel shading, fasteners.
labels=[('MERIDIAN EXCHANGE','TRADING • TRANSIT • CIVIC SERVICES'),('CUSTOMS','INSPECTION & CLEARANCE'),('FREIGHT HALL','CARGO RECEIVING / DISPATCH'),('MAISON VERTE','TERRACE CAFÉ'),('ATELIER 04','DESIGN & ELECTRONICS'),('DISTRICT SERVICES','MAINTENANCE & REPAIR'),('SIGNAL EXCHANGE','COMMUNICATIONS & RELAYS'),('TICKETS','TIMETABLES & TRAVEL'),('PUMP CONTROL','DISTRICT WATER SERVICES'),('COURIER DISPATCH','PARCEL COLLECTION'),('DATA EXCHANGE','SECURE NETWORK ACCESS'),('DISTRICT DIRECTORY','EXCHANGE  •  FREIGHT  •  TRANSIT'),('INSPECTION','FREIGHT CHECKPOINT'),('TRANSIT','MERIDIAN LOCAL SERVICES'),('OLD EXCHANGE','CIVIC GARDEN'),('SERVICE ACCESS','AUTHORIZED PERSONNEL')]
sheet=Image.new('RGB',(2048,2048));draw=ImageDraw.Draw(sheet)
for i,(title,sub)in enumerate(labels):
 x=i%2*1024;y=i//2*256;accent=(115,224,230)if i not in [2,3,7,12]else(255,206,127)
 draw.rectangle((x,y,x+1023,y+255),fill=(29,43,47));draw.rounded_rectangle((x+8,y+8,x+1015,y+247),radius=19,fill=(73,77,72),outline=(184,166,120),width=6)
 draw.rounded_rectangle((x+25,y+23,x+998,y+232),radius=13,fill=(18,37,42),outline=(96,119,119),width=3)
 for xx in [x+39,x+984]:
  for yy in [y+38,y+218]:draw.ellipse((xx-5,yy-5,xx+5,yy+5),fill=(193,187,166),outline=(39,46,45),width=2)
 fs=72
 while draw.textlength(title,font=ImageFont.truetype(FONT,fs))>895:fs-=1
 ft=ImageFont.truetype(FONT,fs);draw.text((x+512,y+105),title,font=ft,fill=accent,anchor='mm',stroke_width=1)
 draw.line((x+120,y+164,x+904,y+164),fill=(143,123,83),width=3)
 fs2=28
 while draw.textlength(sub,font=ImageFont.truetype(FONT,fs2))>880:fs2-=1
 draw.text((x+512,y+199),sub,font=ImageFont.truetype(FONT,fs2),fill=(208,211,196),anchor='mm')
sheet.save(A/'r5-signage.png')
# Small fully indexed sign mesh builder. Mirror X and reverse winding exactly as
# the established Unity importer convention. Both faces have outward-readable UVs.
class SignMesh:
 def __init__(self):self.v=[];self.uv=[];self.f=[]
 def quad(self,pts,uv):
  j=len(self.v);self.v+=pts;u0=min(u for u,v in uv);u1=max(u for u,v in uv);self.uv += [(u0+u1-u,v)for u,v in uv];self.f += [(j,j+2,j+1),(j,j+3,j+2)]
 def box(self,x,y,z,w,h,d):
  a,b=x-w/2,x+w/2;c,e=y,y+h;f,g=z-d/2,z+d/2
  uv=[(.015,.99)]*4
  for pts in [[(a,c,f),(b,c,f),(b,e,f),(a,e,f)],[(b,c,g),(a,c,g),(a,e,g),(b,e,g)],[(a,c,g),(a,c,f),(a,e,f),(a,e,g)],[(b,c,f),(b,c,g),(b,e,g),(b,e,f)],[(a,e,f),(b,e,f),(b,e,g),(a,e,g)],[(a,c,g),(b,c,g),(b,c,f),(a,c,f)]]:self.quad(pts,uv)
 def plaque(self,i,x,y,z,w,h=.62,rot=0):
  start=len(self.v);self.box(0,-.04,0,w+.14,h+.08,.17)
  for bx in [-w*.35,w*.35]:self.box(bx,-.04,.15,.09,h+.08,.35)
  u0=(i%2)/2;u1=u0+.5;v1=1-(i//2)/8;v0=v1-.125
  self.quad([(-w/2,0,-.09),(w/2,0,-.09),(w/2,h,-.09),(-w/2,h,-.09)],[(u0,v0),(u1,v0),(u1,v1),(u0,v1)])
  self.quad([(w/2,0,.091),(-w/2,0,.091),(-w/2,h,.091),(w/2,h,.091)],[(u0,v0),(u1,v0),(u1,v1),(u0,v1)])
  a=math.radians(rot);c,s=math.cos(a),math.sin(a)
  self.v[start:]=[(x+c*xx+s*zz,y+yy,z-s*xx+c*zz)for xx,yy,zz in self.v[start:]]
 def world(self,r,pivot):
  a=math.radians(r['rotation']);c,s=math.cos(a),math.sin(a)
  self.v=[(r['x']+c*x+s*z-pivot[0],y-pivot[1],r['z']-s*x+c*z-pivot[2])for x,y,z in self.v]
 def export(self,name):
  out=['# Meridian R5 fitted sign; typed front/back UVs; Unity import X convention']
  out+=['v %.6f %.6f %.6f'%(-x,y,z)for x,y,z in self.v];out+=['vt %.7f %.7f'%uv for uv in self.uv]
  out+=['f '+' '.join(f'{i+1}/{i+1}'for i in reversed(f))for f in self.f]
  (A/name).write_text('\n'.join(out)+'\n')
  return len(self.v)
# Exterior sign coordinates are from the source architecture, not guesses from screenshots.
spec={
'concourse':[(0,0,2.78,-6.36,4.95,0),(0,0,2.78,6.36,4.95,180)],
'customs':[(1,0,2.70,-3.81,3.0,0)],'freight':[(2,0,3.42,-4.32,3.65,0)],
'cafe':[(3,-.5,2.86,-5.32,4.1,0)],'atelier':[(4,0,3.90,-4.58,3.55,0)],
'service':[(5,0,2.68,-3.57,4.2,0)],'signals':[(6,-.5,2.72,-3.12,3.65,0)],
 'ticket-office':[(7,0,2.48,-3.10,2.65,0)],'pump-annex':[(8,0,2.47,-2.34,3.05,0)],
 'dispatch':[(9,0,2.50,-2.34,4.2,0)],'district-directory':[(11,0,2.48,-1.48,2.0,0),(11,0,2.48,1.48,2.0,180)],
 'inspection-shelter':[(12,0,2.42,-2.08,3.4,0)],'transit-stop':[(13,-1.1,2.37,-1.91,2.9,0)],'civic-alcove':[(14,0,1.48,2.10,2.7,180)]}
# Deterministic IDs and compact, non-obstructing contact geometry for visual children.
def uid(s):return hashlib.sha256(('MeridianR5|'+s).encode()).hexdigest()[:6]
contact='r5-visual-contact.obj';(A/contact).write_text('g contact\nv -.001 -.001 -.001\nv .001 -.001 -.001\nv .001 .001 -.001\nv -.001 .001 -.001\nv -.001 -.001 .001\nv .001 -.001 .001\nv .001 .001 .001\nv -.001 .001 .001\nf 1 3 2\nf 1 4 3\nf 5 6 7\nf 5 7 8\nf 1 2 6\nf 1 6 5\nf 4 8 7\nf 4 7 3\nf 1 5 8\nf 1 8 4\nf 2 3 7\nf 2 7 6\n')
def child(parent,name,mesh,texture,emissive=False):
 c=copy.deepcopy(parent)
 for k in ['States','StateId','ChildObjects']:c.pop(k,None)
 c.update(GUID=uid(parent['GUID']+mesh),Nickname=name,Description='',LuaScript='',LuaScriptState='',XmlUI='',Tooltip=False,DragSelectable=False,Locked=False,GridProjection=False)
 c['Transform']={k:(1 if k.startswith('scale')else 0)for k in ['posX','posY','posZ','rotX','rotY','rotZ','scaleX','scaleY','scaleZ']}
 c['CustomMesh']=copy.deepcopy(parent['CustomMesh']);c['CustomMesh'].update(MeshURL=BASE+'/'+mesh,DiffuseURL=BASE+'/'+texture,NormalURL='',ColliderURL=BASE+'/'+contact,Convex=True,MaterialIndex=0 if emissive else 3,CastShadows=not emissive)
 c['CustomMesh']['CustomShader']={'SpecularColor':{'r':.1,'g':.1,'b':.1},'SpecularIntensity':0,'SpecularSharpness':2,'FresnelStrength':0}
 c['Tags']=['LoboMap:df2801','terrain','MeridianR5Detail'];parent.setdefault('ChildObjects',[]).append(c)
# Export additions through established meshkit, compact indices and no additional floor hulls.
def detail_export(m,name):
 fn=m.export(name)['file'];p=A/fn;vs=[];uv=[];ns=[];faces=[]
 for l in p.read_text().splitlines():
  q=l.split()
  if not q:continue
  if q[0]=='v':vs.append(tuple(map(float,q[1:])))
  elif q[0]=='vt':uv.append(tuple(map(float,q[1:])))
  elif q[0]=='vn':ns.append(tuple(map(float,q[1:])))
  elif q[0]=='f':faces.append([tuple(map(int,v.split('/')))for v in q[1:]])
 out=['# Meridian R5 fitted interior details'];look={};verts=[];coords=[];normals=[];ff=[]
 for face in faces:
  ix=[]
  for a,b,c in face:
   key=(vs[a-1],uv[b-1],ns[c-1])
   if key not in look:look[key]=len(verts)+1;verts.append(key[0]);coords.append(key[1]);normals.append(key[2])
   ix.append(look[key])
  ff.append(ix)
 assert len(verts)<20000,(name,len(verts))
 out+=['v %.6f %.6f %.6f'%v for v in verts];out+=['vt %.7f %.7f'%v for v in coords];out+=['vn %.6f %.6f %.6f'%v for v in normals];out+=['f '+' '.join(f'{i}/{i}/{i}'for i in f)for f in ff];p.write_text('\n'.join(out)+'\n');(A/(name+'-collision.obj')).unlink()
 return fn,len(verts)
def details(slug):
 m=Mesh()
 def panel(x,y,z,w=.65,h=.5):
  bevel(m,x,y,z,w,h,.07,'bronze',.015);m.box(x,y+.055,z-.044,w-.10,h-.11,.016,'glass',False)
  for xx in np.arange(x-w/2+.1,x+w/2-.05,.10):m.box(xx,y+.10,z-.056,.04,.025,.008,'enamel',False)
 if slug=='concourse':
  panel(-2.8,2.05,-5.82,1.3,.65)
  for z in [-3.75,0,3.75]:
   m.box(3.2,1.3,z,.24,.035,.38,'rubber',False)
   for a in range(4):m.box(3.2,1.34,z-.12+a*.08,.18,.016,.045,'enamel',False)
 elif slug=='customs':
  panel(1.9,1.7,-3.29,.85,.62)
  # Existing filing storage retained without overlapping additions.
  m.box(2.45,1.19,-2.5,.25,.07,.2,'rubber',False)
 elif slug=='freight':
  panel(-2.3,2.65,3.77,1.2,.60)
  # Retain existing fitted freight shelving and cargo.
 elif slug=='cafe':
  m.cyl(-2.5,2.19,2.75,.13,.32,'bronze',16);m.cyl(-2.5,2.51,2.75,.15,.05,'rubber',16)
  for x in [-3.5,-3.2,-2.9]:m.cyl(x,2.2,2.80,.08,.17,'enamel',12)
  panel(2.5,2.2,-3.29,.9,.68)
 elif slug=='atelier':
  panel(2.6,3.0,-3.99,1.05,.75)
  # Retain existing atelier shelf contents.
  for x in [1.6,1.8,2.0]:m.cyl(x,2.6,-1.4,.07,.20,'fabric',12)
 elif slug=='service':
  m.box(-1.85,1.75,-2.79,1.1,.72,.08,'wood',False)
  for x in [-2.2,-1.95,-1.7,-1.5]:rod(m,(x,1.9,-2.85),(x,2.30,-2.85),.025,'bronze',6)
  panel(2.1,2.1,2.95,.8,.55)
 elif slug=='signals':
  for x in [-3.6,-3.3,-3.0]:
   panel(x,1.4,2.57,.23,.95)
   rod(m,(x,2.4,2.6),(x,2.9,2.6),.018,'bronze',6)
  panel(.4,2.0,-2.58,1.2,.68)
 elif slug=='ticket-office':
  panel(.9,1.9,2.52,1.65,.62)
  for x in [-2.45,-2.2,-1.95]:m.box(x,1.45,1.83,.13,.21,.24,'wood',False)
 elif slug=='pump-annex':
  for x in [-1.65,-1.25,-.85]:
   m.box(x,2.1,1.78,.17,.17,.035,'enamel',False)
   rod(m,(x,1.6,1.83),(x,2.1,1.83),.035,'bronze',8)
  panel(1.6,2.0,1.79,.9,.6)
 elif slug=='dispatch':
  for z in [.05,.5,.95]:
   for y in [.51,1.14,1.77]:m.box(-2.13,y,z,.015,.08,.14,'enamel',False)
  panel(1.5,1.8,1.79,1,.65)
 return m
report=[]
for o in objects:
 if not o.get('CustomMesh'):continue
 meshname=o['CustomMesh']['MeshURL'].rsplit('/',1)[-1];raw=meshname.removeprefix('r4-');slug=next((n for n in names[:-1]if re.fullmatch(re.escape(n)+r'-[0-9]+\.obj',raw)),None)
 if not slug:
  slug=next((n for n in spec if re.fullmatch(re.escape(n)+r'-[0-9]+\.obj',raw)),None)
 if slug:
  r=rec[slug];pivot=pivots[slug+'-1.obj']['pivot'];sg=SignMesh()
  for i,x,y,z,w,rot in spec[slug]:sg.plaque(i,x,y,z,w,.62,rot)
  sg.world(r,pivot);sf=f'r5-{slug}-signs.obj';count=sg.export(sf)
  dm=None
  if slug in names[:-1]:
   m=details(slug).moved(r['x'],r['z'],rot=r['rotation']).moved(-pivot[0],-pivot[2],y=-pivot[1]);dm,dc=detail_export(m,'r5-'+slug+'-fittings')
  variants=[o]+list(o.get('States',{}).values())
  def retexture(x):
   cm=x.get('CustomMesh')
   if cm and cm.get('DiffuseURL','').endswith('meridian-atlas.png'):
    cm.update(DiffuseURL=BASE+f'/r5-{slug}-atlas.jpg',NormalURL=BASE+f'/r5-{slug}-normal.png')
   for v in x.get('ChildObjects',[]):retexture(v)
  for v in variants:
   if slug in names[:-1]:retexture(v)
   child(v,'Fitted '+slug+' signs',sf,'r5-signage.png',True)
   if dm:child(v,'Fitted '+slug+' interior details',dm,'r5-'+slug+'-atlas.jpg')
   v['Description']='';v['Tooltip']=True
  report.append({'slug':slug,'states_updated':len(variants),'sign_mesh_vertices':count,'new_fittings':bool(dm),'floor_finish_updated':slug in names[:-1]})
 # Central mission room retains all native equipment, dimensions and collision.
 if o['GUID']=='c18001':
  o['CustomMesh'].update(DiffuseURL=BASE+'/r5-server-room-atlas.jpg',NormalURL=BASE+'/r5-server-room-normal.png')
  sg=SignMesh()
  for a in [0,90,180,270]:sg.plaque(10,0,3.15,-4.48,2.45,.38,a)
  sg.export('r5-server-room-signs.obj');child(o,'Data Exchange gate signs','r5-server-room-signs.obj','r5-signage.png',True)
 if o['GUID']=='df2802':
  # Original ground geometry repeats atlas-style UVs: replace it with a single
  # correctly mapped top quad on the same supporting slab; no added overlapping layer.
  o['CustomMesh']['MeshURL']=BASE+'/r5-ground.obj';o['CustomMesh']['DiffuseURL']=BASE+'/r5-meridian-mat.jpg';o['CustomMesh']['NormalURL']=''
  o['CustomMesh']['CustomShader'].update(SpecularIntensity=0,FresnelStrength=0)
# Slab has unchanged dimensions and pivot, all six faces defined, full-sheet top UV.
g=SignMesh();g.box(0,-.125,0,48,.25,48)
# replace all face UVs; top at indices16..19 from SignMesh.box uses +Y winding.
for k in range(0,len(g.uv),4):g.uv[k:k+4]=[(0,0),(1,0),(1,1),(0,1)]
g.export('r5-ground.obj')
# Controller panorama URLs and startup mode point to new immutable assets.
for o in objects:
 if o['GUID']=='df2803':
  s=o['LuaScript']
  old='https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/64b2dc3173ce799776b3dd24a4077b56b3372899/meridian-exchange-r2/Assets/'
  for oldname,new in [('meridian-day.jpg','r5-meridian-day.jpg'),('meridian-night.jpg','r5-meridian-night.jpg'),('meridian-background-off.jpg','r5-background-off.jpg')]:s=s.replace(old+oldname,BASE+'/'+new)
  o['LuaScript']=s.replace('Meridian Exchange R4','Meridian Exchange R5').replace('Meridian Exchange R3','Meridian Exchange R5');o['LuaScriptState']=''
# Finish the public-space equipment with fitted, grounded identifying details.
scatter_changes=[]
for o in objects[:]:
 cm=o.get('CustomMesh',{});raw=cm.get('MeshURL','').rsplit('/',1)[-1].removeprefix('r4-')
 match=re.fullmatch(r'(network-[0-4]|freight-group-[0-2]|garden-cistern|battery-cart|electrical-bay|cooling-plant|traffic-control)-1\.obj',raw)
 if not match:continue
 slug=match.group(1);r=rec[slug];pivot=pivots[slug+'-1.obj']['pivot'];m=Mesh()
 if slug.startswith('network-'):
  idx=int(slug[-1]);m.box(-.65,1.10,-.655,.65,.36,.035,'rubber',False)
  for i in range(2+idx):m.box(-.85+i*.085,1.2,-.68,.035,.055,.012,'enamel',False)
  if idx%2:
   rod(m,(.8,2.3,.3),(.8,2.85,.3),.025,'bronze',8)
  else:m.box(.7,2.30,0,.42,.16,.4,'sage',False)
 elif slug.startswith('freight-group-'):
  for x in [-.20,.20]:m.box(x,.80,-.60,.17,.14,.025,'enamel',False)
 elif slug=='battery-cart':
  for z in [-1,0,1]:m.box(-.665,1.30,z,.035,.18,.3,'enamel',False)
 elif slug=='garden-cistern':
  m.box(.65,1.2,-1.1,.40,.55,.04,'enamel',False)
 elif slug=='electrical-bay':
  for x in [-1,0,1]:m.box(x,1.8,-1.225,.26,.16,.02,'enamel',False)
 elif slug=='cooling-plant':
  for x in [-1.35,1.35]:m.box(x,.50,-.90,.25,.20,.06,'enamel',False)
 else:
  for y in [.55,.9,1.25]:m.box(0,y,-.72,.28,.18,.025,'glass',False)
 m=m.moved(r['x'],r['z'],rot=r['rotation']).moved(-pivot[0],-pivot[2],y=-pivot[1]);fn,ct=detail_export(m,'r5-'+slug+'-detail')
 child(o,'Fitted street equipment details',fn,'r5-service-atlas.jpg');scatter_changes.append(slug)
# Use actual TTS Light components for signs, not a claim of emission on an OBJ.
# These are static shadow-free points with bounded load retries, no frame loop.
light_template=next(o for o in objects if 'MeridianLight'in o.get('Tags',[]))
light_script='''local function apply()
 if self.loading_custom then return end
 self.setLock(true);self.interactable=false
 if self.AssetBundle then pcall(function()self.AssetBundle.playLoopingEffect(2)end)end
 for _,c in ipairs(self.getComponentsInChildren('Light')or{})do
  c.set('renderMode',1);c.set('enabled',true);c.set('range',3.1);c.set('intensity',.65);c.set('color',Color(1,.88,.70,1));pcall(function()c.set('shadows',0)end)
 end
 for _,r in ipairs(self.getComponentsInChildren('MeshRenderer')or{})do r.set('enabled',false)end
 for _,kind in ipairs({'BoxCollider','SphereCollider','MeshCollider','CapsuleCollider'})do for _,c in ipairs(self.getComponentsInChildren(kind)or{})do c.set('enabled',false)end end
end
function onLoad()
 self.setLock(true);self.interactable=false
 Wait.condition(apply,function()return not self.loading_custom end,30)
 for _,delay in ipairs({1,3,8,15})do Wait.time(apply,delay)end
end
'''
newlights=[]
for slug in names[:-1]:
 r=rec[slug];pv=pivots[slug+'-1.obj']['pivot']
 parent=next(o for o in objects if o.get('CustomMesh',{}).get('MeshURL','').rsplit('/',1)[-1].removeprefix('r4-')==slug+'-1.obj')
 dx=parent['Transform']['posX']-pv[0];dy=parent['Transform']['posY']-pv[1];dz=parent['Transform']['posZ']-pv[2]
 for j,(index,x,y,z,w,rot)in enumerate(spec[slug]):
  a=math.radians(rot);x-=math.sin(a)*.55;z-=math.cos(a)*.55
  b=math.radians(r['rotation']);xx=r['x']+math.cos(b)*x+math.sin(b)*z+dx;zz=r['z']-math.sin(b)*x+math.cos(b)*z+dz
  o=copy.deepcopy(light_template);o.update(GUID=uid(slug+'signlight'+str(j)),Nickname='Meridian sign light',Tooltip=False,LuaScript=light_script,LuaScriptState='',Description='',Tags=['LoboMap:df2801','terrain','MeridianLight','MeridianR5SignLight'])
  o['Transform'].update(posX=xx,posY=dy+y+.90,posZ=zz);newlights.append(o)
objects.extend(newlights)

scene.update(SaveName='Meridian Exchange - Critical Intervention R5 REVIEW');scene['Grid']['Lines']=False
(R/'PreviewSave/TS_Save_Meridian_Critical_R5_Review.json').write_text(json.dumps(scene,ensure_ascii=False,indent=2))
bag=copy.deepcopy(json.loads(next((P/'r4/SavedObjects').glob('*.json')).read_text())['ObjectStates'][0]);bag['Nickname']='SET_ITS18 Critical Intervention — Meridian Exchange R5 REVIEW';bag['Description']='R5 review: fitted signs, distinct interiors and floor finishes, detailed mat, corrected spherical Day/Night backgrounds. Use on the normal Infinity table. Workshop not replaced.'
manifest=[]
for o in objects:
 for v in [o]+list(o.get('States',{}).values()):
  t=v['Transform'];manifest.append('--'+','.join([v['GUID']]+[str(t[k])for k in ['posX','posY','posZ','rotX','rotY','rotZ']]))
bag['LuaScript']='\r\n'.join(manifest)+'\r\n';bag['ContainedObjects']=copy.deepcopy(objects)
for o in bag['ContainedObjects']:
 for v in [o]+list(o.get('States',{}).values()):v['Transform'].update(posX=70,posY=100,posZ=70)
(R/'SavedObjects/Lobos-Top-40-Losers-Round-8-Meridian-R5.json').write_text(json.dumps({'ObjectStates':[bag]},ensure_ascii=False,indent=2))
(R/'Review/R5-Changes.json').write_text(json.dumps({'source':'R4 review','building_and_structure_updates':report,'scatter_detail_updates':scatter_changes,'added_sign_lights':len(newlights),'server_room':'native mission objects and compound collision retained; new floor finish and signs','ground':'single full-sheet UV slab; no overlapping overlay','backgrounds':'new 2:1 spherical panorama textures; no foreground buildings beneath horizon','limitations':['Live TTS rendering and multiplayer loading require review','Concept artwork is a visual target, not a pixel-exact rebuild']},indent=2))
# Atlas is only an intermediate input; every used finish has its own packed variant.
(A/'meridian-atlas.png').unlink()
print('Updated buildings and structures',len(report),'assets',len(list(A.iterdir())),flush=True)
