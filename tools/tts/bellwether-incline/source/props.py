import math,random
import numpy as np
from mesh import Pair
from buildings import bench,crate,cabinet,case,stairs

def rounded(g,x,y,z,rx,ry,rz,material,seed=0):
 rnd=random.Random(seed);n=12;rings=[]
 for j in range(7):
  phi=-math.pi/2+math.pi*j/6
  rings.append([(x+rx*math.cos(phi)*math.cos(i*2*math.pi/n)*(1+rnd.uniform(-.05,.05)),y+ry*math.sin(phi),z+rz*math.cos(phi)*math.sin(i*2*math.pi/n)*(1+rnd.uniform(-.05,.05))) for i in range(n)])
 for a,b in zip(rings,rings[1:]):
  for i in range(n):
   j=(i+1)%n;pts=[a[i],b[i],b[j],a[j]]
   if np.linalg.norm(np.cross(np.subtract(pts[1],pts[0]),np.subtract(pts[2],pts[0])))<1e-6:g.m.tri([a[i],b[j],a[j]],material)
   else:g.panel(pts,material)

def wheelset():
 g=Pair('wheelset-cradle')
 for z in (-.74,.74):
  g.box(0,.08,z,2.55,.22,.20,'darkiron',True)
  for x in (-1.04,1.04):g.box(x,0,z,.42,.11,.36,'steel',True)
 for x in (-1.08,1.08):g.box(x,.17,0,.22,.41,1.62,'ochre',True)
 for x in (-.78,.78):
  g.cyl((x-.10,.92,0),(x+.10,.92,0),.68,'darkiron',22,True,'steel')
  g.cyl((x-.14,.92,0),(x-.095,.92,0),.736,'darkiron',22)
  g.cyl((x+.105,.92,0),(x+.14,.92,0),.49,'steel',18)
 g.cyl((-1.27,.92,0),(1.27,.92,0),.135,'steel',12,True)
 for x in (-.36,.36):g.cyl((x-.09,.92,0),(x+.09,.92,0),.245,'darkiron',12)
 g.sign((0,.20,-.854),1.1,.19,'S','numbers');return g

def inspection():
 g=Pair('inspection-locker')
 g.box(0,.02,0,1.85,.86,1.05,'darkiron',True)
 g.box(0,.88,0,1.81,.057,1.02,'rubber',False)
 g.box(0,.90,.46,1.83,1.00,.11,'darkiron',True)
 g.sign((0,1.42,.38),1.54,.71,'S','mapprint')
 for x,col in ((-.44,'enamelblue'),(.44,'ochre')):
  g.box(x,.96,-.02,.63,.24,.64,col,True);g.box(x,1.20,.03,.46,.032,.29,'glass',False)
  for i in range(4):g.cyl((x-.20+i*.12,1.20,-.23),(x-.20+i*.12,1.244,-.23),.031,'ivory',7)
 for x in (-.65,.65):g.box(x,.55,-.545,.13,.22,.06,'brass',False)
 g.sign((0,.43,-.542),.95,.28,'S','recorders');return g

def trolley():
 g=Pair('parcel-trolley')
 for x in (-.82,.82):
  for z in (-.48,.48):
   g.cyl((x-.07,.19,z),(x+.07,.19,z),.18,'rubber',10,True,'steel')
 g.box(0,.32,0,2.05,.15,1.32,'darkiron',True)
 for x in (-.96,.96):
  for z in (-.59,.59):g.cyl((x,.44,z),(x,2.10,z),.054,'steel',8)
  g.beam((x,2.10,-.59),(x,2.10,.59),.10,.09,'steel')
 for z in (-.61,.61):
  for i in range(6):g.box(-.85+i*.34,.47,z,.18,1.11,.07,'weatherwood',False)
  for yy in (.62,1.39,1.96):g.box(0,yy,z,2.03,.080,.09,'darkiron',False)
 for x,z,w,h,d in [(-.48,-.02,.78,.70,.84),(.42,0,.80,.86,.86),(-.47,-.04,.68,.55,.68)]:
  crate(g,x,1.17 if h==.55 else .47,z,w,h,d)
 g.sign((0,1.47,-.684),1.1,.36,'S','parcelmark');return g

def grit():
 g=Pair('winter-grit-bin')
 g.box(-.32,.08,0,1.45,.89,1.19,'enamelblue',True)
 g.box(-.32,.98,0,1.38,.06,1.10,'salt',False)
 g.box(-.32,1.02,.51,1.47,.70,.10,'enamelblue',True)
 g.sign((-.32,.49,-.609),1.02,.36,'S','locker')
 for k,(x,z,rx,ry,rz) in enumerate([(.82,.06,.39,.51,.38),(1.10,-.40,.31,.39,.32)]):
  rounded(g,x,ry,z,rx,ry,rz,'canvas',k+50);g.c.box(x,.03,z,rx*1.45,ry*1.40,rz*1.45,'darkiron')
 g.beam((.38,.10,-.47),(.62,1.83,-.34),.057,.052,'larch')
 g.box(.38,.07,-.47,.25,.25,.09,'steel',False);return g

def toolchest():
 g=Pair('mobile-tool-chest')
 for x in (-.66,.66):
  for z in (-.37,.37):g.cyl((x-.07,.16,z),(x+.07,.16,z),.15,'rubber',9,True)
 cabinet(g,0,.28,0,1.73,1.04,.90,5,'enamelblue')
 g.box(-.38,1.39,0,.36,.19,.31,'enamelblue',False);g.box(-.39,1.58,0,.45,.07,.25,'steel',False)
 for y in [1.45,1.50,1.55]:g.cyl((.42,y,-.02),(.42,y+.028,-.02),.27,'rubber',12)
 g.cyl((.42,1.60,-.02),(.42,1.86,-.02),.13,'light',10)
 return g

def platform_bench():
 g=Pair('waiting-bench');bench(g,-.20,0,2.60)
 case(g,1.24,.015,-.20,.64,.62,.51)
 g.cyl((.68,.67,-.08),(.68,1.01,-.08),.085,'sage',10)
 g.box(-.73,.67,-.09,.48,.035,.31,'paper',False);return g

def shelter():
 g=Pair('platform-shelter');w=4.2;d=1.85
 g.box(0,0,0,w,.17,d,'concrete',True,'tile')
 g.box(0,.17,.81,w-.13,1.37,.19,'ashlar',True)
 for x in (-1.92,1.92):
  for z in (-.76,.76):g.box(x,.17,z,.16,2.08,.17,'larch',True)
 for a,b in ((-.94,0),(0,.94)):
  g.panel([(-2.26,2.26+.27*(1-abs(a)),a),(-2.26,2.26+.27*(1-abs(b)),b),(2.26,2.26+.27*(1-abs(b)),b),(2.26,2.26+.27*(1-abs(a)),a)],'slate',True)
 bench(g,-.30,.22,2.55,y=.17)
 g.sign((0,1.73,.695),1.83,.51,'S','station');return g

def standing_board():
 g=Pair('station-information-board')
 for x in (-1.13,1.13):
  g.box(x,0,0,.47,.22,.52,'ashlar',True);g.box(x,.17,0,.15,2.30,.19,'darkiron',True)
 g.box(0,.57,0,2.49,1.86,.18,'enamelblue',True)
 g.sign((0,1.51,-.10),2.27,1.65,'S','poster1');g.sign((0,1.51,.10),2.26,1.64,'N','mapprint')
 g.box(0,2.43,0,2.63,.12,.37,'copper',True);return g

def screen():
 g=Pair('retaining-screen')
 g.box(0,0,0,3.8,1.56,.55,'ashlar',True)
 g.box(0,1.56,0,3.80,.14,.57,'concrete',True,'snow')
 for x in (-1.72,1.72):g.box(x,0,.08,.37,1.77,.69,'rubble',True,'snow')
 return g

def hatchbox():
 g=Pair('signal-power-case')
 g.box(0,0,0,1.95,.22,1.22,'concrete',True);cabinet(g,0,.22,0,1.61,1.55,.89,2,'sage')
 for x in (-.55,-.30,-.05,.2,.45):
  for y in (1.0,1.12,1.24):g.box(x,y,.456,.16,.042,.035,'darkiron',False)
 g.sign((0,.80,-.482),.60,.25,'S','bellmark');return g

def planter():
 g=Pair('station-windbreak-planter')
 g.box(0,0,0,3.2,.82,1.30,'ashlar',True)
 g.box(0,.82,0,3.23,.105,1.32,'concrete',True,'snow')
 # Branches grow out of the planted bed. Snow sits on boughs at varied heights.
 rnd=random.Random(812)
 for j,(x,height) in enumerate([(-.97,2.18),(.1,1.52),(.91,1.96)]):
  g.cyl((x,.90,0),(x,height+.40,0),.055,'weatherwood',7)
  for tier in range(4):
   y=.97+tier*.25;reach=(1-tier*.19)*(.44+.055*(j%2))
   for i in range(7):
    a=i*math.pi*2/7+tier*.59
    xx=x+math.cos(a)*reach;zz=math.sin(a)*reach
    tip=(xx,y+.08+rnd.random()*.09,zz)
    g.beam((x,y+.18,0),tip,.13,.095,'sage')
    if (tier+i)%3==0:g.beam((x+(xx-x)*.44,y+.18,zz*.44),tip,.13,.033,'snow')
  g.c.cyl((x,.87,0),(x,height+.16,0),reach+.17,'darkiron',6)
 return g

def terrace(key,w,d,h,stx):
 g=Pair(key);g.box(0,0,0,w,h,d,'ashlar',True,'tile')
 for x in (-w/2+.12,w/2-.12):
  g.box(x,h,0,.23,.35,d,'ashlar',True,'snow')
 for a,b in [(-w/2,stx-1.03),(stx+1.03,w/2)]:
  if b>a:g.box((a+b)/2,h,-d/2+.09,b-a,.35,.19,'ashlar',True,'snow')
 stairs(g,stx,0,-d/2-.84,1.95,1.70,h,6)
 return g
