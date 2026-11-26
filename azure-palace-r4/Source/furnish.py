"""Outdoor resort furnishings. Local +Z faces the visitor; dimensions are tabletop inches."""
from pathlib import Path
import sys,math,json,random
import numpy as np
from materials import ids,N
R=Path(__file__).resolve().parents[1];HIST=R.parent/'azure2'
if not HIST.is_dir(): HIST=R.parent/'azure-palace-r2'
sys.path.insert(0,str(HIST/'Source'))
import build_r2 as old
B=old.R
A=R/'Assets'
def atlas_uv(key,u,v):
 j=ids[key];pad=4/N
 return ((j%8+pad+(1-2*pad)*u)/8,1-(j//8+pad+(1-2*pad)*(1-v))/8)
class Surface(B.M):
 def face(self,vs,mat):
  a=np.asarray(vs,float);normal=np.cross(a[1]-a[0],a[2]-a[0]);axis=np.argmax(np.abs(normal));dims=[[2,1],[0,2],[0,1]][axis];q=a[:,dims];lo=q.min(0);span=q.max(0)-lo
  q=(q-lo)/np.maximum(span,[1.55,1.27]);i=len(self.v);self.v+=a.tolist();self.uv.extend(atlas_uv(mat,u,v) for u,v in q)
  self.f.extend([[i,i+j,i+j+1] for j in range(1,len(a)-1)])
 def outward(self,vs,mat,expected):
  a=np.asarray(vs);n=np.cross(a[1]-a[0],a[2]-a[0])
  self.face(vs if np.dot(n,expected)>=0 else list(reversed(vs)),mat)
 def card(self,x,y,z,nx,nz,w,h,key):
  dx,dz=-nz,nx
  def pt(a,b):return (x+dx*a,y+b,z+dz*a)
  vs=[pt(-w/2,0),pt(-w/2,h),pt(w/2,h),pt(w/2,0)]
  # The surface is outward-facing, and texture U increases to the viewer's right.
  i=len(self.v);self.v.extend(vs);self.f.extend([(i,i+1,i+2),(i,i+2,i+3)]);self.uv.extend(atlas_uv(key,u,v) for u,v in [(0,0),(0,1),(1,1),(1,0)])
 def rounded(self,x,y,z,w,h,d,r,mat,b=.016):
  r=min(r,w*.48,d*.48);b=min(b,h*.23,r*.5)
  def ring(yy,inset):
   a=w/2-inset;c=d/2-inset;rr=max(.002,r-inset);out=[]
   for xx,zz,t in [(a-rr,c-rr,0),(-a+rr,c-rr,90),(-a+rr,-c+rr,180),(a-rr,-c+rr,270)]:
    for ang in np.linspace(t,t+90,4):
     u=math.radians(ang);out.append((x+xx+rr*math.cos(u),yy,z+zz+rr*math.sin(u)))
   return out
  rings=[ring(y,b),ring(y+b,0),ring(y+h-b,0),ring(y+h,b)]
  self.outward(rings[0],mat,[0,-1,0]);self.outward(rings[-1],mat,[0,1,0])
  for lo,hi in zip(rings,rings[1:]):
   for i,a in enumerate(lo):
    j=(i+1)%len(lo);mid=(np.array(a)+lo[j])*.5;self.outward([a,lo[j],hi[j],hi[i]],mat,[mid[0]-x,0,mid[2]-z])
 def historic(self,mesh,x,z,scale=1,y=0,angle=0):
  a=math.radians(angle);cs,s=math.cos(a),math.sin(a);idx=len(self.v)
  self.v.extend((x+scale*(u*cs+w*s),y+scale*v,z+scale*(w*cs-u*s))for u,v,w in mesh.v);self.f.extend([int(j)+idx for j in face]for face in mesh.f)
  for u,v in mesh.uv:
   col=min(3,int(4*u));row=min(3,int(4*(1-v)));key=B.H.NAMES[col+4*row];self.uv.append(atlas_uv(key,4*u-col,1-(4*(1-v)-row)))
def plaque(m,x,y,z,direction,w,h,key):
 m.rounded(x,y,z,w,h,.045,.035,'brass');m.card(x,y+.022,z+direction*.025,0,direction,w-.04,h-.045,key)
def tube(m,points,width,mat):
 for a,b in zip(points,points[1:]):m.beam(a,b,width,mat)
def hoop(m,x,y,z,r,t,mat):
 for j in range(24):
  a=j*math.tau/24;b=(j+1)*math.tau/24;m.beam((x+r*math.cos(a),y+r*math.sin(a),z),(x+r*math.cos(b),y+r*math.sin(b),z),t,mat)
def cup(m,x,y,z):
 m.cyl(x,y,z,.115,.014,'white',16);m.cyl(x,y+.012,z,.061,.10,'white',16,r2=.075);m.cyl(x,y+.110,z,.062,.004,'tea',14);hoop(m,x+.073,y+.066,z,.031,.015,'white')
def daybed(m,c,x,z):
 for xx in [-.37,.37]:
  m.beam((x+xx,.185,z-.71),(x+xx,.185,z+.82),.065,'teak')
  for zz in [-.57,.65]:m.box(x+xx,0,z+zz,.083,.21,.083,'brass')
 for zz in np.linspace(-.72,.76,11):m.rounded(x,.205,z+zz,.79,.045,.085,.023,'teak',b=.006)
 m.rounded(x,.254,z+.195,.74,.105,1.04,.065,'ivory')
 m.beam((x,.345,z-.34),(x,.79,z-.80),.73,'sea',.115)
 m.rounded(x,.37,z+.45,.73,.04,.27,.03,'towel')
 for v in [-.10,.10]:m.box(x,.411,z+.45+v,.69,.004,.014,'sea',collide=False)
 c.box(x,0,z,.78,.37,1.65,'wood');c.beam((x,.345,z-.34),(x,.79,z-.80),.73,'wood',.115)
def cafe_table(m,c,x,z,high=.77,r=.35):
 m.cyl(x,.04,z,r*.59,.065,'iron',16,r2=r*.53);m.cyl(x,.09,z,.047,high-.06,'brass',12);m.cyl(x,high,z,r,.066,'teak',24);m.cyl(x,high+.063,z,r-.018,.014,'oyster',24);cup(m,x+.08,high+.078,z+.016)
 c.cyl(x,.04,z,.054,high,'bronze',10);c.cyl(x,high,z,r,.079,'wood',16)
def seat(m,c,x,z,w=1.1,mat='sea'):
 m.rounded(x,.13,z,w-.1,.32,.49,.075,'teak');m.rounded(x,.43,z,w,.13,.55,.07,mat);m.rounded(x,.55,z-.21,w,.42,.105,.05,mat)
 c.box(x,0,z,w,.56,.55,'wood');c.box(x,.54,z-.21,w,.44,.12,'wood')
def awning(m,c,x,z,w,d,y,strip=True):
 # A tensioned canopy with stitched stripes, a scalloped valance and brass support rods.
 n=max(6,int(w/.22));band=w/n
 for j in range(n):
  xx=x-w/2+j*band;mat='canvas' if not strip or j%4 in (0,1) else 'sea'
  prev=None
  for k in range(8):
   u=k/7;h=y+.14*(1-u)-.085*math.sin(math.pi*u);zz=z+d*u
   row=[(xx,h,zz),(xx+band,h,zz)]
   if prev:
    q=[prev[0],prev[1],row[1],row[0]];m.outward(q,mat,[0,1,0]);m.outward(q,mat,[0,-1,0])
   prev=row
  zz=z+d;drop=.135+(j%2)*.012
  a=[(xx,y,zz),(xx+band,y,zz),(xx+band,y-.075,zz),(xx+.75*band,y-drop,zz),(xx+.5*band,y-drop-.015,zz),(xx+.25*band,y-drop,zz),(xx,y-.075,zz)]
  m.outward(a,mat,[0,0,1]);m.outward(a,mat,[0,0,-1])
 for xx in [x-w/2+.07,x+w/2-.07]:
  tube(m,[(xx,y-.52,z+.03),(xx,y-.02,z+d*.92),(xx,y+.10,z+.06)],.034,'brass')
 m.beam((x-w/2+.01,y-.03,z+d),(x+w/2-.01,y-.03,z+d),.044,'brass')
 # Fabric and rails provide overhead cover at their real, thin height.
 c.beam((x,y+.1,z),(x,y-.015,z+d),w,'fabric',.045)
def plant(m,x,y,z,scale=1,seed=0):
 gen=random.Random(seed)
 for j in range(20):
  ang=j*2.39996+gen.uniform(-.23,.23);radius=scale*gen.uniform(.19,.44);h=scale*gen.uniform(.30,.91);rad=np.array([math.cos(ang),0,math.sin(ang)]);cross=np.array([-rad[2],0,rad[0]]);ctr=np.array([x,y,z])
  prev=None
  for f,w in [(0,.018),(.28,.068),(.62,.062),(.83,.045),(1,.001)]:
   p=ctr+rad*radius*(f**1.50)+np.array([0,h*(f+.30*math.sin(math.pi*f)),0]);ridge=p+np.array([0,scale*.014*math.sin(math.pi*f),0]);row=[p-cross*w*scale,ridge,p+cross*w*scale]
   if prev:
    for i,k in enumerate([('leaf','newleaf','blueleaf')[j%3],('blueleaf','leaf','newleaf')[j%3]]):
     q=[prev[i],row[i],row[i+1],prev[i+1]];m.face(q,k);m.face(q[::-1],k)
   prev=row
def planter(m,c,x,z,w,d,h=.63,seed=4):
 m.rounded(x,0,z,w,h,d,.082,'oyster');m.rounded(x,h-.055,z,w+.03,.075,d+.03,.07,'travertine');m.rounded(x,h+.022,z,w-.16,.023,d-.13,.05,'soil')
 c.box(x,0,z,w,h+.025,d,'limestone')
 n=max(1,int(w/.52))
 for j in range(n):plant(m,x-w/2+w*(j+.5)/n,h+.044,z+(j%2-.5)*d*.24,min(.78,d*.84),seed+j)
def apron(m,w,d):
 m.rounded(0,0,(d-.14)/2,w,.033,d+.14,.08,'terrazzo',b=.005)
 # Inlaid edging and thin tile joints make each furnishing belong to its own paved area.
 for z in [-.09,d-.055]:m.box(0,.035,z,w-.12,.004,.022,'brass',False)
 for x in [-(w/2-.06),w/2-.06]:m.box(x,.035,(d-.14)/2,.022,.004,d-.11,'brass',False)
 for j in range(1,int(w/.63)+1):
  x=-w/2+w*j/(int(w/.63)+1);m.box(x,.034,(d-.14)/2,.008,.002,d-.18,'slate',False)
def spine(m,c,w,h,finish='oyster',teak=False):
 # Continuous opaque backing is expressed on both elevations, with an actual coping and relief.
 m.box(0,.033,0,w,h,.235,finish);c.box(0,0,0,w,h+.033,.235,'limestone')
 m.rounded(0,h+.033,0,w,.075,.27,.027,'travertine',b=.009);c.box(0,h+.033,0,w,.075,.27,'limestone')
 for xx in np.linspace(-w/2+.14,w/2-.14,4):
  m.box(xx,.105,-.123,.035,h-.16,.023,'brass',False)
 if teak:
  for yy in np.arange(.18,h-.04,.14):m.rounded(0,yy,-.139,w-.10,.105,.047,.018,'teak',b=.005)
def bistro(m,c,w,d):
 apron(m,w,d);spine(m,c,w,2.14,'green')
 m.box(0,.31,.135,w-.14,1.49,.03,'pooltile',False);plaque(m,-.65,1.21,-.143,-1,1.02,.52,'cafe')
 for x in [-1.23,.15]:
  seat(m,c,x,.56,w=1.15);cafe_table(m,c,x,1.43,r=.39)
  stoolx=x+.40;m.cyl(stoolx,.08,1.96,.036,.37,'brass',12);m.cyl(stoolx,.45,1.96,.19,.071,'teak',18);c.cyl(stoolx,.03,1.96,.17,.49,'wood',12)
 planter(m,c,1.64,1.43,.68,.65,.67)
 for x in [-w/2+.11,w/2-.11]:m.box(x,.033,.09,.10,2.74,.10,'brass');c.box(x,.033,.09,.10,2.74,.10,'bronze')
 awning(m,c,-.36,.068,w-.85,1.36,2.57,True)
def bell(m,c,w,d):
 apron(m,w,d);spine(m,c,w,2.17,'oyster',True)
 for x in [-w/2+.11,-.74,w/2-.11]:m.box(x,.04,.14,.09,2.64,.13,'brass')
 m.rounded(-1.62,.04,.75,1.18,1.01,.85,.12,'teak');m.rounded(-1.62,1.05,.75,1.28,.105,.95,.07,'oyster');c.box(-1.62,0,.75,1.28,1.15,.95,'wood')
 plaque(m,-1.62,.51,1.205,1,.83,.39,'bell');plaque(m,-1.47,1.11,-.172,-1,1.06,.54,'bell')
 m.cyl(-1.49,1.16,.82,.10,.07,'brass',16,r2=.065);m.cyl(-1.49,1.23,.82,.026,.04,'brass',12)
 for j,x in enumerate([-.16,1.38]):
  sc=.64 if j==0 else .61;z=1.10 if j==0 else .97;m.historic(B.trolley(),x,z,sc,.038)
  for xx in (-.55,.55):c.box(x+xx*sc,.0,z,sc*.21,sc*.39,sc*.82,'rubber')
  c.box(x,.23,z,sc*2.2,.16,sc*1.25,'bronze');c.box(x,.37,z,sc*1.88,sc*1.05,sc*.89,'wood');c.box(x-.16,sc*1.76+.04,z+.04,sc*1.0,sc*.65,sc*.73,'wood')
  for xx in [-1,1]:c.beam((x+xx*sc,.35,z+.48*sc),(x+xx*sc,2.91*sc,z+.48*sc),.056,'bronze')
  m.box(x,.042,z+.48,.95,.016,.055,'brass',False)
 awning(m,c,0,.09,w-.27,1.43,2.66,False)
def water(m,c,w,d):
 apron(m,w,d);spine(m,c,w,2.29,'iron')
 for yy in np.arange(.24,2.17,.16):
  m.beam((-w/2+.12,yy,-.16),(w/2-.12,yy,-.16),.065,'green',.115)
 m.box(-w/2+.12,.05,1.00,.23,2.03,1.88,'oyster');c.box(-w/2+.12,0,1,.23,2.08,1.88,'limestone')
 plaque(m,.85,1.11,-.22,-1,1.09,.57,'plant')
 for j,(x,rad) in enumerate([(-1.04,.39),(.17,.34)]):
  m.cyl(x,.06,.85,rad+.05,.12,'iron',22);m.cyl(x,.18,.85,rad,1.29,'green',24,r2=rad*.97);m.cyl(x,1.47,.85,rad*.97,.23,'green',24,r2=.16);m.cyl(x,1.70,.85,.15,.12,'brass',16)
  for hh in [.29,.94,1.41]:m.cyl(x,hh,.85,rad+.017,.044,'steel',24)
  c.cyl(x,.03,.85,rad,1.49,'enamel',18);c.cyl(x,1.52,.85,rad*.8,.22,'enamel',18,r2=.15)
  tube(m,[(x,1.79,.85),(x,1.91,.85),(x,1.91,.43),(x,1.96,.22)],.085,'copper')
  tube(m,[(x,.36,1.12),(x,.36,1.53),(x+.43,.36,1.53)],.102,'steel')
  m.box(x,1.12,1.206,.30,.27,.03,'steel');m.card(x,1.14,1.225,0,1,.26,.23,'pressure')
 for xx in np.linspace(.75,1.9,9):m.box(xx,.05,1.45,.06,.012,.54,'iron',False)
 m.historic(B.maintenance(),1.28,.71,.57,.04,0)
 c.box(1.18,.03,.71,1.12,.82,.78,'enamel')
 m.box(1.53,.18,.177,1.0,1.04,.19,'green');plaque(m,1.58,.50,.296,1,.57,.25,'filter')
def garden(m,c,w,d):
 apron(m,w,d);spine(m,c,w,2.03,'oyster')
 for j in range(30):
  x=-w/2+.17+j*(w-.34)/29;m.box(x,.80,.134,.052,1.14,.042,'reed',False)
 planter(m,c,-.20,.58,w-.7,.75,.72,seed=33)
 for x in [-1.46,1.18]:m.box(x,.06,1.18,.21,.40,.34,'oyster');c.box(x,.045,1.18,.21,.40,.34,'limestone')
 for z in [1.04,1.19,1.34]:m.rounded(-.13,.45,z,w-.69,.105,.128,.04,'teak')
 c.box(-.13,.45,1.19,w-.69,.105,.46,'wood')
 plaque(m,.71,1.00,-.149,-1,1.02,.48,'garden')
def pool(m,c,w,d):
 apron(m,w,d)
 # The narrow changing screen and the back of the towel cabinet are solid. The loungers face the water.
 p=w/2-.60;m.rounded(p,.04,.42,1.14,2.10,.68,.05,'teak');c.box(p,0,.42,1.14,2.14,.68,'wood')
 m.box(p,2.13,.44,1.23,.08,.77,'oyster');m.box(p,1.13,.79,.99,.84,.033,'iron',False)
 for k in range(2):
  yy=1.15+.42*k;m.box(p,yy,.84,1.05,.055,.22,'teak')
  for j in range(3):
   xx=p-.32+j*.31
   for level in range(2):m.rounded(xx,yy+.065+.105*level,.89,.25,.09,.22,.033,'towel' if (j+k)%2 else 'sea')
 plaque(m,p,.52,.79,1,.81,.37,'pool');plaque(m,p,1.15,.062,-1,.77,.51,'pool')
 for j in range(11):
  x=-w/2+.135+j*.227;m.rounded(x,.05,.07,.220,1.94,.13,.018,'teak',b=.006)
 # A continuous dark backing behind the slats is visible in their joints, and matches the collider.
 m.box(-w/2+1.27,.06,.03,2.53,1.89,.08,'green');c.box(-w/2+1.27,0,.05,2.53,1.99,.15,'wood')
 for x in [-1.38,-.26]:daybed(m,c,x,1.14)
 cafe_table(m,c,.50,1.36,.48,.22)
 awning(m,c,p,.12,1.31,1.03,2.32,True)
def laundry(m,c,w,d):
 apron(m,w,d);spine(m,c,w,2.22,'slate')
 # Pass-through linen hatch, with visible roller strips and a return shelf.
 m.rounded(.29,.70,.14,2.02,1.22,.12,.045,'iron')
 for yy in np.linspace(.77,1.85,13):m.box(.29,yy,.218,1.87,.066,.036,'steel',False)
 m.rounded(.29,.78,.38,2.12,.09,.49,.05,'teak');c.box(.29,.78,.38,2.12,.09,.49,'wood')
 plaque(m,-1.22,1.24,.153,1,.78,.42,'linen');plaque(m,.62,1.22,-.153,-1,.97,.54,'linen')
 m.historic(B.trolley(True),-.84,1.07,.60,.039);c.box(-.75,.07,1.07,1.44,1.40,.80,'enamel')
 m.rounded(.98,.13,1.13,.81,.72,.68,.115,'reed')
 for hh in [.18,.46,.72]:m.rounded(.98,hh,1.13,.82,.035,.69,.10,'brass',b=.006)
 for j in range(3):m.rounded(.97,.85+.079*j,1.12,.66,.072,.52,.065,'towel')
 c.box(.98,.04,1.13,.83,1.02,.69,'wood')
def promenade(m,c,w,d):
 apron(m,w,d)
 # The open bronze loops remain open; the framed coastal artwork provides opaque cover beside them.
 m.rounded(-.74,.035,.14,1.83,2.29,.28,.07,'oyster');c.box(-.74,0,.14,1.83,2.32,.28,'limestone')
 for sign in [-1,1]:
  zz=.14+sign*.153;m.box(-.74,.71,zz,1.57,1.37,.045,'brass');m.card(-.74,.76,zz+sign*.027,0,sign,1.46,1.24,'artwork')
 plaque(m,-.75,.30,.313,1,1.08,.28,'art')
 m.historic(B.sculpture(),.91,.55,.68,.04,0);c.box(.91,.04,.55,1.22,.85,1.09,'limestone')
 for cy in [1.90,3.05]:
  for i in range(16):
   a=i*math.tau/16;b=(i+1)*math.tau/16;xx=.91;yy=.04+.68*cy
   c.beam((xx+.45*math.cos(a),yy+.45*math.sin(a),.55),(xx+.45*math.cos(b),yy+.45*math.sin(b),.55),.128,'bronze')
 planter(m,c,-.78,.94,1.72,.48,.45,seed=41)
def dining(m,c,w,d):
 apron(m,w,d);spine(m,c,w,2.05,'teak',False)
 for j in range(3):
  x=-1.42+j*.43;m.box(x,1.12,.141,.075,.76,.041,'brass',False)
 m.rounded(-.11,.05,.64,2.78,1.12,.84,.135,'green');m.rounded(-.11,1.17,.65,2.94,.13,.99,.11,'oyster');c.box(-.11,0,.64,2.90,1.30,.97,'wood')
 for j in range(15):m.box(-1.33+j*.174,.17,1.073,.063,.82,.044,'teak',False)
 m.rounded(.41,1.57,.29,1.43,.05,.30,.035,'brass')
 for j in range(7):
  x=-.12+j*.177;h=.14+.036*(j%3);m.cyl(x,1.62,.28,.049,h,'glass' if j%2 else 'copper',12);m.cyl(x,1.62+h,.28,.024,.06,'brass',10)
 for x in [-.80,.62]:
  m.cyl(x,.04,1.59,.25,.06,'iron',16);m.cyl(x,.10,1.59,.05,.62,'brass',12);m.cyl(x,.70,1.59,.239,.09,'sea',20);c.cyl(x,.04,1.59,.23,.75,'wood',14)
 for x in [-1.15,-.55]:cup(m,x,1.305,.79)
 plaque(m,.29,.92,-.15,-1,1.08,.53,'dining')
 m.box(1.61,.04,.71,.36,1.87,.52,'teak');plaque(m,1.61,1.11,.995,1,.31,.42,'menu');c.box(1.61,0,.71,.36,1.91,.52,'wood')
defs=[
 ('arrivals','Reception · Bell desk and luggage bay','reception',5.05,2.04,bell),
 ('filtration','Pool Equipment Room · Filter yard','pool-equipment',4.55,2.14,water),
 ('terrace','Poolside Café · Sheltered terrace','cafe',4.75,2.30,bistro),
 ('garden','Azure Spa · Walled garden seat','azure-spa',4.60,1.68,garden),
 ('pool-club','Pool Club · Towel cabana and loungers','ground',4.34,2.18,pool),
 ('linen','Service Laundry · Linen return','laundry',3.76,1.80,laundry),
 ('tideline','Hotel promenade · Tideline bronze','sunward-wing',3.58,1.40,promenade),
 ('dining-bar','Terrace Restaurant · Drinks counter','terrace-restaurant',4.04,2.00,dining)]
def run():
 info=[]
 for key,name,venue,w,d,fn in defs:
  m=Surface();c=B.M();fn(m,c,w,d);v,f=old.export(m,A/(key+'.obj'))
  parts=old.compound({'physical_primitives':c.solids,'physical_extras':c.physical_extras,'free_faces':[]})
  old.write_compound(A/(key+'-collision.obj'),parts,np.zeros(3))
  info.append(dict(key=key,name=name,venue=venue,width=w,depth=d,vertices=v,triangles=f,collision_parts=len(parts)))
 (R/'Source/furnishings.json').write_text(json.dumps(info,indent=2,ensure_ascii=False))
 print([(r['key'],r['triangles'],r['collision_parts']) for r in info],flush=True)
if __name__=='__main__':run()
