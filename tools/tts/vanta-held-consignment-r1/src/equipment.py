"""Diegetic cargo handling equipment. Inches, Y up. Decorative details and simplified convex hulls."""
from yard import *
from meshwork import Model
from finishes import uv
def badge(q,pos,w,h,key,direction):
 x,y,z=pos
 n=np.array(direction,float);right=np.array([-n[2],0,n[0]]);up=np.array([0,1,0]);c=np.array((x,y,z))
 ps=[c+right*du*w/2+up*dv*h/2 for du,dv in [(-1,-1),(1,-1),(1,1),(-1,1)]]
 q.m.part();q.m.face(ps,key,c-n,[(0,0),(1,0),(1,1),(0,1)])
def fan(q,x,y,z,r):
 q.tube((x,y,z-.012),(x,y,z+.026),r,'rubber',22)
 for j in range(7):
  a=math.tau*j/7;u=np.array((math.cos(a),math.sin(a)));v=np.array((-u[1],u[0]))
  points=[u*r*.10,u*r*.50-v*r*.08,u*r*.85+v*r*.22,u*r*.71+v*r*.38]
  pts=[(x+p[0],y+p[1],z+.04)for p in points];q.m.part();q.m.face(pts,'metal',np.array((x,y,z-1)))
 for j in range(-3,4):
  off=j*r*.23;half=math.sqrt(r*r-off*off)*.94;q.tube((x-half,y+off,z+.059),(x+half,y+off,z+.059),.010,'slate',6)
 q.tube((x,y,z+.05),(x,y,z+.08),r*.18,'ivory',12)
def wheel(q,x,y,z,r,w):
 sign=1 if x>0 else -1
 q.tube((x-sign*w/2,y,z),(x+sign*w/2,y,z),r,'rubber',20)
 side=x+sign*(w/2+.012)
 q.tube((side-sign*.014,y,z),(side+sign*.016,y,z),r*.57,'metal',16)
 q.tube((side,y,z),(side+sign*.035,y,z),r*.26,'slate',14)
 for i in range(6):
  a=i*math.tau/6;yy=y+r*.39*math.sin(a);zz=z+r*.39*math.cos(a)
  q.tube((side,yy,zz),(side+sign*.035,yy,zz),.022,'metal',6)
def stack(q,x,y,z,w=.99,d=.82,h=.86,marked=False):
 for i in (-.34,0,.34):q.shell((x+i*w,y+.06,z),(w*.15,.12,d),'wood',.009)
 for i in range(5):q.shell((x,y+.15,z+d*((i+.5)/5-.5)),(w,.075,d*.174),'wood',.01)
 q.solid((x,y+.19+h/2,z),(w*.95,h,d*.94),'wrap',.055)
 for dx in (-.28,.28):
  for zz in (-1,1):q.shell((x+w*dx,y+.19+h/2,z+zz*(d*.47+.006)),(.043,h,.022),'paint',.003)
  q.shell((x+w*dx,y+.197+h,z),(.043,.015,d*.94),'paint',.004)
 if marked:badge(q,(x,y+.2+h*.54,z+d*.47+.019),w*.52,h*.56,'tag',(0,0,1))
def weigh():
 q=Model()
 q.solid((0,.058,0),(2.64,.116,5.35),'concrete',.075)
 q.shell((0,.119,0),(2.40,.022,4.97),'tread',.045)
 for zz in (-1.74,-.57,.59,1.76):q.shell((0,.133,zz),(2.38,.013,.022),'rubber',.002)
 for x in (-1.50,1.50):
  q.solid((x,.15,1.75),(.4,.3,1.08),'concrete',.10)
  q.solid((x,1.57,1.93),(.24,2.65,.29),'paint',.045)
  for y in (.68,1.24):q.shell((x,y,1.93),(.255,.15,.305),'safety',.025)
 q.solid((0,2.92,1.93),(3.21,.35,.36),'paint',.06)
 badge(q,(0,2.92,1.743),2.01,.29,'inbound',(0,0,-1))
 q.shell((-1.66,1.76,1.78),(.80,.66,.14),'slate',.050)
 badge(q,(-1.66,1.76,1.701),.73,.57,'manifest',(0,0,-1))
 q.tube((-1.54,2.16,1.91),(-1.54,2.37,1.91),.073,'amber',12)
 q.shell((.99,2.59,1.9),(.37,.25,.51),'slate',.042);q.tube((.99,2.60,1.63),(.99,2.60,1.58),.073,'glass',12)
 q.solid((-1.58,.68,-.44),(.42,1.36,.42),'paint',.07)
 q.shell((-1.56,1.48,-.44),(.61,.39,.36),'slate',.04)
 badge(q,(-1.243,1.48,-.44),.33,.29,'scale',(1,0,0))
 q.shell((-1.56,1.70,-.44),(.65,.06,.44),'metal',.025)
 q.solid((-1.64,.84,-2.02),(.35,1.68,2.76),'concrete',.022)
 q.shell((-1.64,1.70,-2.02),(.38,.055,2.72),'metal',.018)
 for zz in (-3.15,-2.28,-1.39):
  q.shell((-1.456,1.41,zz),(.022,.11,.46),'safety',.007)
 for xx in (-1,1):
  for zz in (-2.22,2.22):q.shell((1.16*xx,.14,zz),(.12,.02,.17),'safety',.01)
 return q
def reefer():
 q=Model();WID=2.08;L=4.98
 for x in (-.90,.90):
  for z in (-2.26,2.26):q.solid((x,.11,z),(.35,.22,.37),'slate',.035)
 q.solid((0,1.36,0),(WID,2.30,L),'ivory',.055)
 for x in (-1.044,1.044):
  side=1 if x>0 else -1
  for z in np.linspace(-2.23,2.23,19):q.shell((x,1.37,z),(.044,2.11,.055),'ivory',.008)
  for y in (.31,2.40):q.shell((x,y,0),(.071,.11,L+.05),'metal',.013)
  q.shell((x+side*.034,1.52,.45),(.045,.84,1.79),'paint',.018)
  badge(q,(x+side*.062,1.52,.45),1.67,.72,'reefer',(side,0,0))
  q.shell((x+side*.035,.82,-1.53),(.04,.48,.69),'ivory',.02)
  badge(q,(x+side*.059,.82,-1.53),.63,.43,'hold',(side,0,0))
 for z in (-2.49,2.49):
  for x in (-1.02,1.02):
   q.shell((x,1.36,z),(.145,2.35,.14),'metal',.025)
   for y in (.29,2.43):q.shell((x,y,z),(.20,.17,.19),'slate',.025)
 for z in np.linspace(-2.3,2.3,16):q.shell((0,2.518,z),(1.91,.034,.047),'ivory',.009)
 # Refrigeration machinery and shore connection at the service end.
 q.shell((0,1.41,2.55),(1.84,1.86,.24),'slate',.08)
 q.shell((0,1.06,2.695),(1.67,.66,.12),'grill',.025)
 for xx in (-.46,.46):fan(q,xx,1.84,2.70,.36)
 badge(q,(-.47,.64,2.686),.58,.34,'display',(0,0,1))
 for x in (-.48,.48):
  q.shell((x,1.39,-2.506),(.92,2.04,.06),'ivory',.03)
  for dx in (-.32,.32):
   xx=x+dx;q.tube((xx,.49,-2.56),(xx,2.24,-2.56),.031,'metal',10)
   q.shell((xx+.075,.97,-2.608),(.19,.045,.038),'slate',.006)
 for y in (.52,1.4,2.19):
  for x in (-.91,.91):q.shell((x,y,-2.57),(.18,.09,.045),'metal',.008)
 badge(q,(.48,1.55,-2.545),.53,.46,'serial',(0,0,-1))
 q.shell((-.15,1.0,-2.603),(.11,.18,.035),'holdred',.01)
 q.solid((1.63,.55,2.03),(.48,1.1,.49),'paint',.065)
 q.shell((1.63,1.16,2.03),(.53,.11,.58),'safety',.045)
 for z in (1.92,2.13):q.tube((1.376,.77,z),(1.318,.77,z),.09,'rubber',12)
 q.pipe([(1.32,.74,2.0),(1.24,.30,2.25),(1.17,.09,2.45),(.95,.08,2.63),(.72,.34,2.67),(.65,.68,2.71)],.042,'rubber')
 return q
def forklift():
 q=Model()
 q.solid((0,.42,-.20),(1.14,.52,1.69),'safety',.18)
 q.solid((0,.78,-.64),(1.10,.56,.65),'safety',.16)
 q.shell((0,1.084,-.69),(.84,.065,.48),'slate',.075)
 for x in (-.56,.56):
  wheel(q,x,.35,.39,.35,.23);wheel(q,x,.275,-.72,.275,.205)
  q.shell((x,.63,.35),(.25,.115,.72),'safety',.055)
  q.shell((x,.455,-.07),(.16,.078,.38),'tread',.015)
 q.shell((0,.80,-.21),(.52,.12,.48),'rubber',.09);q.shell((0,.98,-.41),(.52,.39,.12),'rubber',.065)
 q.tube((.09,.58,.18),(.09,.94,.09),.04,'slate',10)
 q.tube((.09,.93,.09),(.09,.977,.09),.16,'rubber',12)
 for x in (-.46,.46):
  q.tube((x,.66,-.54),(x,1.78,-.55),.046,'slate',10);q.tube((x,.66,.43),(x,1.78,.36),.046,'slate',10)
 q.shell((0,1.81,-.10),(1.15,.10,1.19),'safety',.08)
 q.solid((0,1.81,-.10),(1.03,.11,1.05),'safety',.055)
 for x in (-.33,-.16,0,.16,.33):q.shell((x,1.869,-.10),(.063,.02,.87),'slate',.009)
 q.tube((.39,1.85,-.48),(.39,2.00,-.48),.07,'amber',12)
 for x in (-.43,.43):
  q.solid((x,1.0,.76),(.14,1.9,.16),'slate',.015)
  q.tube((x*.64,.32,.68),(x*.64,1.56,.68),.058,'metal',10)
  q.shell((x,.288,1.38),(.13,.092,1.39),'metal',.015)
 for y in (.44,.88,1.78):q.shell((0,y,.79),(.99,.10,.15),'slate',.018)
 stack(q,0,.30,1.45,1.20,1.02,.92,True)
 badge(q,(0,.79,-.977),.69,.33,'lift',(0,0,-1))
 return q
def tractor():
 q=Model()
 q.solid((0,.46,1.16),(1.38,.42,2.34),'paint',.16)
 for x in (-.67,.67):
  for z in (.51,1.77):wheel(q,x,.33,z,.33,.245)
 q.solid((0,1.02,1.40),(1.15,.71,1.22),'paint',.095)
 for x in (-.54,.54):
  for z in (.87,1.89):q.shell((x,1.57,z),(.095,.83,.10),'ivory',.017)
 for x in (-.551,.551):
  q.shell((x,1.58,1.40),(.028,.51,.88),'glass',.025)
  q.shell((x,1.59,1.35),(.037,.51,.038),'slate',.006)
  badge(q,(x*1.065,1.12,1.39),.65,.26,'plate',(1 if x>0 else -1,0,0))
 q.shell((0,1.61,1.925),(.98,.56,.039),'glass',.033)
 q.shell((0,1.61,.845),(.99,.53,.039),'glass',.033)
 q.solid((0,2.02,1.39),(1.31,.14,1.28),'ivory',.11)
 q.tube((-.46,2.095,1.0),(-.46,2.24,1.0),.07,'amber',10)
 for x in (-.57,.57):q.shell((x,.67,2.28),(.22,.15,.04),'lamp',.02)
 for y in (.63,.71,.79):q.shell((0,y,2.29),(.66,.022,.046),'slate',.007)
 q.tube((0,.34,.07),(0,.34,-.38),.10,'metal')
 q.solid((0,.48,-1.49),(1.50,.20,2.44),'slate',.10)
 q.shell((0,.605,-1.49),(1.45,.06,2.35),'tread',.055)
 for x in (-.72,.72):
  for z in (-2.22,-.75):wheel(q,x,.245,z,.245,.155)
 for x in (-.75,.75):q.shell((x,.58,-1.50),(.035,.085,2.06),'safety',.006)
 stack(q,0,.63,-2.05,1.10,.77,.49);stack(q,0,.63,-.99,.99,.80,.67)
 badge(q,(0,.48,-2.73),.82,.19,'release',(0,0,-1))
 return q
def inspection():
 q=Model();q.solid((0,.08,0),(2.37,.16,1.20),'concrete',.08)
 for x in (-.94,.94):
  for z in (-.37,.37):q.solid((x,.55,z),(.095,.88,.095),'metal',.008)
 q.solid((0,1.02,0),(2.20,.15,.99),'metal',.05)
 q.solid((.72,.48,0),(.53,.72,.71),'paint',.04)
 for y in (.32,.53,.74):q.shell((.72,y,.365),(.28,.032,.042),'slate',.01)
 q.solid((0,1.71,-.42),(2.13,1.27,.13),'paint',.04)
 badge(q,(.56,1.83,-.347),.92,.70,'board',(0,0,1))
 badge(q,(-.55,1.89,-.347),.64,.83,'manifest',(0,0,1))
 q.shell((-.39,1.16,.10),(.93,.17,.56),'safety',.068)
 q.shell((-.39,1.26,.10),(.80,.04,.46),'rubber',.035)
 for x in (-.61,-.38,-.15):q.shell((x,1.292,.10),(.135,.045,.31),'metal',.02)
 q.shell((-.39,1.45,-.16),(.90,.47,.065),'safety',.04);q.shell((-.39,1.45,-.12),(.80,.39,.027),'rubber',.016)
 q.shell((.55,1.111,.04),(.48,.024,.58),'wood',.012)
 q.shell((.54,1.132,.02),(.40,.016,.48),'ivory',.005)
 q.tube((.49,1.151,.1),(.66,1.15,.13),.025,'holdred',7)
 q.pipe([(.91,1.09,-.22),(.91,1.69,-.22),(.73,1.84,-.06)],.029,'metal')
 q.shell((.66,1.81,-.013),(.29,.066,.17),'lamp',.04)
 return q
def exit_counter():
 q=Model()
 q.solid((0,.82,0),(3.20,1.64,.44),'concrete',.024)
 q.shell((0,1.66,0),(3.15,.07,.48),'metal',.02)
 q.solid((-.55,1.55,-.04),(.88,.75,.40),'paint',.04)
 q.shell((-.55,1.95,-.04),(1.01,.065,.48),'metal',.02)
 badge(q,(-.55,1.62,.169),.75,.43,'dock',(0,0,1))
 q.shell((-.53,1.36,.245),(.76,.07,.27),'slate',.024)
 for x in (.41,.56,.71,.86):q.shell((x,1.36,.23),(.09,.19,.019),'safety',.008)
 q.tube((-1.35,1.67,0),(-1.35,1.84,0),.07,'paint',10)
 q.tube((-1.35,1.84,0),(-1.35,1.99,0),.068,'lamp',10)
 return q
if __name__=='__main__':
 for title,func in [('intake-weighbridge',weigh),('refrigerated-consignment',reefer),('yard-forklift',forklift),('release-tractor',tractor),('seal-inspection-bench',inspection),('gate-release-counter',exit_counter)]:
  func().save(title)
