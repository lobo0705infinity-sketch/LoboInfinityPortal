from design import *
from fixtures import asset
from functools import lru_cache
ARR=json.loads((WORK/'arrangement.json').read_text())
ART={'a':'art1','b':'art2','j':'art0','e':11,'i':'art4','l':9,'n':'art5','o':'art3'}
ROOM={'a':[3,4],'b':[1,5],'c':[2,7],'d':[4,0],'e':[5,2],'f':[5,1],'g':[0,7],'h':[0,7],'i':[2,5],'j':[2,7],'k':[1,3],'l':[5,4],'m':[3,4],'n':[7,0],'o':[6,1],'p':[2,3]}
def artkey(f):return tuple(sorted(tuple(round(v,3) for v in p)for p,_,_ in f))
def choose_art(t):
 if t.key not in ART:return set()
 faces,_=roof_base(t);groups=[]
 for i,f in enumerate(faces[:-1]):
  if source_id(f) not in (9,11) or source_id(faces[i+1])!=source_id(f):continue
  if not set(v[0]for v in f).intersection(v[0]for v in faces[i+1]):continue
  pts={v[0]for ff in [f,faces[i+1]] for v in ff};z0=min(p[1]for p in pts);z1=max(p[1]for p in pts)
  if len(pts)!=4 or z1-z0<1:continue
  # Give each piece an outward-facing wall with the longest visible artwork bay.
  width=max(max(p[k]for p in pts)-min(p[k]for p in pts) for k in [0,2]);se=max(max(p[0]for p in pts),-min(p[2]for p in pts))
  groups.append((width+.12*se+.06*z0,[artkey(f),artkey(faces[i+1])]))
 assert groups,(t.key,'missing mural');return set(max(groups,key=lambda v:v[0])[1])
def facade(m,t):
 # Continuously mapped room photographs run behind the architectural glazing bars.
 poly=list(t.poly.exterior.coords)[:-1];count=0;rooms=[]
 for start,end in zip(poly,poly[1:]+poly[:1]):
  dx=end[0]-start[0];dz=end[1]-start[1];length=math.hypot(dx,dz)
  if length<1.9:continue
  dx/=length;dz/=length;nx,nz=dz,-dx
  def pt(s,y,off):return (start[0]+dx*s+nx*off,y,start[1]+dz*s+nz*off)
  def rail(s1,y1,s2,y2,width,material,depth=None):m.beam(pt(s1,y1,.058),pt(s2,y2,.058),width,material,depth or width)
  available=length-.26;div=max(1,math.ceil(available/7.4));step=available/div
  for bay in range(div):
   i=ROOM[t.key][(count+bay)%2];lo=.13+bay*step;hi=lo+step
   m.face([pt(lo,-.35,.030),pt(hi,-.35,.030),pt(hi,-2.75,.030),pt(lo,-2.75,.030)],'room'+str(i),[(0,1),(1,1),(1,0),(0,0)])
   # The glazing is one storey tall. Shared mullions do not restart the photograph.
   rail(lo,-2.77,lo,-.31,.067 if bay==0 else .13,'teal')
   n=max(1,round(step/2.65))
   for k in range(1,n):
    q=lo+k*step/n;rail(q,-2.74,q,-.36,.055,'charcoal')
   if bay==div-1:rail(hi,-2.77,hi,-.31,.085,'teal')
   rooms.append((count,bay,i,n))
  rail(.04,-2.80,length-.04,-2.80,.13,'zinc');rail(.04,-.31,length-.04,-.31,.12,'teal');count+=1
 return rooms
def make_towers():
 report={}
 for key,t in T.items():
  keep=choose_art(t);meta=[]
  for state in range(1,t.n+2):
   full=state==t.n+1;s='tower-'+key+'-'+str(state)
   faces,solids=roof_base(t) if full else base_model(s);m=Mesh();m.solids=list(solids)
   for f in faces:
    idx=source_id(f)
    if idx in (9,11):
     if artkey(f)in keep:m.faces.append(to_atlas(f,ART[key]))
     continue
    if idx==3:
     # Opaque backing for every original facade slot; polished windows use their own UVs.
     m.faces.append(to_atlas(f,'charcoal'));continue
    m.faces.append(to_atlas(f))
   rooms=facade(m,t)
   for lev in range(min(state,t.n)):
    for kind,x,z,a in ARR[key][str(lev)]:m.attach(asset(kind),x,lev*PITCH+.009,z,a)
   if full:
    for kind,x,z,a in ARR[key][str(t.n)]:m.attach(asset(kind),x,t.n*PITCH+.010,z,a)
   meta.append(m.save(s))
  report[key]={'states':meta,'rooms':rooms,'mural':ART.get(key)}
 (WORK/'model-report.json').write_text(json.dumps(report,indent=1))
def make_bridges():
 for style in ['open','service','gallery','freight']:
  f,c=base_model('bridge-'+style);m=Mesh();m.faces=[to_atlas(a)for a in f];m.solids=list(c)
  if style in ['open','service']:
   for sg in [-1,1]:
    x=sg*1.915;m.box(x,0,0,.153,.91,4,'ceramic','roofB',True);m.box(x,.87,0,.17,.067,4,'zinc')
    # Riveted panel edges and bolt heads give the opaque guard a true scale.
    for z in [-1.92,-.67,.67,1.92]:
     m.box(x,0,z,.164,.88,.042,'teal')
     for y in [.20,.74]:m.box(x+.084*sg,y,z,.012,.036,.036,'bronze')
  m.save('bridge-'+style)
def make_blimp():
 src,c=base_model('moored-aerostat');m=Mesh()
 for f in src:
  v=[p for p,st,n in f];idx=source_id(f)
  if idx==3 or (idx==18 and all(.719<y<.861 and abs(z)<=1.251 and abs(x)<=.641 for x,y,z in v)):continue
  m.faces.append(to_atlas(f))
 m.solids=[s for s in c if abs(s[1]+.16)>.001]
 hull=[(-.54,-1.24),(.54,-1.24),(.65,-1.03),(.65,.73),(.49,1.19),(-.49,1.19),(-.65,.73),(-.65,-1.03)]
 m.prism(hull,-.18,.18,'charcoal','zinc',True);m.prism(hull,.00,.17,'bench','teal',True)
 m.prism(hull,.76,.082,'ceramic','red',True)
 m.box(0,.16,-.46,1.23,.62,1.46,'zinc','roofB',True)
 for side in [-1,1]:
  m.box(side*.624,.19,-.46,.037,.51,.94,'ceramic','zinc');m.box(side*.652,.42,-.24,.03,.053,.16,'charcoal')
  for z in [-.94,-.02]:m.box(side*.647,.19,z,.045,.52,.030,'bronze')
  for z in [.55,1.06]:
   x=.64 if z<1 else .53;m.beam((side*x,.16,z),(side*x*.95,.77,z-.055),.049,'teal')
  m.box(side*.345,.17,.38,.27,.12,.29,'charcoal');m.box(side*.345,.27,.31,.24,.25,.048,'red')
 m.box(0,.20,.86,.80,.17,.21,'charcoal');m.box(0,.37,.86,.78,.055,.22,'route')
 m.beam((0,.17,1.17),(0,.77,1.11),.043,'teal')
 m.save('moored-aerostat')
if __name__=='__main__':make_towers();make_bridges();make_blimp()
