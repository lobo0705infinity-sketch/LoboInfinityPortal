from math import pi,sin,cos
from mesh import Pair
from roofs import roof_details

def stairs(g,x,y,z,w,d,rise,n,axis='z'):
 for i in range(n):
  off=-d/2+(i+.5)*d/n;h=rise*(i+1)/n
  g.box(x+(off if axis=='x' else 0),y,z+(off if axis=='z' else 0),d/n if axis=='x' else w,h,w if axis=='x' else d/n,'ashlar',True,'concrete')

def wallbox(g,face,w,d,s,y,width,height,deep,material,outer=0,physical=True):
 if face in 'NS':
  z=(1 if face=='N' else -1)*(d/2+outer);g.box(s,y,z,width,height,deep,material,physical)
 else:
  x=(1 if face=='E' else -1)*(w/2+outer);g.box(x,y,s,deep,height,width,material,physical)

def mounted(g,face,w,d,at,cy,width,height,graphic,offset=.195):
 wallbox(g,face,w,d,at,cy-height/2-.045,width+.09,height+.09,.065,'darkiron',offset-.067,False)
 if face in 'NS':p=(at,cy,(d/2+offset)*(1 if face=='N' else -1))
 else:p=((w/2+offset)*(1 if face=='E' else -1),cy,at)
 g.sign(p,width,height,face,graphic)

def bench(g,x,z,w=1.7,wood='weatherwood',y=.09):
 for xx in (x-w*.34,x+w*.34):
  g.box(xx,y,z,.12,.48,.47,'darkiron',True)
  g.box(xx,y+.43,z+.21,.09,.57,.085,'darkiron',False)
 for k in range(3):g.box(x,y+.46,z-.17+k*.155,w,.10,.12,wood,True)
 for k in range(2):g.box(x,y+.68+k*.18,z+.23,w,.13,.075,wood,False)

def case(g,x,y,z,w=.8,h=.48,d=.5,label=False):
 g.box(x,y,z,w,h,d,'enamelblue',True)
 for yy in [y+.055,y+h-.055]:g.box(x,yy,z,w+.025,.035,d+.025,'steel',False)
 for xx in [x-w*.34,x+w*.34]:g.box(xx,y+h*.38,z-d/2-.014,.055,.14,.034,'brass',False)
 g.box(x,y+h,z,.24,.035,.12,'rubber',False)
 if label:g.sign((x,y+h*.6,z-d/2-.024),w*.5,h*.38,'S','numbers')

def crate(g,x,y,z,w,h,d):
 g.box(x,y,z,w,h,d,'package',True)
 for xx in (x-w*.25,x+w*.25):g.box(xx,y-.005,z,.045,h+.028,d+.015,'canvas',False)
 g.sign((x,y+h*.52,z-d/2-.012),w*.49,h*.35,'S','parcelmark')

def cabinet(g,x,y,z,w,h,d,drawers=4,color='enamelblue'):
 g.box(x,y,z,w,h,d,color,True)
 g.box(x,y+h,z,w+.05,.065,d+.06,'steel',False)
 for i in range(drawers):
  yy=y+.09+i*(h-.15)/drawers
  g.box(x,yy,z-d/2-.016,w-.10,(h-.22)/drawers,.024,color,False)
  g.box(x,yy+(h-.22)/drawers*.72,z-d/2-.048,w*.51,.035,.040,'steel',False)

def building_wall(g,face,w,d,h,kind,doors):
 span=w if face in 'NS' else d-.19
 apertures=[];face_door=face in doors
 if face_door:
  door=(-.23 if face in 'SE' else .24)*span
  apertures.append((door-.55,door+.55,.10,1.93,'door'))
 if kind=='winding' and face=='S':
  apertures=[(-1.50,1.50,.74,3.38,'arch')]
 else:
  wins=[span*.23] if face_door else ([-span*.24,span*.21] if span>5.45 else [0])
  if face_door and doors.index(face)>0:wins=[-span*.23 if face not in 'SE' else span*.23]
  if kind=='relay' and face in ('S','E','W') and not face_door:wins=[-.245*span,.245*span]
  if face=='N':wins=[c for c in wins if abs(c-(w/2-1.05))>1.18]
  for c in wins:
   half=min(1.01 if kind=='relay' else .73,span*(.16 if kind=='relay' else .115))
   if any(c+half>a-.20 and c-half<b+.20 for a,b,_,_,_ in apertures):continue
   apertures.append((c-half,c+half,.83 if kind not in ('stores','boiler') else 1.12,min(h-.30,2.02),'window'))
 apertures.sort()
 def slab(a,b,lo,hi):
  if b-a>.006 and hi-lo>.008:
   material={'relay':'larch','cafe':'plaster','ticket':'plaster','crew':'larch','boiler':'rubble','stores':'corrugated'}.get(kind,'ashlar')
   wallbox(g,face,w,d,(a+b)/2,lo,b-a,hi-lo,.19,material)
   if kind in ('crew','cafe','ticket','relay') and lo<.55:
    top=min(hi,.55)
    wallbox(g,face,w,d,(a+b)/2,lo,b-a,top-lo,.21,'rubble')
 end=-span/2
 for a,b,lo,hi,typ in apertures:
  slab(end,a,0,h);slab(a,b,0,lo);slab(a,b,hi,h)
  sz=b-a;mid=(a+b)/2
  if typ=='door':
   for k in (a-.035,b+.035):wallbox(g,face,w,d,k,.085,.07,hi-.085,.26,'larch')
   wallbox(g,face,w,d,mid,hi,sz+.23,.15,.28,'larch')
   wallbox(g,face,w,d,mid,.035,sz+.07,.045,.36,'concrete',.10,False)
   wallbox(g,face,w,d,mid,hi+.21,.27,.15,.11,'light',.135,False)
   # An opened timber leaf folds against the inside of its own jamb.
   swing=1 if mid<0 else -1;leaf=mid+swing*1.105
   wallbox(g,face,w,d,leaf,.12,1.02,1.77,.065,'sage' if kind in ('cafe','crew','ticket') else 'larch',-.151,False)
   wallbox(g,face,w,d,leaf,.30,.83,.64,.025,'weatherwood',-.195,False)
   wallbox(g,face,w,d,leaf,1.10,.82,.58,.028,'weatherwood',-.195,False)
   wallbox(g,face,w,d,leaf+swing*.36,.98,.11,.045,.065,'brass',-.207,False)
  elif typ=='window':
   for k in (a,b):wallbox(g,face,w,d,k,lo,.08,hi-lo,.21,'darkiron',0,False)
   wallbox(g,face,w,d,mid,lo-.065,sz+.22,.095,.32,'concrete')
   wallbox(g,face,w,d,mid,hi-.045,sz+.13,.077,.21,'darkiron',0,False)
   wallbox(g,face,w,d,mid,lo+.05,.055,hi-lo-.09,.12,'darkiron',0,False)
   wallbox(g,face,w,d,mid,lo+(hi-lo)*.62,sz,.045,.115,'darkiron',0,False)
  else:
   # True curved opening. Stone spandrels fill only the corners above the arch.
   radius=sz/2;spring=hi-radius;zz=-d/2
   for j in range(12):
    a0=pi*j/12;a1=pi*(j+1)/12;x0=mid+radius*cos(a0);x1=mid+radius*cos(a1);y0=spring+radius*sin(a0);y1=spring+radius*sin(a1)
    for zp in [zz-.095,zz+.095]:
     pts=[(x0,y0,zp),(x1,y1,zp),(x1,hi+.002,zp),(x0,hi+.002,zp)]
     if abs(x0-x1)>.001:g.panel(pts if zp<zz else pts[::-1],'ashlar',True)
    g.beam((x0,y0,zz-.11),(x1,y1,zz-.11),.20,.14,'concrete',True)
   for xx in [-1.00,-.5,0,.5,1.0]:
    top=spring+(radius**2-xx**2)**.5
    wallbox(g,face,w,d,mid+xx,lo,.052,top-lo,.12,'darkiron',0,False)
   for yy in (1.23,1.8,2.25):wallbox(g,face,w,d,mid,yy,sz if yy<=spring else sz*.91,.055,.12,'darkiron',0,False)
   wallbox(g,face,w,d,mid,lo-.08,sz+.35,.15,.38,'concrete')
  end=b
 slab(end,span/2,0,h)
 return apertures

def hatch_ladder(g,w,d,h,roof):
 x=w/2-1.10;z=d/2-.19
 for xx in (x-.39,x+.39):
  g.cyl((xx,.14,z-.20),(xx,h+.53,z-.20),.040,'darkiron',7)
 for i in range(int((h+.05)/.26)):
  y=.25+i*.26;g.cyl((x-.405,y,z-.22),(x+.405,y,z-.22),.032,'steel',7)
 for y in (.46,h*.52,h-.22):
  for xx in (x-.38,x+.38):g.beam((xx,y,z-.24),(xx,y,z+.10),.05,.052,'darkiron')
 if roof:
  g.box(x,h+.07,z-.89,1.24,.045,.09,'ochre',False)
  g.box(x+.65,h+.07,z-.43,.075,.57,1.18,'darkiron',True)
  g.box(x+.65,h+.15,z-.43,.082,.39,.92,'sage',False)

def workbench(g,x,z,w=1.9):
 g.box(x,.77,z,w,.14,.67,'floorwood',True)
 for xx in (x-w*.40,x+w*.40):g.box(xx,.10,z,.13,.66,.44,'darkiron',True)
 g.box(x+.42,.92,z,.35,.19,.22,'enamelblue',False)
 for v in range(5):g.box(x-.64+.17*v,1.17+v%2*.09,z+.25,.047,.39-.035*(v%3),.063,'steel',False)

def furniture(g,w,d,h,kind):
 if kind=='winding':
  for x in (-1.1,1.1):
   g.box(x,.12,-.69,.48,.72,1.47,'concrete',True)
   g.box(x,.83,-.69,.56,.24,.64,'darkiron',True)
  g.cyl((-1.52,1.36,-.72),(1.50,1.36,-.72),.14,'steel',14)
  g.cyl((-.86,1.36,-.72),(.86,1.36,-.72),.66,'copper',24,True)
  for x in (-.87,.87):g.cyl((x-.06,1.36,-.72),(x+.06,1.36,-.72),.90,'ochre',24)
  for x in [-.75+i*.13 for i in range(13)]:g.cyl((x,1.36,-.72),(x+.049,1.36,-.72),.69,'brass' if abs(x)<.085 else 'steel',18)
  cabinet(g,-w/2+.62,.12,-d/2+.60,.75,1.3,.51,3,'sage')
  g.box(0,.13,.80,2.00,.62,.29,'ochre',True)
 elif kind=='brake':
  workbench(g,-w*.18,d/2-.54,w*.47);cabinet(g,w/2-.68,.12,0,.95,.95,.58,5,'red')
  g.beam((-w*.35,h-.43,0),(w*.35,h-.43,0),.18,.15,'ochre')
  g.box(-.38,h-.59,0,.33,.19,.35,'darkiron',False);g.cyl((-.38,h-.58,0),(-.38,h-1.08,0),.024,'steel',6)
 elif kind=='cafe':
  g.box(-w*.14,.12,d*.19,w*.38,.87,.64,'larch',True)
  g.box(-w*.14,.99,d*.19,w*.40,.09,.76,'concrete',False)
  g.box(-.16,1.08,d*.19,.55,.43,.32,'steel',False);g.box(-.16,1.36,d*.19-.16,.48,.09,.12,'rubber',False)
  for i in range(3):g.cyl((-w*.26+i*.15,1.09,d*.18),(-w*.26+i*.15,1.24,d*.18),.066,'ivory',9)
  bench(g,-w*.22,-d*.25,w*.32,'leather')
 elif kind=='relay':
  workbench(g,-w*.09,d/2-.52,min(1.7,w*.34))
  g.box(-w*.09,.1,d/2-.58,.40,.36,.36,'larch',True)
 elif kind in ('office','crew','ticket'):
  bench(g,-w*.13,d*.27,min(2.3,w*.43))
  workbench(g,-w*.20,-d*.19,min(1.6,w*.35))
  if kind not in ('relay',):cabinet(g,w*.14,.1,d*.12,.67,1.34,.46,3,'sage')
 else:
  for i in range(2):crate(g,-.81+i*1.01,.11,d/2-.56,.74,.68,.56)
  cabinet(g,-w*.18,.1,-d*.06,.81,.90,.56,4,'enamelblue')

def house(key,w,d,h,kind,doors,graphic,roof=True):
 g=Pair(key+('-roof' if roof else '-floor'))
 g.box(0,.005,0,w,.105,d,'concrete',True,'floorwood' if kind in ('crew','cafe','office') else 'floor')
 openings={face:building_wall(g,face,w,d,h,kind,doors) for face in ('S','N','E','W')}
 for x in (-w/2,w/2):
  for z in (-d/2,d/2):
   g.box(x,.06,z,.245,h-.06,.245,'rubble',True)
   for i in range(1,int(h/.56)+1):
    g.box(x,i*.51,z,.27,.12,.27,'ashlar',False)
 # Fascia is above windows and doors on both states. Snow guard and roof details belong to the roof state only.
 for z in (-d/2,d/2):g.box(0,h-.12,z,w+.2,.12,.23,'larch',False)
 for x in (-w/2,w/2):g.box(x,h-.12,0,.23,.12,d+.18,'larch',False)
 signage_face='S';sign_y=h-.31
 if kind=='winding':signage_face='E'
 mounted(g,signage_face,w,d,0,sign_y,min(w*.52,3.12),.41,graphic)
 if kind=='winding':
  mounted(g,'S',w,d,0,h-.33,3.20,.47,'station',.21)
 if kind in ('cafe','ticket','crew'):
  for f in ('S','N'):
   wallbox(g,f,w,d,0,h-.11,w+.19,.12,.28,'sage' if kind!='crew' else 'weatherwood',0,False)
 if kind=='brake':
  mounted(g,'S',w,d,w*.28,2.68,2.02,.40,'test',.22)
 if kind=='office':mounted(g,'W',w,d,d*.22,h-.37,2.34,.43,'parcelmark',.20)
 if kind in ('cafe','ticket'):
  # Real striped cantilever canopy over a service window, with brace arms and valance.
  x0=w*.23;aw=min(2.7,w*.45);yd=2.15
  for i in range(8):
   lo=x0-aw/2+i*aw/8;hi=lo+aw/8;z0=-d/2-.09;z1=z0-.68
   g.panel([(lo,yd,z0),(hi,yd,z0),(hi,yd-.13,z1),(lo,yd-.13,z1)],'canvas' if i%2 else 'enamelblue')
   g.box((lo+hi)/2,yd-.31,z1,hi-lo,.17,.036,'canvas' if i%2 else 'enamelblue',False)
  for x in (x0-aw*.43,x0+aw*.43):g.beam((x,yd-.45,-d/2-.06),(x,yd-.15,-d/2-.75),.045,.046,'darkiron')
 if kind in ('office','cafe','crew','ticket','relay'):
  # The art faces the interior, just clear of the opposite wall.
  art={'office':'poster2','cafe':'poster1','crew':'poster3','ticket':'mapprint','relay':'mapprint'}[kind]
  # Fit the framed art into an actual solid pier, clear of glazing, doors and the hatch.
  block=sorted([(a-.10,b+.10) for a,b,lo,hi,typ in openings['N']]+[(w/2-1.85,w/2-.30)])
  gaps=[];last=-w/2+.17
  for a,b in block:
   if a>last:gaps.append((last,a))
   last=max(last,b)
  if last<w/2-.17:gaps.append((last,w/2-.17))
  a,b=max(gaps,key=lambda v:v[1]-v[0]);aw=min(1.24,b-a-.08)
  x=(a+b)/2;y=1.66;z=d/2-.135
  if aw>.45:
   g.box(x,y-aw*.35,z,aw,aw*.70,.05,'larch',False)
   g.sign((x,y,z-.037),aw-.075,aw*.70-.065,'S',art)
 furniture(g,w,d,h,kind)
 if roof:roof_details(g,w,d,h,kind,key)
 hatch_ladder(g,w,d,h,roof)
 return g
