"""Construction and prop detail for the rebuilt Meridian Exchange."""
from meshkit import *
from shapely.ops import unary_union

def bevel(m,x,y,z,w,h,d,mat='enamel',b=.025):
 c=np.array([x,y+h/2,z]);hh=np.array([w,h,d])/2;b=min(b,min(hh)*.45)
 m._solid_depth+=1
 for ax in range(3):
  other=[i for i in range(3)if i!=ax]
  for sign in [-1,1]:
   pts=[]
   for u,v in [(-1,-1),(1,-1),(1,1),(-1,1)]:
    p=c.copy();p[ax]+=sign*hh[ax];p[other[0]]+=u*(hh[other[0]]-b);p[other[1]]+=v*(hh[other[1]]-b);pts.append(p)
   if np.dot(np.cross(pts[1]-pts[0],pts[2]-pts[0]),np.eye(3)[ax]*sign)<0:pts.reverse()
   m.face(pts,mat)
 for ax in range(3):
  other=[i for i in range(3)if i!=ax]
  for a in [-1,1]:
   for bsign in [-1,1]:
    pts=[]
    for end,cut in [(-1,0),(1,0),(1,1),(-1,1)]:
     p=c.copy();p[ax]+=end*(hh[ax]-b);p[other[0]]+=a*(hh[other[0]]-(b if cut else 0));p[other[1]]+=bsign*(hh[other[1]]-(0 if cut else b));pts.append(p)
    normal=np.zeros(3);normal[other]=[a,bsign]
    if np.dot(np.cross(pts[1]-pts[0],pts[2]-pts[0]),normal)<0:pts.reverse()
    m.face(pts,mat)
 for a in [-1,1]:
  for bs in [-1,1]:
   for cc in [-1,1]:
    signs=np.array([a,bs,cc]);pts=[]
    for ax in range(3):
     p=c+signs*(hh-b);p[ax]+=signs[ax]*b;pts.append(p)
    if np.dot(np.cross(pts[1]-pts[0],pts[2]-pts[0]),signs)<0:pts.reverse()
    m.face(pts,mat)
 m._solid_depth-=1;m.solids.append(('box',(x,y,z,w,h,d)))

def rod(m,p,q,r=.035,mat='bronze',n=12):
 p=np.array(p,float);q=np.array(q,float);v=q-p;length=np.linalg.norm(v)
 if length<1e-7:return
 v/=length;ref=np.array([0,1,0])if abs(v[1])<.95 else np.array([1,0,0]);u=np.cross(v,ref);u/=np.linalg.norm(u);w=np.cross(v,u)
 rings=[[p+r*(math.cos(a)*u+math.sin(a)*w)for a in np.linspace(0,2*math.pi,n,endpoint=False)],[q+r*(math.cos(a)*u+math.sin(a)*w)for a in np.linspace(0,2*math.pi,n,endpoint=False)]]
 m._solid_depth+=1;m.face(rings[0][::-1],mat);m.face(rings[1],mat)
 for i in range(n):j=(i+1)%n;m.face([rings[0][i],rings[0][j],rings[1][j],rings[1][i]],mat)
 m._solid_depth-=1;m.physical_extras.append([p.tolist()for ring in rings for p in ring])

def rail(m,p,q,y,h=.8,spacing=.75):
 p=np.array(p,float);q=np.array(q,float);L=np.linalg.norm(q-p)
 for f in np.linspace(0,1,max(2,math.ceil(L/spacing)+1)):
  a=p+(q-p)*f;rod(m,(a[0],y,a[1]),(a[0],y+h,a[1]),.025,'bronze',8)
 for hh in [.4,h]:rod(m,(p[0],y+hh,p[1]),(q[0],y+hh,q[1]),.028,'bronze')

def ledge(m,p,y,h=.16,mat='limestone',offset=.05):
 poly=Polygon(p);outer=poly.buffer(offset,join_style=2)
 for a,b in zip(list(outer.exterior.coords),list(outer.exterior.coords)[1:]):m.wall(a,b,y,h,'solid',mat,.14)

def sign(m,text,x,y,z,width=3,rot=0):
 from matplotlib.textpath import TextPath
 path=TextPath((0,0),text,size=1,prop={'family':'DejaVu Sans','weight':'bold'});shape=Polygon()
 for q in path.to_polygons():
  if len(q)>2:shape=shape.symmetric_difference(Polygon(q).buffer(0))
 lo,bot,hi,top=shape.bounds;scale=width/(hi-lo);t=Mesh();t._solid_depth+=1
 for poly in ([shape]if shape.geom_type=='Polygon'else shape.geoms):
  for tr in triangulate(poly):
   if not poly.covers(tr):continue
   p=list(tr.exterior.coords)[:3]
   for zz in [-.025,.025]:t.face([(-(a-(lo+hi)/2)*scale,b*scale,zz)for a,b in p][::-1 if zz>0 else 1],'enamel')
  for ring in [poly.exterior]+list(poly.interiors):
   coords=list(ring.coords)
   for (a,b),(c,d)in zip(coords,coords[1:]):t.face([(-(a-(lo+hi)/2)*scale,b*scale,-.025),(-(c-(lo+hi)/2)*scale,d*scale,-.025),(-(c-(lo+hi)/2)*scale,d*scale,.025),(-(a-(lo+hi)/2)*scale,b*scale,.025)],'enamel')
 t._solid_depth-=1;t.free_ranges=[];m.add(t.moved(x,z,y=y,rot=rot))

def console(m,x,z,rot=0):
 t=Mesh();bevel(t,0,0,0,.85,.9,.55,'sage');bevel(t,0,.9,0,.95,.12,.65,'bronze')
 bevel(t,0,1.1,.12,.82,.50,.09,'rubber',.015);t.box(0,1.16,.063,.70,.34,.015,'glass')
 for i in range(6):t.box(-.28+i*.11,.99,-.13,.06,.025,.1,'enamel')
 for i in range(3):t.box(-.25+i*.25,1.36,.05,.12,.025,.015,'sage')
 for xx in [-.3,.3]:rod(t,(xx,.15,-.285),(xx,.7,-.285),.022)
 m.add(t.moved(x,z,y=getattr(m,'floor_y',0),rot=rot))

def seat(m,x,z,rot=0):
 t=Mesh();bevel(t,0,.58,0,.65,.13,.7,'fabric',.05);bevel(t,0,.7,.29,.65,.66,.13,'fabric',.04)
 for xx in [-.26,.26]:
  for zz in [-.25,.25]:rod(t,(xx,0,zz),(xx,.61,zz),.027,'bronze',8)
  rod(t,(xx,.65,.14),(xx,.97,.14),.025);bevel(t,xx,.96,-.03,.09,.06,.5,'wood',.02)
 m.add(t.moved(x,z,y=getattr(m,'floor_y',0),rot=rot))

def table(m,x,z,w=2,d=1.2,rot=0,top='wood'):
 t=Mesh();bevel(t,0,.96,0,w,.12,d,top,.04)
 for xx in [-w/2+.18,w/2-.18]:
  for zz in [-d/2+.16,d/2-.16]:rod(t,(xx,0,zz),(xx,.96,zz),.045,'bronze')
 rod(t,(-w/2+.18,.3,0),(w/2-.18,.3,0),.03)
 m.add(t.moved(x,z,y=getattr(m,'floor_y',0),rot=rot))

def filing(m,x,z,rot=0,count=2):
 t=Mesh()
 for j in range(count):
  a=j*.66;bevel(t,a,0,0,.63,1.65,.65,'sage',.025)
  for yy in [.15,.58,1.01]:
   bevel(t,a,yy,-.338,.56,.38,.04,'enamel',.01);rod(t,(a-.12,yy+.22,-.38),(a+.12,yy+.22,-.38),.02)
   t.box(a,yy+.08,-.365,.15,.06,.015,'rubber')
 m.add(t.moved(x,z,y=getattr(m,'floor_y',0),rot=rot))

def workstation(m,x,z,rot=0):
 t=Mesh();table(t,0,0,2.15,.9);bevel(t,-.62,.08,0,.63,.78,.68,'sage')
 for y in [.28,.52,.76]:rod(t,(-.8,y,-.37),(-.45,y,-.37),.015)
 bevel(t,.2,1.22,.16,.86,.52,.08,'bronze',.018);t.box(.2,1.28,.112,.73,.35,.015,'glass')
 t.box(.2,1.08,.16,.11,.15,.10,'bronze');bevel(t,.2,1.08,-.22,.82,.035,.3,'rubber',.01)
 for a in range(9):
  for b in range(3):t.box(-.14+a*.075,1.12,-.31+b*.07,.052,.013,.046,'enamel')
 seat(t,.18,-1.05,180)
 # Monitor cable, desk lamp and an actual paper tray.
 rod(t,(.2,1.28,.2),(.2,.65,.33),.015,'rubber',6);rod(t,(.8,1.08,.22),(.72,1.6,.22),.022)
 bevel(t,.62,1.58,.22,.42,.10,.24,'enamel');bevel(t,-.6,1.08,-.04,.52,.08,.34,'bronze',.01);t.box(-.6,1.17,-.04,.42,.04,.27,'enamel')
 m.add(t.moved(x,z,y=getattr(m,'floor_y',0),rot=rot))

def rack(m,x,z,rot=0,width=2.2,kind='books'):
 t=Mesh()
 for xx in [-width/2,width/2]:bevel(t,xx,0,0,.1,2.35,.65,'wood')
 for y in [.15,.78,1.41,2.05]:
  bevel(t,0,y,0,width+.12,.08,.65,'wood',.015)
  if kind=='books':
   for i in range(max(2,int(width/.14))):
    xx=-width/2+.12+i*.14;h=.31+(i%4)*.065
    bevel(t,xx,y+.08,.04,.11,h,.43,['red','sage','enamel','fabric'][i%4],.008)
    t.box(xx,y+.14,-.182,.075,.025,.015,'bronze')
  elif kind=='tools':
   for xx in [-.65,0,.65]:bevel(t,xx,y+.08,.04,.45,.32,.44,'sage',.025);rod(t,(xx-.12,y+.37,-.2),(xx+.12,y+.37,-.2),.018)
 m.add(t.moved(x,z,y=getattr(m,'floor_y',0),rot=rot))

def kitchen(m,x,z,rot=0):
 t=Mesh();bevel(t,0,0,0,3.8,1.05,.85,'sage');bevel(t,0,1.05,0,4,.14,1.0,'limestone')
 for xx in [-1.35,-.45,.45,1.35]:
  bevel(t,xx,.1,-.442,.78,.84,.035,'wood',.01);rod(t,(xx+.23,.55,-.485),(xx+.23,.78,-.485),.018)
 # Countertop espresso machine, cup shelf, group heads and grinder hopper.
 bevel(t,-.65,1.19,0,1.45,.65,.64,'bronze',.06);t.box(-.65,1.28,-.34,1.27,.38,.025,'rubber')
 for xx in [-1.05,-.48]:
  rod(t,(xx,1.62,-.38),(xx,1.48,-.63),.035);t.cyl(xx,1.2,-.55,.12,.18,'enamel',18)
  rod(t,(xx+.12,1.28,-.55),(xx+.18,1.37,-.55),.015,'enamel')
 t.cyl(.85,1.19,0,.21,.6,'rubber',24);t.cyl(.85,1.79,0,.28,.42,'glass',24,r2=.18)
 bevel(t,1.45,1.19,0,.48,.12,.55,'bronze');t.cyl(1.45,1.31,0,.15,.27,'enamel',20)
 m.add(t.moved(x,z,y=getattr(m,'floor_y',0),rot=rot))

def vending(m,x,z,rot=0):
 t=Mesh();bevel(t,0,0,0,1.5,2.5,.85,'sage',.08);bevel(t,-.2,.6,-.45,.85,1.45,.04,'rubber',.015)
 for yy in [.85,1.25,1.65]:
  for xx in [-.45,-.15,.15]:t.cyl(xx,yy,-.47,.1,.25,['red','enamel','sage'][round(yy*4)%3],12)
 for yy in [1.15,1.4,1.65]:bevel(t,.52,yy,-.47,.16,.10,.06,'bronze',.015)
 t.box(.4,2.05,-.46,.36,.22,.02,'glass');bevel(t,0,.2,-.47,1.02,.25,.10,'rubber')
 sign(t,'MERIDIAN',0,2.23,-.51,1.05);m.add(t.moved(x,z,y=getattr(m,'floor_y',0),rot=rot))

def crate(m,x,z,y=0,w=1.4,h=1.1,d=1.1,rot=0):
 t=Mesh();bevel(t,0,0,0,w,h,d,'sage',.07)
 for xx in [-w/2+.15,w/2-.15]:bevel(t,xx,.07,-d/2-.025,.10,h-.14,.07,'bronze',.02)
 for yy in [.16,h-.24]:bevel(t,0,yy,-d/2-.03,w-.10,.10,.08,'bronze',.015)
 bevel(t,0,h,0,w+.02,.10,d+.02,'bronze',.035);bevel(t,0,.42,-d/2-.09,.42,.19,.035,'enamel',.005)
 m.add(t.moved(x,z,y=y,rot=rot))

def pallet(m,x,z,rot=0):
 t=Mesh()
 for xx in [-.65,0,.65]:bevel(t,xx,0,0,.16,.18,1.5,'wood',.02)
 for z0 in [-.65,-.32,0,.32,.65]:bevel(t,0,.18,z0,1.7,.11,.25,'wood',.015)
 m.add(t.moved(x,z,y=getattr(m,'floor_y',0),rot=rot))

def industrial_door(m,p,q,y,h=3,mat='ceramic'):
 # Piers and lintel surround a real, full-height passage. Open shutter is above it.
 m.wall(p,q,y,h,'door',mat,.30)
 p=np.array(p);q=np.array(q);v=q-p;L=np.linalg.norm(v);v/=L;n=np.array([-v[1],v[0]]);c=(p+q)/2
 for yy in np.arange(y+2.72,y+h-.08,.105):
  a=c-v*1.06+n*.20;b=c+v*1.06+n*.20;rod(m,(a[0],yy,a[1]),(b[0],yy,b[1]),.035,'roof',8)

def trim_shell(m,p,y,h,material='limestone'):
 ledge(m,p,y+.13,.15,material,.03);ledge(m,p,y+h-.22,.18,material,.04)
 for x,z in p:bevel(m,x,y,z,.20,h,.20,'limestone',.02)

def roof_equipment(m,x,z,y,rot=0):
 t=Mesh();bevel(t,0,0,0,1.7,.6,1.2,'sage',.05)
 for xx in np.arange(-.68,.7,.13):bevel(t,xx,.58,0,.055,.06,.94,'bronze',.01)
 t.cyl(.47,.66,.15,.26,.08,'bronze',24)
 for a in np.linspace(0,2*math.pi,5,endpoint=False):rod(t,(.47,.74,.15),(.47+.2*math.cos(a),.74,.15+.2*math.sin(a)),.025,'rubber',6)
 for yy in [.18,.32,.46]:rod(t,(-.7,yy,-.62),(.1,yy,-.62),.018,'rubber',6)
 m.add(t.moved(x,z,y=y,rot=rot))

def slope_plate(m,poly,fn,thickness=.15,mat='roof'):
 p=Polygon(poly)
 for tr in triangulate(p):
  if not p.covers(tr):continue
  q=list(tr.exterior.coords)[:3];lo=[(x,fn(x,z)-thickness,z)for x,z in q];hi=[(x,fn(x,z),z)for x,z in q]
  normal=np.cross(np.array(hi[1])-hi[0],np.array(hi[2])-hi[0])
  if normal[1]<0:hi=hi[::-1];lo=lo[::-1]
  m._solid_depth+=1;m.face(hi,mat);m.face(lo[::-1],mat)
  for i in range(3):j=(i+1)%3;m.face([lo[i],lo[j],hi[j],hi[i]],mat)
  m._solid_depth-=1;m.physical_extras.append(lo+hi)

def panel3d(m,pts,depth=.07,mat='glass'):
 pts=np.array(pts,float);normal=np.cross(pts[1]-pts[0],pts[2]-pts[0])
 if np.linalg.norm(normal)<1e-8:return
 normal/=np.linalg.norm(normal);a=pts-normal*depth/2;b=pts+normal*depth/2
 m._solid_depth+=1;m.face(a[::-1],mat);m.face(b,mat)
 for i in range(len(pts)):j=(i+1)%len(pts);m.face([a[i],a[j],b[j],b[i]],mat)
 m._solid_depth-=1;m.physical_extras.append(a.tolist()+b.tolist())

def roof_apron(m,poly,base,fn,mat='enamel'):
 # The roof planes alone do not enclose an attic. Build actual gables/fascia
 # at the wall line, including a ridge break when a pitched edge crosses X=0.
 for a,b in zip(poly,poly[1:]+poly[:1]):
  points=[a,b]
  if a[0]*b[0]<0:
   f=-a[0]/(b[0]-a[0]);points=[a,(0,a[1]+f*(b[1]-a[1])),b]
  for aa,bb in zip(points,points[1:]):
   panel3d(m,[(aa[0],base,aa[1]),(bb[0],base,bb[1]),(bb[0],fn(*bb)-.075,bb[1]),(aa[0],fn(*aa)-.075,aa[1])],.15,mat)

def stairs(m,x,z,y,h,length,width,rot=0):
 # Landings are authored explicitly so they meet floors edge-to-edge, rather
 # than leaving the generic oversized landing embedded in another floor.
 t=Mesh();count=round(h/.25)
 for i in range(count):t.box((i+.5)*length/count,y,0,length/count,(i+1)*h/count,width,'travertine')
 for side in [-1,1]:
  zz=side*(width/2+.05);rod(t,(0,y+.85,zz),(length,y+h+.85,zz),.028,'bronze')
  for f in np.linspace(0,1,max(3,round(length))):rod(t,(f*length,y+f*h,zz),(f*length,y+f*h+.85,zz),.025,'bronze',8)
 m.add(t.moved(x,z,rot=rot))

def solid_ramp(m,poly,fn,mat='travertine'):
 p=Polygon(poly)
 for tr in triangulate(p):
  if not p.covers(tr):continue
  q=list(tr.exterior.coords)[:3];lo=[(x,0,z)for x,z in q];hi=[(x,fn(x,z),z)for x,z in q]
  if np.cross(np.array(hi[1])-hi[0],np.array(hi[2])-hi[0])[1]<0:lo=lo[::-1];hi=hi[::-1]
  m._solid_depth+=1;m.face(hi,mat);m.face(lo[::-1],mat)
  for i in range(3):j=(i+1)%3;m.face([lo[i],lo[j],hi[j],hi[i]],mat)
  m._solid_depth-=1;m.physical_extras.append(lo+hi)

_base_shell=shell
def shell(poly,y,h,kinds,mat='sage'):
 m=_base_shell(poly,y,h,kinds,mat);m.floor_y=y+.25;return m

_base_bench=bench
def bench(m,*args,**kwargs):
 t=Mesh();_base_bench(t,*args,**kwargs)
 m.add(t.moved(y=getattr(m,'floor_y',.25)-.25))

def residential_bed(m,x,z,rot=0):
 t=Mesh();bevel(t,0,.35,0,1.1,.18,2.1,'wood',.04)
 for xx in [-.44,.44]:
  for zz in [-.85,.85]:bevel(t,xx,0,zz,.12,.38,.12,'wood',.015)
 bevel(t,0,.53,0,1.02,.2,2.0,'enamel',.075);bevel(t,0,.73,-.22,1.04,.10,1.55,'fabric',.035)
 bevel(t,0,.74,.70,.8,.16,.43,'enamel',.06);bevel(t,0,.35,1.03,1.12,.9,.12,'wood',.035)
 # Compact nightstand, drawer handle, book and shaded bedside lamp.
 bevel(t,-.9,0,.7,.53,.65,.6,'wood',.025);rod(t,(-1.02,.44,.38),(-.78,.44,.38),.018)
 bevel(t,-.9,.65,.72,.34,.055,.30,'red',.01);rod(t,(-.9,.72,.72),(-.9,1.05,.72),.02)
 t.cyl(-.9,1.02,.72,.2,.25,'enamel',20,r2=.14)
 m.add(t.moved(x,z,y=getattr(m,'floor_y',0),rot=rot))
