from facade import *
from shapely.geometry import Point
class Bay:
 def __init__(self,q,p,u,n,y):
  self.q=q;self.p=vec(p);self.u=vec(u);self.n=vec(n);self.y=y
 def pt(self,x,y,z):return xyz(self.p+self.u*x+self.n*z,self.y+y)
 def block(self,x,y,z,w,h,dep,key,solid=False):
  p=self.p+self.u*x+self.n*z;self.q.beam(p-self.u*w/2,p+self.u*w/2,self.y+y-h/2,self.y+y+h/2,dep,key,solid)
 def rod(self,a,b,r,key,n=8):self.q.rod(self.pt(*a),self.pt(*b),r,key,n)
 def sign(self,x,y,z,w,h,key):self.q.label(self.pt(x,y,z),w,h,key,self.n)
 def paper(self,x,y,z,w=.38,h=.28,key='manifest'):
  pts=[self.pt(x+i*w/2,y,z+j*h/2)for i,j in [(-1,-1),(1,-1),(1,1),(-1,1)]]
  self.q.v.face(pts,key,(0,1,0),[(0,1),(1,1),(1,0),(0,0)])
def chair(s,x,z):
 s.block(x,.39,z,.43,.09,.40,'oxblood');s.block(x,.40,z,.39,.092,.37,'oxblood')
 s.block(x,.65,z+.18,.41,.28,.083,'oxblood')
 for dx in(-.15,.15):s.rod((x+dx,.39,z+.12),(x+dx,.77,z+.19),.022,'zinc')
 s.rod((x-.18,.78,z+.187),(x+.18,.78,z+.187),.031,'oxblood',8)
 for dx in(-.15,.15):
  for dz in(-.13,.13):s.rod((x+dx,.035,z+dz),(x+dx,.37,z+dz),.026,'ink',7)
def parcel(s,x,y,z,w=.64,h=.52,d=.48):
 s.block(x,y+h/2,z,w,h,d,'packing',True)
 for dx in (-w*.31,w*.31):
  s.block(x+dx,y+h+.007,z,.033,.014,d*.97,'navy')
  s.block(x+dx,y+h/2,z+d/2+.007,.036,h*.98,.013,'navy')
 s.sign(x,y+.56*h,z+d/2+.019,w*.45,h*.42,'crate')
def railmap(s,k):
 s.block(-.67,1.51,.075,1.02,.73,.06,'wood');s.sign(-.67,1.51,.124,.92,.63,k)
def office(s,role,upper):
 desk='wood' if role in ('dispatch','public','archive') else 'timber'
 s.block(0,.76,.51,2.62,.11,.73,desk,True)
 s.block(-.94,.37,.51,.50,.68,.63,'navy',True);s.block(.95,.37,.51,.43,.68,.62,'wood',True)
 for y in(.27,.47,.65):s.block(-.94,y,.837,.26,.026,.025,'brass')
 s.block(-.35,.821,.50,.31,.028,.25,'ink');s.rod((-.34,.83,.44),(-.34,1.05,.45),.034,'zinc')
 s.sign(-.35,1.12,.45,.54,.33,'screen' if role!='weigh' else 'meter')
 s.paper(.37,.822,.53,.52,.39,'releaseform' if role=='clearance' else 'manifest')
 s.block(.88,.89,.41,.26,.16,.26,'inside');s.rod((1.07,.82,.67),(1.07,1.26,.62),.028,'brass');s.block(1.02,1.27,.61,.27,.045,.17,'lamp')
 # A keyboard, handset, ceramic mug and a stamped paper give the counter a working surface.
 s.block(-.34,.831,.70,.49,.035,.19,'ink')
 for row in range(3):
  for j in range(8):s.block(-.545+j*.057,.852,.645+row*.051,.044,.012,.027,'zinc')
 s.rod((.64,.82,.32),(.64,.956,.32),.068,'lamp',12)
 s.rod((.64,.961,.32),(.64,.965,.32),.048,'wood',10)
 for a,b in [((.695,.93,.32),(.75,.935,.32)),((.75,.935,.32),(.76,.862,.32)),((.76,.862,.32),(.695,.864,.32))]:s.rod(a,b,.013,'lamp',7)
 s.rod((-.52,.825,.38),(-.59,.825,.33),.014,'rubber',7)
 s.rod((-.59,.825,.33),(-.64,.825,.13),.014,'rubber',7)
 if role in ('dispatch','public','security','clearance','weigh'):chair(s,.29,1.23)
 if role=='dispatch':
  if upper:railmap(s,'map')
  else:
   s.block(-1.05,1.02,.71,.48,.40,.055,'navy');s.sign(-1.05,1.02,.750,.42,.35,'notice');railmap(s,'map')
   s.block(.88,.93,.84,.23,.21,.13,'brass')
 if role=='public':
  railmap(s,'shipprint');s.block(-1.05,1.04,.71,.32,.44,.05,'brass')
 if role in ('weigh','security','clearance'):railmap(s,'map' if role=='security' else 'board')
def lab(s):
 for x in (-1.03,1.03):
  for z in(.22,.82):s.block(x,.45,z,.085,.82,.085,'ink')
 s.block(0,.88,.53,2.55,.12,.81,'zinc',True);s.block(.86,.36,.42,.60,.62,.57,'navy',True)
 s.block(-.52,1.0,.52,.74,.12,.47,'oxblood');s.block(-.52,1.07,.52,.67,.056,.41,'rubber')
 s.block(-.52,1.23,.32,.72,.37,.066,'oxblood')
 for j,dx in enumerate((-.70,-.51,-.32)):
  # A crimped seal body with its own loop of wire and recessed case insert.
  s.block(dx,1.109,.53,.128,.031,.28,'ink')
  s.block(dx,1.14,.577,.054,.033,.078,'oxide' if j!=1 else 'brass')
  pts=[(dx+.037*math.cos(t),1.155,.50+.063*math.sin(t))for t in np.linspace(-1.0,math.tau-1.0,12)]
  for a,b in zip(pts,pts[1:]):s.rod(a,b,.009,'zinc',5)
 s.block(.52,.955,.73,.43,.022,.031,'zinc')
 for px in(.36,.44):s.block(px,.963,.694,.021,.025,.13,'zinc')
 s.block(.47,.977,.72,.113,.031,.070,'ink')
 s.rod((-.91,.949,.57),(-.91,1.123,.57),.045,'glass',10);s.rod((-.91,1.122,.57),(-.91,1.155,.57),.051,'oxblood',10)
 s.paper(.18,.948,.55,.34,.34,'evidence');s.sign(.84,1.19,.30,.47,.36,'sample')
 s.rod((1.05,.96,.46),(1.05,1.52,.46),.031,'ink');s.rod((1.05,1.51,.46),(.85,1.62,.65),.03,'zinc')
 s.rod((.81,1.59,.67),(.84,1.65,.64),.085,'navy',12);s.rod((.81,1.578,.68),(.818,1.59,.672),.070,'lamp',12);railmap(s,'manifest')
def storage(s,kind):
 for x in(-1.21,1.21):
  for z in(.20,.85):s.block(x,.91,z,.076,1.79,.074,'oxide',True)
 if kind=='archive':
  for ht in(.14,.68,1.22):
   s.block(0,ht,.53,2.5,.09,.76,'wood',True);s.block(0,ht+.22,.52,2.29,.38,.55,'timber')
   s.sign(0,ht+.23,.806,2.25,.34,'filebacks')
  s.sign(.82,1.77,.88,.66,.20,'board')
 else:
  for ht in(.17,.86,1.61):
   s.block(0,ht,.55,2.51,.092,.80,'ink',True)
  for j,(x,w)in enumerate([(-.77,.68),(.15,.91),(.91,.48)]):parcel(s,x,.22,.56,w,.44,.48)
  parcel(s,-.40,.91,.49,.88,.43,.49);parcel(s,.69,.91,.52,.64,.38,.52)
def cold(s):
 for x in(-.72,.39):
  s.block(x,.93,.49,.99,1.84,.74,'panel',True)
  s.block(x,.94,.875,.914,1.66,.072,'rubber')
  s.block(x,.94,.918,.865,1.602,.042,'zinc')
  s.block(x,.94,.941,.79,1.51,.012,'inside')
  # Polished pulls stand proud on short brackets so the hand can actually grip them.
  for y in (.83,1.13):s.rod((x+.29,y,.958),(x+.29,y,1.034),.023,'zinc',8)
  s.rod((x+.29,.83,1.034),(x+.29,1.13,1.034),.031,'ink',10)
  for hh in(.45,1.33):
   s.block(x-.40,hh,.956,.080,.16,.047,'zinc');s.rod((x-.421,hh-.09,.988),(x-.421,hh+.09,.988),.017,'brass',8)
  s.sign(x,1.53,.960,.56,.29,'coldlog')
  for j in range(5):s.block(x-.25+j*.119,.275,.965,.073,.019,.014,'ink')
 s.rod((-1.27,1.97,.13),(1.18,1.97,.13),.055,'zinc');s.rod((1.16,1.97,.13),(1.16,.49,.13),.050,'zinc')
 s.block(1.05,1.36,.30,.36,.61,.20,'navy');s.sign(1.05,1.47,.411,.29,.25,'meter')
 s.rod((1.05,1.18,.404),(1.05,1.18,.449),.059,'oxblood',10)
def shop(s):
 s.block(0,.78,.56,2.60,.14,.79,'timber',True)
 for x in(-.93,.94):s.block(x,.37,.54,.56,.65,.69,'navy',True)
 s.block(-.66,.935,.54,.42,.13,.30,'ink');s.block(-.76,1.058,.52,.15,.22,.31,'zinc');s.block(-.53,1.056,.52,.12,.22,.28,'zinc')
 for dx in(.14,.36,.58):s.rod((dx,.87,.36),(dx+.14,.87,.67),.030,'brass',7)
 s.block(.42,1.51,.12,1.11,.77,.076,'timber')
 for dx in(.10,.44,.76):s.rod((dx,1.37,.175),(dx-.025,1.71,.18),.035,'zinc',8)
 s.paper(-.08,.864,.55,.36,.27,'releaseform')
def furnish(q,d,shape,y,drec,hatch,upper):
 edges=sections(shape)
 obstacles=hatch.buffer(.13) if hatch is not None else Polygon()
 if drec:
  obstacles=obstacles.union(Point(drec[0]).buffer(1.04))
 places=[]
 for i,(a,b,u,n,L,_,_)in enumerate(edges):
  if L<2.95:continue
  for fraction in (.50,.36,.64):
   c=a+u*float(np.clip(L*fraction,1.45,L-1.45))-n*.22
   poly=Polygon([c+u*x-n*z for x,z in [(-1.34,0),(1.34,0),(1.34,1.44),(-1.34,1.44)]])
   if shape.buffer(-.08).covers(poly)and not obstacles.intersects(poly):
    score=min(L,7)+(.45 if upper else 1.00)*(-np.dot(n,d['face']))+min(2.2,poly.distance(obstacles))-.23*abs(fraction-.50)
    places.append((float(score),i,c,u,-n,poly))
 if not places and upper:
  # The engineering loft has a narrow service desk opposite the terrace and ladder.
  for i,(a,b,u,n,L,_,_) in enumerate(edges):
   if L<1.20:continue
   for f in (.50,.27,.73):
    c=a+u*float(np.clip(L*f,.57,L-.57))-n*.19
    footprint=Polygon([c+u*x-n*z for x,z in [(-.53,0),(.53,0),(.53,.53),(-.53,.53)]])
    if shape.buffer(-.06).covers(footprint) and not footprint.intersects(obstacles):
     s=Bay(q,c,-u,-n,y+.02);s.block(0,.78,.25,1.02,.07,.47,'wood',True)
     for x in(-.40,.40):s.block(x,.39,.25,.10,.73,.37,'navy',True)
     s.sign(.02,1.35,.09,.79,.53,'meter');s.paper(-.19,.821,.26,.35,.24,'releaseform')
     s.block(.28,.89,.23,.27,.14,.21,'ink');s.rod((.35,.97,.20),(.37,1.24,.20),.014,'zinc')
     return [{'level':2,'type':'service log and radio desk','point':c.tolist(),'wall':i,'reserved':.52}]
 if not places:return []
 places.sort(key=lambda e:e[0],reverse=True);best=places[0];kinds={'dispatch':'office','public':'office','archive':'archive','security':'office','weigh':'office','clearance':'office','laboratory':'lab','receiving':'lab','cold':'cold','store':'storage','bond':'storage','repair':'shop'}
 role=d['room'];kind=kinds[role]
 if upper and role=='bond':kind='office'
 if upper and role=='laboratory':kind='lab'
 result=[]
 for idx,(position,kind_) in enumerate([(best,kind)]):
  _,i,c,u,n,poly=position;s=Bay(q,c,-u,n,y+.018)
  if kind_=='office':office(s,role,upper)
  elif kind_=='lab':lab(s)
  elif kind_=='cold':cold(s)
  elif kind_=='shop':shop(s)
  else:storage(s,kind_)
  result.append({'level':int(upper)+1,'type':kind_,'point':c.tolist(),'wall':i,'reserved':1.34})
 if shape.area>33:
  other=next((p for p in places[1:]if p[1]!=best[1] and p[-1].distance(best[-1])>1.46),None)
  if other:
   _,i,c,u,n,poly=other;s=Bay(q,c,-u,n,y+.02)
   result.append({'level':int(upper)+1,'type':'wall fittings','point':c.tolist(),'wall':i,'reserved':1.30})
   if role=='cold':storage(s,'storage')
   elif role in ('public','dispatch','archive'):
    s.block(0,.44,.36,1.88,.13,.49,'timber',True)
    for x in(-.69,.69):s.block(x,.22,.36,.13,.43,.38,'ink')
    s.block(0,.72,.15,1.85,.42,.085,'timber');railmap(s,'shipprint')
   else:storage(s,'archive' if role=='laboratory' else 'storage')
 return result
