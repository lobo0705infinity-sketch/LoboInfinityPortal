"""Bulkhead halls and flanged, open-ended EVA galleries. All dimensions are table inches."""
from plan import *
import model as md
from materials import SWATCH,rect,font
from PIL import Image,ImageDraw
import numpy as np
md.ASSETS=A
# Maps the plate cells in a copy of the existing worn metal atlas.
SPECS={'lab':('intake','L01','CORE PREP','CLEAN LAB'), 'plant':('power','E02','SERVICES','BASE POWER'),
       'clinic':('suits','M03','SICK BAY','CREW DECK'),'shop':('drill','W04','INSTRUMENTS','FLIGHT TEST'),
       'dispatch':('corevault','F05','DISPATCH','SAMPLE FREIGHT')}
def atlas():
 im=Image.open(r2.ASSETS/'station-finishes.jpg').convert('RGB')
 plates={**SPECS,'solar':('westshield','E02','POWER YARD','TRANSFORMERS'),'service':('northshield','H03','CREW EVA','SUIT SERVICE')}
 for key,(cell,code,title,sub) in plates.items():
  area=Image.new('RGB',(256,256),(45,58,61));d=ImageDraw.Draw(area)
  d.rectangle((8,9,247,246),outline=(160,170,161),width=3)
  stripe=(222,165,66) if key in ('lab','dispatch','shop') else (80,163,167)
  d.rectangle((12,13,243,42),fill=stripe);d.text((18,14),'KESTREL  /  LUNAR STATION',font=font(16),fill=(29,41,42))
  d.text((17,46),code,font=font(70),fill=(235,232,207))
  size=35
  while d.textlength(title,font=font(size))>221:size-=1
  d.text((17,137),title,font=font(size),fill=(239,232,205));d.text((18,204),sub,font=font(20),fill=stripe)
  for xx in [15,238]:
   for yy in [16,238]:d.ellipse((xx-2,yy-2,xx+2,yy+2),fill=(163,166,156))
  im.paste(area,rect(cell))
 im.save(A/'station-hardware.jpg',quality=94,subsampling=0)
def hullbox(m,p,s,mat):
 # Simple convex boxes keep separate collision components small and their seams stable.
 m.c.box(p,s,mat,0)
def facet(q,width,length,h=2.44):
 # Sloped upper shoulders and a flat walkable middle. Kept outside the interior headroom.
 for sign in (-1,1):
  x=sign*width/2;i=sign*(width/2-.32)
  q.m.part()
  a=[(x,h-.31,-length/2),(i,h,-length/2),(i,h,length/2),(x,h-.31,length/2)]
  q.m.face(a,'steel',np.array([0,0,0]))
 q.shell((0,h-.08,0),(width-.61,.16,length),'ivory',.075)
 hullbox(q,(0,h-.22,0),(width,.24,length),'steel')
def walls(q,side,lo,hi,at,gaps,tint):
 # Long rectangular hulls have real single-file personnel ports.
 cuts=[lo]+[v for m in sorted(gaps) for v in (m-.77,m+.77)]+[hi]
 def box(mid,y,span,h,thick,mat,offset=0,physics=False):
  sc=(thick,h,span) if side in 'NS' else (span,h,thick)
  p=(at+offset,y,mid) if side in 'NS' else (mid,y,at+offset)
  q.shell(p,sc,mat,.018); 
  if physics:hullbox(q,p,sc,mat)
 outward=-1 if side in ('N','W') else 1
 for a,b in zip(cuts[::2],cuts[1::2]):
  if b-a<.01:continue
  span=b-a;mid=(a+b)*.5
  box(mid,1.21,span,2.23,.18,'ivory',physics=True)
  box(mid,.34,span,.27,.055,'graphite',outward*.105)
  box(mid,1.80,span,.18,.055,tint,outward*.112)
  count=max(1,round(span/1.55))
  for n in range(count):
   x=a+(n+.5)*span/count
   if span/count>.87:
    box(x,1.25,min(.86,span/count-.28),.42,.06,'graphite',outward*.117)
    box(x,1.30,min(.71,span/count-.42),.24,.074,'glass',outward*.13)
   box(a+.045+n*span/count,1.24,.07,2.06,.11,'steel',outward*.10)
 for c in gaps:
  for s in (-1,1):box(c+s*.785,1.03,.074,1.90,.25,'saffron',outward*.035)
  box(c,2.13,1.52,.30,.21,tint,physics=True)
def table(q,x,z,kind):
 q.solid((x,.65,z),(.65,.67,1.48),'graphite',.025)
 q.shell((x,1.02,z),(.79,.10,1.58),'steel',.035)
 if kind=='clinic':
  q.shell((x,1.12,z),(.70,.11,1.34),'teal',.075);q.shell((x,1.21,z-.47),(.55,.10,.32),'ivory',.06)
 elif kind=='plant':
  q.shell((x,1.28,z),(.69,.47,1.3),'steel',.02)
  for zz in [-.37,-.12,.13,.38]:q.shell((x,1.53,z+zz),(.55,.06,.065),'graphite')
 else:
  for zz in [-.39,.10,.42]:
   q.tube((x,1.08,z+zz),(x,1.26,z+zz),.115,'foil' if kind=='lab' else 'teal',12)
def hall(role,closed):
 _,title,u,v,length,width,doors=HALLS[role]
 q=md.Model();tint='teal' if role in ['plant','clinic'] else 'saffron'
 q.solid((0,.072,0),(width,.144,length),'grate',.11)
 for side,lo,hi,at in [('N',-length/2,length/2,-width/2+.09),('S',-length/2,length/2,width/2-.09),('W',-width/2+.18,width/2-.18,-length/2+.09),('E',-width/2+.18,width/2-.18,length/2-.09)]:
  origin=u if side in 'NS' else v
  walls(q,side,lo,hi,at,[a-origin for a in doors.get(side,[])],tint)
 # Equipment stays on the floor with working room through all ports.
 if role=='plant':table(q,.60,-2.03,role);table(q,-.68,2.0,role)
 elif role=='clinic':table(q,.87,1.47,role);table(q,-.86,-1.57,role)
 elif role=='lab':table(q,-.91,-2.45,role);table(q,.84,2.01,role)
 elif role=='shop':table(q,.80,1.20,role)
 else:table(q,-.64,.85,role)
 # Fixed roof access on selected halls, away from the personnel port.
 if role in ('plant','lab','shop','dispatch'):
  z=-length/2+.74;xx=width/2+.12
  for zz in (z-.30,z+.30):q.tube((xx,.16,zz),(xx,2.56,zz),.043,'steel',8)
  for y in np.arange(.31,2.56,.29):q.tube((xx,y,z-.31),(xx,y,z+.31),.039,'saffron',8)
 if closed:
  facet(q,width,length)
  count=max(3,round(length/1.05))
  for i in range(count):
   z=-length/2+(i+.5)*length/count
   q.shell((0,2.455,z),(width-.74,.035,length/count-.044),'cloth' if role in ('lab','clinic') else 'steel',.027)
  for s in (-1,1):
   xx=s*(width/2-.4)
   q.pipe([(xx,2.38,-length/2+.11),(xx,2.49,-length/2+.26),(xx,2.49,length/2-.26),(xx,2.38,length/2-.11)],.047,tint)
  # One demountable plant bank and two clear roof lanes.
  if role=='plant':
   for z in (-2.95,-.98,1.0,2.98):
    q.shell((.18,2.59,z),(1.33,.24,1.68),'graphite',.095)
    for j in range(8):q.shell((.18,2.754,z-.63+j*.183),(1.08,.12,.064),'steel',.019)
  elif role=='clinic':
   q.shell((0,2.54,1.13),(1.46,.14,1.68),'teal',.08)
   q.shell((0,2.623,1.13),(.83,.023,.23),'ivory',.012);q.shell((0,2.635,1.13),(.23,.027,.78),'ivory',.012)
  elif role=='lab':
   for z in (-2.74,-1.50):q.shell((.20,2.55,z),(1.42,.14,1.06),'glass',.047)
  else:
   for z in (.42,1.34):
    q.shell((.16,2.59,z),(1.15,.20,.73),'graphite',.07)
    for a in range(4):q.shell((.16,2.715,z-.22+.14*a),(.88,.065,.037),'steel',.008)
  # Enamel identification panel recessed in a flat top cassette.
  z=length*.31 if role=='lab' else -length*.30
  if role!='plant':
   q.shell((-.18,2.503,z),(1.23,.045,1.25),'graphite',.037)
   q.m.part();q.m.face([(-.76,2.530,z-.58),(-.76,2.530,z+.58),(.40,2.530,z+.58),(.40,2.530,z-.58)],SPECS[role][0],np.array([0,0,0]),[(0,1),(1,1),(1,0),(0,0)])
 return q
def gallery(length,closed,kind):
 q=md.Model();q.solid((0,.082,0),(2.24,.164,length),'grate',.045)
 opening=min(1.88 if kind in ('freight','crossing') else 1.42,length-.55)
 for side,xx in [(-1,-1.055),(1,1.055)]:
  has_side=kind in ('freight','crossing') or (side==-1 and kind!='collar')
  spans=[(-length/2,-opening/2),(opening/2,length/2)] if has_side else [(-length/2,length/2)]
  for a,b in spans:
   q.solid((xx,1.05,(a+b)/2),(.17,1.90,b-a),'teal',.020)
   q.shell((xx+side*.10,.40,(a+b)/2),(.05,.22,b-a),'graphite',.012)
   for z in np.linspace(a+.075,b-.075,max(2,round((b-a)/.49))):
    q.shell((xx,1.02,z),(.26,1.8,.085),'steel',.015)
  if has_side:
   for s in (-1,1):q.shell((xx,1.02,s*(opening/2+.028)),(.225,1.85,.070),'saffron',.01)
 if closed:
  q.solid((0,2.04,0),(2.24,.21,length),'ivory',.045)
  n=max(2,round(length/1.00))
  for i in range(n):
   z=-length/2+(i+.5)*length/n
   q.shell((0,2.17,z),(1.65,.07,length/n-.07),'teal',.048)
   for xx in (-.90,.90):q.shell((xx,2.175,z),(.06,.10,length/n-.07),'foil',.018)
  for z in (-length/2+.115,length/2-.115):q.shell((0,2.17,z),(2.22,.10,.14),'steel',.025)
 return q
def baffle():
 q=md.Model()
 for z in [-2.2,-1.10,0,1.10,2.2]:
  q.solid((0,.99,z),(.75,1.98,1.075),'graphite',.075)
  # Regolith-filled protection bins behind bolted sheet ribs with a worn cap.
  q.shell((0,2.01,z),(.79,.09,1.075),'basalt',.05)
  for x in (-.397,.397):
   for zz in (-.43,0,.43):q.shell((x,1.02,z+zz),(.045,1.88,.033),'steel',.007)
   q.shell((x,1.75,z),(.048,.075,1.02),'saffron',.007)
 return q
if __name__=='__main__':
 atlas()
 for role in HALLS:
  for closed in [False,True]:hall(role,closed).save(role+('-closed' if closed else '-open'))
 for kind,length in [('collar',1.6),('link',3.0),('trunk',7.4),('freight',3.),('crossing',7.4)]:
  for closed in [False,True]:gallery(length,closed,kind).save(kind+('-closed' if closed else '-open'))
 baffle().save('apron-shield')
