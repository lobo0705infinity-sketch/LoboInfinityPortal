"""Verdant Exchange: measured, reproducible 48-inch Uplink Center terrain."""
from geometry import *
from components import cyl, ladder, wall, cabinet, hvac, case, staircase, ring
from shapely import affinity
from shapely.ops import unary_union
import copy, hashlib, re, sys

ROOT=Path(__file__).resolve().parents[1]
ASSET=ROOT/'Assets'
import geometry as G
G.ASSET=ASSET
URL='https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/'+(sys.argv[1] if len(sys.argv)>1 else 'main')+'/verdant-exchange-r1/Assets/'
TAG='LoboMap:VerdantExchangeR1'
BASE=1.0
STEP=3.25
meshes=G.meshes
objects=[]; layouts=[];building_checks=[]

def leaf(mesh,c,d,L=.22,W=.075,mat='foliage'):
 c=np.array(c);d=np.array(d);d=d/np.linalg.norm(d)
 across=np.cross(d,[0,1,0]);across/=np.linalg.norm(across)
 p=[c-d*L,c+across*W+[0,.035,0],c+d*L,c-across*W+[0,.035,0]]
 mesh.face(p,mat);mesh.face(p[::-1],mat)

def plant(m,x,z,y=0,h=1.2,seed=1,palm=False):
 rng=random.Random(seed)
 h*=rng.uniform(.78,1.12)
 cyl(m,(x,y,z),(x,y+h*.8,z),.032 if palm else .02,'wood',8,False)
 for j in range(8 if palm else 6):
  a=j*2.399+rng.uniform(-.22,.22);direction=np.array([math.cos(a),0,math.sin(a)])
  side=np.array([-math.sin(a),0,math.cos(a)])
  root=np.array([x,y+h*rng.uniform(.50,.85),z]);length=rng.uniform(.43,.78) if palm else rng.uniform(.28,.43)
  def center(t):return root+direction*length*t+np.array([0,.30*math.sin(math.pi*t)-.10*t,0])
  for t1,t2 in zip(np.linspace(0,1,7),np.linspace(0,1,7)[1:]):
   c1,c2=center(t1),center(t2);cyl(m,c1,c2,.012,'wood',5,False)
   if seed%3:
    # Broad, tapering, folded leaves with visibly curved midribs.
    w1=.21*math.sin(math.pi*t1);w2=.21*math.sin(math.pi*t2)
    for sign in [-1,1]:
     ps=[c1,c2,c2+side*w2*sign+[0,-.045,0],c1+side*w1*sign+[0,-.045,0]]
     m[0].face(ps,'foliage');m[0].face(ps[::-1],'foliage')
   else:
    for sign in [-1,1]:
     off=side*sign;leaf(m[0],c2+off*.11,off+direction*.35,.17*math.sin(math.pi*t2)+.025,.055)
 # The planter provides collision and cover; individual foliage stays visual.

def grow_bed(m,x,z,y=0,w=1.2,d=2.7,tall=False,seed=1):
 solid(m,(x,y+.30,z),(w,.60,d),'concrete')
 solid(m,(x,y+.61,z),(w-.12,.035,d-.12),'soil',collision=False)
 for xx in [-w/2+.13,w/2-.13]:
  cyl(m,(x+xx,y+.68,z-d/2+.12),(x+xx,y+.68,z+d/2-.12),.025,'metal',6,False)
 for i,zz in enumerate(np.arange(-d/2+.35,d/2,.43)):
  plant(m,x,z+zz,y+.63,1.35 if tall else .58,seed+i*7,tall)

def lab(w,d,floors,state,role='Lab'):
 m=pair();levels=floors if state in [1,2] or floors==1 else 1
 hx=w/2-.85;hz=-d/2+.85
 for k in range(levels):
  y=k*STEP
  p=box(-w/2,-d/2,w/2,d/2)
  if k:p=p.difference(box(hx-.60,hz-.60,hx+.60,hz+.60))
  slab(m,p,y,.15,'tile')
  coords=list(p.exterior.coords)
  # Ground entrances on opposing faces, upper doors only where a terrace exists.
  wall(m,[-w/2,-d/2],[w/2,-d/2],y+.15,STEP-.15,door=k==0,mat='concrete',reserve_intervals=[(w-1.5,w)])
  wall(m,[w/2,-d/2],[w/2,d/2],y+.15,STEP-.15,door=False,mat='plaster')
  wall(m,[w/2,d/2],[-w/2,d/2],y+.15,STEP-.15,door=k==0,mat='concrete')
  wall(m,[-w/2,d/2],[-w/2,-d/2],y+.15,STEP-.15,door=False,mat='plaster',reserve_intervals=[(d-1.4,d)])
  # Genuine room partitions: offset from the two entrance paths, with a 1.6-inch door.
  for za,zb in [(-d/2+.22,-.80),(.80,d/2-.22)]:
   solid(m,(-.45,y+1.38,(za+zb)/2),(.14,2.45,zb-za),'plaster')
  # Perimeter benches, cupboard, instruments and chairs leave a clear central aisle.
  for sign in [-1,1]:
   if role=='Comms' and sign==1:continue
   bx=sign*(w/2-.65)
   solid(m,(bx,y+.63,.35),(.9,.92,1.65),'blue')
   solid(m,(bx,y+1.115,.35),(1.02,.07,1.78),'counter')
   for zz in [-.22,.75]:
    cyl(m,(bx,y+1.16,zz),(bx,y+1.46,zz),.075,'silver',10,False)
   if d>=4.5:cabinet(m,bx,d/2-.48,y+.15,.72,1.65,.52,'blue')
   # Backless lab stool with actual legs.
   if d>=4.5:
    stoolx=bx-sign*.85
    solid(m,(stoolx,y+.75,1.15),(.46,.12,.46),'wood')
    for dx in [-.16,.16]:
     for dz in [-.16,.16]:cyl(m,(stoolx+dx,y+.15,1.15+dz),(stoolx+dx,y+.69,1.15+dz),.025,'metal',6,False)
  # Exposed pipework and junction boxes, kept away from doors/windows.
  for zz in [-d/2+.12,d/2-.12]:
   cyl(m,(-w/2+.3,y+.22,zz),(-w/2+.3,y+2.75,zz),.038,'rust',8,False)
  if role=='Comms':
   for zz in [-1.2,0,1.2]:cabinet(m,w/2-.48,zz,y+.15,.65,2.45,.65,'grille')
 if floors>1:
  ladder(m,hx,hz-.38,STEP,base_y=.15)
 # Permanent exterior ladder attaches to a solid corner, never a door or window.
 ladder(m,-w/2-.28,-d/2+.55,floors*STEP)
 if state==1:
  if role=='Archive':
   # Hollow barrel-vault roof; its visible and physical shells both disappear
   # in the interior state. This creates a different architectural silhouette.
   for i in range(14):
    xa=-w/2+i*w/14;xb=-w/2+(i+1)*w/14
    ya=STEP+.12+.9*math.sin(i*math.pi/14);yb=STEP+.12+.9*math.sin((i+1)*math.pi/14)
    points=[(xa,ya,-d/2-.08),(xa,ya,d/2+.08),(xb,yb,d/2+.08),(xb,yb,-d/2-.08)]
    for mm in m:
     mm.groups.append(len(mm.f));mm.face(points,'roof');mm.face([(x,y-.12,z) for x,y,z in points][::-1],'roof')
     for p,q in zip(points,points[1:]+points[:1]):mm.face([p,q,(q[0],q[1]-.12,q[2]),(p[0],p[1]-.12,p[2])],'metal')
   # Close both curved gables down to the wall head. These infill panels are
   # part of the roofed state only, so exposing the interior remains possible.
   profile=Polygon([(-w/2,STEP-.02),(w/2,STEP-.02)]+[(w/2-i*w/14,STEP+.9*math.sin(i*math.pi/14))for i in range(15)])
   for end in [-d/2,d/2]:
    cap=pair();slab(cap,profile,-.10,.20,'concrete')
    for mm in cap:
     mm.v=[(x,vertical,end+depth)for x,depth,vertical in mm.v]
     mm.f=[tuple(reversed(f))for f in mm.f]
    m[0].merge(cap[0]);m[1].merge(cap[1])
   return m
  roof=box(-w/2-.08,-d/2-.08,w/2+.08,d/2+.08)
  # An open ladder arrival pocket, with usable roof cover around the remaining edges.
  slab(m,roof,floors*STEP,.15,'roof')
  solid(m,(0,floors*STEP+.525,d/2),(w,.75,.16),'concrete')
  solid(m,(w/2,floors*STEP+.525,0),(.16,.75,d),'concrete')
  solid(m,(0,floors*STEP+.525,-d/2),(w,.75,.16),'concrete')
  solid(m,(-w/2,floors*STEP+.525,.7),(.16,.75,d-1.4),'concrete')
  hvac(m,w*.2,0,floors*STEP+.15,1.35,1.1,.7)
  if role=='Comms':
   cyl(m,(0,floors*STEP+.15,-d*.16),(0,floors*STEP+1.5,-d*.16),.045,'silver',10,False)
   # Dish is a shallow parabolic shell with separate feed arm; visual equipment.
   cy=floors*STEP+.95;cz=-d*.16
   for i in range(20):
    a=i*math.tau/20;b=(i+1)*math.tau/20
    m[0].face([(0,cy,cz),(.65*math.cos(a),cy+.23,cz+.65*math.sin(a)),(.65*math.cos(b),cy+.23,cz+.65*math.sin(b))],'silver')
   m[0].beam((0,cy,cz),(0,cy+.7,cz),.045,mat='metal')
 return m

def greenhouse(w,d,state,seed=10):
 m=pair();glass=pair()
 slab(m,box(-w/2,-d/2,w/2,d/2),0,.15,'tile')
 for z in [-d/2,d/2]:
  # Wide open ends allow miniatures to move through and around the growing beds.
  for x in [-(w/2+.80)/2,(w/2+.80)/2]:
   solid(m,(x,.72,z),(w/2-.80,1.15,.22),'concrete')
  for x in [-.82,.82]:solid(m,(x,1.78,z),(.11,3.26,.16),'metal')
  solid(m,(0,3.43,z),(w,.14,.16),'metal')
 for x in [-w/2,w/2]:
  solid(m,(x,.72,0),(.22,1.15,d),'concrete')
  for zz in np.linspace(-d/2,d/2,6):
   solid(m,(x,2.25,zz),(.12,2.25,.12),'metal')
  for yy in [1.32,2.35,3.43]:solid(m,(x,yy,0),(.10,.10,d),'metal')
 # A side door with a solid service vestibule breaks the greenhouse silhouette.
 solid(m,(w/2-.55,1.6,d*.27),(.85,2.90,1.5),'blue')
 cabinet(m,-w/2+.5,-d/2+.5,.15,.65,1.5,.55,'blue')
 # Central 2.0-inch walking aisle, with a 1.8-inch cross aisle halfway along.
 for sign in [-1,1]:
  for j,zz in enumerate([-d*.28,d*.28]):
   # Planting is exported separately so UV seams and detailed foliage cannot
   # push a greenhouse shell over TTS's model-import vertex budget.
   cyl(m,(sign*(w/2-.4),.95,zz-.7),(sign*(w/2-.4),.95,zz+.7),.04,'rust',8,False)
 if state==1:
  for zz in np.linspace(-d/2,d/2,7):
   m[0].beam((-w/2,3.5,zz),(0,4.5,zz),.10,mat='metal')
   m[0].beam((0,4.5,zz),(w/2,3.5,zz),.10,mat='metal')
  for xx in [-w/2,-w*.25,0,w*.25,w/2]:
   yy=4.5-abs(xx)*2/w
   m[0].beam((xx,yy,-d/2),(xx,yy,d/2),.075,mat='metal')
  # Solid central maintenance catwalk is distinct from the glazed slopes.
  solid(m,(0,4.53,0),(1.75,.12,d),'grating')
  solid(m,((w/2-.45)/2,4.53,-d/2-.32),(w/2-.45,.12,.75),'grating')
  for xx in [w/2-.45]:solid(m,(xx,3.99,-d/2-.32),(.10,1.02,.10),'metal')
  for sign in [-1,1]:
   a=[sign*.89,4.39,-d/2];b=[sign*w/2,3.5,-d/2];c=[sign*w/2,3.5,d/2];e=[sign*.89,4.39,d/2]
   glass[0].face([a,b,c,e],'glass');glass[0].face([e,c,b,a],'glass')
   # Actual thin roof colliders; removed together with the visible glass shell.
   for mm in [glass[1]]:
    mm.groups.append(len(mm.f));mm.face([a,b,c,e]);mm.face([[x,y-.035,z] for x,y,z in [e,c,b,a]])
    for p,q in [(a,b),(b,c),(c,e),(e,a)]:mm.face([p,q,[q[0],q[1]-.035,q[2]],[p[0],p[1]-.035,p[2]]])
 ladder(m,w/2-.45,-d/2-.85,4.5,180)
 return m,glass

def padded(m):
 maximum=max(v[1] for v in m[0].v)
 target=math.ceil(maximum*4-1e-6)/4
 if target-maximum>1e-6:
  x,_,z=max(m[0].v,key=lambda v:v[1]);solid(m,(x,(maximum+target)/2,z),(.045,target-maximum,.045),'metal',collision=False)
 return m

def model(key,m,x,z,a=0,label=None,kind='scenery',y=BASE):
 if kind!='planting-bed':padded(m)
 register(key,m)
 lo,hi=m[0].bounds();h=hi[1]-lo[1]
 g=hashlib.sha256(('VerdantExchangeR1:'+key).encode()).hexdigest()[:6]
 o={'GUID':g,'Name':'Custom_Model','Nickname':label or key,'Description':f'Height (base to top): {h:.2f} in\nVerdant Exchange | Uplink Center | 48 × 48 inches.\nUse physical geometry for cover, movement and line of fire.','Transform':dict(posX=x,posY=y,posZ=z,rotX=0,rotY=a,rotZ=0,scaleX=1,scaleY=1,scaleZ=1),'ColorDiffuse':dict(r=1,g=1,b=1),'Locked':True,'Grid':False,'Snap':False,'Hands':False,'Tooltip':True,'DragSelectable':True,'Tags':[TAG,'VerdantExchange',kind],'CustomMesh':{'MeshURL':URL+key+'.obj','DiffuseURL':URL+'verdant-materials.jpg','ColliderURL':URL+key+'-collider.obj','Convex':True,'MaterialIndex':3,'TypeIndex':0,'CastShadows':True},'LuaScript':'function onLoad() self.setLock(true) end\n','LuaScriptState':'','XmlUI':''}
 poly=Polygon(np.array(m[1].v)[:,[0,2]]).convex_hull if m[1].v else Polygon()
 poly=affinity.rotate(poly,-a,origin=(0,0));poly=affinity.translate(poly,x,z)
 layouts.append(dict(guid=g,mesh=key,label=label or key,x=x,z=z,angle=a,y=y,kind=kind,footprint=list(poly.exterior.coords) if not poly.is_empty else [],bounds=[lo,hi]))
 return o

SPECS=[
 ('Botanical Genetics Laboratory',-16,-16,7,6,1,'Lab',0),
 ('Research Administration',16,16,7,6,1,'Lab',180),
 ('Tropical Conservatory',-6,-17,8,8,1,'Greenhouse',0),
 ('Temperate Conservatory',6,17,8,8,1,'Greenhouse',180),
 ('Western Propagation House',-16,4,7,10,1,'Greenhouse',0),
 ('Eastern Propagation House',16,-4,7,10,1,'Greenhouse',180),
 ('Uplink Data Exchange',-4.25,-4,5,5,2,'Comms',45),
 ('Signal Analysis Laboratory',4.25,4,5,5,2,'Comms',225),
 ('Seed Vault',17,-18,5.5,6,1,'Archive',0),
 ('Specimen Archive',-17,18,5.5,6,1,'Archive',180),
 ('Nutrient Control',-6,7.5,5,5,1,'Lab',0),
 ('Irrigation Control',6,-7.5,5,5,1,'Lab',180),
 ('Southern Service Annex',5,-22,4.5,3,1,'Lab',0),
 ('Northern Service Annex',-5,22,4.5,3,1,'Lab',180),
]
for i,(name,x,z,w,d,f,role,a) in enumerate(SPECS):
 key=re.sub('[^a-z0-9]+','-',name.lower())
 main,glass=greenhouse(w,d,1,i*51) if role=='Greenhouse' else (lab(w,d,f,1,role),pair())
 o=model(key+'-roof',main,x,z,a,name+' | Roof on','building');o['States']={}
 for state in ([2,3] if f==2 else [2]):
  mm=greenhouse(w,d,state,i*51)[0] if role=='Greenhouse' else lab(w,d,f,state,role)
  label='Upper floor exposed' if f==2 and state==2 else 'Ground floor exposed'
  o['States'][str(state)]=model(key+'-state-'+str(state),mm,x,z,a,name+' | '+label,'building-state')
 roof_guid=o['GUID']
 roof=copy.deepcopy(o);roof.pop('States',None)
 lower=copy.deepcopy(o['States']['3'] if f==2 else o['States']['2'])
 lower['Tags']=[TAG,'VerdantExchange','building']
 lower['States']={'2':copy.deepcopy(o['States']['2']),'3':roof} if f==2 else {'2':roof}
 order='1 ground floor; 2 upper floor; 3 fully roofed view.' if f==2 else '1 ground floor; 2 fully roofed view.'
 for state_index,state_obj in [(1,lower)]+[(int(k),q)for k,q in lower['States'].items()]:
  state_obj['Description']+='\nStates: '+order+' Exterior access remains attached in every state.'
 objects.append(lower);o=lower
 if role=='Greenhouse':
  for sign in [-1,1]:
   for j,zz in enumerate([-d*.28,d*.28]):
    bed=pair();grow_bed(bed,sign*(w/2-1.05),zz,.15,1.45,max(1.4,d*.35),True,i*51+sign*40+j)
    bed_obj=model(key+'-planting-'+str(sign)+'-'+str(j),bed,x,z,a,name+' | Planting bed '+str((0 if sign==-1 else 2)+j+1),'planting-bed')
    bed_obj['Description']+='\nFixed ground-floor planting; stays aligned in every greenhouse state.'
    objects.append(bed_obj)
 if glass[0].v:
  q=model(key+'-glazing',glass,x,z,a,name+' | Removable roof glazing','glass')
  q['CustomMesh'].update(MaterialIndex=4,CastShadows=False)
  q['ColorDiffuse']=dict(r=.76,g=.9,b=.91,a=.26)
  q['Description']='Glazed roof follows the parent greenhouse state automatically. Only the central metal service spine is a roof walkway.'
  q['LuaScript']='local parent='+json.dumps(roof_guid)+'\nlocal home='+json.dumps(json.dumps({'x':x,'y':BASE,'z':z}))+'\n'+'''
local colors={'White','Brown','Red','Orange','Yellow','Green','Teal','Blue','Purple','Pink','Grey','Black'}
local timer=nil
local function sync()
 local p=getObjectFromGUID(parent)
 local visible=p and not p.isDestroyed()
 if visible then local a=p.getPosition();visible=math.abs(a.x)<26 and math.abs(a.z)<26 and a.y<20 end
 self.setPosition(visible and JSON.decode(home) or {90,24,90})
 self.setInvisibleTo(visible and {} or colors)
end
function onLoad()self.setLock(true);self.interactable=false;timer=Wait.time(sync,.3,-1);Wait.frames(sync,4)end
function onDestroy()if timer then Wait.stop(timer)end end
'''
  objects.append(q)
 building_checks.append(dict(name=name,x=x,z=z,w=w,d=d,floors=f,role=role,angle=a,main=o['GUID'],states=list(o['States'])))

# Covered service links between the genetics labs and propagation houses.
# Pillars stand outside a 1.9-inch continuous walking aisle; both ends are open.
for i,(x,z,a) in enumerate([(-16,-7.25,0),(16,7.25,180)]):
 m=pair()
 for xx in [-1.1,1.1]:
  for zz in [-5.45,-1.8,1.8,5.45]:
   solid(m,(xx,1.65,zz),(.12,3.3,.12),'metal')
  solid(m,(xx,3.34,0),(.15,.16,11.5),'metal')
 for zz in np.arange(-5.5,5.6,.5):solid(m,(0,3.46,zz),(2.4,.10,.32),'metal')
 objects.append(model('covered-walkway-'+str(i+1),m,x,z,a,'Covered service walkway '+str(i+1),'canopy'))

def equipment(kind,index):
 m=pair()
 if kind=='tanks':
  solid(m,(0,.08,0),(3.2,.16,2.1),'concrete')
  for x in [-.72,.72]:
   cyl(m,(x,.16,0),(x,2.55,0),.58,'silver',20)
   for y in [.4,1.3,2.3]:cyl(m,(x,y,0),(x,y+.055,0),.60,'metal',20,False)
   cyl(m,(x,.5,-.67),(x,2.0,-.67),.045,'rust',8,False)
   cyl(m,(x-.1,1.0,-.67),(x+.1,1.0,-.67),.026,'rust',8,False)
  cabinet(m,0,-.7,.16,.7,1.25,.45,'blue')
 elif kind=='screen':
  solid(m,(0,1.25,0),(3,2.5,.5),'concrete')
  for xx in [-1.3,1.3]:solid(m,(xx,.15,0),(.34,.3,1.35),'metal')
  for i in range(7):m[0].box((0,.40+i*.30,-.27),(2.6,.12,.05),'blue')
 elif kind=='grow':
  grow_bed(m,0,0,w=1.3,d=3.5,tall=True,seed=index)
 elif kind=='cooler':
  solid(m,(0,.08,0),(3,.16,2),'concrete');hvac(m,-.45,0,.16,1.7,1.65,2.1);cabinet(m,1.0,0,.16,.65,2.25,.8,'blue')
 elif kind=='cart':
  for x in [-.7,.7]:
   for z in [-.43,.43]:cyl(m,(x,.18,z-.05),(x,.18,z+.05),.18,'metal',12,False)
  solid(m,(0,.38,0),(1.8,.18,1.2),'wood');case(m,-.35,0,.47,.8,.85,.85,'blue');case(m,.5,0,.47,.65,.65,.8,'silver')
 else:
  solid(m,(0,1.2,0),(2.25,2.4,1.4),'blue')
  for z in [-.72,.72]:
   m[0].box((0,1.15,z),(1.95,1.75,.025),'grille')
   for x in [-.8,.8]:m[0].box((x,1.2,z*1.04),(.05,2,.05),'silver')
 return m

SCATTER=[
 ('tanks',-11,-8,0),('tanks',11,8,180),
 ('cooler',-20,-7,0),('cooler',20,7,180),
 ('server',-9,0,45),('server',9,0,225),
 ('screen',-3.5,1.25,45),('screen',3.5,-1.25,225),
 ('screen',-3,-9,0),('screen',3,9,180),
 ('tanks',-9,14,0),('tanks',9,-14,180),
 ('grow',3,-16,90),('grow',-3,16,270),
 ('grow',-21,11,0),('grow',21,-11,180),
 ('grow',-21,-11,0),('grow',21,11,180),
 ('screen',0,-8.25,90),('screen',0,8.25,270),
 ('cart',-21,-21,0),('cart',21,21,180),
 ('cart',-11,22,0),('cart',11,-22,180),
 ('grow',-4.75,11.25,90),('grow',4.75,-11.25,270),
 ('cooler',-11.5,-22,0),('cooler',11.5,22,180),
 ('server',-22,0,0),('server',22,0,180),
 ('cooler',-12.5,12,0),('cooler',12.5,-12,180),
 ('screen',-3.5,-10.75,0),('screen',3.5,10.75,180),
]
for i,(kind,x,z,a) in enumerate(SCATTER):
 objects.append(model('equipment-'+str(i+1),equipment(kind,100+i),x,z,a,kind.title()+' cluster '+str(i+1),'scatter'))

# Reuse Lobo's approved native console bundle at the existing mission positions.
# Names preserve the two Antenna roles and the central Tech-Coffin role.
console_template=json.loads((ROOT/'Source/console-template.json').read_text())
for i,z in enumerate([-12,0,12]):
 c=copy.deepcopy(console_template);c['GUID']=f'b9a00{i}'
 c['Nickname']='Console | '+('Central Tech-Coffin' if z==0 else 'Communication Antenna '+str(1 if z<0 else 2))
 c['Transform'].update(posX=0.,posY=BASE+.15,posZ=float(z),rotX=0.,rotY=270.,rotZ=0.)
 c['Tags']=[TAG,'VerdantExchange','mission'];c['Locked']=True;c['Grid']=False;c['Snap']=False
 c['Description']=console_template['Description']+'\nUplink Center objective at (0, '+str(z)+') inches. Approved console model used as the visible objective; 40 mm contact base.\n'+('Control as the central Tech-Coffin.' if z==0 else 'Activate and Control as a Communication Antenna.')
 c['LuaScriptState']='';c['XmlUI']=''
 for j,child in enumerate(c.get('ChildObjects',[])):
  child['GUID']=f'b9c{i}0{j}';child['Tags']=[TAG,'mission'];child['Locked']=True;child['Grid']=False;child['Snap']=False
 c['LuaScript']='function onLoad()\n self.setLock(true)\n Wait.condition(function() Wait.frames(function()\n  if self.isDestroyed()then return end\n  local b=self.getBounds();if b and b.center and b.size then local p=self.getPosition();p.y=p.y+1.012-(b.center.y-b.size.y/2);self.setPosition(p)end\n end,4)end,function()if self.isDestroyed()or self.loading_custom then return false end;local p=self.getPosition();return math.abs(p.x)<25 and math.abs(p.z)<25 and p.y<10 end,120)\nend\n'
 objects.append(c)

# Exact-sized model mat: no guessed native-tile scaling.
ground=pair();solid(ground,(0,-.06,0),(48,.12,48),'concrete')
for mm in ground:
 mm.uv=[((x+24)/48,(z+24)/48) for x,y,z in mm.v]
mat=model('verdant-ground',ground,0,0,0,'Verdant Exchange | 48 × 48 inch ground','ground')
mat['CustomMesh'].update(DiffuseURL=URL+'verdant-ground.jpg',MaterialIndex=0)
mat['CustomMesh'].update(MaterialIndex=3,CustomShader={'SpecularColor':{'r':0.,'g':0.,'b':0.},'SpecularIntensity':0.,'SpecularSharpness':0.,'FresnelStrength':0.})
mat['DragSelectable']=False
mat['Description']='48 × 48 inches. ITS18 Uplink Center. 300 points. Deployment along X=-24/+24; 16-inch-deep zones, fronts X=-8/+8. No additional terrain rules. Remove this anchor to clear the map.'
mat['LuaScript']='''function onLoad()self.setLock(true)end
function onDestroy()
 if Global.getVar('clearingVerdantR1')then return end
 Global.setVar('clearingVerdantR1',true)
 local list={};for _,o in ipairs(getAllObjects())do if o~=self and o.hasTag('''+json.dumps(TAG)+''')then list[#list+1]=o end end
 for _,o in ipairs(list)do o.destruct()end
 Global.setVar('clearingVerdantR1',false)
end
'''
objects.insert(0,mat)

template=json.load(open(ROOT/'Source/reference-bag.json'))['ObjectStates'][0]
controller=copy.deepcopy(next(o for o in template['ContainedObjects'] if 'local universalConfig=' in o.get('LuaScript','')))
controller['GUID']='b9fffe';controller['Nickname']='Verdant Exchange | Map Controls';controller['Tags']=[TAG,'controller']
controller['Transform'].update(posX=0,posY=24,posZ=0)
script=controller['LuaScript'].replace('d60000',mat['GUID']).replace('d6fffe','b9fffe').replace('LoboMap:8102b2',TAG).replace('Sirocco Wells','Verdant Exchange').replace('SIROCCO WELLS','VERDANT EXCHANGE').replace('PROVISIONING |','UPLINK CENTER |')
script=script.replace('thickness=.025/width','thickness=.085/width').replace('thickness=.015/width','thickness=.055/width')
def lua_config(name,fn):
 global script
 rx=re.compile(r'local '+name+r'=JSON.decode\((".*")\)')
 m=rx.search(script);data=json.loads(json.loads(m[1]));fn(data)
 script=script[:m.start(1)]+json.dumps(json.dumps(data,ensure_ascii=False))+script[m.end(1):]
lua_config('backgroundConfig',lambda d:d.update(day=URL+'verdant-day.jpg',night=URL+'verdant-night.jpg',category='Verdant Exchange'))
lua_config('universalConfig',lambda d:d.update(mat=mat['GUID'],shape='rect',depth=16,surface=BASE,tag=TAG))
pages=[
 ('Mission','Uplink Center | Verdant Exchange','48 × 48 inches; 300 points. Two Communication Antennas are at (0,-12) and (0,+12). One Tech-Coffin is at (0,0). Positions are X,Z in inches from board centre.\n\nOfficial mission:\nhttps://experience.corvusbelli.com/en/game-content/bf606d32-d933-4e1d-a6d9-5f92a9faef85'),
 ('Scoring','Score at game end','Each Antenna Activated by your side: 2 OP.\nEach Antenna you physically Control: 1 OP.\nControl the central Tech-Coffin: 3 OP.\nHave an Active Lieutenant: 1 OP.\n\nActivation and physical Control are separate. A Lieutenant must avoid Null, Isolated and Immobilized states to count as Active.'),
 ('Deployment','16-inch deployment','Deploy on opposite X edges. Each zone is 16 inches deep, placing the front lines at X=-8 and X=+8.\n\nNo deployment in Silhouette contact with an Antenna or the Tech-Coffin.\n\nDZ +4 and DZ +8 are measuring aids. There is no added exclusion-zone overlay. No HVT Model, Secure HVT or Classified Deck is used.'),
 ('Antennas','Activation and Control','A Specialist in Silhouette contact Activates with a Normal WIP Roll, spending a Short Skill. The enemy may Activate it later and take activation ownership.\n\nControl requires at least one non-Null troop Model in Silhouette contact and no enemy qualifying Model in contact. Markers cannot Control.\n\nOperational Learning: consecutive retries by the same troop, Skill and target receive +3 WIP on the second Order; +3 and +1SD from the third. Interruptions or success reset the sequence.'),
 ('Terrain','Campus terrain and interiors','Use normal Infinity movement, cover and line-of-fire rules. Planting beds, water equipment and campus paving have no added Difficult Terrain rule. Use the solid geometry.\n\nState 1 exposes the ground floor. State 2 exposes the upper floor on two-storey buildings. The final state is the fully roofed view: state 2 for single-storey buildings; state 3 for two-storey buildings. Exterior ladders remain in every state. Greenhouse roof glazing follows the roofed state. Planting beds remain in place.'),
 ('Controls','Controls and game end','The right-side drawer starts open. DZ, DZ +4, DZ +8, Booty, Metachemistry, Mission, Day, Night and Background Off are available.\n\nEach player opens mission references independently. Grid and snapping start off.\n\nThree Game Rounds; a turn beginning in Retreat! ends the game at that turn end.\n\nClear Table removes the complete map, including changed building states and glazing, and restores the prior background and lighting.'),
]
def luastr(s):return json.dumps(s,ensure_ascii=False)
page_lua='local siroccoPages={\n'+',\n'.join('{tab='+luastr(a)+',title='+luastr(b)+',body='+luastr(c)+'}' for a,b,c in pages)+'\n}'
script=re.sub(r'local siroccoPages=\{.*?\n\}',lambda m:page_lua,script,count=1,flags=re.S)
# Remove the donor's corner-zone writer. All deployment lines belong to the
# current mission's rectangular universal compositor.
script=re.sub(r'local function siroccoDraw\(\).*?\nend\nlocal function siroccoMount',
 'local function siroccoDraw()\n local mat=getObjectFromGUID(siroccoMat)\n if mat then loboUniversalWrite(mat,{})end\nend\nlocal function siroccoMount',script,count=1,flags=re.S)
controller['LuaScript']=script;controller['LuaScriptState']='';controller['XmlUI']=''
controller['Description']='Verdant Exchange: right-side mission, deployment, reference tables and environment controls.'
objects.append(controller)

bag=copy.deepcopy(template);bag['GUID']='b90000';bag['Nickname']='SET_ITS18 Uplink Center — Verdant Exchange R3'
bag['Description']='Drop on STAGE > DROP BAGS HERE.\nVerdant Exchange | Botanical research and communications campus.\n48 × 48 inches; 300-point Uplink Center.\n16-inch deployment zones from opposite X edges. Two 40 mm Antennas at (0,-12)/(0,+12), central 40 mm Tech-Coffin.\n14 varied buildings including four glazed conservatories, two midfield two-storey data centres and single-storey deployment labs, seed archives and utility houses. Furnished interiors, real openings, permanent ladders, crop beds, irrigation and service equipment.\nIndividual day/night backgrounds. Right-side controls, Booty, Metachemistry, independent DZ guides and per-player mission reference. Live TTS physics and playtesting remain unverified.'
bag['Tags']=['VerdantExchangeR1'];bag['ContainedObjects']=objects
records=[]
for o in objects:
 for q in [o]+list(o.get('States',{}).values()):
  records.append('--'+q['GUID']+','+','.join(f"{q['Transform'][k]:.6f}" for k in ['posX','posY','posZ','rotX','rotY','rotZ']))
bag['LuaScript']='\r\n'.join(records)+'\r\n';bag['LuaScriptState']='';bag['ColorDiffuse']=dict(r=.28,g=.5,b=.37)
path=ROOT/'Map-Bags/Verdant-Exchange-Uplink-Center-R3.json'
path.write_text(json.dumps({'ObjectStates':[bag]},ensure_ascii=False,separators=(',',':'))+'\n')
(ROOT/'Source/layout.json').write_text(json.dumps(layouts,indent=2))
(ROOT/'Source/buildings.json').write_text(json.dumps(building_checks,indent=2))
(ROOT/'Source/deployment-config.json').write_text(json.dumps({bag['GUID']:dict(mat=mat['GUID'],shape='rect',depth=16,surface=BASE,tag=TAG)},indent=2))
(ROOT/'Source/mission-pages.json').write_text(json.dumps(pages,ensure_ascii=False,indent=2))
print(json.dumps(dict(objects=len(objects),buildings=len(SPECS),states=sum(len(o.get('States',{})) for o in objects),meshes=len(meshes),triangles=sum(len(x['visual'].f) for x in meshes.values()),bag=str(path))))
