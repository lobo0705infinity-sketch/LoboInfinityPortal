from mesh import *
def sections(poly,t=.15):
 pts=np.array(poly.exterior.coords[:-1]);n=len(pts);inners=[];edges=[]
 for i,a in enumerate(pts):
  b=pts[(i+1)%n];v=b-a;ln=np.linalg.norm(v);u=v/ln;edges.append((a,b,u,np.array([u[1],-u[0]]),ln))
 for i in range(n):
  prev=edges[(i-1)%n];edge=edges[i];bis=prev[3]+edge[3];den=np.dot(bis,edge[3]);inners.append(pts[i]-bis*t/max(den,.16))
 return [(*e,inners[i],inners[(i+1)%n])for i,e in enumerate(edges)]
def door_edge(edges,face):
 available=[(np.dot(e[3],face)+min(8,e[4])*.032,i)for i,e in enumerate(edges)if e[4]>2.14]
 return max(available)[1]
def doorpos(edge,target):
 a,b,u,N,L,*_=edge;k=1 if abs(N[0])>.65 else 0
 p=(target-a[k])/u[k] if abs(u[k])>.10 else L*.5
 return float(np.clip(p,.85,L-.85))
def rail(q,a,b,y,style='ink',skip=False):
 a=vec(a);b=vec(b);u=b-a;L=np.linalg.norm(u)
 if L<.1:return
 if skip and L>2.4:
  m=(a+b)/2;v=u/L;rail(q,a,m-.63*v,y,style);rail(q,m+.63*v,b,y,style);return
 for f in np.linspace(0,1,max(2,round(L/.94)+1)):
  p=a+u*f;q.rod(xyz(p,y+.005),xyz(p,y+.55),.036,style,7)
 q.rod(xyz(a,y+.55),xyz(b,y+.55),.048,style,9);q.rod(xyz(a,y+.27),xyz(b,y+.27),.027,style,7)
def ladder(q,c,u,n,bottom,top,ext=False):
 c=vec(c);u=vec(u);n=vec(n)
 for s in (-1,1):
  p=c+s*.41*u;q.rod(xyz(p,bottom+.045),xyz(p,top+.36),.037,'zinc',8)
  for y in np.arange(bottom+.22,top,.95):
   q.rod(xyz(p,y),xyz(p-n*.13,y),.029,'ink',7)
 for h in np.arange(bottom+.20,top+.07,.255):
  q.rod(xyz(c-.41*u,h),xyz(c+.41*u,h),.025,'brass',7)
 # Capsule-free physics: individual small rungs form a visible ladder without blocking the opening.
def doors_and_windows(q,d,shape,y0,y1,upper=False,reserved=(),upper_door=None):
 es=sections(shape);face=(1,0) if upper and d['style'] in ('exchange','saw','engineer') else d['face'];di=door_edge(es,face);openings=[];door_record=None
 mat=d['upper']if upper else d['base'];trim=d['trim'];rng=np.random.default_rng(int(d['g'],16)+(1 if upper else 0))
 for i,(a,b,u,N,L,ia,ib) in enumerate(es):
  P=lambda t:a+u*t;Q=lambda t:ia+(ib-ia)*(t/L);ph=float(a@u)+.43
  holes=[];hasdoor=(i==di if not upper else upper_door is not None and i==upper_door[0])
  # Upper levels retain real sills. Their access comes through the indoor ladder shaft.
  if hasdoor:
   dc=upper_door[1] if upper else doorpos(es[i],d['target']);w=1.24;lo=dc-w/2;hi=dc+w/2;ht=y0+min(2.03,y1-y0-.40)
   holes.append((lo,hi,y0,ht,'door'));door_record=(P(dc),u,N,lo,hi,ht)
  intervals=[(.26,L-.26)]
  if upper and d['style']=='exchange' and L<1.6:intervals=[(.078,L-.078)]
  if hasdoor:intervals=[(.23,lo-.30),(hi+.30,L-.23)]
  for v0,v1 in intervals:
   span=v1-v0
   if span<1.03:
    if d['style']in('exchange','guard','engineer')and .40<span<1.03 and L<1.7:
     holes.append((v0+.035,v1-.035,y0+1.06,y1-.55,'curve'))
    continue
   ct=max(1,round(span/(1.64 if d['room']in('dispatch','public','clearance','weigh','archive') else 2.05)))
   if d['room'] in ('bond','store','cold') and i%3==1:ct=0
   for j in range(ct):
    w=min(span/ct-.30,1.35 if upper and d['style']=='exchange' else 1.10)
    mid=v0+(j+.5)*span/ct
    typ='arch' if d['style'] in ('civic','records','hoist','train','stores') and L>2 and (j+i)%3!=1 else 'window'
    if d['room']=='cold' or (d['room']=='laboratory'and (i+j)%3==1):typ='frost'
    holes.append((mid-w/2,mid+w/2,y0+(.98 if upper else 1.12),y1-(.59 if typ=='arch' else .54),typ))
  for record in reserved:
   if record['wall']==i:
    ct=(np.array(record['point'])-a)@u;w=record['reserved'];holes=[h for h in holes if h[4]=='door' or h[1]<ct-w or h[0]>ct+w]
  holes=sorted(h for h in holes if h[1]-h[0]>.23 and h[3]>h[2]+.2)
  def chunk(lo,hi,bot,top):
   if hi<=lo+.0001 or top<=bot+.0001:return
   va=[P(lo),P(hi),Q(hi),Q(lo)];pts=[xyz(p,h) for h in (bot,top)for p in va];q.hexa(pts,mat,True,False)
   tiled(q.v,P,N,lo,hi,bot,top,mat,ph);tiled(q.v,Q,-N,lo,hi,bot,top,'inside',ph)
   for ends,j,k,direc in [('left',0,3,-u),('right',1,2,u)]:
    if (ends=='left' and lo>.001)or(ends=='right' and hi<L-.001):
     q.v.face([pts[j],pts[k],pts[k+4],pts[j+4]],'limestone',(direc[0],0,direc[1]))
   q.v.face(pts[4:], 'limestone',(0,1,0));q.v.face(pts[:4],'limestone',(0,-1,0))
  start=0.
  for lo,hi,bot,top,typ in holes:
   chunk(start,lo,y0,y1);chunk(lo,hi,y0,bot);chunk(lo,hi,top,y1)
   if typ!='door':
    q.beam(P(lo-.09),P(hi+.09),bot-.072,bot+.012,.25,'limestone',False,.037)
    for edge in (lo-.025,hi+.025):
     q.beam(P(edge-.034),P(edge+.034),bot+.016,top+.042,.085,trim,False,.003)
    if typ=='frost':
     c=P((lo+hi)/2)-N*.085;q.label(xyz(c,(bot+top)/2),hi-lo-.035,top-bot-.03,'glassblock',N,'ink')
     q.beam(P(lo),P(hi),bot,top,.034,'glass',True,-.10)
    else:
     # Small outboard transom, clear opening below, no invisible full-window collider.
     q.beam(P(lo),P(hi),top-.19,top-.031,.046,'glass',True,-.08)
     q.beam(P(lo-.035),P(hi+.035),top-.204,top-.17,.052,trim,False,-.027)
     if typ=='curve' or (hi-lo>.96 and (i+int(round(lo)))%2==0):
      c=P((lo+hi)/2)-N*.064;q.rod(xyz(c,bot+.025),xyz(c,top-.02),.022,'brass',6)
    if typ=='arch':
     width=hi-lo;prev=None
     for angle in np.linspace(math.pi,0,9):
      point=xyz(P((lo+hi)/2+math.cos(angle)*(width*.57))+N*.038,top+.015+math.sin(angle)*.24)
      if prev:q.rod(prev,point,.063,'limestone',6)
      prev=point
   else:
    for t in (lo-.075,hi+.075):q.beam(P(t-.064),P(t+.064),y0,top+.13,.21,'limestone',False,.022)
    q.beam(P(lo-.14),P(hi+.14),top+.045,top+.165,.24,trim,False,.036)
   openings.append((i,typ,lo,hi,bot,top));start=hi
  chunk(start,L,y0,y1)
  # Each field of masonry has a stone or dark concrete plinth and cornice. Gaps respect the doorway.
  for lo,hi in ([(0,door_record[3]),(door_record[4],L)] if hasdoor else [(0,L)]):
   q.beam(P(lo+.012),P(hi-.012),y0+.01,y0+(.23 if not upper else .105),.085,'foot',False,.038)
  q.beam(P(.015),P(L-.015),y1-.14,y1-.067,.125,'limestone' if mat in ('brick','darkbrick','plaster','limestone') else trim,False,.044)
  if L>2.2:
   p=P(.13)+N*.014
   q.beam(p-u*.080,p+u*.080,y0+.04,y1-.07,.125,'limestone' if d['style'] in ('civic','exchange','records') else trim,False,.044)
   if i%3==0:
    p=P(L-.20)+N*.106;q.rod(xyz(p,y0+.21),xyz(p,y1+.07),.049,'zinc',8)
    for h in np.arange(y0+.51,y1,.93):q.rod(xyz(p,h),xyz(p-N*.11,h),.032,'ink',6)
 if door_record and not upper:
  p,u,N,lo,hi,ht=door_record
  # Enameled lintel panels sit above the passage. Each service door stays clear for a 25mm model.
  w=min(2.36,es[di][4]-.32);h=min(.49,y1-ht-.17)
  q.label(xyz(p+N*.11,ht+.17+h*.5),w,h,d['slug'],N,'brass')
  p2=p+u*(hi-lo)*.69+N*.128
  q.rod(xyz(p2,ht-.26),xyz(p2,ht-.05),.061,'lamp',8)
 return door_record,openings
