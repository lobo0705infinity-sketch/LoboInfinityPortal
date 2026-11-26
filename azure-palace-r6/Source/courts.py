"""Fitted courtyards. Each site is authored from its own façade, with occasional world-aligned boundary returns."""
from pathlib import Path
from functools import partial
from concurrent.futures import ProcessPoolExecutor
from shapely.geometry import Polygon,Point,box
from shapely import affinity
from common import *
from faces import clean,give_sheets_thickness
from architecture import dims
# side, position along façade, finish, paving polygon in the site's outward frame
sites={
'terrace-restaurant':(270,.18,'dining',[(-3.00,-.04),(3.16,-.04),(3.16,3.55),(1.3,3.55),(-.70,2.14),(-2.50,1.14),(-3,.79)]),
'azure-spa':(90,.03,'spa',[(-2.78,-.04),(4.38,-.04),(4.38,2.10),(3.39,3.82),(-2.78,3.82)]),
'reception':(90,0,'arrivals',[(-2.6,-.04),(2.62,-.04),(2.62,3.05),(.55,3.02),(-2.6,2.48)]),
'cafe':(90,0,'cafe',[(-2.70,-.04),(2.72,-.04),(2.72,3.63),(1.46,4.34),(-2.7,4.34)]),
'pool-equipment':(90,.10,'plant',[(-3.37,-.04),(3.27,-.04),(3.27,3.32),(-3.37,3.32)]),
'laundry':(90,0,'linen',[(-2.85,-.04),(3.11,-.04),(3.11,3.05),(-2.85,3.05)]),
'sunward-wing':(90,-.48,'gallery',[(-2.85,-.04),(2.55,-.04),(2.55,2.34),(.80,3.52),(-2.85,3.52)]),
'seaward-wing':(90,-.10,'loggia',[(-3.62,-.04),(2.75,-.04),(2.75,3.64),(1.10,4.42),(-3.62,4.42)]),
'north-villa':(270,-.23,'quiet',[(-2.85,-.04),(2.4,-.04),(2.4,3.98),(1.15,4.37),(-2.85,4.37)]),
'east-villa':(90,.16,'quiet',[(-2.8,-.04),(2.72,-.04),(2.72,4.23),(-1.48,4.23),(-2.8,3.18)]),
'south-villa':(90,-.16,'quiet',[(-2.91,-.04),(2.68,-.04),(2.68,4.57),(-.84,4.57),(-2.91,3.13)]),
'west-villa':(270,-.40,'quiet',[(-2.43,-.04),(2.60,-.04),(2.60,4.10),(-2.43,4.10)]),
'pool':(270,0,'pool',[(-2.15,-.05),(2.16,-.05),(2.16,2.52),(-2.15,2.52)])}
def frame(slug):
    side,along,_,_=sites[slug]
    if slug=='pool':return 5.96,4.54,side
    w,d,_,_=dims[slug];x,z=origin(side,w,d,along)
    return x,z,side
def from_site(slug,u,v):
    x,z,rot=frame(slug);lx,lz=transform(x,z,rot,u,v);return (lx,lz) if slug=='pool' else world(slug,lx,lz)
def site_polygon(slug):return Polygon([from_site(slug,*p) for p in sites[slug][3]])
def secure(m,c,a,b,h=2.16,stone='oyster',th=.32):
    """Masonry seated on the paving, with a real stone coping and a narrow plinth."""
    ax,az=a;bx,bz=b;vx=bx-ax;vz=bz-az;length=math.hypot(vx,vz);angle=math.degrees(math.atan2(-vz,vx));cx=(ax+bx)/2;cz=(az+bz)/2
    slab=F.Surface();solid=M()
    slab.box(0,.01,0,length,h,th,stone);slab.rounded(0,h+.01,0,length,.095,th+.08,.036,'travertine')
    slab.box(0,.045,0,length,.14,th+.055,'slate');solid.box(0,0,0,length,h+.105,th+.045,'limestone')
    m.add(slab.moved(x=cx,z=cz,rot=angle));c.add(solid.moved(x=cx,z=cz,rot=angle))
def canopy(m,c,x,z,w,depth,h,cantilever=False):
    F.awning(m,c,x,z,w,depth,h,True)
    for q in ([x+w/2-.09] if cantilever else [x-w/2+.09,x+w/2-.09]):
        m.box(q,.04,z+depth-.10,.114,h-.085,.114,'brass');c.box(q,0,z+depth-.1,.114,h-.045,.114,'bronze')
        m.rounded(q,.01,z+depth-.10,.26,.23,.26,.045,'oyster')
def pad(m,c,x,z,w,h,d,mat):
    m.rounded(x,.012,z,w,h,d,.06,mat);c.box(x,0,z,w,h+.012,d,'limestone')
def wallfit(m,c,w,h,mat):
    m.box(0,.05,.067,w,h,.134,mat);c.box(0,.05,.067,w,h,.134,'wood')
def sub(m,c,fn,x,z,rot=0):
    q=F.Surface();v=M();fn(q,v);m.add(q.moved(x=x,z=z,rot=rot));c.add(v.moved(x=x,z=z,rot=rot))
def sculpture(m,c):
    F.promenade(m,c,3.58,1.4)
def furniture(slug,m,c):
    # Existing resort furniture is reused from R4. The fitted panel shares the solid service-side façade.
    if slug=='terrace-restaurant':
        wallfit(m,c,3.96,1.98,'teak');F.dining(m,c,4.04,2.)
        canopy(m,c,-.37,.15,4.40,2.33,2.73,cantilever=True)
        secure(m,c,(2.95,.02),(2.95,3.01),2.25)
        secure(m,c,(2.95,3.01),(1.20,3.01),2.25)
        sub(m,c,lambda a,b:F.seat(a,b,0,0,1.24),2.02,2.57,180)
        F.cafe_table(m,c,1.81,2.05,.77,.32);F.planter(m,c,2.51,1.35,.51,.43,.85,72)
    elif slug=='azure-spa':
        wallfit(m,c,4.61,1.94,'green');F.garden(m,c,4.6,1.68)
        secure(m,c,(-2.55,.0),(-2.55,3.62),2.16,'oyster')
        secure(m,c,(-2.55,3.62),(.06,3.62),2.16,'green')
        secure(m,c,(3.99,.08),(3.99,2.17),2.02,'oyster');secure(m,c,(3.99,2.17),(3.08,3.58),2.02,'oyster')
        F.planter(m,c,-1.27,3.13,1.95,.64,.79,36);F.planter(m,c,3.10,1.59,.93,.70,1.11,54)
        sub(m,c,lambda a,b:F.seat(a,b,0,0,1.2),2.62,2.64,110)
        canopy(m,c,-.98,.13,2.76,1.65,2.68)
    elif slug=='pool-equipment':
        wallfit(m,c,4.53,2.24,'iron');F.water(m,c,4.55,2.14)
        for xx,hh in [(-1.04,1.96),(.17,1.96)]:
            m.box(xx,hh-.14,.134,.33,.32,.115,'iron')
            F.tube(m,[(xx,hh,.265),(xx,hh,-.065)],.095,'copper')
            for dx,dy in [(-.10,-.10),(-.10,.10),(.10,-.10),(.10,.10)]:m.box(xx+dx,hh+dy,.202,.035,.035,.029,'brass')
        secure(m,c,(-3.10,.0),(-3.10,3.18),2.30,'oyster')
        secure(m,c,(-3.10,3.18),(.98,3.18),2.17,'iron')
        for y in np.arange(.34,2.05,.20):m.box(-1.05,y,3.369,3.82,.083,.084,'green')
        F.plaque(m,-1.22,.80,3.427,1,1.19,.53,'plant')
        pad(m,c,2.67,.55,.48,1.59,.86,'green')
    elif slug=='reception':
        wallfit(m,c,5.07,2.07,'teak');F.bell(m,c,5.05,2.04)
        secure(m,c,(-2.43,.0),(-2.43,2.45),2.10)
        secure(m,c,(-2.43,2.45),(-.96,2.45),1.98);F.planter(m,c,1.71,2.62,1.55,.61,.82,25)
    elif slug=='cafe':
        wallfit(m,c,4.74,2.05,'green');F.bistro(m,c,4.75,2.30)
        secure(m,c,(2.47,.0),(2.47,3.51),2.12);secure(m,c,(2.47,3.51),(1.28,4.10),2.12)
        F.planter(m,c,-1.92,3.19,1.22,.7,.83,43);F.cafe_table(m,c,.22,3.22,.79,.43)
    elif slug=='laundry':
        wallfit(m,c,3.77,2.12,'slate');F.laundry(m,c,3.76,1.8)
        secure(m,c,(2.68,0),(2.68,2.91),2.11,'oyster');secure(m,c,(2.68,2.91),(.81,2.91),2.11,'iron')
        pad(m,c,-2.16,.66,.56,1.32,.85,'teak')
    elif slug=='sunward-wing':
        # The bronze sits in the end wall of the hotel's open gallery, with a clear view through its rings.
        secure(m,c,(-2.63,0),(-2.63,3.14),2.07)
        sub(m,c,sculpture,-.92,3.10,180)
        F.planter(m,c,1.73,.68,1.34,.58,.75,52)
    elif slug=='seaward-wing':
        secure(m,c,(-3.35,0),(-3.35,4.06),2.22);secure(m,c,(-3.35,4.06),(-.13,4.06),2.22,'teak')
        canopy(m,c,-1.65,.12,3.18,3.68,2.84)
        sub(m,c,lambda a,b:F.seat(a,b,0,0,1.90),-1.67,3.67,180);F.cafe_table(m,c,-1.68,2.91)
        F.planter(m,c,1.61,2.68,1.45,.65,1.00,73)
    elif slug=='pool':
        F.pool(m,c,4.34,2.18)
        # The cabinet is a short built-in return of the east pool deck. It ends above the east stair.
        secure(m,c,(-1.89,.08),(-1.89,2.826),1.93,'teak',.18)
    else:
        # Private villa courtyards have different orientations, heights and opening positions.
        key=['north-villa','east-villa','south-villa','west-villa'].index(slug)
        sign=[-1,1,1,-1][key];u=sign*[2.61,2.40,2.39,2.25][key];length=[4.07,3.98,4.27,3.88][key]
        secure(m,c,(u,0),(u,length),[2.15,2.20,2.36,2.04][key],'oyster')
        secure(m,c,(u,length),(u-sign*[2.08,2.75,2.60,2.75][key],length),[2.15,2.20,2.36,2.04][key],['green','oyster','teak','green'][key])
        F.planter(m,c,u-sign*1.25,length-.51,1.80,.62,.83,91+key*11)
        sub(m,c,lambda a,b:F.seat(a,b,0,0,1.58),u-sign*1.13,length-1.18,180)
        if key in (0,2):F.cafe_table(m,c,-sign*.68,2.0,.62,.37)
def walkshade(m,c,tx,tz,rot,width,reach):
    # A covered walkway can be entered from either side. Wall brackets leave base space below the outer eave.
    def frame(a,b):
        F.awning(a,b,0,.02,width,reach,2.72,True)
        for xx in (-width/2+.13,width/2-.13):
            F.tube(a,[(xx,2.06,.035),(xx,2.64,reach*.68)],.085,'brass')
            a.box(xx,2.00,.045,.19,.82,.085,'iron')
    sub(m,c,frame,tx,tz,rot)
def passages(slug,m,c):
    # Architectural arms toward each central walk leave an open side and a sheltered side.
    if slug=='sunward-wing':
        walkshade(m,c,1.57,4.65,0,3.07,2.48)
        secure(m,c,(2.53,4.62),(2.53,6.69),2.14)
        secure(m,c,(2.53,6.69),(3.55,6.69),2.14,'green')
        F.planter(m,c,1.68,6.25,.96,.55,.70,28)
    if slug=='south-villa':
        walkshade(m,c,1.49,3.40,0,3.18,2.54)
        secure(m,c,(2.48,3.37),(2.48,4.03),2.05)
        secure(m,c,(2.48,4.03),(5.25,4.03),2.05,'teak')
        F.planter(m,c,4.61,3.54,1.17,.63,.81,50)
    if slug=='seaward-wing':
        walkshade(m,c,-3.65,-.59,270,3.19,2.71)
    if slug=='azure-spa':
        walkshade(m,c,1.25,-3.15,180,3.09,2.74)
    if slug=='east-villa':
        secure(m,c,(-2.36,-3.36),(-2.36,-7.24),2.30)
        secure(m,c,(-2.36,-7.24),(-.48,-7.24),2.30,'green')
        sub(m,c,lambda a,b:F.seat(a,b,0,0,2.1),-1.99,-5.66,90)
        sub(m,c,lambda a,b:canopy(a,b,0,0,2.00,2.14,2.75),-1.38,-7.00)
        F.planter(m,c,-1.29,-6.68,1.07,.53,.86,62)
    if slug=='west-villa':
        secure(m,c,(2.24,3.36),(2.24,7.55),2.20,'oyster')
        secure(m,c,(2.24,7.55),(.47,7.55),2.20,'oyster')
        F.planter(m,c,1.31,7.05,1.13,.60,.78,48)
        sub(m,c,lambda a,b:F.seat(a,b,0,0,1.70),1.85,5.98,270)
def boundary(slug,m,c):
    # Property-line screens physically terminate on the board edge and spring from a solid entrance pier.
    spec={'north-villa':('x',-24,0,-1.68),'pool-equipment':('x',24,0,2.02),'laundry':('z',-24,180,-1.93),'cafe':('z',24,0,-1.81)}
    if slug not in spec:return
    axis,edge,side,along=spec[slug];w,d,_,_=dims[slug];x,z=origin(side,w,d,along);p=poses[slug];wx,wz=world(slug,x,z)
    # Work in world coordinates first; end face must be exactly on the table edge.
    if axis=='x':a=(wx,wz);b=(edge,wz)
    else:a=(wx,wz);b=(wx,edge)
    bias=.016 if edge>0 else -.016
    if axis=='x':a=(a[0]-bias,a[1])
    else:a=(a[0],a[1]-bias)
    def inv(pt):return transform(0,0,-p['rot'],pt[0]-p['x'],pt[1]-p['z'])
    secure(m,c,inv(a),inv(b),2.12,'oyster',.31)

# A delivery yard grows from the back of the laundry. The opposite guest garden
# opens off the villa's solid middle bay. These polygons are in building space.
deployment_paving={
    'laundry':[(-2.83,3.48),(2.85,3.48),(3.08,8.75),(2.96,11.90),(1.18,12.78),(-3.39,12.78),(-3.39,6.84),(-2.83,6.08)],
    'east-villa':[(-3.23,-.98),(-5.29,-1.08),(-7.29,-1.63),(-9.36,-1.63),(-10.66,.34),(-10.66,3.70),(-9.62,4.68),(-6.54,4.68),(-6.40,2.35),(-5.13,.90),(-3.23,.90)]}

def linen_yard(m,c):
    quay=[(-2.57,3.62),(-2.57,6.17),(-3.10,6.97),(-3.10,12.41),(.50,12.41)]
    for a,b in zip(quay,quay[1:]):secure(m,c,a,b,2.32,'oyster')
    secure(m,c,(2.64,8.83),(2.64,11.05),2.18,'iron')
    # Lockers, trolley and a shallow service canopy face the loading apron.
    def lockers(q,v):
        q.rounded(0,.08,.0,3.36,1.82,.70,.07,'iron')
        v.box(0,.02,0,3.38,1.90,.71,'limestone')
        for xx in (-1.09,0,1.09):
            q.rounded(xx,.19,.359,1.034,1.55,.040,.033,'green')
            for yy in (1.35,1.45,1.55):q.box(xx,yy,.389,.70,.025,.030,'steel',False)
            q.box(xx+.34,.72,.410,.051,.23,.080,'brass',False)
        q.box(0,2.13,.21,3.73,.105,1.09,'steel')
        for xx in (-1.30,1.30):q.beam((xx,1.87,-.17),(xx,2.13,.62),.061,'iron')
        v.box(0,2.13,.21,3.73,.105,1.09,'bronze')
    sub(m,c,lockers,-2.52,9.86,90)
    def cart(q,v):
        q.historic(B.trolley(True),0,0,.54,.035)
        v.box(0,.03,0,1.01,1.07,.65,'wood')
    sub(m,c,cart,-1.61,11.78,0)
    F.plaque(m,-.41,1.12,12.218,-1,.90,.48,'linen')

def villa_garden(m,c):
    back=[(-3.36,.49),(-5.22,1.11),(-6.81,2.62),(-6.81,4.35),(-9.42,4.35),(-10.36,3.52),(-10.36,.50)]
    for a,b in zip(back,back[1:]):secure(m,c,a,b,2.26,'oyster')
    secure(m,c,(-3.36,-.79),(-4.61,-.79),1.95,'oyster')
    secure(m,c,(-8.92,-1.47),(-7.67,-1.47),2.10,'green')
    secure(m,c,(-7.67,-1.47),(-7.08,-.74),2.10,'green')
    # A teak trellis and the irrigated bed share the garden's high western wall.
    def trellis(q,v):
        for xx in np.linspace(-.96,.96,5):q.box(xx,.50,0,.048,1.58,.055,'teak',False)
        for yy in np.linspace(.61,1.91,5):q.box(0,yy,.041,2.14,.045,.044,'teak',False)
        F.planter(q,v,0,.38,2.24,.55,.67,122)
        F.tube(q,[(-1.03,.22,.69),(-1.03,.52,.69),(-.77,.52,.69)],.043,'copper')
    sub(m,c,trellis,-10.13,2.02,90)
    sub(m,c,lambda q,v:F.seat(q,v,0,0,1.86),-8.15,4.05,180)
    F.planter(m,c,-8.19,-1.12,1.16,.36,.56,134)
    # An evergreen in a glazed pot rises above the privacy screen. Its light
    # foliage stays out of the movement collider.
    tx,tz=-9.49,3.41
    m.cyl(tx,.015,tz,.25,.62,'sea',20,r2=.41)
    m.cyl(tx,.635,tz,.42,.09,'oyster',20)
    m.cyl(tx,.725,tz,.36,.024,'soil',20)
    c.cyl(tx,0,tz,.41,.75,'limestone',16)
    m.beam((tx,.74,tz),(tx+.025,2.20,tz-.02),.11,'teak')
    c.box(tx,.73,tz,.16,1.40,.16,'wood')
    rng=np.random.default_rng(118)
    for j in range(11):
        angle=j*2.39996;reach=.36+.20*(j%3)/2
        tip=np.array([tx+reach*math.cos(angle),2.12+.41*math.sin(j*1.61),tz+reach*math.sin(angle)])
        m.beam((tx,1.30+.055*j,tz),tip,.052,'teak')
        for i in range(18):
            a=rng.uniform(0,2*math.pi);sx,sz=math.cos(a),math.sin(a)
            base=tip+[rng.uniform(-.22,.22),rng.uniform(-.20,.23),rng.uniform(-.22,.22)]
            end=base+np.array([sx*.23,rng.uniform(.04,.18),sz*.23])
            cross=np.array([-sz,0,sx])*.079;mid=base*.45+end*.55
            ridge=mid+np.array([0,.042,0]);shade=('leaf','blueleaf','newleaf')[(i+j)%3]
            for poly in ([base,mid-cross,ridge],[mid-cross,end,ridge],[end,mid+cross,ridge],[mid+cross,base,ridge]):
                m.outward(poly,shade,[0,1,0])

def make(slug):
    m=F.Surface();c=M()
    furniture(slug,m,c);x,z,angle=frame(slug);m=m.moved(x=x,z=z,rot=angle);c=c.moved(x=x,z=z,rot=angle)
    boundary(slug,m,c);passages(slug,m,c)
    if slug=='laundry':linen_yard(m,c)
    if slug=='east-villa':villa_garden(m,c)
    contact=mesh_from_obj(OUT/(slug+'-2.obj')) if slug!='pool' else None
    name=slug+'-court';out,trim=clean(m,bottom=True,other=contact);v,f=A.export(out,OUT/(name+'.obj'));write_collision(c,OUT/(name+'-col.obj'))
    print(name,v,f,trim,flush=True);return [slug,v,f,trim]
if __name__=='__main__':
    # Decking is inlaid on the mat. The fitted walls and forecourts have one exposed finish.
    F.apron=lambda *a:None;F.spine=lambda *a:None
    base_plaque=F.plaque
    def plaque(m,x,y,z,normal,w,h,k):
        if normal<0 and z<0:return
        base_plaque(m,x,y,z,normal,w,h,k)
    F.plaque=plaque
    give_sheets_thickness(F.Surface);give_sheets_thickness(M)
    selection=sys.argv[1:] or list(sites)
    with ProcessPoolExecutor(max_workers=4) as jobs:stats=list(jobs.map(make,selection))
    if len(selection)==len(sites):write(ROOT/'Review/courts.json',stats)
