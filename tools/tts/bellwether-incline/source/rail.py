from math import pi,cos,sin,ceil,sqrt
from random import Random
import numpy as np
from mesh import Pair
from buildings import stairs,crate,bench

from hillside import SLOPE, grade, apron, TRACK_Z, HALFWAY

def railbed(key,center):
 g=Pair(key);h=lambda x:grade(x+center);lo=-8;hi=8;edge=3.22
 # Each span sits on a full-width mountain core. Its end sections close the formation.
 for a,b in zip(range(-8,8,2),range(-6,10,2)):
  g.deck([(a,h(a),-edge),(a,h(a),edge),(b,h(b),edge),(b,h(b),-edge)],'rubble',.40,'ashlar')
 for i in range(32):
  x=-7.75+i*.5
  g.box(x,h(x),0,.19,.086,2.85,'weatherwood',False)
  for z in (-.90,.90):
   g.box(x,h(x)+.081,z,.22,.035,.19,'darkiron',False)
 for z in (-.90,.90):
  g.beam((lo,h(lo)+.127,z),(hi,h(hi)+.127,z),.085,.12,'darkiron',True)
  g.beam((lo,h(lo)+.204,z),(hi,h(hi)+.204,z),.145,.042,'steel')
 g.beam((lo,h(lo)+.102,0),(hi,h(hi)+.102,0),.045,.045,'darkiron')
 # Track ballast, cable rollers and trackside snow at the grade.
 rnd=Random(center+162)
 for i in range(92):
  x=rnd.uniform(-7.94,7.94);side=rnd.choice([-1,1]);z=side*rnd.uniform(1.34,3.09)
  size=rnd.uniform(.048,.125);y=h(x)+.006;apex=(x+.012,y+size*.62,z-.005)
  pts=[(x-size,y,z),(x,y,z+size*.74),(x+size*.92,y,z),(x,y,z-size*.61)]
  for j in range(4):g.m.tri([pts[j],pts[(j+1)%4],apex],'rubble')
 for i in range(4):
  x=-6.60+4*i;g.cyl((x,h(x)+.125,-.16),(x,h(x)+.125,.16),.082,'darkiron',8)
 for side in [-1,1]:
  for i in range(6):
   a=-7.9+i*2.61;b=a+1.46+rnd.random()*.76;snow_inner=[];snow_outer=[]
   for j in range(10):
    x=a+(b-a)*j/9;z=side*(3.09-.065*rnd.random());edge=z-side*(.15+.42*rnd.random())*sin(pi*j/9)**.72
    snow_inner.append((x,h(x)+.018,min(z,edge)));snow_outer.append((x,h(x)+.018,max(z,edge)))
   for j in range(9):
    if j==0:g.m.tri([snow_inner[j],snow_outer[j+1],snow_inner[j+1]],'snow')
    elif j==8:g.m.tri([snow_inner[j],snow_outer[j],snow_inner[j+1]],'snow')
    else:g.panel([snow_inner[j],snow_outer[j],snow_outer[j+1],snow_inner[j+1]],'snow')
 # Continuous real maintenance stairs flank the cable line. Each crossing replaces
 # the matching length of stairs with a full-width plank deck.
 cuts=[lo,hi]+[i*.5 for i in range(-15,16)]
 crossings=(-22.6,-8.65,8.05,22.6)
 cuts+= [v-center for c in crossings for v in (c-1.10,c+1.10) if lo<v-center<hi]
 cuts=sorted(set(cuts))
 for left,right in zip(cuts,cuts[1:]):
  xc=(left+right)/2;worldx=xc+center
  if any(abs(worldx-c)<1.10 for c in crossings):continue
  y=h(xc)+.225;bottom=min(h(left),h(right))-.398
  for side in (-1,1):
   g.box(xc,bottom,side*3.035,right-left,y-bottom,1.246,'ashlar',True,'concrete')
   if right-left>.22:g.box(left+.045,y+.001,side*2.70,.035,.009,.36,'ochre',False)
 # Railings follow the inner side of each walk, with openings at the crossings
 # and clearance for the existing avalanche-gallery portal posts.
 for left in np.arange(-7.95,7.0,1.5):
  right=left+1.40
  if any(left+center<c+1.16 and right+center>c-1.16 for c in crossings):continue
  if left+center<5.48 and right+center>-3.28:continue
  for side in (-1,1):
   zz=side*2.405
   for x in (left,right):g.cyl((x,h(x)+.18,zz),(x,h(x)+1.01,zz),.035,'darkiron',7)
   g.beam((left,h(left)+1.01,zz),(right,h(right)+1.01,zz),.055,.058,'darkiron')
 return g

def crossing(key,x):
 g=Pair(key);w=2.20
 def top(u):return grade(x+u)+.225
 for a,b in ((-HALFWAY,-.99),(-.82,.82),(.99,HALFWAY)):
  for j in range(5):
   u=-w/2+w*j/5;v=u+w/5-.007
   g.deck([(u,top(u),a),(u,top(u),b),(v,top(v),b),(v,top(v),a)],'weatherwood',.16,'darkiron')
  for xx in [-.80,.80]:
   g.deck([(xx-.027,top(xx-.027)+.012,a),(xx-.027,top(xx-.027)+.012,b),(xx+.027,top(xx+.027)+.012,b),(xx+.027,top(xx+.027)+.012,a)],'ochre',.017,'ochre',False)
 depth=5.12-HALFWAY
 for sign in (-1,1):
  base=apron(x,TRACK_Z+sign*5.15)
  for j in range(7):
   far=sign*(HALFWAY+depth-j*depth/7);near=sign*(HALFWAY+depth-(j+1)*depth/7)
   def level(u):return base+(top(u)-base)*(j+1)/7
   g.deck([(-w/2,level(-w/2),far),(-w/2,level(-w/2),near),(w/2,level(w/2),near),(w/2,level(w/2),far)],'concrete',.28,'ashlar')
  for u in [-w*.485,w*.485]:
   for dist,t in [(HALFWAY+.06,1),(4.99,.13)]:
    y=base+(top(u)-base)*t;g.cyl((u,y,sign*dist),(u,y+.78,sign*dist),.040,'darkiron',8)
   g.beam((u,top(u)+.78,sign*(HALFWAY+.06)),(u,base+(top(u)-base)*.13+.78,sign*4.99),.065,.064,'darkiron')
 return g

def snow_shed(full):
 g=Pair('snow-shed-'+('roof' if full else 'floor'));length=8.1;depth=4.50;eave=3.40;off=lambda x:x*SLOPE
 for side in (-1,1):
  z=side*depth/2
  for i,x in enumerate([-3.80,-1.30,1.24,3.82]):
   base=off(x)
   g.box(x,base,z,.38,.51,.43,'ashlar',True)
   g.box(x,base+.50,z,.20,eave-.50,.24,'larch',True)
   for dx in (-.58,.58):
    if i==0 and dx<0 or i==3 and dx>0:continue
    g.beam((x,base+eave-.77,z),(x+dx,base+eave-.10,z),.15,.15,'larch',True)
  g.beam((-4.07,eave+off(-4.07),z),(4.07,eave+off(4.07),z),.21,.24,'larch',True)
  if side==1:
   for a,b in ((-3.65,-1.48),(-1.13,1.11),(1.42,3.68)):
    x=(a+b)/2
    g.box(x,off(x)+.19,z,b-a,.89,.16,'ashlar',True)
    g.box(x,off(x)+1.11,z,b-a,1.16,.085,'weatherwood',True)
    g.beam((a,off(a)+1.10,z+.085),(b,off(b)+2.25,z+.085),.12,.13,'larch')
 if full:
  portal_x=-4.25;summit_x=4.25
  for z0,y0,z1,y1 in ((-2.53,eave-.01,0,eave+1.05),(0,eave+1.05,2.53,eave-.01)):
   p=[(portal_x,y0+off(portal_x),z0),(portal_x,y1+off(portal_x),z1),(summit_x,y1+off(summit_x),z1),(summit_x,y0+off(summit_x),z0)]
   g.deck(p,'weatherwood',.18,'larch')
   for x in [-4,-2,0,2,4]:g.beam((x,off(x)+y0-.04,z0),(x,off(x)+y1-.04,z1),.105,.10,'larch',True)
   rnd=Random(27 if z0<0 else 15)
   # A ragged drift catches against the downwind eave, with exposed larch between tongues.
   for start,end,depth in [(-4.0,-.80,.34),(-.95,1.05,.18),(1.15,3.95,.30)]:
    n=15;outer=[];inner=[]
    for j in range(n+1):
     x=start+(end-start)*j/n
     a=.035+.016*sin(j*.71);b=a+depth*(sin(j*pi/n)**.84)*(.76+.11*sin(j*.63)+.05*sin(j*.98))
     if z0==0:a,b=1-b,1-a
     def top(q):return (x,off(x)+y0+(y1-y0)*q+.027,z0+(z1-z0)*q)
     outer.append(top(a));inner.append(top(b))
    for j in range(n):
     face=[outer[j],inner[j],inner[j+1],outer[j+1]]
     if j==0:g.m.tri([outer[j],inner[j+1],outer[j+1]],'snow')
     elif j==n-1:g.m.tri([outer[j],inner[j],outer[j+1]],'snow')
     else:g.panel(face,'snow')
  for x in [-3.76,0,3.82]:
   g.beam((x,eave-.05+off(x),-2.24),(x,eave-.05+off(x),2.24),.14,.16,'larch',True)
 return g

def car():
 g=Pair('funicular-car-02');w=6.85;d=2.72;axle=.30*sqrt(1+SLOPE*SLOPE)
 def wheels(x,z):
  g.cyl((x,axle+x*SLOPE,z-.11),(x,axle+x*SLOPE,z+.11),.30,'darkiron',14,False,'steel')
  g.cyl((x,axle+x*SLOPE,z-.135),(x,axle+x*SLOPE,z+.135),.105,'copper',10)
 for x in (-2.28,2.22):
  for z in (-.9,.9):wheels(x,z)
  g.cyl((x,axle+x*SLOPE,-.95),(x,axle+x*SLOPE,.95),.095,'steel',10)
 g.beam((-3.18,.51-3.18*SLOPE,0),(3.18,.51+3.18*SLOPE,0),2.20,.23,'darkiron',True)
 # Five stepped compartments, open side glazing and upholstered seats visible through the frames.
 for i in range(5):
  x=-2.46+i*1.23;base=.92+x*SLOPE
  g.box(x,base,0,1.225,.11,d-.12,'floorwood',True)
  for side in (-1,1):
   z=side*d/2
   g.box(x,base+.03,z,1.23,.71,.125,'red',True)
   g.box(x,base+.72,z,1.23,.072,.138,'enamelblue',False)
   g.box(x,base+.79,z,1.23,.078,.131,'ivory',False)
   for xx in (x-.574,x+.574):g.box(xx,base+.85,z,.10,.91,.14,'ivory',True)
   g.box(x,base+1.73,z,1.23,.16,.16,'ivory',True)
   g.box(x,base+.89,z,.048,.80,.12,'rubber',False)
   g.box(x,base+1.46,z,1.09,.045,.115,'darkiron',False)
   for dx in (-.45,.45):g.box(x+dx,base+.105,z+side*.075,.025,.034,.028,'steel',False)
  if i in (1,2,3):bench(g,x,0,.83,'seat',base+.11)
  # Stepped rounded roof across the body; a full top surface and curving edge strips.
  cross=[(-1.52,1.85),(-1.36,2.00),(-.88,2.10),(.88,2.10),(1.36,2.00),(1.52,1.85)]
  for (z0,y0),(z1,y1) in zip(cross,cross[1:]):
   g.deck([(x-.625,base+y0,z0),(x-.625,base+y1,z1),(x+.625,base+y1,z1),(x+.625,base+y0,z0)],'ivory',.09,'ivory')
  if i in (1,3):
   g.box(x,base+2.11,0,.57,.12,.62,'steel',False)
   for a in range(4):g.box(x-.20+.13*a,base+2.232,0,.058,.024,.54,'darkiron',False)
 for side,x,bb in [(-1,-3.075,.92-2.46*SLOPE),(1,3.075,.92+2.46*SLOPE)]:
  nose=x+side*.34
  g.box((nose+x)/2,bb+.065,0,.37,.63,d-.09,'red',True)
  g.box(nose,bb+.70,0,.13,.11,d-.16,'enamelblue',False)
  for z in [-1.23,-.48,.48,1.23]:g.beam((nose,bb+.78,z),(x,bb+1.74,z),.085,.085,'ivory',True)
  g.box(x,bb+1.76,0,.24,.16,d+.025,'ivory',True)
  for z in (-1.00,1.00):
   g.cyl((nose,bb+.38,z),(nose+side*.075,bb+.38,z),.112,'darkiron',12)
   g.cyl((nose+side*.072,bb+.38,z),(nose+side*.088,bb+.38,z),.084,'light',12)
  g.box(nose+side*.12,bb-.06,0,.29,.14,.42,'darkiron',True)
 for side,face in [(-1,'S'),(1,'N')]:
  g.sign((.15,1.19,side*(d/2+.078)),1.64,.28,face,'carname')
 return g

def arcade(full):
 g=Pair('parcel-arcade-'+('roof' if full else 'floor'));w=8.4;d=4.5;h=2.62
 g.box(0,0,0,w,.075,d,'concrete',True,'tile')
 for xx in (-3.93,0,3.93):
  g.box(xx,.07,0,.54,1.67,d,'ashlar',True)
 for xc in (-1.965,1.965):
  rad=1.70;spring=.90
  if full:
   # The two real barrel-vault soffits run the full depth through the arcade.
   for j in range(16):
    aa=pi*j/16;bb=pi*(j+1)/16
    x0=xc+rad*cos(aa);x1=xc+rad*cos(bb)
    y0=spring+rad*sin(aa);y1=spring+rad*sin(bb)
    g.deck([(x0,y0+.10,-d/2+.12),(x0,y0+.10,d/2-.12),(x1,y1+.10,d/2-.12),(x1,y1+.10,-d/2+.12)],'ashlar',.10,'ashlar')
  for zz in (-d/2+.085,d/2-.085):
   for i in range(12):
    t0=i*pi/12;t1=(i+1)*pi/12
    x0=xc+rad*cos(t0);x1=xc+rad*cos(t1);y0=spring+rad*sin(t0);y1=spring+rad*sin(t1)
    if full:
     for z in (zz-.085,zz+.085):
      face=[(x0,y0,z),(x1,y1,z),(x1,h,z),(x0,h,z)]
      g.panel(face if z<zz else face[::-1],'ashlar',True)
     g.beam((x0,y0,zz),(x1,y1,zz),.25,.15,'concrete',True)
 if full:
  g.box(0,h,0,w+.05,.17,d+.07,'concrete',True,'tile')
  for zz in [-d/2+.06,d/2-.06]:
   g.box(0,h+.17,zz,w,.28,.155,'ashlar',True)
   for x in [-3.9,-2,0,2,3.9]:g.cyl((x,h+.44,zz),(x,h+.91,zz),.045,'darkiron',7)
   g.beam((-4.1,h+.90,zz),(4.1,h+.90,zz),.067,.065,'darkiron')
  stairs(g,5.04,0,0,1.56,4.28,h+.17,10,'z')
  # A level landing joins the highest tread to the terrace.
  g.box(4.56,h+.035,1.92,1.0,.13,.66,'concrete',True)
  g.sign((-.01,1.48,-d/2-.106),.48,.34,'S','parcelmark')
 for x in (-3.52,3.55):crate(g,x,.08,.95,.57,.61,.69)
 return g
