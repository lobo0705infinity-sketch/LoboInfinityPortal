"""Construct every visible TTS building state and its matching walkable collider."""
import json,sys,math
from functools import lru_cache
from roofs import *
from rooms import furnish, Bay

def entrance(q,d,rec):
 p,u,n,lo,hi,ht=rec
 s=Bay(q,p,u,n,0);style=d['style']
 w=2.18 if style in ('exchange','civic','guard','visor') else 1.81
 if style in ('exchange','civic','guard','visor','release','engineer'):
  y=d['h']+.025
  q.beam(p-u*w/2+n*.36,p+u*w/2+n*.36,y,y+.068,.80,'copper' if style!='engineer' else 'navy',True)
  for dx in (-w*.416,w*.416):
   q.rod(s.pt(dx,y-.38,.08),s.pt(dx,y+.007,.67),.040,'brass',8)
  q.beam(p-u*w/2+n*.755,p+u*w/2+n*.755,y-.059,y+.024,.052,'brass')
 s.sign(w*.49,1.63,.096,.30,.38,'notice' if style in ('civic','exchange','visor') else 'crate')

def external(q,d):
 if d['style']=='train':
  # Rail-side loading shelter on fixed masonry brackets.
  for z in (-2.78,-.12,2.46):
   q.block((-6.23,1.10,z),(.16,2.18,.18),'oxide',True)
   q.rod((-6.23,1.53,z),(-5.72,2.31,z),.058,'ink')
   q.rod((-4.62,1.92,z),(-5.10,2.35,z),.052,'zinc')
  pts=[(-6.41,2.25,-2.98),(-4.57,2.55,-2.98),(-4.57,2.55,2.76),(-6.41,2.25,2.76)]
  q.hexa([(x,y-.098,z)for x,y,z in pts]+pts,'oxide',True)
  for z in np.linspace(-2.88,2.60,9):q.rod((-6.41,2.267,z),(-4.58,2.57,z),.028,'zinc')
 if d['style']=='cold':
  # Fixed refrigeration line runs down the side of Q2 and ends against a service cabinet.
  for y in (.83,1.12):
   q.rod((4.73,y,-2.81),(4.73,y,1.10),.071,'zinc',10)
   q.rod((4.73,y,-2.81),(4.73,y+.62,-2.81),.071,'zinc',10)
  q.block((4.98,.70,-1.78),(.65,1.35,1.23),'panel',True)
  q.label((5.33,.87,-1.78),.82,.51,'coldlog',(1,0),'ink')
  for z in (-2.5,.38):q.block((4.70,.95,z),(.31,.53,.08),'oxblood')
 if d['style']=='hoist':
  for z in (-1.75,1.71):
   q.beam((-2.73,z-.12),(-2.73,z+.12),.08,2.47,.17,'brick',True)
 if d['style']=='civic':
  for x in (-3.08,1.78):
   q.beam((x,-2.99),(x,-3.11),.10,2.57,.23,'limestone',True)
 if d['style']=='records':
  q.label((-.18,1.54,2.42),.76,.50,'shipprint',(0,1),'wood')

def open_building(q,d):
 roof=d['h'];p=d['p'];style=d['style'];q.prism(p,-.012,.084,'foot','foot')
 if style=='portal':
  for x in (-2.30,2.08):
   prof=[(-1.85,.11),(-1.85,1.91),(-1.30,2.89),(-.75,3.22),(.75,3.22),(1.30,2.89),(1.85,1.91),(1.85,.11)]
   for (za,ya),(zb,yb) in zip(prof,prof[1:]):
    q.rod((x,ya,za),(x,yb,zb),.16,'navy',8,True)
   for z in(-1.86,1.86):
    q.block((x,.74,z),(.46,1.31,.51),'panel',True)
    q.label((x+.247,1.05,z),.27,.25,'meter',(1,0),'ink')
  q.beam((-2.53,-1.80),(2.35,-1.80),.12,1.13,.53,'panel',True)
  q.beam((-2.53,1.83),(2.35,1.83),.16,.64,.52,'foot',True)
  for z in (-.65,.65):q.beam((-2.32,z),(2.17,z),3.12,3.30,.105,'zinc',True)
  q.prism(box(-2.49,-1.99,2.25,-.72),2.97,3.092,'ink','deck')
  q.label((2.27,2.82,-.07),1.88,.37,'scanner',(1,0),'navy')
  q.label((-2.50,2.82,-.07),1.88,.37,'scanner',(-1,0),'navy')
  ladder(q,(.93,-2.052),(1,0),(0,-1),.085,3.09,True)
  for z in (-1.91,-.80):rail(q,(-2.14,z),(-.34,z),3.095)
  q.block((-.80,.62,-1.43),(.60,1.08,.35),'navy',True)
  q.label((-.80,1.15,-1.22),.50,.32,'screen',(0,1))
  return {'open':'axle scanner and service deck','width':2.3}
 # Transfer operates under two trussed, rising canopies with a flat central maintenance deck.
 q.prism(box(-2.82,-1.03,2.76,.71),roof,roof+.10,'ink','deck')
 for sign,inner,outer in [(-1,-1.03,-2.09),(1,.71,2.04)]:
  pts=[(-2.83,roof+.10,inner),(2.77,roof+.10,inner),(2.77,roof+.67,outer),(-2.83,roof+.67,outer)]
  q.hexa([(x,y-.068,z)for x,y,z in pts]+pts,'copper',True)
  for x in np.linspace(-2.8,2.73,10):
   q.rod((x,roof+.118,inner),(x,roof+.69,outer),.024,'zinc',8)
  q.beam((-2.83,outer),(2.78,outer),roof+.58,roof+.70,.132,'oxide',True)
 for x in (-2.29,2.17):
  for z in (-.91,.63):
   q.block((x,roof/2,z),(.16,roof,.18),'oxide',True)
   q.rod((x,roof-.74,z),(x,roof+.51,-1.96 if z<0 else 1.89),.068,'navy',8)
 q.label((2.81,roof-.23,-.12),1.70,.36,'dock',(1,0),'brass')
 q.beam((-1.26,-1.85),(1.03,-1.85),.14,1.24,.43,'foot',True)
 q.label((-.13,.83,-1.60),1.42,.46,'board',(0,1))
 ladder(q,(-2.84,.28),(0,1),(-1,0),.084,roof+.10,True)
 for x,z,yaw in pallets[d['g']]:roof_load(q,x,z,roof+.10,yaw)
 return {'open':'transfer truss, manifest counter and bonded roof load','width':2.0}

def door_hint(d,p):
 es=sections(p);idx=door_edge(es,d['face']);a,b,u,n,*_=es[idx];return [a+u*doorpos(es[idx],d['target'])]
def landing_position(d,hatch):
 shape=d['p'].buffer(-.09);up=d['up'];available=shape.difference(up)
 candidates=[]
 for i,(a,b,u,n,L,*_)in enumerate(sections(up)):
  if L<2.46:continue
  for f in (.5,.35,.65):
   mid=a+u*L*f
   # Face a usable terrace, with a continuous landing supporting a 25 mm miniature.
   landing=Polygon([mid+u*dx+n*dz for dx,dz in [(-.60,.018),(.60,.018),(.60,1.10),(-.60,1.10)]])
   if available.covers(landing) and hatch.distance(landing)>.28 and hatch.distance(Point(mid))>1.06:
    candidates.append((np.dot(n,(1,0))+.08*L,i,L*f,mid))
 if not candidates:return None
 best=max(candidates,key=lambda c:c[0]);return best[1:]
def build(d,level,layout=None):
 q=Building();style=d['style'];g=d['g'];state={'id':g,'slug':d['slug'],'state':level,'room':[]}
 if style in ('wing','portal'):state.update(open_building(q,d))
 else:
  shape=d['p'];up=d['up'];main,hp,H=layout;hx,hz=hp;hatch=box(hx-.55,hz-.63,hx+.55,hz+.63)
  q.prism(shape,-.012,.11,'foot',{'public':'tile','cold':'tile','laboratory':'tile','archive':'wood','dispatch':'tile'}.get(d['room'],'foot'))
  groundrooms=furnish(q,d,shape,.11,door_hint(d,shape),hatch,False);state['room']+=groundrooms
  door,ops=doors_and_windows(q,d,shape,.11,d['h'],reserved=groundrooms);entrance(q,d,door);external(q,d)
  state['door']={'center':door[0].tolist(),'tangent':door[1].tolist(),'outward':door[2].tolist(),'top':door[5],'floor':.11,'width':float(door[4]-door[3])}
  state['hatch']=hp
  ladder(q,(hx,hz-.54),(1,0),(0,1),.11,d['h']+.135)
  if up is not None and level>=2:
   floor=d['h']+.14
   q.prism(shape.difference(hatch),d['h'],floor,'foot','deck')
   hatch_trim(q,hx,hz,floor)
   landing=landing_position(d,hatch)
   upstairs=furnish(q,d,up,floor,[landing[2]] if landing else None,hatch,True);state['room']+=upstairs
   upstairs_door,uo=doors_and_windows(q,d,up,floor,floor+d['uh'],True,reserved=upstairs,upper_door=landing)
   if upstairs_door:
    doorp,tu,no,lo,hi,ht=upstairs_door
    state['terraceDoor']={'center':doorp.tolist(),'tangent':tu.tolist(),'outward':no.tolist(),'width':float(hi-lo),'floor':floor}
   if style=='exchange':
    # Cast harbour seal below the curved public gallery windows.
    q.label((-.295,floor+.55,-2.393),.59,.57,'portcrest',(0,-1),'brass')
    for xx in(-.80,.22):
     q.beam((xx-.123,-2.373),(xx+.123,-2.373),floor+.49,floor+.55,.043,'brass')

   for a,b,u,n,L,*_ in sections(shape):
    if L>1.8 and up.boundary.distance(Point((a+b)*.5))>.78:
     rail(q,a+u*.18-n*.055,b-u*.18-n*.055,floor+.014,d['trim'])
   ladder(q,(hx,hz-.54),(1,0),(0,1),floor+.07,floor+d['uh']+.12)
  isroof=level==(3 if up is not None else 2)
  if isroof:
   y=d['h']+(.14+d['uh'] if up is not None else 0)+.135
   cover=up if up is not None else shape
   q.prism(cover.difference(hatch),y-.135,y,'foot','deck')
   finishroof(q,d,y,main,hp,H);hatch_trim(q,hx,hz,y)
   state['roof']={'flatDeck':round(cover.difference(main.union(hatch)).area,2),'pallets':len(pallets.get(g,[]))}
  if not state['room']:raise ValueError('no usable interior '+d['slug'])
 slug=d['slug']+'-s'+str(level);q.save(slug)
 state.update(vertices=len(q.v.v),faces=sum(l.startswith('f ')for l in q.v.lines),colliderGroups=q.c.groups)
 return state
def run(names):
 out={}
 for d in models:
  if names and d['slug']not in names:continue
  layout=None if d['style']in ('wing','portal') else roof_design(d)
  n=1 if layout is None else 3 if d['up']is not None else 2
  results=[build(d,i,layout)for i in range(1,n+1)]
  out[d['g']]=results;print(d['slug'],[(r['state'],r['vertices'],r['faces'],len(r['room']))for r in results],flush=True)
 if not names:(W/'buildings.json').write_text(json.dumps(out,indent=1))
if __name__=='__main__':run(sys.argv[1:])
