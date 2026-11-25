from model import *
from functools import lru_cache
# Width and depth are conservative occupancy envelopes for layout and clearance.
SIZE={'greenhouse':(6.10,3.05),'cabinet':(1.52,.72),'chest':(1.83,.95),'hvac':(2.17,1.14),'radome':(1.61,1.61),'planter':(1.67,.77),'drum':(1.19,1.13),'vent':(1.23,1.04),'weather':(.91,.91),'bench':(1.78,.78),'desk':(1.86,1.07),'archive':(1.89,.99),'rack':(1.76,.78),'pump':(1.51,.92),'potting':(1.93,.98),'dispatch':(1.72,.90),'instrument':(1.72,.94),'seat':(1.75,.78),'trolley':(1.10,.65)}
def foliage(m,x,z,y,w,d,seed):
 rng=np.random.default_rng(seed);nx=max(1,round(w/.42));nz=max(1,round(d/.44));sx=w/nx;sz=d/nz
 def bound(v,center,span):return max(center-span/2,min(center+span/2,v))
 for ix in range(nx):
  for iz in range(nz):
   cx=x-w/2+(ix+.5)*sx;cz=z-d/2+(iz+.5)*sz;rad=min(.35,max(sx,sz)*.75);base=y+.012
   # Broad, folded leaves grow in overlapping inner and outer whorls.
   for layer,num in [(0,7),(1,5)]:
    for leaf in range(num):
     a=leaf*math.tau/num+layer*.9+rng.uniform(-.11,.11);u,v=math.cos(a),math.sin(a)
     length=rad*(1 if layer==0 else .64)*rng.uniform(.90,1.11);width=length*(.47 if layer==0 else .57);rise=length*(.92 if layer==0 else 1.42)
     def pt(along,side,up):
      return (bound(cx+u*length*along-v*width*side,x,w),base+rise*up,bound(cz+v*length*along+u*width*side,z,d))
     vv=[pt(0,0,0),pt(.34,-.77,.66),pt(.30,0,.72),pt(.34,.77,.63),pt(.73,-1,.94),pt(.72,0,.83),pt(.74,1,.92),pt(1,0,.82 if layer==0 else 1.09)]
     offset=rng.uniform(-.045,.035)
     st=[(.70+offset,.56),(.60+offset,.68),(.70+offset,.68),(.80+offset,.68),(.56+offset,.83),(.70+offset,.83),(.84+offset,.83),(.70+offset,.94)]
     for ids in [(0,1,2),(0,2,3),(1,4,5),(1,5,2),(2,5,6),(2,6,3),(4,7,5),(5,7,6)]:
      ps=[vv[k]for k in ids];uvs=[st[k]for k in ids];m.face(ps,'leaves',uvs);m.face(ps[::-1],'leaves',uvs[::-1])
def greenhouse(m):
 w,d=SIZE['greenhouse'];post=.12;iw=w-2*post;bw=1.13;lane=(iw-2*bw)/3
 for side in [-1,1]:
  x=side*(w/2-post/2)
  for z in [-d/2+post/2,0,d/2-post/2]:
   m.box(x,0,z,post,2.31,post,'teal',solid=True)
  m.box(x,0,0,post,.28,d,'ceramic',solid=True);m.box(x,1.20,0,.07,.07,d,'zinc');m.box(x,2.19,0,.13,.12,d,'zinc')
  for z in [-d/2+.06,0,d/2-.06]:m.beam((x,2.27,z),(0,3.01,z),.09,'zinc')
  for t in [.36,.65,.90]:
   m.box(x*t,2.98-t*.73,0,.095,.052,d,'glass')
 m.box(0,2.98,0,.14,.09,d,'zinc')
 for j in range(2):
  x=-iw/2+lane+bw/2+j*(lane+bw);bd=d-.38
  for zz in [-bd*.36,bd*.36]:m.box(x,0,zz,bw*.77,.14,.24,'timber')
  m.box(x,.14,0,bw,.48,bd,'soil','bench',True);m.box(x,.60,0,bw,.065,bd,'timber')
  m.box(x,.64,0,bw-.10,.04,bd-.10,'soil')
  for zz in [-bd/2+.065,bd/2-.065]:m.box(x,.64,zz,bw,.075,.10,'zinc')
  for xx in [-bw/2+.04,bw/2-.04]:m.box(x+xx,.64,0,.07,.075,bd,'zinc')
  foliage(m,x,0,.71,bw-.19,bd-.22,44+j)
def fan(m,x,z,y):
 m.cyl(x,y,z,.40,.035,'black',n=20)
 for j in range(7):
  a=j*math.tau/7;u=math.cos(a);v=math.sin(a);m.beam((x+.055*u,y+.041,z+.055*v),(x+.29*u-.11*v,y+.069,z+.29*v+.11*u),.082,'zinc',.035)
 m.cyl(x,y+.047,z,.085,.09,'bronze',n=12)
 for i in range(4):
  r=.15+i*.061
  for k in range(12):
   a=k*math.tau/12;b=(k+1)*math.tau/12
   m.beam((x+r*math.cos(a),y+.11,z+r*math.sin(a)),(x+r*math.cos(b),y+.11,z+r*math.sin(b)),.014,'charcoal')
def screen(m,x,z,y,w=.55):
 m.box(x,y,z,.12,.13,.085,'black');m.box(x,y+.1,z,w,.36,.067,'charcoal');m.box(x,y+.13,z-.039,w-.045,.27,.012,'route')
def top(m,w,d,y=.74):
 for x in [-w*.41,w*.41]:
  for z in [-d*.37,d*.37]:m.box(x,0,z,.092,y,.092,'teal')
 m.box(0,y,0,w,.105,d,'timber','bronze')
def book(m,x,y,z,k):
 for j in range(2+k%2):m.box(x,y+j*.069,z,.27,.064,.20,['teal','cream','red'][(k+j)%3])
def bench(m,w,d):
 for x in [-w*.34,w*.34]:m.box(x,0,0,.16,.41,d*.67,'zinc')
 m.box(0,.35,0,w,.135,d*.83,'timber')
 for x in [-w*.32,0,w*.32]:
  m.box(x,.48,-d*.06,w*.29,.10,d*.72,'red');m.box(x,.50,d*.31,w*.29,.4,.10,'red')
 for x in [-w*.47,w*.47]:m.box(x,.46,0,.055,.21,d*.72,'bronze')
@lru_cache(None)
def asset(kind):
 m=Mesh();w,d=SIZE[kind]
 if kind=='greenhouse':greenhouse(m);return m
 if kind in ('bench','seat'):bench(m,w,d);h=.89
 elif kind in ('desk','archive','potting','dispatch','instrument'):
  top(m,w,d);h=.85
  if kind=='desk':
   screen(m,-.38,.20,.85,.57);screen(m,.37,.20,.85,.52);m.box(-.35,.86,-.14,.42,.024,.16,'rack')
   m.box(.58,.02,.01,.38,.68,d*.69,'bench')
   # Operator chair tucked under the working edge, inside the reserved footprint.
   m.cyl(-.37,.06,-.34,.18,.035,'charcoal',n=12);m.cyl(-.37,.085,-.34,.046,.29,'zinc',n=8)
   m.box(-.37,.365,-.34,.40,.11,.32,'teal');m.box(-.37,.46,-.49,.055,.28,.045,'zinc');m.box(-.37,.68,-.50,.39,.24,.054,'teal')
  elif kind=='archive':
   for i in range(3):book(m,-.57+i*.42,.86,.04 if i%2 else -.16,i)
   for x in [-.64,.64]:m.beam((x,.86,.30),(x,1.25,.30),.04,'bronze');m.box(x-.08,1.24,.28,.31,.065,.15,'teal')
  elif kind=='potting':
   m.box(0,.22,0,w*.83,.085,d*.7,'zinc')
   for i in range(3):
    x=-.54+i*.47;m.cyl(x,.85,0,.14,.19,'red',n=10);foliage(m,x,0,1.04,.28,.28,35+i)
  elif kind=='dispatch':
   m.box(-.30,.85,.03,.70,.38,.51,'timber');m.box(-.3,1.23,.03,.071,.012,.52,'cream');m.box(.52,.85,-.07,.46,.24,.36,'red');screen(m,.44,.28,.85,.35)
  else:
   m.cyl(-.25,.85,.08,.21,.14,'bronze');m.beam((-.25,1,.08),(.08,1.41,-.06),.088,'zinc');m.beam((-.23,1.23,-.10),(.42,1.44,.09),.19,'bronze');screen(m,.56,.24,.85,.38)
 elif kind=='rack':
  for x in [-w/2+.09,w/2-.09]:m.box(x,0,0,.11,1.42,d,'teal')
  for j in range(3):
   m.box(0,.12+j*.44,0,w,.069,d,'zinc')
   for i in range(3):m.box(-.48+i*.47,.19+j*.44,.02,.38,.28,d*.75,['timber','ceramic','teal'][(i+j)%3])
  h=1.42
 elif kind=='pump':
  m.box(0,.02,0,w,.20,d,'charcoal')
  for x in [-.46,.38]:m.cyl(x,.22,0,.28,.48,'teal',n=14)
  for x in [-.46,.38]:m.cyl(x,.70,0,.30,.06,'bronze',n=14)
  m.beam((-.47,.66,0),(.42,.66,0),.20,'zinc');m.box(.50,.22,.26,.23,.46,.22,'rack');h=.84
 elif kind=='trolley':
  for x in [-.39,.39]:
   for z in [-.22,.22]:m.ball(x,.10,z,.095,.09,.065,'black',8,4)
  m.box(0,.15,0,w,.10,d,'zinc');m.box(0,.25,.02,.83,.42,.49,'bench');m.box(-.47,.19,0,.06,.72,d,'teal');h=.88
 elif kind=='hvac':
  m.box(0,0,0,w-.1,.13,d-.08,'charcoal');m.box(0,.13,0,w,.67,d,'zinc','louver',True);m.box(0,.80,0,w,.055,d,'ceramic')
  for x in [-.51,.51]:fan(m,x,0,.85)
  return m
 elif kind=='chest':
  m.box(0,0,0,w,.105,d,'charcoal');m.box(0,.1,0,w-.095,.81,d-.07,'red',solid=True)
  m.box(0,.91,0,w,.08,d,'zinc')
  for x in [-w*.34,w*.34]:
   m.box(x,.1,0,.07,.81,d-.012,'cream');m.box(x,.98,0,.09,.03,d,'bronze')
  m.box(0,.67,-d/2,.21,.09,.05,'charcoal');return m
 elif kind in ('cabinet','vent'):
  m.box(0,.005,0,w,.13,d,'charcoal');m.box(0,.13,0,w-.07,1.16 if kind=='cabinet' else .83,d-.05,'zinc','louver',True)
  h=1.29 if kind=='cabinet' else .96
  m.box(0,h,0,w,.09,d,'ceramic');m.box(-w*.31,.29,-d/2,.075,.41,.08,'bronze')
  return m
 elif kind=='radome':
  m.cyl(0,0,0,.66,.15,'charcoal',solid=True);m.cyl(0,.15,0,.58,.57,'teal',solid=True);m.cyl(0,.70,0,.68,.09,'zinc',solid=True)
  m.ball(0,1.20,0,.78,.66,.78,'cream',20,10);m.cyl(0,.81,0,.65,.72,'cream',solid=True,n=18);return m
 elif kind=='planter':
  m.box(0,.01,0,w-.13,.09,d-.10,'charcoal');m.box(0,.10,0,w,.52,d,'concrete',solid=True);m.box(0,.62,0,w-.10,.035,d-.10,'soil')
  foliage(m,0,0,.65,w-.22,d-.18,78);return m
 elif kind=='drum':
  m.cyl(0,.03,0,.51,.12,'timber',solid=True);m.cyl(0,.14,0,.41,.62,'charcoal',solid=True)
  for j in range(6):m.cyl(0,.19+j*.092,0,.435,.035,'bronze')
  m.cyl(0,.76,0,.55,.10,'timber',solid=True);m.cyl(0,.86,0,.10,.025,'charcoal');return m
 elif kind=='weather':
  m.cyl(0,0,0,.35,.14,'concrete',solid=True);m.cyl(0,.14,0,.10,1.48,'zinc',solid=True,n=10)
  for j in range(3):
   a=j*math.tau/3;x=.37*math.cos(a);z=.37*math.sin(a);m.beam((0,1.59,0),(x,1.64,z),.045,'bronze');m.ball(x,1.63,z,.075,.095,.075,'yellow',8,5)
  return m
 else:raise ValueError(kind)
 # TTS contact envelope for a furniture item. Walkways are planned outside this footprint.
 m.solids.append((rect(0,0,w,d),0,h));return m
