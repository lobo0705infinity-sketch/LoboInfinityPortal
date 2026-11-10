import bpy,math,random,json,pathlib,hashlib
from mathutils import Vector
R=pathlib.Path('/workspace/scratch/f5b36afa893f/rebuild');A=R/'Assets';A.mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
random.seed(27);models={};physics={};current='';layer='ground'
atlas=pathlib.Path('/workspace/scratch/f5b36afa893f/repo/assets/tts/port-meridian-r2/meridian-r2-materials.jpg')
art=atlas.with_name('port-meridian-artwork.jpg');mats={}
def material(cell,texture='atlas'):
 key=(cell,texture)
 if key in mats:return mats[key]
 m=bpy.data.materials.new(str(key));m.use_nodes=True;t=m.node_tree.nodes.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(atlas if texture=='atlas'else art),check_existing=True)
 p=m.node_tree.nodes.get('Principled BSDF');m.node_tree.links.new(t.outputs['Color'],p.inputs['Base Color']);p.inputs['Roughness'].default_value=.78
 if cell in (2,3,11):p.inputs['Metallic'].default_value=.25
 mats[key]=m;return m
def finish(o,name,cell,bevel=0,solid=False,texture='atlas'):
 o.name=current+' | '+name;o['cell']=cell;o['layer']=layer;o['texture']=texture;o.data.materials.append(material(cell,texture));models.setdefault(current,[]).append(o)
 if bevel:
  mod=o.modifiers.new('Machined edges','BEVEL');mod.width=bevel;mod.segments=4
  mod=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');mod.keep_sharp=True
 if solid:
  physics.setdefault((current,layer),[]).append((tuple(o.location),tuple(o.dimensions),tuple(o.rotation_euler)))
 return o
def box(name,p,d,cell=0,b=.025,solid=False):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.dimensions=d;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 for face in o.data.polygons:face.use_smooth=True
 return finish(o,name,cell,b,solid)
def cyl(name,p,r,h,cell=2,axis='Z',vertices=16):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=h,location=p);o=bpy.context.object
 if axis=='X':o.rotation_euler[1]=math.pi/2
 if axis=='Y':o.rotation_euler[0]=math.pi/2
 for f in o.data.polygons:f.use_smooth=len(f.vertices)==4
 return finish(o,name,cell,.009)
def rod(name,a,b,r=.025,cell=2):
 a,b=Vector(a),Vector(b);o=cyl(name,(a+b)/2,r,(b-a).length,cell);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
def bolt(x,y,z,axis='Y',r=.024):return cyl('Fastener',(x,y,z),r,.025,2,axis,vertices=6)
def text(label,p,size=.22,cell=12):
 cu=bpy.data.curves.new('engraved label','FONT');cu.body=label;cu.align_x='CENTER';cu.size=size;cu.extrude=.004;cu.bevel_depth=.001
 o=bpy.data.objects.new(label,cu);bpy.context.collection.objects.link(o);o.location=p;o.rotation_euler=(math.pi/2,0,0);finish(o,'Lettering '+label,cell)
 return o
def sign(label,p,w=2.2,h=.5,cell=1):
 x,y,z=p;box('Enamel sign rim',(x,y,z),(w,.09,h),2,.028);box('Enamel sign face',(x,y-.052,z),(w-.08,.025,h-.08),cell,.015);text(label,(x,y-.07,z-h*.17),min(.24,w/max(len(label),1)*1.4))
 for a in [-1,1]:
  for c in [-1,1]:bolt(x+a*(w/2-.08),y-.075,z+c*(h/2-.08),r=.015)
def vent(p,w=.8,h=.5):
 x,y,z=p;box('Vent frame',(x,y,z),(w,.09,h),2,.02);box('Vent recess',(x,y-.05,z),(w-.08,.025,h-.08),3,.006)
 for i in range(6):box('Louver',(x,y-.075,z-h*.35+i*h*.14),(w-.12,.035,.025),11,.006)
def screen(p,w=.65,h=.45):
 x,y,z=p;box('Screen housing',(x,y,z),(w+.09,.12,h+.09),3,.035);box('Glass display',(x,y-.068,z),(w,.018,h),6,.01)
 for i in range(4):box('Interface line',(x-w*.1,y-.08,z+h*.3-i*h*.18),(w*(.55-i*.08),.008,.012),8,.002)
def hvac(x,y,z,w=1.5):
 box('HVAC plinth',(x,y,z+.08),(w+.12,.95,.16),11,.03,True);box('Compressor housing',(x,y,z+.43),(w,.85,.58),0,.06,True)
 for xx in [x-w*.28,x+w*.28]:
  cyl('Fan rim',(xx,y,z+.75),.24,.055,2)
  cyl('Fan well',(xx,y,z+.783),.2,.02,3)
  for i in range(9):
   a=i*math.tau/9;rod('Fan spokes',(xx,y,z+.80),(xx+.19*math.cos(a),y+.19*math.sin(a),z+.80),.008,2)
 vent((x,y-.435,z+.45),w*.8,.35)
 rod('Return duct',(x+w/2,y+.18,z+.5),(x+w/2+.32,y+.18,z+.5),.1,11)
def ladder(x,y,h):
 for yy in [y-.22,y+.22]:rod('Ladder rail',(x,yy,.25),(x,yy,h+.35),.035,2)
 for i in range(int(h/.25)):rod('Ladder tread',(x,y-.22,.25+i*.25),(x,y+.22,.25+i*.25),.028,2)
def wall_run(orientation,coord,length,height,openings):
 # Butt-joined segments; no coplanar wall boxes overlap at the corners.
 boundaries=sorted(set([-length/2,length/2]+[a for op in openings for a in op[:2]]))
 for left,right in zip(boundaries,boundaries[1:]):
  mid=(left+right)/2;op=next((q for q in openings if q[0]<=mid<=q[1]),None)
  ranges=[(.14,height)]if op is None else [(.14,op[2]),(op[3],height)]
  for low,high in ranges:
   if high-low<.015:continue
   p=(mid,coord,(low+high)/2)if orientation=='X'else(coord,mid,(low+high)/2)
   d=(right-left,.24,high-low)if orientation=='X'else(.24,right-left,high-low)
   box('Structural wall',p,d,0,.012,True)
 for left,right,low,high in openings:
  if low>.3:
   if orientation=='X':
    box('Window sill',((left+right)/2,coord-.025,low-.025),(right-left+.1,.34,.09),2,.018)
    for x in [left+.035,right-.035]:box('Window jamb',(x,coord-.01,(low+high)/2),(.06,.28,high-low),1,.012)
    box('Window lintel',((left+right)/2,coord-.01,high-.03),(right-left,.28,.06),1,.012)
   else:
    box('Window sill',(coord-.025,(left+right)/2,low-.025),(.34,right-left+.1,.09),2,.018)
    for y in [left+.035,right-.035]:box('Window jamb',(coord-.01,y,(low+high)/2),(.28,.06,high-low),1,.012)
def shell(key,w,d,h,label):
 global current,layer;current=key;layer='ground'
 box('Foundation',(0,0,.07),(w+.12,d+.12,.14),5,.028,True)
 # Floor is inset, so the slab and surface never occupy the same plane.
 box('Floor surface',(0,0,.151),(w-.48,d-.48,.022),5,.006)
 door=(-.7,.7,.14,2.5);windows=[(-w/2+.5,-1.1,1.1,2.35),(1.1,w/2-.5,1.1,2.35)] if w>6.5 else [(-w/2+.4,-1.05,1.1,2.35),(1.05,w/2-.4,1.1,2.35)]
 wall_run('X',-d/2+.12,w,h,[door]+windows);wall_run('X',d/2-.12,w,h,[door])
 sidewindows=[(-d/2+.55,d/2-.55,1.15,2.35)]
 wall_run('Y',-w/2+.12,d-.48,h,sidewindows);wall_run('Y',w/2-.12,d-.48,h,sidewindows)
 for x in [-w/2,w/2]:
  for y in [-d/2,d/2]:box('Corner protector',(x,y,h/2),(.16,.16,h-.1),11,.022)
 for y in [-d/2-.018,d/2+.018]:
  box('Lower facade band',(0,y,.45),(w-.2,.05,.2),1,.012)
  box('Cornice',(0,y,h-.11),(w+.12,.09,.16),1,.018)
 for x in [-w/2-.018,w/2+.018]:box('Side facade band',(x,0,.45),(.05,d-.2,.2),1,.012)
 box('Entrance threshold',(0,-d/2-.19,.10),(1.6,.4,.2),11,.025,True)
 box('Canopy fascia',(0,-d/2-.55,2.57),(2.3,1.15,.16),1,.045,True)
 for x in [-.9,.9]:rod('Canopy support',(x,-d/2,2.2),(x,-d/2-.9,2.5),.025,2)
 sign(label,(0,-d/2-.63,2.8),min(w-1,3.4),.47)
 for x in [-1,1]:
  box('Lamp backplate',(x,-d/2-.05,2.14),(.18,.1,.42),3,.028)
  box('Warm lamp lens',(x,-d/2-.12,2.14),(.12,.05,.3),7,.02)
  for dz in [-.11,0,.11]:rod('Lamp guard',(x-.08,-d/2-.16,2.14+dz),(x+.08,-d/2-.16,2.14+dz),.009,2)
 vent((w/2-.65,-d/2-.015,.72),.6,.38)
 ladder(w/2+.13,d/2-.75,h)
 rod('Downpipe',(-w/2-.1,d/2-.12,.25),(-w/2-.1,d/2-.12,h),.05,11)
 layer='roof'
 box('Roof slab',(0,0,h+.07),(w+.12,d+.12,.14),11,.025,True)
 box('Roof membrane',(0,0,h+.149),(w-.2,d-.2,.018),1,.005)
 for y in [-d/2,d/2]:box('Parapet coping',(0,y,h+.3),(w+.15,.16,.26),0,.028,True)
 for x in [-w/2,w/2]:box('Parapet coping',(x,0,h+.3),(.16,d-.16,.26),0,.028,True)
 hvac(w*.22,d*.12,h+.18)
 for i in range(3):box('Roof service pad',(-w*.22,-d*.18+i*.25,h+.18),(.7,.2,.03),2,.01)
 layer='ground'
def desk(x,y):
 box('Desk legs',(x,y,.65),(1.4,.65,1.0),0,.04,True);box('Desk top',(x,y,1.18),(1.55,.78,.12),4,.04,True);screen((x,y-.05,1.55),.65,.4)
 box('Keyboard',(x,y-.32,1.26),(.55,.2,.04),3,.012)
 for dx in [-.12,0,.12]:box('Keys',(x+dx,y-.32,1.286),(.06,.12,.01),11,.002)
def locker(x,y):
 box('Locker cabinet',(x,y,1.1),(.65,.52,1.9),11,.045,True)
 for z in [.7,1.6]:
  box('Locker door',(x,y-.275,z),(.58,.035,.78),1,.02);vent((x,y-.31,z+.22),.38,.18);rod('Door pull',(x+.18,y-.33,z-.12),(x+.18,y-.33,z+.08),.018,2)
def chair(x,y):
 for dx in [-.2,.2]:
  for dy in [-.18,.18]:rod('Seat leg',(x+dx,y+dy,.15),(x+dx,y+dy,.65),.025,2)
 box('Seat cushion',(x,y,.68),(.58,.56,.15),13,.06,True);box('Seat back',(x,y+.21,1.0),(.58,.13,.55),1,.055)
def bed(x,y):
 box('Bed frame',(x,y,.55),(1.0,2,.18),2,.035,True);box('Mattress',(x,y,.73),(.95,1.95,.22),12,.1,True);box('Pillow',(x,y+.65,.9),(.7,.42,.16),12,.07)
 for xx in [-.42,.42]:rod('Bed rail',(x+xx,y-.8,1.05),(x+xx,y+.85,1.05),.025,2)
 for yy in [-.7,.7]:
  for xx in [-.35,.35]:cyl('Caster',(x+xx,y+yy,.2),.12,.07,3,'X')
def building_models():
 shell('customs-inspection',10,8,3.3,'CUSTOMS / INSPECTION');desk(-2.6,1.8);chair(-2.6,2.6)
 for x in [1.2,2,2.8]:locker(x,2.9)
 box('Inspection bench',(1,-.1,.8),(2.7,1.1,1.25),11,.04,True);box('Inspection conveyor',(1,-.1,1.48),(2.9,1.2,.12),3,.035)
 for i in range(12):cyl('Conveyor roller',(-.3+i*.235,-.1,1.55),.065,.98,2,'Y')
 for x in [-.5,2.5]:
  box('Scanner upright',(x,-.1,2.12),(.16,1.2,1.3),1,.035)
 box('Scanner arch',(1,-.1,2.8),(3.15,1.2,.14),1,.04);screen((1,-.72,2.45),.8,.33)
 shell('port-clinic',7,6,3.35,'MERIDIAN / MEDICAL');bed(-1.8,.7);desk(1.5,1.9);locker(2.6,2.25)
 rod('IV stand',(-.9,1.4,.2),(-.9,1.4,2.5),.025,2);rod('IV hook',(-.9,1.4,2.5),(-.65,1.4,2.5),.025,2);box('Fluid bag',(-.65,1.4,2.15),(.16,.13,.42),12,.04)
 cyl('Oxygen cylinder',(-2.7,2,1.0),.17,1.5,10);cyl('Oxygen cap',(-2.7,2,1.79),.1,.1,2)
 box('Medical cross upright',(0,-3.01,1.6),(.16,.07,.6),14,.018);box('Medical cross arm',(0,-3.06,1.6),(.56,.07,.16),14,.018)
 shell('fuel-control',7,6,3.35,'FUEL / ENGINEERING');desk(1.5,1.8)
 for x in [-2.5,-1.6]:
  box('Switchgear',(x,2.3,1.3),(.75,.6,2.3),11,.04,True);screen((x,1.97,1.8),.5,.32)
  for z in [.5,.8,1.1]:box('Breaker handle',(x,1.93,z),(.3,.05,.08),3,.01)
 for x in [-2.8,-2.3,-1.8]:
  rod('Service pipe',(x,-1.5,.35),(x,-1.5,2.5),.075,2);cyl('Valve wheel',(x,-1.62,1.1),.2,.04,14,'Y')
  for i in range(4):
   a=i*math.tau/4;rod('Valve spokes',(x,-1.65,1.1),(x+.18*math.cos(a),-1.65,1.1+.18*math.sin(a)),.012,2)
 cyl('Fire extinguisher',(2.8,-1.9,.85),.14,1.2,14);rod('Hose',(2.9,-1.9,1.5),(3.05,-1.9,.7),.025,3)
 shell('north-security',6,4,3.0,'PORT SECURITY');desk(-1.3,.8);chair(-1.3,1.5);locker(1.7,1.35)
 for x in [.5,1.3]:screen((x,1.6,2.1),.6,.38)
 box('Access reader',(1.0,-1.94,1.25),(.25,.14,.4),3,.035);box('Reader lens',(1,-2.025,1.32),(.17,.02,.16),8,.01)
 shell('meridian-noodles',7,4,3,'MERIDIAN NOODLES')
 box('Service counter',(0,-.5,.7),(3.8,.7,1.1),4,.05,True);box('Stone counter',(0,-.5,1.3),(4,.85,.15),11,.04)
 box('Cooking island',(0,1.15,.8),(3.2,.65,1.2),11,.04,True)
 for x in [-.8,0,.8]:
  cyl('Hob ring',(x,1.15,1.44),.22,.045,3);cyl('Cooking pot',(x,1.15,1.6),.18,.28,2);rod('Pot handle',(x+.16,1.15,1.65),(x+.35,1.15,1.65),.025,3)
 box('Extractor hood',(0,1.15,2.3),(3.4,.9,.35),11,.08);vent((0,.68,2.3),2.8,.22)
 for x in [-1.5,-.75,0,.75,1.5]:cyl('Serving bowl',(x,-.5,1.43),.13,.12,12)
 for x in [-2.6,2.6]:chair(x,0)
def pod(x=0,y=0,z=0,scale=1,tint=1):
 box('Cargo case',(x,y,z+.73*scale),(2.4*scale,1.5*scale,1.45*scale),tint,.09*scale,True)
 for xx in [-1.06,1.06]:
  for yy in [-.64,.64]:box('Protective corner',(x+xx*scale,y+yy*scale,z+.73*scale),(.18*scale,.18*scale,1.5*scale),11,.035*scale)
 for xx in [-.75,0,.75]:box('Case reinforcing rib',(x+xx*scale,y-.765*scale,z+.73*scale),(.055*scale,.06*scale,1.18*scale),2,.012)
 for xx in [-.7,.7]:
  box('Recessed latch',(x+xx*scale,y-.795*scale,z+.98*scale),(.18*scale,.06*scale,.26*scale),3,.025)
  rod('Latch lever',(x+xx*scale,y-.84*scale,z+.9*scale),(x+xx*scale,y-.84*scale,z+1.07*scale),.022,2)
 box('Shipping label',(x+.48*scale,y-.80*scale,z+.5*scale),(.44*scale,.02*scale,.25*scale),12,.008)
 for i in range(7):box('Barcode',(x+(.3+i*.045)*scale,y-.816*scale,z+.5*scale),(.016*scale,.008,.15*scale),3,.001)
 text('PM / 041',(x-.48*scale,y-.81*scale,z+.44*scale),.12*scale,12)
def scatter_models():
 global current,layer;layer='ground'
 for key,tint in [('cargo-teal',1),('cargo-olive',10),('cargo-rust',9)]:current=key;pod(tint=tint)
 current='ground-power'
 box('Tow chassis',(0,0,.3),(2.45,1.35,.25),11,.06,True);box('Generator enclosure',(-.15,0,1.06),(2.1,1.25,1.25),1,.12,True)
 for x in [-.75,.6]:
  for y in [-.7,.7]:
   cyl('Rubber tire',(x,y,.35),.3,.18,3,'Y',24);cyl('Cast wheel hub',(x,y*1.12,.35),.14,.05,2,'Y')
 vent((-.15,-.65,1.18),1.55,.65);screen((.3,-.72,.85),.4,.26)
 for x in [-.5,.6]:rod('Lifting eye',(x,-.4,1.72),(x,.4,1.72),.03,2)
 rod('Tow arm',(1,0,.32),(1.8,0,.2),.055,2);cyl('Cable reel',(1.15,0,1.0),.34,.24,3,'X')
 for i in range(6):cyl('Cable wrap',(1.05+i*.04,0,1),.35,.025,3,'X')
 current='baggage-cart'
 box('Perforated cart bed',(0,0,.3),(2.1,1.3,.14),11,.04,True)
 for x in [-.84,.84]:
  for y in [-.52,.52]:cyl('Swivel caster',(x,y,.13),.13,.10,3,'Y');box('Caster fork',(x,y,.23),(.08,.18,.18),2,.01)
 for x in [-1,1]:
  for y in [-.61,.61]:rod('Tube corner',(x,y,.35),(x,y,1.6),.034,2)
 for z in [.6,1.1,1.57]:
  for y in [-.61,.61]:rod('Side rail',(-1,y,z),(1,y,z),.026,2)
 for x in [-1,1]:rod('Cart handle',(x,-.61,1.57),(x,.61,1.57),.035,2)
 # Soft luggage with corner guards, seams, wheels and handles.
 for i,(x,y,h,cell)in enumerate([(-.5,-.2,.85,6),(.4,-.1,1.1,13),(.15,.35,.7,9)]):
  box('Travel case',(x,y,.4+h/2),(.67,.52,h),cell,.1,True)
  for dx in [-.3,.3]:box('Case edge seam',(x+dx,y-.27,.4+h/2),(.018,.016,h-.14),2,.004)
  rod('Suitcase handle',(x-.14,y,.48+h),(x+.14,y,.48+h),.025,3)
 current='ticket-kiosk'
 box('Kiosk plinth',(0,0,.1),(1.1,.8,.2),11,.06,True);box('Pedestal',(0,.05,.68),(.72,.5,1.0),1,.1,True)
 box('Upper housing',(0,.04,1.6),(1.05,.7,.85),0,.12,True);screen((0,-.335,1.67),.78,.52)
 box('Ticket slot',(0,-.33,1.11),(.45,.08,.07),3,.012);box('Contactless reader',(.31,-.36,1.18),(.2,.07,.15),8,.02)
 sign('CHECK IN',(0,-.17,2.18),1.2,.3);vent((0,.38,1.55),.7,.45)
 current='passenger-bench'
 rod('Bench beam',(-1.2,0,.47),(1.2,0,.47),.08,2)
 for x in [-.85,.85]:
  box('Bench foot',(x,0,.08),(.52,.72,.15),11,.04);rod('Bench leg',(x,0,.1),(x,0,.55),.07,2)
 for x in [-.8,0,.8]:
  box('Sculpted seat',(x,-.03,.68),(.72,.65,.14),1,.09,True)
  box('Sculpted back',(x,.29,.98),(.72,.12,.65),1,.08)
  for i in range(3):box('Seat drainage groove',(x-.2+i*.2,-.06,.755),(.025,.4,.006),3,.003)
 for x in [-1.17,-.4,.4,1.17]:rod('Armrest leg',(x,0,.58),(x,0,1.02),.025,2);rod('Armrest',(x,-.25,1.02),(x,.26,1.02),.03,2)
 current='planted-divider'
 box('Cast planter',(0,0,.38),(2.4,.9,.76),5,.12,True);box('Soil bed',(0,0,.77),(2.18,.69,.04),13,.02)
 for x in [-.75,0,.75]:
  rod('Shrub stem',(x,0,.77),(x,.03,1.8),.045,13)
  for i in range(18):
   a=i*2.4;z=.98+i*.056;radius=.28
   p=(x+math.cos(a)*radius,math.sin(a)*.25,z);rod('Twig',(x,0,z-.1),p,.014,13)
   bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=p);o=bpy.context.object;o.scale=(.20,.11,.13);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);finish(o,'Olive foliage',10)
 current='baggage-tug'
 box('Vehicle chassis',(0,0,.42),(2.8,1.4,.32),11,.12,True);box('Power bonnet',(-.85,0,.93),(1.0,1.3,.72),1,.16,True)
 box('Rear battery case',(.98,0,.85),(.64,1.2,.65),0,.12,True)
 for x in [-.94,.9]:
  for y in [-.72,.72]:
   cyl('Vehicle tire',(x,y,.38),.34,.22,3,'Y',24);cyl('Wheel hub',(x,y*1.13,.38),.19,.04,2,'Y',16)
   for i in range(6):
    a=i*math.tau/6;bolt(x+.13*math.cos(a),y*1.17,.38+.13*math.sin(a),r=.018)
 for x in [-.35,.7]:
  for y in [-.56,.56]:rod('Cabin pillar',(x,y,.62),(x,y,2.2),.05,2)
 box('Cab roof',(.18,0,2.23),(1.45,1.4,.16),0,.14,True);chair(.37,0)
 rod('Steering column',(-.25,0,.62),(-.23,0,1.37),.04,3);cyl('Steering wheel',(-.23,0,1.4),.23,.035,3)
 for y in [-.46,.46]:box('Headlight',(-1.43,y,.94),(.045,.25,.18),7,.04)
 for x in [-1.45,1.4]:box('Bumper',(x,0,.45),(.14,1.5,.2),3,.06)
 vent((-1.42,0,.82),.7,.4)
def write_obj(path,verts,uvs,norms,faces):
 with open(path,'w')as f:
  f.write('# Port Meridian R4; exact inches, Y-up; safe import budgets.\n')
  for x,y,z in verts:f.write('v %.7g %.7g %.7g\n'%(x,z,-y))
  for u,v in uvs:f.write('vt %.7g %.7g\n'%(u,v))
  for x,y,z in norms:f.write('vn %.7g %.7g %.7g\n'%(x,z,-y))
  for face in faces:f.write('f '+' '.join('/'.join(str(i+1)for i in t)for t in face)+'\n')
def export():
 manifest=[];deps=bpy.context.evaluated_depsgraph_get();bpy.context.view_layer.update()
 for key,obs in models.items():
  for cat in sorted(set(o['layer']for o in obs)):
   vv=[];tt=[];nn=[];ff=[];index=0;vt={};uvt={};nt={}
   def emit():
    nonlocal vv,tt,nn,ff,index,vt,uvt,nt
    if not ff:return
    name=f'{key}-{cat}-{index}.obj';write_obj(A/name,vv,tt,nn,ff);manifest.append(dict(key=key,layer=cat,file=name,texture='meridian-r2-materials.jpg',physics=False,triangles=len(ff),face_corners=len(ff)*3));index+=1;vv=[];tt=[];nn=[];ff=[];vt={};uvt={};nt={}
   for o in obs:
    if o['layer']!=cat:continue
    ev=o.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles();cell=o['cell'];normalmatrix=o.matrix_world.to_3x3().inverted().transposed()
    for tri in me.loop_triangles:
     points=[o.matrix_world@me.vertices[i].co for i in tri.vertices]
     if (points[1]-points[0]).cross(points[2]-points[0]).length<1e-10:continue
     if len(ff)>=6000:emit()
     face=[]
     for vi,li in zip(tri.vertices,tri.loops):
      pos=tuple(round(v,7)for v in o.matrix_world@me.vertices[vi].co);normal=tuple(round(v,6)for v in (normalmatrix@me.corner_normals[li].vector).normalized())
      local=me.vertices[vi].co;ax=sorted(range(3),key=lambda i:abs(tri.normal[i]))[:2]
      u=max(.012,min(.988,.5+float(local[ax[0]])*.12));v=max(.012,min(.988,.5+float(local[ax[1]])*.12))
      uv=(round((cell%4+u)/4,7),round(1-(cell//4+1-v)/4,7))
      if pos not in vt:vt[pos]=len(vv);vv.append(pos)
      if uv not in uvt:uvt[uv]=len(tt);tt.append(uv)
      if normal not in nt:nt[normal]=len(nn);nn.append(normal)
      face.append((vt[pos],uvt[uv],nt[normal]))
     ff.append(face)
    ev.to_mesh_clear()
   emit()
 for (key,cat),boxes in physics.items():
  for start in range(0,len(boxes),18):
   vs=[];fs=[]
   for p,d,rot in boxes[start:start+18]:
    from mathutils import Euler
    matrix=Euler(rot).to_matrix();off=len(vs)
    vs += [tuple(Vector(p)+matrix@Vector((x*d[0]/2,y*d[1]/2,z*d[2]/2)))for x,y,z in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
    for a,b,c,d0 in [(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)]:fs.extend([[(off+a,0,0),(off+c,0,0),(off+b,0,0)],[(off+a,0,0),(off+d0,0,0),(off+c,0,0)]])
   name=f'{key}-{cat}-collider-{start//18}.obj';write_obj(A/name,vs,[(.1,.1)],[(0,0,1)],fs);manifest.append(dict(key=key,layer=cat,file=name,texture='meridian-r2-materials.jpg',physics=True,triangles=len(fs)))
 (R/'Source/new-models.json').write_text(json.dumps(manifest,indent=2));print('EXPORTED',len(manifest),'files',flush=True)
building_models();scatter_models();export();bpy.ops.wm.save_as_mainfile(filepath=str(R/'Source/Models-R4.blend'))
# Actual geometry close-ups, with the same material atlas consumed by TTS.
bpy.ops.object.light_add(type='AREA',location=(5,-10,15));bpy.context.object.data.energy=1800;bpy.context.object.data.size=9
bpy.ops.object.light_add(type='AREA',location=(-8,2,9));bpy.context.object.data.energy=1300;bpy.context.object.data.size=7
bpy.ops.object.camera_add();cam=bpy.context.object;s=bpy.context.scene;s.camera=cam;s.render.engine='CYCLES';s.cycles.samples=24;s.cycles.use_denoising=False;s.world.color=(.17,.17,.17);s.render.resolution_x=1400;s.render.resolution_y=1100;s.render.resolution_percentage=100
for key in models:
 for k,obs in models.items():
  for o in obs:o.hide_render=k!=key
 big=key in ['customs-inspection','port-clinic','fuel-control','north-security','meridian-noodles'];span=17 if key=='customs-inspection'else 13 if big else 5.2;target=Vector((0,0,1.3 if big else .8))
 cam.location=target+Vector((span*.85,-span,span*.80));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=span
 s.render.filepath=str(R/'Renders'/(key+'.png'));bpy.ops.render.render(write_still=True)
 if big:
  for o in models[key]:o.hide_render=o['layer']=='roof'
  s.render.filepath=str(R/'Renders'/(key+'-interior.png'));bpy.ops.render.render(write_still=True)
