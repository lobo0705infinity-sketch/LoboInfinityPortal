import bpy,pathlib,json,math
from mathutils import Vector
R=pathlib.Path('/workspace/scratch/f5b36afa893f/rebuild');old=[e for e in json.loads((R/'Source/new-models.json').read_text())if e['key']!='evening-star-shuttle']
source=(R/'Source/build_models.py').read_text().split('building_models();scatter_models();export();')[0];exec(compile(source,'model-tools','exec'))
current='evening-star-shuttle';layer='ground';collision_meshes=[]
def outward(vs,faces):
 volume=0
 for f in faces:
  a=Vector(vs[f[0]])
  for i in range(1,len(f)-1):volume+=a.dot(Vector(vs[f[i]]).cross(Vector(vs[f[i+1]])))/6
 return [tuple(reversed(f))for f in faces]if volume<0 else faces
for p in A.glob('evening-star-shuttle*.obj'):p.unlink()

profile=[(-4.3,.05),(-4.05,.40),(-3.6,.72),(-2.8,.87),(-1.8,.9),(0,.9),(1.8,.85),(2.8,.72),(3.55,.48),(3.9,.12)]
def loft(name,profile,segments=24,cell=0):
 vs=[];faces=[]
 for x,r in profile:
  for i in range(segments):
   a=math.tau*i/segments;vs.append((x,math.cos(a)*r,1.65+math.sin(a)*r*.86))
 for ring in range(len(profile)-1):
  for i in range(segments):
   a=ring*segments+i;b=ring*segments+(i+1)%segments;c=(ring+1)*segments+(i+1)%segments;d=(ring+1)*segments+i;faces.append((a,b,c,d))
 faces.extend([tuple(reversed(range(segments))),tuple((len(profile)-1)*segments+i for i in range(segments))])
 me=bpy.data.meshes.new(name);faces=outward(vs,faces);me.from_pydata(vs,[],faces);me.update()
 for f in me.polygons:f.use_smooth=len(f.vertices)==4
 o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);finish(o,name,cell)
 return vs,faces
loft('Passenger pressure hull',profile)
# A continuous belly fairing and four swept lifting surfaces.
box('Keel fairing',(0,0,1.02),(6.8,1.1,.35),1,.16)
for side in [-1,1]:
 vs=[(-.7,side*.62,1.43),(1.35,side*2.42,1.40),(2.75,side*2.42,1.40),(2.0,side*.65,1.43)]
 vertices=vs+[(x,y,z-.12)for x,y,z in vs];faces=[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)]
 faces=outward(vertices,faces);collision_meshes.append((vertices,faces));me=bpy.data.meshes.new('Wing');me.from_pydata(vertices,[],faces);me.update();o=bpy.data.objects.new('Swept wing',me);bpy.context.collection.objects.link(o);finish(o,'Swept wing',1,.025)
 rod('Leading-edge rail',vs[0],vs[1],.045,2);rod('Wingtip marker',vs[1],vs[2],.035,7)
 for i in range(4):rod('Wing panel seam',(.2+i*.35,side*.8,1.45),(1.7+i*.2,side*2.3,1.43),.012,11)
 # Ducted engines with a deep fan well, rings, blades, core and exhaust.
 for x in [1.65]:
  y=side*1.5
  cyl('Engine nacelle',(x,y,1.83),.38,2.1,11,'X',32)
  cyl('Inlet rim',(.55,y,1.83),.41,.11,2,'X',32);cyl('Dark intake',(.48,y,1.83),.34,.025,3,'X',32)
  cyl('Fan core',(.45,y,1.83),.10,.05,2,'X',16)
  for i in range(12):
   a=math.tau*i/12;rod('Turbine blade',(.43,y+.11*math.cos(a),1.83+.11*math.sin(a)),(.43,y+.31*math.cos(a+.3),1.83+.31*math.sin(a+.3)),.022,2)
  cyl('Exhaust ring',(2.73,y,1.83),.34,.12,3,'X',24);cyl('Exhaust core',(2.8,y,1.83),.25,.05,9,'X',24)
  for xx in [.9,1.45,2.0,2.5]:cyl('Nacelle panel band',(xx,y,1.83),.387,.025,2,'X',32)
 for x in [-2.8,-2.1,-1.4,-.7,0,.7]:
  box('Window gasket',(x,side*.86,1.97),(.43,.055,.30),3,.075)
  box('Cabin viewport',(x,side*.90,1.97),(.34,.025,.21),6,.07)
 for x in [-2.8,1.9]:
  rod('Landing leg',(x,side*.55,1.0),(x,side*.95,.35),.075,11)
  box('Landing pad',(x,side*.98,.14),(.8,.55,.2),3,.055,True)
  rod('Hydraulic ram',(x-.2,side*.55,.95),(x-.1,side*.9,.45),.032,2)
 # Side service door and operating handles.
 box('Airlock frame',(-2.0,side*.91,1.48),(.8,.06,1.18),11,.1)
 box('Airlock panel',(-2.0,side*.95,1.48),(.64,.025,1.02),1,.08)
 for z in [1.1,1.8]:bolt(-1.75,side*.99,z,r=.024)
box('Registration panel',(-.5,-.884,1.48),(3,.03,.3),12,.025)
text('EVENING STAR',(-.5,-.909,1.40),.17,1)
text('PM-741',(-3.3,-.65,1.72),.13,1)
# Cockpit glazing, navigation beacon and a raised dorsal tail.
for x,y,z,w in [(-3.3,-.25,2.30,.65),(-3.3,.25,2.30,.65)]:
 o=box('Cockpit pane',(x,y,z),(.6,.42,.025),6,.04);o.rotation_euler[1]=-.3
vertices=[(2.5,-.08,2.1),(3.1,-.08,3.25),(3.8,-.08,3.25),(3.6,-.08,2.1),(2.5,.08,2.1),(3.1,.08,3.25),(3.8,.08,3.25),(3.6,.08,2.1)]
faces=[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)];faces=outward(vertices,faces);collision_meshes.append((vertices,faces));me=bpy.data.meshes.new('tail');me.from_pydata(vertices,[],faces);me.update();o=bpy.data.objects.new('Dorsal tail',me);bpy.context.collection.objects.link(o);finish(o,'Dorsal tail',1,.025)
for x in [-2.7,0,2.4]:
 for i in range(18):
  a=math.tau*i/18;r=.91 if abs(x)<2 else .84
  bolt(x,math.cos(a)*r,1.65+math.sin(a)*r*.86,axis='X',r=.012)
cyl('Navigation beacon',(0,0,2.49),.07,.10,14)
export();new=json.loads((R/'Source/new-models.json').read_text())
# Low-resolution matching hull collider, below the native 256-triangle limit.
vs=[];faces=[];segments=8
for x,r in profile:
 for i in range(segments):
  a=math.tau*i/segments;vs.append((x,math.cos(a)*r,1.65+math.sin(a)*r*.86))
for ring in range(len(profile)-1):
 for i in range(segments):
  a=ring*segments+i;b=ring*segments+(i+1)%segments;c=(ring+1)*segments+(i+1)%segments;d=(ring+1)*segments+i;faces.extend([[(a,0,0),(b,0,0),(c,0,0)],[(a,0,0),(c,0,0),(d,0,0)]])
for offset,rev in [(0,True),((len(profile)-1)*segments,False)]:
 for i in range(1,segments-1):
  f=[(offset,0,0),(offset+i,0,0),(offset+i+1,0,0)];faces.append(list(reversed(f))if rev else f)
for verts,polygons in collision_meshes:
 offset=len(vs);vs.extend(verts)
 for f in polygons:
  for i in range(1,len(f)-1):faces.append([(offset+f[0],0,0),(offset+f[i],0,0),(offset+f[i+1],0,0)])
name='evening-star-shuttle-ground-collider-hull.obj';write_obj(A/name,vs,[(.1,.1)],[(0,0,1)],faces);new.append(dict(key=current,layer='ground',file=name,texture='meridian-r2-materials.jpg',physics=True,triangles=len(faces)))
(R/'Source/new-models.json').write_text(json.dumps(old+new,indent=2));bpy.ops.wm.save_as_mainfile(filepath=str(R/'Source/Shuttle-R4.blend'))
