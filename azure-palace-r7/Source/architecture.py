"""Single-finish exterior walls, individual recessed doorways and furnished walk-in building states."""
from copy import deepcopy
import math, sys
from pathlib import Path
import numpy as np
from PIL import Image
from common import *
from faces import clean,give_sheets_thickness
CLEAR=26/25.4
FRONT=-.73
BACK=.73
HEIGHT=2.24
dims=A.dims
ROLES={**{k:'hotel' for k in dims if 'wing' in k or 'villa' in k},'azure-spa':'spa','terrace-restaurant':'restaurant','reception':'reception','cafe':'restaurant','pool-equipment':'equipment','laundry':'laundry'}
# These ground-floor walls carry the working fittings. The remaining openings and all upper-storey bays retain glazing.
fitted={'terrace-restaurant':-1,'azure-spa':1,'reception':1,'cafe':1,'pool-equipment':1,'laundry':1}
def make_atlas():
    tiles=[(Image.open(R2/'Assets'/name).convert('RGB'),n,start) for name,n,start in [('palace-materials.jpg',4,0),('arts-and-finishes.jpg',6,16)]]
    dest=Image.new('RGB',(4096,4096),(110,112,105))
    for im,n,start in tiles:
        for i in range(n*n):
            x=i%n*512;y=i//n*512;slot=start+i
            dest.paste(im.crop((x,y,x+512,y+512)),(slot%8*512,slot//8*512))
    dest.save(OUT/'palace-interiors.jpg',quality=94,subsampling=0,optimize=True)
def remap(mesh,n,first):
    uv=np.asarray(mesh.uv);u=np.clip(uv[:,0]*n,0,n-1.e-8);v=np.clip((1-uv[:,1])*n,0,n-1.e-8)
    x=u.astype(int);y=v.astype(int);idx=first+x+y*n
    mesh.uv=np.c_[((idx%8)+u-x)/8,1-((idx//8)+v-y)/8].tolist()
def doorway(m,w,d,zsign,y):
    center=FRONT if zsign<0 else BACK
    half=CLEAR/2;edge=.099;z=zsign*d/2;h=2.88
    def strip(a,b,lo,hh,mat,depth=.25,shift=0):
        if b>a:m.box((a+b)/2,lo,z+zsign*shift,b-a,hh,depth,mat)
    left,right=center-half,center+half
    strip(-w/2,left-edge,y,h,'limestone');strip(right+edge,w/2,y,h,'limestone')
    for a,b in [(left-edge,left),(right,right+edge)]:strip(a,b,y,HEIGHT,'wood',.32,.014)
    strip(left-edge,right+edge,y+HEIGHT,.12,'bronze',.32,.014)
    strip(left-edge,right+edge,y+HEIGHT+.12,h-HEIGHT-.12,'limestone')
    # A short projecting cap casts a readable shadow without bridging the walkable entrance.
    strip(left-.24,right+.24,y+HEIGHT+.15,.115,'travertine',.46,.066)

def sealed_rear(m,w,d,y):
    # One exterior wall with a small, backed ventilation grille above eye level.
    # There is no door frame or opening behind the grille.
    m.box(0,y,d/2,w,2.88,.25,'limestone')
    m.box(.73,y+1.65,d/2+.148,1.20,.55,.046,'bronze')
    m.box(.73,y+1.70,d/2+.178,1.07,.44,.026,'rubber',False)
    for i in range(4):
        m.box(.73,y+1.75+.095*i,d/2+.211,1.03,.041,.063,'bronze',False)

ladder_centres={'sunward-wing':1.55,'seaward-wing':1.55,'azure-spa':-1.80,'terrace-restaurant':1.65}
GATE_HALF=.72
DECK_REACH=1.80
def flight_gate(slug,level):
    return ladder_centres[slug] if level==1 else -1.28

def balcony(m,w,d,level,slug):
    y=level*3.1
    gate=flight_gate(slug,level)
    lo,hi=gate-GATE_HALF,gate+GATE_HALF
    edge=-d/2-DECK_REACH
    hotel=ROLES[slug]=='hotel'
    if hotel:
        upper_gate=flight_gate(slug,2)
        shoulder={max(-w/2,min(w/2,upper_gate+offset)) for offset in (-2.10,-1.82,1.82,2.10)} if level==1 else set()
        xs=sorted({round(w/2*math.cos(t),8) for t in np.linspace(0,math.pi,23)}|{lo,hi}|shoulder)
        def outline(x):
            if lo <= x <= hi:return edge
            curve=-d/2-.89-1.04*math.sqrt(max(0,1-(2*x/w)**2))
            if level==1:
                blend=max(0,min(1,(2.10-abs(x-upper_gate))/.28))
                return curve*(1-blend)+(edge-1.61)*blend
            return curve
    else:
        xs=[-w/2,lo,hi,w/2]
        def outline(x):return edge
    front=[(x,outline(x)) for x in xs]
    m.prism([(-w/2,-d/2),*front,(w/2,-d/2)],y,.22,'travertine')
    for a,b in zip(front,front[1:]):
        if lo < (a[0]+b[0])/2 < hi:continue
        if hotel or a[0]<0:
            m.wall(a,b,y+.22,.76,'solid','limestone' if not hotel or abs(a[0])>w*.26 else 'bronze',.12)
        else:
            for x in np.linspace(a[0],b[0],max(2,math.ceil((b[0]-a[0])/.44))):
                m.box(x,y+.22,edge,.047,.77,.05,'bronze')
            m.box((a[0]+b[0])/2,y+.97,edge,b[0]-a[0]+.045,.068,.074,'bronze')
    for (xx,zz) in (front[0],front[-1]):
        m.wall((xx,-d/2-.14),(xx,zz),y+.22,.76,'solid','limestone',.12)
    if hotel:
        for xx in [-w/2+.68,w/2-.68]:
            m.add(B.planter(1.06,.52).moved(x=xx,z=-d/2-.40,y=y+.22))

def exterior_flight(m,d,level,slug):
    x=flight_gate(slug,level);edge=-d/2-DECK_REACH;z=edge-.162
    bottom=0 if level==1 else (level-1)*3.1+.22
    top=level*3.1+.22
    # Flights alternate on the taller hotels. An extended lower deck supports
    # the second flight and lets a miniature walk around to its foot.
    for sign in (-1,1):
        xx=x+sign*.63
        m.box(xx,bottom+.035,z,.081,top+.70-bottom-.035,.089,'bronze')
        m.box(xx,bottom+.003,z,.165,.07,.18,'rubber')
        m.box(xx,top-.14,edge-.061,.12,.093,.22,'bronze')
    count=math.ceil((top-bottom-.22)/.30)
    for h in np.linspace(bottom+.25,top-.073,count):
        m.box(x,h,z-.006,1.239,.055,.065,'bronze')
def sidewall(m,w,d,sx,slug,level,y):
    x=sx*w/2
    def section(a,b,low,h,mat='limestone',extra=0):
        if b>a:m.box(x+sx*extra/2,low,(a+b)/2,.25+extra,h,b-a,mat)
    for j in range(3):
        lo,hi=(-d/2+.125 if j==0 else -d/2+j*d/3),(d/2-.125 if j==2 else -d/2+(j+1)*d/3)
        if j==1 or (level==0 and fitted.get(slug)==sx):
            section(lo,hi,y,2.88);continue
        a,b=lo+.31,hi-.31;sill=1.32;head=2.37
        section(lo,a-.06,y,2.88);section(b+.06,hi,y,2.88)
        section(a-.06,b+.06,y,sill-.08)
        section(a-.06,b+.06,y+sill-.08,.08,'travertine',.035)
        section(a-.06,a,y+sill,head-sill,'bronze',.025);section(b,b+.06,y+sill,head-sill,'bronze',.025)
        section(a-.06,b+.06,y+head,2.88-head)
def frame(m,w,d,y,trim=.12):
    for sg in [-1,1]:
        m.box(0,y,sg*(d/2+.09),w+.42,trim,.32,'travertine')
        m.box(sg*(w/2+.09),y,0,.32,trim,d-.14,'travertine')
def interior(m,w,d,level,role):
    y=level*3.1+.22
    B.H.ladder(m,w/2-1.2,d/2-.65,y,y+3.10,0,towards=(0,.4))
    if role=='hotel':
        B.bed(m,-w/2+1.40,d/2-1.65,y);B.sofa(m,-w/2+1.16,-d/2+1.62,y)
        m.box(w/2-.50,y,-d/2+1.50,.60,1.9,1.32,'wood')
        for dy in [.30,.80,1.3,1.75]:m.box(w/2-.83,y+dy,-d/2+1.49,.046,.055,1.20,'bronze')
    elif role=='spa':
        for x in [-w*.25,w*.25]:
            m.box(x,y,-.40,1.12,.65,2.35,'wood');m.box(x,y+.65,-.40,1.13,.15,2.30,'fabric')
            for zz in [-1.29,.40]:m.box(x,y+.80,zz,.76,.08,.32,'fabric')
    elif role=='laundry':
        for z in [-.85,.95]:
            q=M();B.H.washer(q,0,0);m.add(q.moved(x=-w/2+.81,z=z,y=y,rot=-90))
        B.H.shelf(m,w/2-.48,-d/2+1.5,90)
    elif role=='equipment':B.H.pump(m,-w/2+1.35,.4)
    else:
        m.box(-w/2+.78,y,.46,1.18,1.15,2.7,'wood');m.box(-w/2+.78,y+1.15,.46,1.36,.12,2.93,'travertine')
        for zz in [-d/2+1.38,.32]:
            m.cyl(w/2-1.35,y,zz,.079,.85,'bronze',12);m.cyl(w/2-1.35,y+.85,zz,.58,.095,'wood',20)
            for xx in [w/2-2.12,w/2-.53]:m.box(xx,y,zz,.48,.50,.52,'sage')
def floor(w,d,level,slug):
    m=M();y=level*3.1
    if level:B.slab_hatch(m,w,d,y)
    else:m.box(0,0,0,w,.22,d,'travertine')
    for sg in [-1,1]:
        if level and sg>0:sealed_rear(m,w,d,y+.22)
        else:doorway(m,w,d,sg,y+.22)
        sidewall(m,w,d,sg,slug,level,y+.22)
    frame(m,w,d,y+2.965)
    interior(m,w,d,level,ROLES[slug])
    if level:balcony(m,w,d,level,slug)
    return m
def roof(m,w,d,count):
    B.slab_hatch(m,w,d,count*3.1);y=count*3.1+.22
    for sg in [-1,1]:
        m.box(0,y,sg*d/2,w+.18,.80,.18,'limestone')
        m.box(sg*w/2,y,0,.18,.80,d-.18,'limestone')
    m.box(-w/2+1.2,y,-d/2+1.2,1.5,.55,1.2,'enamel')
    for j in range(7):m.box(-w/2+1.2,y+.55,-d/2+.76+j*.14,1.28,.055,.066,'rubber')
def details(slug,w,d,n,ix):
    w_,d_,count,role=dims[slug];dmesh,*_=A.build_detail(slug,w,d,count,role,n,ix==1)
    # Floors, runner and roof strips inlay into the upper slab so each patch has one visible surface.
    for i,(x,y,z) in enumerate(dmesh.v):
        if abs(y%3.1-.239)<1e-6 or abs(y%3.1-.255)<1e-6 or abs(y%3.1-.242)<1e-6 or abs(y%3.1-.256)<1e-6:
            dmesh.v[i]=(x,round((y-.23)/3.1)*3.1+.22,z)
    side=fitted.get(slug)
    if side:
        dmesh.f=[f for f in dmesh.f if not all(side*dmesh.v[j][0] > w/2+.13 and dmesh.v[j][1] < 2.67 for j in f)]
    o=M();o.v=dmesh.v;o.uv=dmesh.uv;o.f=dmesh.f;return o
def make_one(slug):
    w,d,n,_=dims[slug];levels=[floor(w,d,i,slug)for i in range(n)];data=[]
    for ix,visible in enumerate([n]+list(range(1,n+1)),1):
        main=M()
        for lev in levels[:visible]:main.add(lev)
        for upper in range(1,visible):exterior_flight(main,d,upper,slug)
        if ix==1:roof(main,w,d,n)
        name=slug+'-'+str(ix)
        write_collision(main,OUT/(name+'-col.obj'))
        remap(main,4,0);de=details(slug,w,d,visible,ix);remap(de,6,16);main.add(de)
        clean_mesh,removed=clean(main,bottom=True);vertices,faces=A.export(clean_mesh,OUT/(name+'.obj'))
        data.append([name,removed,vertices,faces])
    print(slug,data,flush=True);return data
if __name__=='__main__':
    give_sheets_thickness(M)
    from concurrent.futures import ProcessPoolExecutor
    with ProcessPoolExecutor(max_workers=4) as pool:rows=list(pool.map(make_one,ladder_centres))
    write(ROOT/'Review/architecture.json',rows)
