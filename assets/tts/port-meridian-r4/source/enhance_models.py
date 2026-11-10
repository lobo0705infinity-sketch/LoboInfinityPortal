import bpy,pathlib,json,math
from mathutils import Vector
R=pathlib.Path('/workspace/scratch/f5b36afa893f/rebuild')
# Reuse the editable model scene, not the preview images.
source=(R/'Source/build_models.py').read_text().split('building_models();scatter_models();export();')[0]
source=source.replace("bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)", "")
exec(compile(source,'model-tools','exec'))
bpy.ops.wm.open_mainfile(filepath=str(R/'Source/Models-R4.blend'))
models={};physics={};mats={}
for o in list(bpy.data.objects):
 if 'cell' not in o:continue
 key=o.name.split(' | ')[0];models.setdefault(key,[]).append(o)
 if o.type=='MESH' and len(o.data.vertices)==8 and len(o.data.polygons)==6:
  for f in o.data.polygons:f.use_smooth=True
 for mod in o.modifiers:
  if mod.type=='BEVEL':mod.segments=4
old=json.loads((R/'Source/new-models.json').read_text())
for e in old:
 if not e['physics']:continue
 vs=[]
 for line in (A/e['file']).read_text().splitlines():
  if line.startswith('v '):x,y,z=map(float,line.split()[1:]);vs.append((x,-z,y))
 for start in range(0,len(vs),8):
  v=vs[start:start+8];p=tuple((min(q[i]for q in v)+max(q[i]for q in v))/2 for i in range(3));d=tuple(max(q[i]for q in v)-min(q[i]for q in v)for i in range(3));physics.setdefault((e['key'],e['layer']),[]).append((p,d,(0,0,0)))
# Distinct architectural silhouettes and fitted service equipment.
for current,w,d,h in [('customs-inspection',10,8,3.3),('port-clinic',7,6,3.35),('fuel-control',7,6,3.35),('north-security',6,4,3)]:
 layer='ground'
 if current=='customs-inspection':
  for x in [-3.8,3.8]:
   box('Inspection-bay buttress',(x,-d/2-.12,1.65),(.32,.35,3.0),1,.06,True)
  box('Raised loading sill',(2.6,-d/2-.18,.16),(2.2,.4,.3),11,.03,True)
  text('DECLARATIONS',(0,-d/2-.68,2.72),.13,12)
 elif current=='port-clinic':
  for x in [-2.7,2.7]:
   box('Medical facade panel',(x,-d/2-.12,1.65),(.42,.1,2.6),12,.03)
   box('Medical red accent',(x,-d/2-.185,1.65),(.28,.025,2.2),14,.01)
  sign('FIRST AID',(-1.9,-d/2-.12,.88),1.3,.35,14)
  for y in [-1.5,-.6,.3]:box('Sterile storage',(2.8,y,.9),(.5,.65,1.5),12,.04,True)
 elif current=='fuel-control':
  for z in [.75,1.0,1.25]:
   rod('External manifold',(-w/2-.08,-1.9,z),(-w/2-.08,1.8,z),.065,2)
   for y in [-1,1]:bolt(-w/2-.14,y,z,'X')
  layer='roof';cyl('Pressure vent',(1.9,-1.5,h+.7),.3,1.0,2);cyl('Weather cowl',(1.9,-1.5,h+1.24),.39,.10,11)
  for i in range(4):box('Roof cooling fin',(-1.2+i*.22,1.2,h+.45),(.08,.9,.5),11,.015)
 elif current=='north-security':
  for x in [-2.3,2.3]:
   rod('Camera bracket',(x,-d/2,2.65),(x,-d/2-.45,2.75),.035,2)
   box('Security camera',(x,-d/2-.5,2.75),(.25,.5,.2),12,.06);cyl('Camera lens',(x,-d/2-.76,2.75),.075,.025,3,'Y')
  layer='roof';box('Raised radio cabinet',(1.7,.7,h+.55),(.75,.8,.7),11,.07,True);rod('Radio mast',(1.7,.7,h+.8),(1.7,.7,h+1.6),.025,2)
  for z in [h+1.2,h+1.45]:rod('Antenna element',(1.4,.7,z),(2,.7,z),.018,2)
# The noodle counter has a pitched tiled roof, timber eaves and pendant lamps.
current='meridian-noodles'
for o in list(models[current]):
 if o['layer']=='roof':models[current].remove(o);bpy.data.objects.remove(o,do_unlink=True)
physics[(current,'roof')]=[];layer='roof'
for side in [-1,1]:
 o=box('Pitched roof',(0,side*1.06,3.35),(7.5,2.25,.15),1,.035)
 o.rotation_euler[0]=side*-.22;physics[(current,'roof')].append((tuple(o.location),tuple(o.dimensions),tuple(o.rotation_euler)))
 for x in [-3.3,-2.2,-1.1,0,1.1,2.2,3.3]:
  rod('Standing roof seam',(x,side*.05,3.63),(x,side*2.12,3.18),.025,2)
rod('Roof ridge',(-3.8,0,3.63),(3.8,0,3.63),.07,11)
layer='ground'
for x in [-2.8,2.8]:
 box('Timber porch post',(x,-2.25,1.4),(.15,.15,2.8),4,.025,True)
for x in [-2,-1,0,1,2]:
 rod('Pendant cable',(x,-2.2,3),(x,-2.2,2.65),.01,3);cyl('Lantern',(x,-2.2,2.5),.13,.3,7)
 for a in range(4):
  theta=a*math.pi/2;rod('Lantern cage',(x+.14*math.cos(theta),-2.2+.14*math.sin(theta),2.35),(x+.14*math.cos(theta),-2.2+.14*math.sin(theta),2.65),.009,2)
# Extra manufacturing details on scatter, sized to remain within its cover profile.
layer='ground';current='ticket-kiosk'
text('EVENING STAR',(0,-.42,1.83),.064,12);text('BOARDING / 19:40',(0,-.42,1.47),.046,8)
for x in [-.4,.4]:
 for z in [1.36,1.96]:bolt(x,-.42,z,r=.018)
for x in [-.38,.38]:
 for y in [-.26,.26]:cyl('Anchoring bolt',(x,y,.21),.036,.025,2,vertices=6)
current='baggage-cart'
for x,y,h in [(-.5,-.2,.85),(.4,-.1,1.1),(.15,.35,.7)]:
 for xx in [x-.22,x+.22]:
  cyl('Case roller',(xx,y-.2,.43),.065,.06,3,'X')
  rod('Recessed pull handle',(xx,y+.22,.6),(xx,y+.22,.3+h),.015,2)
 for z in [.51,.3+h]:box('Luggage end reinforcement',(x,y-.275,z),(.58,.025,.05),3,.01)
 box('Bag tag',(x+.12,y-.29,.5+h*.5),(.12,.02,.22),12,.009)
current='ground-power'
text('GPU 28V / 400Hz',(-.15,-.74,1.49),.10,12)
for x in [-.85,.85]:
 for z in [.65,1.45]:bolt(x,-.7,z,r=.022)
for current in ['cargo-teal','cargo-olive','cargo-rust']:
 for x in [-1.1,1.1]:
  for z in [.22,1.22]:bolt(x,-.76,z,r=.028)
 for x in [-.85,.85]:
  box('Tie-down strap',(x,0,1.49),(.09,1.48,.025),3,.01)
  box('Strap buckle',(x,-.78,.75),(.15,.06,.18),2,.02)
# A distinct open-sky Launching Tower: four actual wide gate apertures.
current='boarding-control';layer='ground';w=d=8;h=3.3
box('Tower floor',(0,0,.07),(8,8,.14),5,.02,True)
for y in [-3.88,3.88]:wall_run('X',y,8,h,[(-1.2,1.2,.14,2.7)])
for x in [-3.88,3.88]:wall_run('Y',x,7.52,h,[(-1.2,1.2,.14,2.7)])
for x in [-3.9,3.9]:
 for y in [-3.9,3.9]:
  box('Tower corner pier',(x,y,1.7),(.28,.28,3.4),1,.04)
  box('Tower warning light',(x,y,3.48),(.18,.18,.2),7,.03)
sign('LAUNCH CONTROL',(0,-4.04,3.05),3.6,.4)
for y in [-4.025,4.025]:
 for x in [-2.65,2.65]:box('Tower pilaster',(x,y,1.65),(.22,.1,3),1,.02)
for p in A.glob('*.obj'):p.unlink()
export();bpy.ops.wm.save_as_mainfile(filepath=str(R/'Source/Models-R4-Enhanced.blend'))
print('ENHANCED models exported',len(models),flush=True)
