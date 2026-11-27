from facade import *
from shapely.geometry import Point
from shapely.ops import unary_union
PROFILES={
'exchange':(3.75,2.40,-.38,.86,1.11),'saw':(4.75,3.48,-.70,-.6,1.18),
'train':(8.15,3.99,-.2,-1.0,1.43),'cold':(4.14,2.02,.0,-.33,.72),
'civic':(4.0,3.15,-1.4,.0,1.03),'records':(4.68,3.12,-1.3,.0,1.01),
'guard':(3.35,2.14,-.42,.55,.76),'visor':(3.9,1.91,.0,.64,.64),
'release':(3.59,2.16,-.40,-.49,.78),'stores':(3.48,3.45,-.68,.05,1.04),
'hoist':(2.60,2.70,-.60,.20,1.10),'engineer':(2.30,2.37,-.43,-.22,.70)}
def roof_design(d):
 p=d['up'] if d['up'] is not None else d['p'];mw,md,px,pz,H=PROFILES[d['style']]
 goods=pallets.get(d['g'],[])
 packs=[box(x-(.83 if yaw==90 else .99),z-(.99 if yaw==90 else .83),x+(.83 if yaw==90 else .99),z+(.99 if yaw==90 else .83)) for x,z,yaw in goods]
 free=p.buffer(-.14);res=[]
 for f in (1,.90,.79,.68,.58):
  w=mw*f;dep=md*f
  for dx in (0,-.32,.32,-.67,.67):
   for dz in (0,-.27,.27,-.61,.61):
    x=px+dx;z=pz+dz;s=box(x-w/2,z-dep/2,x+w/2,z+dep/2)
    if not free.covers(s) or any(s.distance(t)<.11 for t in packs):continue
    # Every roof gets a true hatch and enough clear deck to stand beside it.
    area=free.difference(unary_union([s.buffer(.075),*packs]));xmin,zmin,xmax,zmax=area.bounds
    options=[]
    for a in np.arange(xmin+.64,xmax-.62,.22):
     for b in np.arange(zmin+.69,zmax-.67,.23):
      h=box(a-.55,b-.63,a+.55,b+.63)
      if area.covers(h)and (d['p'].buffer(-.30)).covers(h):
       edge=p.boundary.distance(h);options.append((edge+.018*abs(a-xmin)+.012*abs(b-zmax),a,b))
    if options:
     _,a,b=min(options);return s,(float(a),float(b)),H
 raise ValueError('roof plan did not fit '+d['slug'])
def pitch(q,x0,x1,z0,z1,profile,material,gable,base,supports=True,strip='zinc'):
 # Profile is a polyline of physical offsets measured from the slab.
 path=[(z0+(z1-z0)*a,base+b)for a,b in profile]
 for (za,ya),(zb,yb) in zip(path,path[1:]):
  if abs(zb-za)<.0001:
   key='glass' if 'glass' in material else gable
   if key=='glass':
    q.beam((x0,za),(x1,za),min(ya,yb),max(ya,yb),.046,'glass',True)
    for x in np.linspace(x0+.10,x1-.10,max(3,int((x1-x0)/.65)+1)):
     q.block((x,(ya+yb)/2,za),(.047,abs(yb-ya),.088),strip)
   else:q.beam((x0,za),(x1,za),min(ya,yb),max(ya,yb),.04,gable,True)
   continue
  key=material[0];seams=max(2,math.ceil((x1-x0)/.63));step=(x1-x0)/seams
  for j in range(seams):
   x=x0+j*step;u=x+step;top=[(x,ya,za),(u,ya,za),(u,yb,zb),(x,yb,zb)]
   q.hexa([(a,b-.073,c)for a,b,c in top]+top,key,True,False)
   # One sheet spans a limited portion of the photo, keeping an honest metal grain.
   q.v.face(top,key,(0,1,0),[(j%4/4,0),((j%4+1)/4,0),((j%4+1)/4,1),(j%4/4,1)])
   q.v.face([(a,b-.073,c)for a,b,c in top],gable,(0,-1,0))
  for x in np.linspace(x0+.025,x1-.025,seams+1):q.rod((x,ya+.019,za),(x,yb+.019,zb),.023,strip,7)
  if supports:
   for x in (x0,x1):
    nx=-1 if x==x0 else 1;bottom=base-.012
    ps=[(x,bottom,za),(x,bottom,zb),(x,yb-.07,zb),(x,ya-.07,za)]
    q.v.face(ps,gable,(nx,0,0));width=.06
    # Fixed geometry below the sloping gable face is solid.
    q.hexa([(x-nx*width,bottom,za),(x,bottom,za),(x,bottom,zb),(x-nx*width,bottom,zb),
            (x-nx*width,ya-.075,za),(x,ya-.075,za),(x,yb-.075,zb),(x-nx*width,yb-.075,zb)],gable,True,False)
  q.rod((x0,ya+.002,za),(x1,ya+.002,za),.026,strip,7);q.rod((x0,yb+.002,zb),(x1,yb+.002,zb),.026,strip,7)
 for (z,y)in(path[0],path[-1]):
  if y>base+.07:q.beam((x0,z),(x1,z),base-.005,y-.055,.075,gable,True)
def roof_load(q,x,z,y,yaw):
 # Six weatherproof stores from the approved roof states, on slatted sleepers with real fork pockets.
 u=np.array((1.,0.)) if yaw==0 else np.array((0.,1.));n=np.array((-u[1],u[0]));c=np.array((x,z))
 def blk(a,b,h,w,d,ht,k,physical=False):
  p=c+a*u+b*n;q.beam(p-u*w/2,p+u*w/2,y+h-ht/2,y+h+ht/2,d,k,physical)
 for a in(-.70,0,.70):blk(a,0,.08,.14,1.35,.16,'wood',True)
 for b in np.linspace(-.60,.60,5):blk(0,b,.19,1.68,.22,.07,'timber')
 for a,w,b,dep in [(-.42,.67,0,1.18),(.33,.68,.04,1.04)]:
  blk(a,b,.53,w,dep,.60,'packing',True)
  for dx in (-.20,.20):
   blk(a+dx,b,.838,.036,dep,.015,'navy');blk(a+dx,b+dep/2+.008,.53,.036,.018,.60,'navy')
 p=c-.42*u+.60*n;q.label(xyz(p,y+.55),.34,.25,'crate',n,'ink')
def grille(q,x,z,y,r):
 q.rod((x,y,z),(x,y+.06,z),r,'rubber',24)
 for j in range(8):
  a=j*math.tau/8;u=np.array([math.cos(a),math.sin(a)]);v=np.array([-u[1],u[0]]);ps=[u*r*.07,u*r*.70-v*r*.17,u*r*.88+v*r*.12,u*r*.42+v*r*.27];q.v.face([(x+i,y+.072,z+j)for i,j in ps],'zinc',(0,1,0))
 for f in np.linspace(-.77,.77,7):
  h=r*math.sqrt(1-f*f);q.rod((x-h,y+.10,z+f*r),(x+h,y+.10,z+f*r),.012,'ink',6)
 q.rod((x,y+.082,z),(x,y+.108,z),r*.19,'brass',10)
def finishroof(q,d,y,main,hp,H):
 style=d['style'];x0,z0,x1,z1=main.bounds;cx=(x0+x1)/2;cz=(z0+z1)/2
 p=d['up'] if d['up'] is not None else d['p']
 if style in ('train','exchange'):
  prof=[(t,.18+math.sin(math.pi*t)**.79*H)for t in np.linspace(0,1,14)]
  pitch(q,x0,x1,z0,z1,prof,('copper' if style=='exchange'else 'oxide',),'riboxide'if style=='train'else'copper',y,strip='brass'if style=='exchange'else'oxide')
  if style=='exchange':
   for x,sgn in ((x0,-1),(x1,1)):
    ze=cz;h=y+.51; q.rod((x-sgn*.01,h,ze),(x+sgn*.073,h,ze),.40,'brass',24)
    q.label((x+sgn*.111,h,ze),.65,.65,'clock',(sgn,0),'brass')
  else:
   for x in np.linspace(x0+.30,x1-.30,5):
    for (ap,ay),(bp,by) in zip(prof,prof[1:]):q.rod((x,y+ay+.033,z0+ap*(z1-z0)),(x,y+by+.033,z0+bp*(z1-z0)),.040,'zinc',8)
 elif style=='saw':
  prof=[(0,.20),(.31,H),(.31,.22),(.64,H+.09),(.64,.23),(.95,H),(.95,.21),(1,.19)]
  pitch(q,x0,x1,z0,z1,prof,('oxide','glass'),'brick',y,strip='zinc')
 elif style=='cold':
  q.block((cx,y+.13,cz),(x1-x0,.26,z1-z0),'foot',True)
  for t in (.24,.73):
   x=x0+(x1-x0)*t;wid=(x1-x0)*.43;dep=(z1-z0)*.81
   q.block((x,y+.49,cz),(wid,.50,dep),'zinc',True);q.block((x,y+.76,cz),(wid+.05,.05,dep+.04),'panel',True);grille(q,x,cz,y+.792,min(wid,dep)*.38)
   for dx in(-.21,0,.21):q.block((x+dx,y+.47,cz+dep/2+.01),(.035,.32,.035),'navy')
   q.rod((x,y+.44,cz-dep/2),(x,y+.44,z0-.18),.052,'brass',8)
 elif style in ('civic','guard'):
  base=[(x0,z0),(x1-.2,z0),(x1,z0+.2),(x1,z1-.22),(x1-.22,z1),(x0+.2,z1),(x0,z1-.20)]
  crown=[(cx+(x-cx)*.64,cz+(z-cz)*.51)for x,z in base]
  for j,pt in enumerate(base):
   k=(j+1)%len(base);low=[xyz(base[j],y+.14),xyz(base[k],y+.14)];high=[xyz(crown[k],y+H),xyz(crown[j],y+H)]
   ps=low+high;q.v.face(ps,'copper'if style=='civic'else'navy',(0,1,0));q.hexa([(a,b-.065,c)for a,b,c in ps]+ps,'copper',True,False);q.rod(low[0],high[-1],.027,'brass')
  q.prism(poly(crown),y+H-.07,y+H,'copper',physical=True)
  q.prism(poly(base),y,y+.13,'limestone')
 elif style in ('records','stores','hoist'):
  key='slate' if style in('records','stores') else 'oxide'
  pitch(q,x0,x1,z0,z1,[(0,.21),(.38 if style=='records' else .50,H+.16),(1,.21)],(key,),'brick' if style!='records'else 'darkbrick',y,strip='ink')
  if style=='hoist':
   q.block((cx,y+.72,z1-.12),(.83,1.03,.63),'timber',True)
   q.beam((cx,z1-.2),(cx,z1+.45),y+1.25,y+1.40,.16,'ink')
   q.rod((cx,y+.75,z1+.40),(cx,y+1.27,z1+.40),.027,'brass',8)
 else:
  pitch(q,x0,x1,z0,z1,[(0,.20),(1,.20+H)],('copper' if style=='visor' else 'navy' if style=='engineer' else 'oxide',),'panel',y,strip='zinc')
  if style=='engineer':
   q.rod((x0+.43,y+.30,z1-.38),(x0+.43,y+H+.68,z1-.38),.13,'zinc',12)
   q.rod((x0+.43,y+H+.64,z1-.38),(x0+.43,y+H+.81,z1-.38),.21,'ink',12)
 # Low parapets, open metal rails and gutters follow the actual roof outline, with a varied profile.
 es=sections(p,.10)
 for j,(a,b,u,n,L,ia,ib) in enumerate(es):
  if L<.14:continue
  q.beam(a,b,y-.081,y+.033,.14,d['trim'])
  if style in ('exchange','civic','guard') and L>1.55:
   rail(q,a+u*.15-n*.07,b-u*.15-n*.07,y+.018,'brass'if style=='civic'else 'ink')
  elif L>2.15 and j%2==0:
   q.beam(a+u*.13,b-u*.13,y+.02,y+.29,.14,'limestone',True,-.015)
 for x,z,yaw in pallets.get(d['g'],[]):roof_load(q,x,z,y+.006,yaw)
def hatch_trim(q,hx,hz,y):
 for z in(hz-.66,hz+.66):q.beam((hx-.605,z),(hx+.605,z),y+.006,y+.053,.057,'brass')
 for x in(hx-.58,hx+.58):q.beam((x,hz-.65),(x,hz+.65),y+.006,y+.053,.058,'brass')
