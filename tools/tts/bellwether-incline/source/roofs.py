from math import sin,cos,pi
from random import Random
import numpy as np

def roof_details(g,w,d,h,kind,variant):
 south=-d/2-.24;edge=d/2-1.55;left=-w/2-.21;right=w/2+.21;north=d/2+.14
 # An accessible service walk and a 1.22-inch hatch are common railway fittings.
 hx=w/2-1.10;ha=hx-.61;hb=hx+.61;za=d/2-1.26;zb=d/2-.05
 for x0,x1,z0,z1 in [(left,ha,edge,north),(hb,right,edge,north),(ha,hb,edge,za),(ha,hb,zb,north)]:
  if min(x1-x0,z1-z0)>.02:g.box((x0+x1)/2,h-.034,(z0+z1)/2,x1-x0,.085,z1-z0,'weatherwood',True,'slate')
 for xx in (left+.30,left+1.48):
  g.cyl((xx,h,north-.08),(xx,h+.44,north-.08),.035,'darkiron',7)
 g.beam((left+.27,h+.43,north-.08),(left+1.5,h+.43,north-.08),.056,.056,'darkiron')
 rng=Random(sum(map(ord,variant)))
 # Snow forms wind-scoured tongues with alternating shoulders, never square plates.
 def sheet(a,b,c,e,fn,mt):
  g.deck([(a,fn(a,c),c),(a,fn(a,e),e),(b,fn(b,e),e),(b,fn(b,c),c)],mt)
 def snow(a,b,z,depth,fn):
  n=max(5,int((b-a)*4.5));edge0=[];edge1=[]
  for j in range(n+1):
   x=a+(b-a)*j/n;q=j/n;mask=sin(q*pi)**.65
   z0=z+.048*sin(j*.91)+rng.random()*.03;z1=z0+depth*mask*(.64+.20*sin(q*7.3)+rng.random()*.27)
   edge0.append((x,fn(x,z0)+.025,z0));edge1.append((x,fn(x,z1)+.029,z1))
  for j in range(n):
   face=[edge0[j],edge1[j],edge1[j+1],edge0[j+1]]
   if j==0:g.m.tri([edge0[j],edge1[j+1],edge0[j+1]],'snow')
   elif j==n-1:g.m.tri([edge0[j],edge1[j],edge0[j+1]],'snow')
   else:g.panel(face,'snow')
 def chimney(x,z,base,tall,roundflue=False):
  g.box(x,base-.16,z,.55,.22,.64,'darkiron',False)
  if roundflue:
   g.cyl((x,base,z),(x,base+tall,z),.15,'darkiron',15)
   for yy in [base+tall*.34,base+tall*.66,base+tall-.08]:
    g.cyl((x,yy,z),(x,yy+.042,z),.178,'steel',15)
   g.cyl((x,base+tall,z),(x,base+tall+.07,z),.245,'copper',12)
  else:
   g.box(x,base-.10,z,.48,tall,.53,'rubble',True)
   g.box(x,base+tall-.13,z,.59,.12,.64,'concrete',False,'snow')
   for zz in (-.145,.145):g.cyl((x,base+tall-.024,z+zz),(x,base+tall+.21,z+zz),.092,'garnet',10)
 if kind in ('winding','crew'):
  # A gable facing the visitors, cut back at the rear for the maintenance deck.
  rise=1.74 if kind=='winding' else (1.28 if variant=='crew-lodge' else .93);ridge=(-.17 if kind=='winding' else .04)*w
  def Y(x,z):return h+.105+rise*max(0,1-abs(x-ridge)/((ridge-left) if x<ridge else (right-ridge)))
  for a,b in [(left,ridge),(ridge,right)]:
   sheet(a,b,south,edge,Y,'slate')
   snow(a+.01,b-.06,south+.04,.65 if kind=='crew' else .37,Y)
   if kind=='crew':snow(a+.13,b-.19,min(-.20,edge-.45),.42,Y)
  for z in [south+.08,edge-.05]:
   p=[(left,h,z),(ridge,Y(ridge,z)-.02,z),(right,h,z)]
   g.closed_plate(p,np.array([0,0,.12 if z<0 else -.12]),'larch','larch')
   for a,b in [(left,ridge),(ridge,right)]:g.beam((a,Y(a,z)-.055,z-.06),(b,Y(b,z)-.055,z-.06),.15,.16,'weatherwood',True)
  # King post and timber struts embedded in the triangular façade.
  for x in [ridge-w*.20,ridge,ridge+w*.20]:
   g.beam((x,h+.075,south-.036),(x,Y(x,south)-.14,south-.036),.14,.09,'weatherwood')
  g.beam((left+.20,h+.135,south-.04),(right-.20,h+.135,south-.04),.14,.12,'weatherwood')
  g.beam((ridge,Y(ridge,south)+.035,south-.04),(ridge,Y(ridge,edge)+.035,edge+.04),.16,.11,'copper')
  if kind=='winding':
   # A circular glazed oculus and the cast station plaque share the principal gable.
   g.cyl((ridge,h+.87,south-.07),(ridge,h+.87,south-.16),.33,'concrete',22)
   g.cyl((ridge,h+.87,south-.165),(ridge,h+.87,south-.19),.255,'glass',22)
   for a in [0,pi/2]:
    g.beam((ridge-.25*cos(a),h+.87-.25*sin(a),south-.207),(ridge+.25*cos(a),h+.87+.25*sin(a),south-.207),.035,.045,'darkiron')
  chimney(-w*.29,edge-.47,Y(-w*.29,edge)-.07,.70,kind=='winding')
 elif kind in ('brake','stores','boiler'):
  if kind=='brake':
   length=(edge-south)/2
   for i in range(2):
    z0=south+i*length;z1=z0+length-.18
    def Y(x,z):return h+.12+.80*(z-z0)/(z1-z0)
    sheet(left,right,z0,z1,Y,'corrugated');snow(left+.09,right-.15,z0+.035,.42,Y)
    for x in (left,right):
     g.closed_plate([(x,h+.08,z0),(x,h+.92,z1),(x,h+.08,z1)],np.array([.1 if x<0 else -.1,0,0]),'larch','larch')
    g.box(0,h+.09,z1+.07,w+.38,.76,.14,'glass',True)
    for j in range(8):g.box(left+.09+j*(right-left-.18)/7,h+.07,z1+.154,.065,.83,.06,'darkiron',False)
    g.beam((left,h+.93,z1),(right,h+.93,z1),.14,.14,'steel')
   chimney(w*.31,edge-.37,h+.64,.88,True)
  else:
   def Y(x,z):return h+.095+.10*(z-south)/(edge-south)
   sheet(left,right,south,edge,Y,'charcoal');snow(left+.12,right-.12,south+.085,.95,Y)
   for x in [left+.06,right-.06]:g.box(x,h-.015,(south+edge)/2,.13,.28,edge-south,'concrete',True,'snow')
   for zz in [south+.04,edge-.04]:g.box(0,h-.02,zz,w+.4,.24,.13,'concrete',True,'snow')
   if kind=='boiler':
    chimney(-w*.26,south+.66,h+.22,2.19,True);chimney(-w*.26+.75,south+.70,h+.20,1.39,True)
    g.box(.48,h+.19,(south+edge)/2,1.75,.42,.82,'steel',True)
    for j in range(8):g.box(-.24+j*.20,h+.61,(south+edge)/2,.10,.04,.66,'darkiron',False)
   else:
    for x in (-w*.24,w*.22):
     g.box(x,h+.19,(south+edge)/2,.90,.18,1.2,'darkiron',True);g.box(x,h+.37,(south+edge)/2,.76,.068,1.02,'glass',False)
 elif kind in ('ticket','cafe'):
  inset=.82 if kind=='ticket' else .70;ridgeZ=(south+edge)/2;rise=1.20 if kind=='ticket' else .90
  a=left+inset;b=right-inset;yl=h+.09;yr=h+rise
  roofmat='copper' if kind=='ticket' else 'slate'
  g.deck([(left,yl,south),(a,yr,ridgeZ),(b,yr,ridgeZ),(right,yl,south)],roofmat)
  g.deck([(a,yr,ridgeZ),(left,yl,edge),(right,yl,edge),(b,yr,ridgeZ)],roofmat)
  for xx,inn in [(left,a),(right,b)]:
   tri=[(xx,yl,south),(xx,yl,edge),(inn,yr,ridgeZ)]
   g.deck(tri,roofmat)
  def Y(x,z):return yl+(yr-yl)*(z-south)/(ridgeZ-south)
  snow(left+.50,right-.54,south+.025,.48,Y)
  g.beam((a,yr+.025,ridgeZ),(b,yr+.025,ridgeZ),.13,.10,'copper')
  if variant=='ticket-office':
   # Station clock lantern and pyramidal copper capping.
   x=0;z=ridgeZ;s=.69
   g.box(x,yr-.10,z,s+.24,.20,s+.24,'larch',True);g.box(x,yr+.10,z,s,.76,s,'ivory',True)
   for xx in [-s/2,s/2]:
    for zz in [-s/2,s/2]:g.box(xx,yr+.12,z+zz,.065,.79,.065,'darkiron',False)
   for face in [-1,1]:
    g.cyl((0,yr+.49,z+face*(s/2+.005)),(0,yr+.49,z+face*(s/2+.032)),.265,'darkiron',22)
    g.cyl((0,yr+.49,z+face*(s/2+.035)),(0,yr+.49,z+face*(s/2+.041)),.219,'ivory',20)
    g.beam((-.11,yr+.58,z+face*.397),(0,yr+.49,z+face*.397),.035,.028,'darkiron')
    g.beam((0,yr+.49,z+face*.397),(.14,yr+.53,z+face*.397),.027,.027,'darkiron')
   for x0,z0,x1,z1 in [(-.49,-.49,-.49,.49),(-.49,.49,.49,.49),(.49,.49,.49,-.49),(.49,-.49,-.49,-.49)]:g.deck([(x0,yr+.87,z+z0),(0,yr+1.39,z),(x1,yr+.87,z+z1)],'copper',.06,'copper',False)
   g.cyl((0,yr+1.38,z),(0,yr+1.65,z),.038,'brass',8)
  else:chimney(-w*.24,ridgeZ,yr-.14,.64)
 else:
  pitch=.86 if kind=='relay' else 1.21
  def Y(x,z):return h+.10+pitch*(z-south)/(edge-south)
  sheet(left,right,south,edge,Y,'corrugated' if kind=='relay' else 'slate')
  for xx in [left,right]:
   tri=[(xx,h+.045,south),(xx,h+pitch+.11,edge),(xx,h+.045,edge)]
   g.closed_plate(tri,np.array([.10 if xx==left else -.10,0,0]),'larch','larch')
  g.box(0,h+.04,edge,w+.34,pitch,.09,'larch',True)
  g.beam((left,h+.18,south),(right,h+.18,south),.14,.13,'copper')
  snow(left+.06,right-.09,south+.06,.50,Y);chimney(-w*.24,edge-.40,Y(0,edge-.4)-.08,.63,kind=='relay')
 # Downpipe attaches to a solid corner pier, away from every aperture.
 xx=left+.18;zz=south+.078
 g.cyl((xx,.15,zz),(xx,h+.01,zz),.049,'copper',9)
 for yy in (.42,h*.60):g.box(xx,yy,zz,.14,.035,.16,'darkiron',False)
