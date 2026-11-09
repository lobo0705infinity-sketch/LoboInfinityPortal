import json,math,copy,pathlib,re,shutil,random
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from shapely.geometry import box,Polygon,Point,LineString
from shapely.ops import unary_union,triangulate
from shapely import affinity

R=pathlib.Path(__file__).parent;O=R/'verdant-r4';A=O/'Assets';A.mkdir(parents=True,exist_ok=True)
SOURCE=json.load(open(R/'verdant-source.json'))['ObjectStates'][0]
BASE='https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/REVISION/verdant-exchange-r4/Assets/'
Image.open(R/'generated_images/exec-20d467b9-f8dd-42ff-b53d-889e64bbf486.png').convert('RGB').save(A/'campus-materials.jpg',quality=93,optimize=True)
shutil.copy(R/'verdant-r2/Assets/botanical-art.jpg',A/'botanical-art.jpg')
F='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';FB='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

class Mesh:
 def __init__(self):self.v=[];self.uv=[];self.f=[];self.boxes=[]
 def quad(self,vs,t=0,cols=4,rows=4):
  n=len(self.v);u=t%cols/cols;v=1-(t//cols+1)/rows;e=.003
  self.v+=vs;self.uv +=[(u+e,v+e),(u+1/cols-e,v+e),(u+1/cols-e,v+1/rows-e),(u+e,v+1/rows-e)];self.f +=[(n,n+1,n+2),(n,n+2,n+3)]
 def cube(self,x,y,z,w,h,d,t=0,solid=True):
  a=x-w/2;b=x+w/2;c=y;dd=y+h;e=z-d/2;f=z+d/2
  for q in [[(a,c,e),(b,c,e),(b,dd,e),(a,dd,e)],[(b,c,f),(a,c,f),(a,dd,f),(b,dd,f)],[(a,c,f),(a,c,e),(a,dd,e),(a,dd,f)],[(b,c,e),(b,c,f),(b,dd,f),(b,dd,e)],[(a,dd,e),(b,dd,e),(b,dd,f),(a,dd,f)],[(a,c,f),(b,c,f),(b,c,e),(a,c,e)]]:self.quad(q,t)
  if solid:self.boxes.append((x,y,z,w,h,d))
 def cylinder(self,x,y,z,r,h,t=6,n=12,solid=False):
  for i in range(n):
   a=2*math.pi*i/n;b=2*math.pi*(i+1)/n
   self.quad([(x+r*math.cos(a),y,z+r*math.sin(a)),(x+r*math.cos(b),y,z+r*math.sin(b)),(x+r*math.cos(b),y+h,z+r*math.sin(b)),(x+r*math.cos(a),y+h,z+r*math.sin(a))],t)
   self.quad([(x,y+h,z),(x+r*math.cos(a),y+h,z+r*math.sin(a)),(x+r*math.cos(b),y+h,z+r*math.sin(b)),(x,y+h,z)],t)
  if solid:self.boxes.append((x,y,z,r*2,h,r*2))
 def add(self,m):
  n=len(self.v);self.v+=m.v;self.uv+=m.uv;self.f +=[tuple(n+i for i in f) for f in m.f];self.boxes+=m.boxes
 def rotated(self,yaw,x=0,z=0,y=0):
  c=math.cos(math.radians(yaw));s=math.sin(math.radians(yaw));m=copy.deepcopy(self)
  m.v=[(x+c*a+s*d,b+y,z-s*a+c*d) for a,b,d in m.v]
  m.boxes=[]
  for a,b,d,w,h,dep in self.boxes:
   poly=affinity.translate(affinity.rotate(box(a-w/2,d-dep/2,a+w/2,d+dep/2),-yaw,origin=(0,0)),xoff=x,yoff=z)
   solids.append((poly,b+y,b+y+h))
  return m
 def save(self,name,collider=True):
  def write(m,p):
   lines=['# Verdant Exchange R4 | inches | Y-up | triangulated']+['v %.5f %.5f %.5f'%v for v in m.v]+['vt %.6f %.6f'%v for v in m.uv]+['f '+' '.join(f'{i+1}/{i+1}' for i in face) for face in m.f]
   p.write_text('\n'.join(lines)+'\n')
  write(self,A/(name+'.obj'))
  if collider:
   cm=Mesh()
   for q in self.boxes:cm.cube(*q,solid=False)
   if not cm.v:cm.cube(0,-.3,0,.01,.01,.01,solid=False)
   write(cm,A/(name+'-collider.obj'))

def slab(m,poly,y,h,t):
 for tri in triangulate(poly):
  if not poly.covers(tri.representative_point()):continue
  pts=list(tri.exterior.coords)[:3]
  m.quad([(a,y+h,b) for a,b in pts]+[(pts[0][0],y+h,pts[0][1])],t)
  bx0,bz0,bx1,bz1=poly.bounds;tu=t%4/4;tv=1-(t//4+1)/4
  m.uv[-4:]=[(tu+.003+(a-bx0)/max(.1,bx1-bx0)*.244,tv+.003+(b-bz0)/max(.1,bz1-bz0)*.244) for a,b in pts+[pts[0]]]
  m.quad([(a,y,b) for a,b in reversed(pts)]+[(pts[-1][0],y,pts[-1][1])],t)
 # Rectangular decomposition keeps concave roof holes accurate with few collider faces.
 rings=[list(poly.exterior.coords)]+[list(r.coords) for r in poly.interiors]
 xx=sorted(set(v[0] for ring in rings for v in ring));zz=sorted(set(v[1] for ring in rings for v in ring))
 for xa,xb in zip(xx,xx[1:]):
  for za,zb in zip(zz,zz[1:]):
   q=box(xa,za,xb,zb)
   if poly.covers(q):m.boxes.append(((xa+xb)/2,y,(za+zb)/2,xb-xa,h,zb-za))
 for (a,b),(c,d) in zip(poly.exterior.coords,list(poly.exterior.coords)[1:]):m.quad([(a,y,b),(c,y,d),(c,y+h,d),(a,y+h,b)],t)

def wall(m,a,b,height=3.25,door=False,windows=True,y=0,material=7):
 ax,az=a;bx,bz=b;dx=bx-ax;dz=bz-az;length=math.hypot(dx,dz);yaw=-math.degrees(math.atan2(dz,dx));w=Mesh()
 # Door widths exceed a 25 mm base, and actual gaps remain in the collider.
 cuts=[]
 if door:cuts.append((-0.72,.72,0,2.45,'door'))
 if windows and length>3.2:
  for center in np.arange(-length/2+1.05,length/2-.7,2.0):
   if door and abs(center)<1.5:continue
   cuts.append((center-.5,center+.5,1.12,2.22,'window'))
 bounds=sorted(set([-length/2,length/2]+[q for c in cuts for q in c[:2] if -length/2<q<length/2]))
 for l,r in zip(bounds,bounds[1:]):
  mid=(l+r)/2;opening=next((q for q in cuts if q[0]<mid<q[1]),None)
  if opening:
   _,_,low,high,kind=opening
   if low:w.cube(mid,y,0,r-l,low,.16,material)
   w.cube(mid,y+high,0,r-l,height-high,.16,material)
  else:w.cube(mid,y,0,r-l,height,.16,material)
 for l,r,low,high,kind in cuts:
  if l<-length/2 or r>length/2:continue
  for side in [l,r]:w.cube(side,y+low,0,.055,high-low,.22,1,False)
  w.cube((l+r)/2,y+high,0,r-l+.1,.065,.22,1,False)
  if low:w.cube((l+r)/2,y+low,0,r-l+.1,.065,.25,6,False)
 w.cube(0,y+.03,0,length,.13,.19,0,False)
 w.cube(0,y+height-.12,0,length,.12,.24,1,False)
 # Oriented local wall contributes precise boxes instead of an invisible building hull.
 c=math.cos(math.radians(yaw));s=math.sin(math.radians(yaw));w.v=[((ax+bx)/2+c*x+s*z,yy,(az+bz)/2-s*x+c*z) for x,yy,z in w.v]
 w.boxes=[((ax+bx)/2+c*x+s*z,yy,(az+bz)/2-s*x+c*z,abs(c)*wi+abs(s)*dep,hh,abs(s)*wi+abs(c)*dep) for x,yy,z,wi,hh,dep in w.boxes]
 m.add(w)

def ladder(m,x,z,base=0,h=3.6):
 for a in [-.48,.48]:m.cube(x+a,base,z,.07,h,.12,6)
 for y in np.arange(base+.2,base+h,.24):m.cube(x,y,z,.96,.055,.12,6,False)

def furnishing(m,rect,kind=0,y=0):
 xmin,zmin,xmax,zmax=rect;cx=(xmin+xmax)/2;cz=(zmin+zmax)/2
 # All equipment remains against side walls; leave a clear central circulation strip.
 if kind%5 in [0,1]:
  x=xmin+.7;z=cz
  m.cube(x,y,z,1,1,.0+min(2.6,zmax-zmin-1),8);m.cube(x,y+1,z,1.08,.1,min(2.7,zmax-zmin-.8),14)
  for offset in [-.7,.5]:
   m.cube(x,y+1.1,z+offset,.55,.17,.55,6,False);m.cylinder(x,y+1.25,z+offset,.08,.35,6,8)
   m.cube(x+.2,y+1.5,z+offset,.3,.1,.28,1,False)
  if kind%5==1:
   m.cube(xmax-.5,y,cz,.65,2.2,min(1.6,zmax-zmin-1),1)
   for h in [.25,.65,1.05,1.45,1.85]:m.cube(xmax-.85,y+h,cz,.035,.28,1.4,14,False)
 elif kind%5==2:
  for z in [zmin+.5,zmax-.5]:
   m.cube(cx,y,z,min(2.5,xmax-xmin-1),.9,.6,9);m.cube(cx,y+.9,z,min(2.6,xmax-xmin-.8),.1,.65,14)
  m.cube(xmin+.5,y,cz,.6,2.1,1.3,8)
 elif kind%5==3:
  m.cube(xmin+.5,y,cz,.7,1.6,min(2.5,zmax-zmin-1),8)
  for zz in np.arange(zmin+.5,zmax-.4,.45):m.cube(xmin+.08,y+.3,zz,.04,1.1,.32,14,False)
  m.cube(xmax-.5,y,zmax-.6,.8,1.1,.9,6)
 else:
  m.cube(cx,y,zmax-.7,min(2.5,xmax-xmin-1),.5,.8,1);m.cube(cx,y+.5,zmax-.7,min(2.5,xmax-xmin-1),.14,.8,12)
  m.cube(xmin+.6,y,cz,.8,.8,1.2,8);m.cube(xmin+.6,y+.8,cz,.9,.07,1.3,14)

# Add detailed role-specific fixtures while preserving an open central aisle.
_basic_furnishing=furnishing
def furnishing(m,rect,kind=0,y=0):
 xmin,zmin,xmax,zmax=rect;cx=(xmin+xmax)/2;cz=(zmin+zmax)/2
 if xmax-xmin<2.8:
  m.cube(cx,y,zmax-.3,max(.6,xmax-xmin-.35),.9,.45,8);m.cube(cx,y+.9,zmax-.3,max(.6,xmax-xmin-.3),.07,.48,14);return
 _basic_furnishing(m,rect,kind,y)
 if xmax-xmin>4.5:
  for xx in [cx-.55,cx+.55]:
   m.cube(xx,y+.1,cz,.65,.13,.65,1,False)
   for zz in [-.25,.25]:m.cube(xx,y,cz+zz,.06,.55,.06,6,False)
   m.cube(xx,y+.6,cz,.7,.08,.7,8,False);m.cube(xx,y+.68,cz+.31,.7,.65,.08,8,False)
 # Specimen jars, drawer pulls and shelf contents are actual geometry.
 for zz in np.arange(zmin+.55,zmax-.45,.42):
  m.cube(xmin+.16,y+.28,zz,.04,.035,.22,6,False)
  m.cube(xmin+.16,y+.64,zz,.04,.035,.22,6,False)
  if kind%5 in [0,1,3]:
   m.cylinder(xmin+.64,y+1.12,zz,.075,.21,11,8)
   m.cylinder(xmin+.64,y+1.33,zz,.08,.035,6,8)
 if kind%5==3:
  x=xmax-.32
  for h in [.4,.95,1.5,2.05]:
   m.cube(x,y+h,cz,.45,.06,min(2.8,zmax-zmin-1),6)
   for zz in np.arange(zmin+.55,zmax-.45,.38):m.cube(x,y+h+.06,zz,.32,.28,.25,8,False)
  for zz in [zmin+.35,zmax-.35]:m.cube(x,y,zz,.06,2.35,.06,1,False)

solids=[];objects=[];places={};gid=0xe90000;building_records=[];signs=Mesh();art=Mesh()
template=SOURCE['ContainedObjects'][1]
def allocate():
 global gid
 gid+=1;return f'{gid:06x}'
def objectmesh(name,mesh,filename,x=0,z=0,yaw=0,texture='campus-materials.jpg',state_meshes=None,y=1):
 guid=allocate();mesh.save(filename);o=copy.deepcopy(template);o['GUID']=guid;o['States']={};o['Nickname']=name;o['Description']='Verdant Exchange R4 | New campus layout';o['LuaScript']='function onLoad() self.setLock(true) end';o['LuaScriptState']='';o['Tags']=['VerdantExchange','LoboMap:VerdantExchangeR4General'];o['Tooltip']=True
 o['Transform'].update(posX=70,posY=100,posZ=70,rotX=0,rotY=yaw,rotZ=0,scaleX=1,scaleY=1,scaleZ=1)
 o['CustomMesh'].update(MeshURL=BASE+filename+'.obj',DiffuseURL=BASE+texture,NormalURL='',ColliderURL=BASE+filename+'-collider.obj',Convex=False,MaterialIndex=3)
 places[guid]=[x,y,z,0,yaw,0]
 if state_meshes:
  for k,(suffix,sm) in enumerate(state_meshes,2):
   sm.save(filename+'-'+str(k));st=copy.deepcopy(o);st['GUID']=allocate();st.pop('States',None);st['Nickname']=name.split(' |')[0]+' | '+suffix;st['CustomMesh']['MeshURL']=BASE+filename+'-'+str(k)+'.obj';st['CustomMesh']['ColliderURL']=BASE+filename+'-'+str(k)+'-collider.obj';o['States'][str(k)]=st;places[st['GUID']]=[x,y,z,0,yaw,0]
 objects.append(o)
 # Occupancy represents the exposed-ground state; doors/interiors are traversable.
 for a,b,c,w,h,d in mesh.boxes:
  pp=affinity.translate(affinity.rotate(box(a-w/2,c-d/2,a+w/2,c+d/2),-yaw,origin=(0,0)),xoff=x,yoff=z)
  if y+b+h>1.6:solids.append((pp,y+b,y+b+h))
 return o

# New ground geometry follows the garden/service split. No inherited straight road.
ground=Mesh()
for x in np.arange(-24,24,4):
 for z in np.arange(-24,24,4):
  t=13 if x>=10 else 3
  ground.cube(x+2,-.12,z+2,4,.12,4,t)
objectmesh('Verdant Exchange | 48 x 48 inch campus ground',ground,'r4-ground')

def makebuilding(code,name,x,z,rects,levels=1,role=0,yaw=0,internal=None):
 footprint=unary_union([box(*r) for r in rects]);assert footprint.geom_type=='Polygon'
 h=3.2;g=Mesh();slab(g,footprint,0,.14,2)
 coords=list(footprint.exterior.coords)
 # Two real entrances on distinct long edges. Door placement is structural, not painted.
 lengths=[LineString([a,b]).length for a,b in zip(coords,coords[1:])]
 door_edges=sorted(range(len(lengths)),key=lambda k:lengths[k],reverse=True)[:2]
 for i,(a,b) in enumerate(zip(coords,coords[1:])):wall(g,a,b,h,door=i in door_edges,windows=True)
 for j,rr in enumerate(rects):furnishing(g,rr,role+j)
 if internal:
  for a,b in internal:wall(g,a,b,h,door=True,windows=False,material=8)
 # Ladder occupies its own rear corner, clear of workbenches and every doorway.
 xmin,zmin,xmax,zmax=footprint.bounds;lx=xmax-.75;lz=zmax-.55
 # Use a footprint corner which actually lies inside an L-shaped wing.
 if not footprint.contains(Point(lx,lz)):lx=xmin+.75;lz=zmax-.55
 lx,lz={'01':(-2,1),'02':(-2.2,2.5),'03':(0,1.8),'04':(.7,1.8),'05':(1.5,1.5),'06':(1.8,1),'07':(1.5,1.7),'08':(.3,1.65),'09':(0,-2),'10':(1.5,1.5),'11':(1.3,-1.2),'12':(.5,1.1),'14':(-2,.65),'15':(1.4,1)}[code]
 ladder(g,lx,lz,.15,h+.5)
 hole=box(lx-.66,lz-.42,lx+.66,lz+.42)
 roof=copy.deepcopy(g);slab(roof,footprint.difference(hole),h,.15,9)
 for a,b in zip(coords,coords[1:]):wall(roof,a,b,.55,False,False,y=h+.15,material=0)
 roof.cube(xmin+.65,h+.15,zmin+.65,1.0,.6,.95,9);roof.cube(xmin+.65,h+.75,zmin+.65,.9,.04,.85,10,False)
 if role%3==0:
  roof.cube(xmin+1.5,h+.15,zmin+1.25,2.5,.45,.85,0);roof.cube(xmin+1.5,h+.6,zmin+1.25,2.35,.2,.72,5,False)
 else:
  for xx in [xmin+1.5,xmin+2.3]:roof.cylinder(xx,h+.15,zmin+.6,.25,.8,6,12)
 for a,b in zip(coords,coords[1:]):
  # Protective eaves and contrasting cladding edges add depth without overhangs into doors.
  mx,mz=(a[0]+b[0])/2,(a[1]+b[1])/2
  if abs(a[0]-b[0])<.01:roof.cube(mx,h+.1,mz,.29,.13,abs(a[1]-b[1]),1,False)
  else:roof.cube(mx,h+.1,mz,abs(a[0]-b[0]),.13,.29,1,False)

 # Roof access is an actual opening in the mesh and collider.
 if levels==2:
  upper=copy.deepcopy(roof)
  # A smaller, setback upper floor creates a different profile and protected terrace.
  upperpoly=box(xmin+.35,zmin+.35,min(xmin+4.6,xmax-.35),min(zmin+4.5,zmax-.35))
  upperpoly=upperpoly.intersection(footprint)
  uc=list(upperpoly.exterior.coords)
  for i,(a,b) in enumerate(zip(uc,uc[1:])):wall(upper,a,b,h,door=i==0,windows=True,y=h+.15,material=8)
  ux0,uz0,ux1,uz1=upperpoly.bounds
  upper.cube(ux0+.55,h+.15,(uz0+uz1)/2,.8,1,1.4,8);upper.cube(ux0+.55,h+1.15,(uz0+uz1)/2,.85,.08,1.45,14)
  # Continue internally to the upper roof from within the smaller second storey.
  ux,uz=upperpoly.centroid.x,upperpoly.bounds[3]-1.0
  ladder(upper,ux,uz,h+.15,h+.4)
  closed=copy.deepcopy(upper);uhole=box(ux-.66,uz-.42,ux+.66,uz+.42)
  slab(closed,upperpoly.difference(uhole),2*h+.15,.15,9)
  for a,b in zip(uc,uc[1:]):wall(closed,a,b,.45,False,False,y=2*h+.3,material=0)
  # Large upper floor never becomes an empty DZ hangar: furnishings and partitions.
  state_meshes=[('Upper floor exposed',upper),('Roof on',closed)]
 else:state_meshes=[('Roof on',roof)]
 ob=objectmesh(name+' | Ground floor exposed',g,'r4-building-'+code,x,z,yaw,state_meshes=state_meshes)
 building_records.append({'code':code,'name':name,'guid':ob['GUID'],'x':x,'z':z,'yaw':yaw,'levels':levels,'footprint':list(footprint.exterior.coords),'door_edges':door_edges,'ladder_local':[lx,lz]})
 # Signs sit flat on solid upper wall bands, below the coping; no freestanding frame.
 # Locate on the longest edge and point the readable face away from its backing wall.
 edge=door_edges[0];(ax,az),(bx,bz)=coords[edge:edge+2];dx=bx-ax;dz=bz-az;L=math.hypot(dx,dz);tx=dx/L;tz=dz/L
 # Polygon exterior may be clockwise after union: determine outward normal explicitly.
 nx,nz=tz,-tx;mx,mz=(ax+bx)/2,(az+bz)/2
 if footprint.contains(Point(mx+nx*.1,mz+nz*.1)):nx,nz=-nx,-nz
 if (-tz)*nx+tx*nz<0:tx,tz=-tx,-tz
 sm=Mesh();w=min(2.2,L-.5);sm.quad([(mx-tx*w/2+nx*.095,2.62,mz-tz*w/2+nz*.095),(mx+tx*w/2+nx*.095,2.62,mz+tz*w/2+nz*.095),(mx+tx*w/2+nx*.095,3.05,mz+tz*w/2+nz*.095),(mx-tx*w/2+nx*.095,3.05,mz-tz*w/2+nz*.095)],len(building_records)-1)
 signs.add(sm.rotated(yaw,x,z))
 # A small framed botanical print on a solid interior partition, away from windows.
 if internal:
  (ax,az),(bx,bz)=internal[0];L=math.hypot(bx-ax,bz-az)
  if L>=3.5:
   tx,tz=(bx-ax)/L,(bz-az)/L;nx,nz=-tz,tx
   mx,mz=(ax+bx)/2+tx*(L/2-.55),(az+bz)/2+tz*(L/2-.55)
   am=Mesh();am.quad([(mx-tx*.4+nx*.095,1.1,mz-tz*.4+nz*.095),(mx+tx*.4+nx*.095,1.1,mz+tz*.4+nz*.095),(mx+tx*.4+nx*.095,2.2,mz+tz*.4+nz*.095),(mx-tx*.4+nx*.095,2.2,mz-tz*.4+nz*.095)],role%4,2,2);art.add(am.rotated(yaw,x,z))

# The two DZs have different building programs, footprints, heights and routes.
makebuilding('01','Seed Library',-18,-17,[(-4,-4,4,0),(-4,0,0,5)],2,3,internal=[((-4,-1),(4,-1))])
makebuilding('02','Genetics Research Court',-18,-2,[(-4,-4,-1,4),(-1,-4,4,-1)],1,0,internal=[((-4,-.5),(-1,-.5))])
makebuilding('03','Botanical Health Clinic',-19,15.5,[(-3,-3.5,3,3.5)],1,2,internal=[((-3,0),(3,0))])
makebuilding('04','Field Research Annex',-11,20,[(-2,-2.8,2,2.8)],1,0,90)
makebuilding('05','Cold Chain Dispatch',18,15,[(-4,-5,4,-1),(-1,-1,4,5)],1,3,internal=[((-4,-3),(4,-3))])
makebuilding('06','Receiving and Biosecurity',18,-1,[(-3.5,-3,3.5,3)],1,2,internal=[((0,-3),(0,3))])
makebuilding('07','Water Recovery',19,-16,[(-3.5,-4.5,3.5,3.5)],2,1,internal=[((-3.5,0),(3.5,0))])
makebuilding('08','Nutrient Services',11,-21,[(-2,-2.5,2,2.5)],1,1)
makebuilding('09','Seed Intelligence Exchange',-4.75,-5,[(-3.25,-3,3.25,1),(-3.25,1,-.5,3.5)],2,0,45,internal=[((-3.25,-1),(3.25,-1))])
makebuilding('10','Signal Quality Laboratory',5.5,7,[(-3,-2.5,3,2.5),(0,2.5,3,4)],1,0,90,internal=[((-3,0),(3,0))])
makebuilding('11','Community Seed Hall',-5,15,[(-2.5,-2.5,2.5,2.5)],1,4,internal=[((-2.5,0),(2.5,0))])
makebuilding('12','Accession Station',3.5,-19,[(-2.5,-2,2.5,2)],1,3,90)

makebuilding('14','Propagation Workrooms',-18,7.5,[(-3,-2,3,0),(-3,0,-1,2),(1,0,3,2)],1,0)
makebuilding('15','Tissue Culture Laboratory',-5,-15,[(-2.5,-2,2.5,2)],1,0,internal=[((0,-2),(0,2))])

# One compact conservatory sits at midfield, broken into growing bays and a passage.
green=Mesh();green.cube(0,0,0,5.5,.14,6.5,2)
for x in [-2.65,2.65]:
 for z in [-3.15,3.15]:green.cube(x,.14,z,.13,3.6,.13,1)
for z in [-3.15,3.15]:
 green.cube(0,3.6,z,5.4,.13,.13,1)
 # Wide central openings; solid return walls and growing bays provide protection.
 for x in [-1.95,1.95]:green.cube(x,.14,z,1.35,2.1,.15,0)
for x in [-2.65,2.65]:
 for z in [-1.8,1.8]:
  green.cube(x,.14,z,.15,2.0,2.5,0);green.cube(x,3.6,z,.13,.13,2.5,1)
for x in [-1.8,1.8]:
 for z in [-1.8,1.8]:
  green.cube(x,.14,z,1,.85,2.1,0);green.cube(x,1,z,.9,.08,2,4)
  for zz in [-.55,0,.55]:
   green.cylinder(x,1.08,z+zz,.16,.28,8,8)
   for a in range(5):
    ang=a*math.pi*2/5;xx=x+math.cos(ang)*.35;zzz=z+zz+math.sin(ang)*.35
    green.quad([(x,1.36,z+zz),(xx-.1,1.7,zzz-.1),(xx+.1,1.72,zzz+.1),(x,1.36,z+zz)],5)
ladder(green,1.75,2.4,.14,3.8)
glazed=copy.deepcopy(green)
for side in [-1,1]:
 glazed.quad([(side*2.7,3.7,-3.2),(0,4.5,-3.2),(0,4.5,3.2),(side*2.7,3.7,3.2)],11)
for z in [-3.2,-1.6,0,1.6,3.2]:
 for side in [-1,1]:
  # Thin roof ribs are modeled, not painted perspective lines.
  rib=Mesh();rib.cube(side*1.35,3.72,z,2.75,.08,.08,1,False);glazed.add(rib)
objectmesh('Living Conservatory | Growing bays exposed',green,'r4-conservatory',5,-11,0,state_meshes=[('Glazed roof on',glazed)])
building_records.append({'code':'13','name':'Living Conservatory','guid':objects[-1]['GUID'],'x':5,'z':-11,'yaw':0,'levels':1,'footprint':[[-2.75,-3.25],[2.75,-3.25],[2.75,3.25],[-2.75,3.25],[-2.75,-3.25]]})

def planter(name,x,z,w,d,yaw=0,height=1.25):
 m=Mesh();m.cube(0,0,0,w,height,d,0);m.cube(0,height,0,w-.16,.06,d-.16,4)
 # Reuse the complete established detailed bed mesh instead of duplicating its data.
 src=next(o for o in SOURCE['ContainedObjects'] if o['Nickname']=='Grow cluster 13')
 raw=(R/'verdant-assets'/src['CustomMesh']['MeshURL'].split('/')[-1]).read_text().splitlines()
 vv=np.array([[float(v) for v in l.split()[1:4]] for l in raw if l.startswith('v ')])
 lo=vv[vv[:,1]<=1.05].min(0);hi=vv[vv[:,1]<=1.05].max(0)
 cm=Mesh();cm.cube((lo[0]+hi[0])/2,0,(lo[2]+hi[2])/2,hi[0]-lo[0],1.05,hi[2]-lo[2]);cm.save('r4-foliage-base',False)
 ob=objectmesh(name,m,'r4-planter-'+str(len(objects)),x,z,yaw)
 ob['CustomMesh']['MeshURL']=src['CustomMesh']['MeshURL'];ob['CustomMesh']['ColliderURL']=BASE+'r4-foliage-base.obj'
 ob['Transform'].update(scaleX=d/(hi[0]-lo[0]),scaleY=height/1.05,scaleZ=w/(hi[2]-lo[2]),rotY=yaw+90)
 places[ob['GUID']][4]=yaw+90
 return ob

# Garden edges are deliberately irregular and broken by accessible entry gaps.
for name,x,z,w,d,yaw,h in [
 ('Herbarium garden wall',-23,-9,1.1,5,0,1.8),('Library rain garden',-14,-23,5,1,0,1.25),('Clinic herb beds',-23,11,1.1,4,0,1.35),
 ('Research courtyard specimen bed',-14,1.5,2.1,1.2,0,1.35),('Raised botanical island',-10,7,3.4,1.5,45,1.45),
 ('Public fern garden',-11,13,2.2,1.2,0,1.6),('Seed hall planting pocket',-1,18.5,2.5,1.2,0,1.3),
 ('Northern boundary garden',1.5,23,5,1,0,1.7),('Eastern green buffer',23,7,1.1,4,0,1.4),
 ('Dispatch rain garden',20.5,22.5,4,1.1,0,1.3),('South access planting',-4,-22.5,4,1.2,0,1.6),
 ('Central low fern bed',-1.5,8.5,2.5,1.1,45,1.4),('Conservatory service planting',10,-6,2.2,1.2,90,1.35)]:planter(name,x,z,w,d,yaw,h)

def service(name,x,z,kind=0,yaw=0):
 m=Mesh()
 if kind==0:
  m.cube(0,0,0,2.8,.14,1.6,6)
  for a in [-.78,.78]:
   m.cylinder(a,.14,0,.57,2.25,6,16,True)
   for y in [.45,1.85]:m.cylinder(a,y,0,.59,.06,9,16)
   m.cube(a,2.39,0,.18,.2,.18,9)
  m.cube(0,.45,-.85,1,1.15,.22,1);m.cube(0,.85,-.98,.7,.3,.02,11,False)
 elif kind==1:
  m.cube(0,0,0,2.7,2.35,1.4,8)
  for a in [-.9,0,.9]:
   m.cube(a,.18,-.72,.78,2,.05,14,False);m.cube(a+.25,.85,-.78,.04,.44,.06,6,False)
  m.cube(0,2.35,0,2.8,.12,1.5,9);m.cube(0,.16,.72,2.3,.6,.03,10,False)
 elif kind==2:
  m.cube(0,0,0,2.6,2.1,1.6,9);m.cube(0,.3,-.81,2.2,1.4,.03,10,False)
  m.cylinder(0,2.1,0,.65,.06,6,16);m.cylinder(0,2.16,0,.55,.02,10,16)
 else:
  # Compact tracked sample transporter: load is secured, handles and wheels modeled.
  m.cube(0,.32,0,2.8,.55,1.4,1);m.cube(-.8,.87,0,1.1,.8,1.2,11)
  for zz in [-.76,.76]:
   m.cube(0,.15,zz,2.5,.45,.18,9)
   for xx in [-.9,-.3,.3,.9]:
    wheel=Mesh();wheel.cylinder(0,0,0,.2,.12,1,12)
    # Wheel circles are vertical: rotate their vertices around X.
    wheel.v=[(xx+a,.37+c,zz+b) for a,b,c in wheel.v];m.add(wheel)
  for xx in [.2,.9]:
   m.cube(xx,.87,0,.6,.85,1.1,8);m.cube(xx,1.75,0,.63,.05,1.13,6,False)
 return objectmesh(name,m,'r4-service-type-'+str(kind),x,z,yaw)

for name,x,z,k,yaw in [
 ('Water recovery pressure vessels',12.5,-15.5,0,0),('Dispatch sample lockers',20,6,1,0),('Cold-chain chillers',23,17,2,90),
 ('Research filtered air plant',-23,-18,2,90),('Seed bank cold store',-12,-16,1,90),('Quarantine storage',11,17,1,90),
 ('Nursery nutrient vessels',11,-.5,0,90),('Biosecurity decontamination unit',23,-6,2,90),('Clinic power plant',-23,20.5,2,90),
 ('Accession sample transporter',9,-18,3,0),('Dispatch sample transporter',16,8,3,90),('Garden maintenance transporter',-15,9,3,0),
 ('Exchange server cabinet',-10,-1,1,45),('Signal plant',10,7,2,90),('Emergency water reserve',-11,-10,0,0),
 ('Roofless receiving bay stores',17,-7,1,0),('Eastern boundary lockers',23,-10.2,1,90),('South-east distribution plant',20,-23,2,0),
 ('North gate power unit',9,22,2,90),('Genetics sample vault',-12,-5,1,0),('Garden irrigation equipment',-9,3,0,90),('Public collection lockers',0,5,1,90),('Signal backup cabinet',10.5,12,1,0),('Conservatory climate unit',0,-13,2,90),('Central specimen transfer',4,2,1,45),('Receiving overflow storage',14,0,1,90)]:service(name,x,z,k,yaw)

# Short walls use real stone/ivory concrete, not blank signage backboards.
for i,(x,z,w,h,d,yaw) in enumerate([(-8,-12,3.4,1.8,.35,45),(-3,3.5,3,1.6,.35,45),(2,-5,2.8,1.7,.35,90),(3,16,3,1.8,.35,0),(13,13,3,1.6,.35,90),(-18,22.6,5,1.5,.35,0),(-23,4,3,1.8,.35,90),(16,-11,3,1.6,.35,0)]):
 m=Mesh();m.cube(0,0,0,w,h,d,0);m.cube(0,h,0,w+.08,.09,d+.12,14);objectmesh('Campus retaining wall '+str(i+1),m,'r4-wall-'+str(i),x,z,yaw)

# Human-scale wall signs, artwork, no overhead frames and no freestanding boards.
labels=[b['name'].upper() for b in building_records]
im=Image.new('RGB',(2048,1024),'#14392c');draw=ImageDraw.Draw(im)
for i,label in enumerate(labels):
 x=i%4*512;y=i//4*256;draw.rectangle((x+12,y+15,x+18,y+239),fill='#b4c5a8')
 draw.text((x+35,y+35),'VERDANT / '+f'{i+1:02}',font=ImageFont.truetype(FB,22),fill='#cbd6bb')
 size=31
 while draw.textlength(label,font=ImageFont.truetype(FB,size))>445:size-=1
 draw.text((x+35,y+105),label,font=ImageFont.truetype(FB,size),fill='#fff9e8')
 draw.text((x+35,y+197),'LIVING COLLECTIONS / RESEARCH CAMPUS',font=ImageFont.truetype(F,16),fill='#b4c8b7')
im.save(A/'campus-wayfinding.png',optimize=True)
if signs.v:objectmesh('Campus wall signage | flush mounted',signs,'r4-signs',texture='campus-wayfinding.png')
if art.v:objectmesh('Botanical interior prints | wall mounted',art,'r4-art',texture='botanical-art.jpg')

# Mature specimen trees use the proven detailed tree assets, with reduced-canopy states.
for idx,(kind,x,z,yaw) in enumerate([('01',-11,-20,25),('03',-12,6,70),('01',-11,17,155),('01',1,21,240),('03',12.8,11.3,300),('01',21,-8.5,110)]):
 tree=copy.deepcopy(json.load(open(R/('tree-'+kind+'.json'))));tree['GUID']=allocate();tree['Nickname']='Campus specimen tree '+str(idx+1)+' | Leaves on';scale=(.43,.5,.43) if kind=='01' else (.38,.55,.38)
 for st in [tree,*tree.get('States',{}).values()]:
  if st is not tree:st['GUID']=allocate();st['Nickname']='Campus specimen tree '+str(idx+1)+' | Canopy reduced'
  st['Tags']=['VerdantExchange','LoboMap:VerdantExchangeR4General'];st['Transform'].update(scaleX=scale[0],scaleY=scale[1],scaleZ=scale[2],rotY=yaw,posX=70,posY=100,posZ=70)
  places[st['GUID']]=[x,1,z,0,yaw,0]
 objects.append(tree)

# Carry the established mission pieces and control panel into the new map.
anchor=objects[0]['GUID'];controller=None
for oldob in SOURCE['ContainedObjects']:
 if oldob['Name']=='Custom_Assetbundle' and oldob['Nickname'].startswith('Console'):
  o=copy.deepcopy(oldob);oldguid=o['GUID'];o['GUID']=allocate();o['Tags']=['VerdantExchange','LoboMap:VerdantExchangeR4General'];objects.append(o)
  zz={'e80056':-12,'e80058':0,'e8005a':12}[oldguid];places[o['GUID']]=[0,1.15,zz,0,270,0]
 if oldob['Nickname'].endswith('Map Controls'):
  controller=copy.deepcopy(oldob)
controller['GUID']=allocate();controller['Nickname']='Verdant Exchange R4 | Map Controls';controller['Tags']=['VerdantExchange','LoboMap:VerdantExchangeR4General'];controller['LuaScript']=controller['LuaScript'].replace('e80001',anchor).replace('e8005c',controller['GUID']).replace('LoboMap:VerdantExchangeR1GeneralFinal','LoboMap:VerdantExchangeR4General');objects.append(controller);places[controller['GUID']]=[0,24,0,0,0,0]
objects[0]['LuaScript']='function onLoad()self.setLock(true)end\nfunction onDestroy()\n local list={}\n for _,o in ipairs(getAllObjects())do if o~=self and o.hasTag("LoboMap:VerdantExchangeR4General")then list[#list+1]=o end end\n for _,o in ipairs(list)do o.destruct()end\nend'
bag=copy.deepcopy(SOURCE);bag['Nickname']='SET_ITS18 Uplink Center — Verdant Exchange — Campus Rebuild R4';bag['Description']='Verdant Exchange | Complete campus rebuild R4\nUnique research gardens, seed library, enclosed courtyards, receiving and cold-chain service yards. New buildings and circulation. 48 x 48 inches. Uplink Center.\nDrop onto the Stage bag area. Clear using Stage CLEAR TABLE.';bag['ContainedObjects']=objects;bag['LuaScript']='\r\n'.join('--'+g+','+','.join(f'{v:.7g}' for v in p) for g,p in places.items())+'\r\n'
objects[0]['Tags'].insert(0,'ground')
for ob in objects:
 if any(v['guid']==ob['GUID'] for v in building_records):
  for st in [ob,*ob.get('States',{}).values()]:st['Tags'].insert(0,'building')
 if 'specimen tree' in ob['Nickname']:
  for st in [ob,*ob.get('States',{}).values()]:st['Tags'].append('LoboCanopyTrees')
for ob in objects:
 if ob.get('States') and any(v['guid']==ob['GUID'] for v in building_records):
  st=ob['States'];closed=copy.deepcopy(st[max(st,key=int)]);closed.pop('States',None)
  opened=copy.deepcopy(ob);opened.pop('States',None);opened['GUID']=closed['GUID']
  closed['GUID']=ob['GUID'];closed['States']={'2':opened}
  if len(st)>1:
   middle=copy.deepcopy(st['2']);middle['GUID']=st['2']['GUID'];closed['States']['3']=middle
  ob.clear();ob.update(closed)
json.dump({'ObjectStates':[bag]},open(O/'Verdant-Exchange-R4.json','w'),indent=2)
json.dump({'buildings':building_records,'placements':places,'objects':len(objects),'new_architecture':True,'solids':[{'polygon':list(p.exterior.coords),'bottom':lo,'top':hi} for p,lo,hi in solids]},open(O/'design-manifest.json','w'),indent=2)
print(json.dumps({'objects':len(objects),'new_buildings':len(building_records),'asset_files':len(list(A.iterdir()))}))
