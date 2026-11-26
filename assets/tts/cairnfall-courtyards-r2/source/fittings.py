"""Fixed courtyard assemblies. Coordinates are X, Z and height in tabletop inches."""
import math
import numpy as np
from finishes import NAMES
from mesh import Mesh

def block(g,p,size,mat,solid=False,r=.0):
    g.box(p,size,mat,r=r,b=min(.018, r*.43),n=1,physical=solid)

def rect(g,x0,x1,z0,z1,h0,h1,mat,solid=False):
    block(g,((x0+x1)/2,(z0+z1)/2,(h0+h1)/2),(x1-x0,z1-z0,h1-h0),mat,solid)

def pole(g,a,b,r,mat='iron',n=8,solid=False):
    g.tube(a,b,r,mat,n,physical=solid)

def label(g,x,z,h,w,hh,mat,plus=True):
    face=[(x+w/2,z,h-hh/2),(x-w/2,z,h-hh/2),(x-w/2,z,h+hh/2),(x+w/2,z,h+hh/2)] if plus else [(x-w/2,z,h-hh/2),(x+w/2,z,h-hh/2),(x+w/2,z,h+hh/2),(x-w/2,z,h+hh/2)]
    g.surface(face,[[0,1,2,3]],mat,manual=[[(0,0),(1,0),(1,1),(0,1)]])

def masonry(g,x,z,w,d,height,axis='x'):
    # End posts, wall core and individual coping stones leave visible capping joints.
    side=g.at((x,z,0),(0,0,90 if axis=='z' else 0))
    rect(side,-w/2,w/2,-d/2,d/2,.0,height-.12,'stone',True)
    n=max(2,round(w/.88))
    for j in range(n):
        a=-w/2+j*w/n+.008;b=-w/2+(j+1)*w/n-.008
        rect(side,a,b,-d/2-.038,d/2+.038,height-.115,height,'slate',True)
    for a in [-w/2+.11,w/2-.11]:
        block(side,(a,0,.16),(.25,d+.08,.31),'stone')

def post(g,x,z,h):
    block(g,(x,z,.12),(.31,.31,.24),'stone',True,.02)
    rect(g,x-.084,x+.084,z-.084,z+.084,.23,h,'oak',True)
    block(g,(x,z,h-.18),(.20,.20,.09),'iron')

def dresser(g,x,z,w,d,h,mat='boards'):
    block(g,(x,z,h/2),(w,d,h),mat,True,.035)
    block(g,(x,z,h+.034),(w+.08,d+.08,.075),'oak',False,.02)
    for j in (-1,1):block(g,(x+j*(w/2-.09),z+d/2+.014,h/2),(.09,.035,h-.05),'oak')

def pent(g,x,z,w,d,height,cladding='patina',angle=-8):
    r=g.at((x,z,height),(angle,0,0))
    block(r,(0,0,0),(w,d,.104),cladding,True,.025)
    for xx in np.linspace(-w/2+.13,w/2-.13,max(4,round(w/.48))):
        rect(r,xx-.014,xx+.014,-d/2+.023,d/2-.023,.051,.079,'brass' if cladding=='patina' else 'slate')
    for zz in [-d/2+.075,d/2-.075]:block(r,(0,zz,-.108),(w-.05,.11,.109),'oak')
    pole(r,(-w/2,d/2,-.03),(w/2,d/2,-.03),.042,'iron',8)

def cases(g,x,z,h,w=.76,d=.53,mat='boards'):
    block(g,(x,z,h+.27),(w,d,.54),mat,True,.034)
    for xx in [-w*.32,w*.32]:
        block(g,(x+xx,z,h+.546),(.05,d+.012,.018),'iron')
        block(g,(x+xx,z+d/2+.009,h+.27),(.05,.022,.53),'iron')
    block(g,(x,z+d/2+.026,h+.33),(.117,.036,.06),'brass')
def book(g,x,z,h,w,d,colour):
    block(g,(x,z,h+.052),(w-.025,d-.024,.085),'linen')
    for zz in [.006,.102]:block(g,(x,z,h+zz),(w,d,.022),colour,False,.008)
    block(g,(x-w/2+.012,z,h+.05),(.034,d,.097),colour)
def tub(g,x,z,r,h,mat='boards',closed=False):
    radii=[(.0,r*.83),(.06,r*.88),(h*.6,r),(h,r*.94)]
    n=14
    def ring(z0,rr):return [(x+rr*math.cos(2*math.pi*i/n),z+rr*math.sin(2*math.pi*i/n),z0)for i in range(n)]
    outer=[ring(level,rad)for level,rad in radii]
    if closed:g.rings(outer,mat,physical=True,smooth=False)
    else:
        g.solid(sum(outer,[]))
        for a,b in zip(outer,outer[1:]):
            for i in range(n):g.surface([a[i-1],a[i],b[i],b[i-1]],[[0,1,2,3]],mat)
        g.rings([ring(h-.105,r*.85),ring(h-.10,r*.85)],'soil')
    for z0,rad in [(h*.20,r*.934),(h*.73,r*.997)]:
        for i in range(n):
            p=ring(z0,rad+.005);pole(g,p[i-1],p[i],.023,'iron',5)
def roof_prop(g,x,z,lean=0):
    for side in [-1,1]:pole(g,(x,z,1.74),(x+side*.37,z,2.15+.02*lean),.058,'oak',6)

def laundry():
    g=Mesh('laundry-yard')
    # Both ends meet working-yard walls. One passage stays open around the wringer.
    masonry(g,0,-.97,3.46,.35,2.00)
    masonry(g,-1.61,-.11,1.44,.37,1.64,'z')
    for x in [-1.29,1.37]:post(g,x,.17,2.31)
    pole(g,(-1.29,.17,2.24),(.12,.21,2.13),.014,'canvas',6);pole(g,(.12,.21,2.13),(1.37,.17,2.24),.014,'canvas',6)
    for i,(x,w,h,mat) in enumerate([(-.92,.53,.90,'linen'),(-.19,.65,1.04,'linen'),(.75,.49,.69,'canvas')]):
        v=[];faces=[]
        for j in range(11):
            u=j/10;zz=.17+.045*math.sin(u*2*math.pi+i);top=2.17+.04*abs(x);low=top-h+.046*math.cos(u*4.4+i)
            v.extend([(x+w*(u-.5),zz,top),(x+w*(u-.5),zz+.065*math.sin(u*math.pi*4),low)])
            if j:faces.extend([[2*j-2,2*j-1,2*j+1,2*j],[2*j,2*j+1,2*j-1,2*j-2]])
        g.surface(v,faces,mat)
        for xx in [x-w*.33,x+w*.33]:block(g,(xx,.17,2.18),(.037,.049,.10),'oak')
    tub(g,.90,-.38,.345,.56)
    for x in [.64,1.14]:pole(g,(x,-.36,.45),(x,-.36,1.10),.034,'iron')
    for z in [.89,1.02]:pole(g,(.65,-.36,z),(1.14,-.36,z),.065,'oak',12)
    pole(g,(1.14,-.36,1.02),(1.28,-.36,1.02),.024,'iron');pole(g,(1.28,-.36,1.02),(1.28,-.36,.87),.022,'iron')
    return g

def refectory():
    g=Mesh('refectory-stores')
    masonry(g,-1.42,.0,2.65,.37,2.25,'z')
    masonry(g,-.10,-1.18,2.85,.355,2.12)
    dresser(g,-.22,-.70,2.02,.52,.41)
    for j,x in enumerate([-.86,-.26,.35]):
        block(g,(x,-.70,.70),(.55,.50,.51),'grain',True,.115)
        block(g,(x+.02,-.69,1.00),(.47,.405,.17),'grain',True,.07)
        pole(g,(x-.17,-.53,1.03),(x+.15,-.52,1.04),.014,'oak',6)
    for x in [-1.21,1.06]:post(g,x,.14,2.06)
    pent(g,-.12,-.56,2.95,1.80,2.33,'slate')
    block(g,(-.15,.24,1.88),(1.20,.07,.44),'oak');label(g,-.15,.28,1.88,1.13,.41,'stores')
    c=g.at((.93,.69,.0),(0,0,-17));block(c,(0,0,.42),(.83,1.0,.12),'boards',True,.022)
    for x in [-.50,.50]:
        c.hoop((x,0,.29),(1,0,0),.251,.033,'iron',14,6)
        pole(c,(x-.045,0,.29),(x+.045,0,.29),.052,'iron',8)
        for j in range(6):
            a=j*math.pi/3;pole(c,(x,0,.29),(x,.244*math.cos(a),.29+.244*math.sin(a)),.015,'oak',5)
    cases(c,0,-.11,.49,.70,.54)
    for x in [-.315,.315]:pole(c,(x,.32,.44),(x,1.01,.70),.031,'oak',7)
    return g

def archive():
    g=Mesh('archive-receiving')
    masonry(g,1.47,-.16,2.83,.34,2.25,'z')
    masonry(g,.03,-1.40,2.60,.34,2.43)
    dresser(g,.04,-.92,2.39,.59,.92)
    for x in [-1.16,1.20]:post(g,x,-.02,2.10)
    pent(g,.04,-.67,2.97,1.79,2.38,'patina')
    for x in [-.86,-.24]:
        book(g,x,-.80,.97,.51,.35,'green');book(g,x+.03,-.80,1.09,.47,.34,'oak')
    block(g,(.58,-.78,1.05),(.73,.43,.20),'oak',True,.04)
    block(g,(.58,-.78,1.17),(.74,.44,.07),'boards',False,.022)
    for x in [.37,.79]:block(g,(x,-.54,1.07),(.045,.03,.16),'brass')
    block(g,(-.05,.176,1.96),(1.21,.065,.45),'oak');label(g,-.05,.211,1.96,1.16,.415,'books')
    cases(g,.83,.55,.0,.70,.58,'green')
    return g

def potting():
    g=Mesh('potting-yard')
    masonry(g,-.02,-1.03,4.31,.36,2.20)
    masonry(g,-2.00,-.24,1.35,.35,1.73,'z')
    dresser(g,-.68,-.61,2.14,.59,.89)
    for j,x in enumerate([-1.35,-.96,-.53,-.17]):
        n=8;r=.108 if j%2 else .137;hh=.22 if j%2 else .27
        g.tube((x,-.60,.935),(x,-.60,.935+hh),r*.71,'grain',n,r2=r)
        g.tube((x,-.60,.935+hh),(x,-.60,.948+hh),r*.82,'soil',n)
    tub(g,1.43,-.44,.38,.99,'boards',True)
    pole(g,(.53,-.82,1.89),(1.48,-.82,1.87),.034,'patina')
    pole(g,(1.48,-.82,1.87),(1.48,-.61,1.10),.033,'patina')
    # A tilted cold-frame lid and seed trays. Minimum movement clearance is measured around the solid base.
    c=g.at((-.57,.75,.0),(0,0,-4))
    block(c,(0,0,.25),(1.70,.83,.50),'boards',True,.02)
    lid=c.at((0,0,.55),(-12,0,0))
    block(lid,(0,0,0),(1.64,.78,.045),'patina')
    for x in [-.84,0,.84]:block(lid,(x,0,.030),(.052,.84,.06),'oak')
    for y in [-.397,.397]:block(lid,(0,y,.035),(1.72,.048,.057),'oak')
    return g

def shrine():
    g=Mesh('pilgrim-shrine')
    # A niche carved in an actual masonry recess, with stone voussoirs and a solid rear wall.
    rect(g,-1.73,1.73,-.73,-.40,0,2.38,'stone',True)
    for x in [-1.42,1.42]:block(g,(x,-.06,1.04),(.61,.77,2.08),'stone',True)
    masonry(g,-1.56,.68,1.48,.33,1.66,'z')
    block(g,(0,-.13,.32),(2.23,.77,.64),'stone',True,.055)
    n=11;ri=.89;ro=1.25;spring=1.24
    for i in range(n):
        a=i*math.pi/n+.002;b=(i+1)*math.pi/n-.002
        ring=[(rr*math.cos(ang),spring+rr*math.sin(ang))for ang,rr in [(a,ri),(a,ro),(b,ro),(b,ri)]]
        verts=[(x,z,h)for z in [-.37,.29]for x,h in ring]
        g.surface(verts,[[3,2,1,0],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],'stone',True)
    block(g,(0,-.368,1.55),(1.28,.065,1.21),'brass');label(g,0,-.329,1.55,1.18,1.13,'shrine')
    for x in [-.60,-.25,.36,.64]:
        h=.25 if x>0 else .16
        pole(g,(x,.04,.65),(x,.04,.71),.112,'brass',10)
        pole(g,(x,.04,.71),(x,.04,.71+h),.074,'linen',10)
        pole(g,(x,.04,.71+h),(x,.04,.75+h),.010,'iron',5)
    for x in [-1.38,1.38]:block(g,(x,-.07,2.12),(.70,.84,.12),'slate',True,.028)
    block(g,(0,.63,.13),(1.9,.42,.26),'stone',True,.04)
    return g

def cistern():
    g=Mesh('header-cistern')
    # Squat copper-jacketed header tank on a continuous limestone plinth with a readable valve face.
    block(g,(0,0,.26),(2.65,2.43,.52),'stone',True,.13)
    levels=[(.50,1.08),(.61,1.19),(2.20,1.19),(2.36,1.11),(2.51,.33)]
    rings=[[(r*math.cos(j*2*math.pi/20),r*math.sin(j*2*math.pi/20),h)for j in range(20)]for h,r in levels]
    g.rings(rings,'patina',physical=True,smooth=True)
    for h in [.74,1.45,2.17]:g.hoop((0,0,h),(0,0,1),1.193,.027,'iron',20,6)
    for j in range(12):
        a=j*math.pi/6
        for h in [.75,2.17]:
            p=(1.20*math.cos(a),1.20*math.sin(a),h)
            g.tube(p,(p[0]*1.024,p[1]*1.024,h),.030,'brass',6)
    pole(g,(0,0,2.5),(0,0,2.59),.31,'iron',14)
    g.path([(.25,-1.11,1.18),(.25,-1.55,1.18),(1.47,-1.55,1.18),(1.47,-1.55,.38),(1.77,-1.55,.38)],.102,'patina',10)
    g.hoop((.88,-1.57,1.49),(0,1,0),.196,.026,'brass',14,6)
    pole(g,(.88,-1.53,1.15),(.88,-1.53,1.49),.043,'iron',8)
    for i in range(5):
        a=i*2*math.pi/5;pole(g,(.88,-1.57,1.49),(.88+.18*math.sin(a),-1.57,1.49+.18*math.cos(a)),.013,'brass',6)
    return g

def porter():
    g=Mesh('gate-porters')
    masonry(g,.14,-.92,3.98,.35,2.00)
    masonry(g,1.97,-.15,1.34,.35,1.83,'z')
    dresser(g,-.23,-.50,2.32,.55,.39)
    for x in [-1.34,1.10]:post(g,x,.33,2.03)
    pent(g,-.12,-.29,3.02,1.72,2.24,'patina')
    cases(g,-.82,-.46,.43,.85,.49,'green');cases(g,.25,-.46,.43,.89,.48)
    cases(g,.23,-.46,.97,.64,.39,'canvas')
    cases(g,1.32,.35,.0,.66,.55,'green')
    return g

def nursery():
    g=Mesh('dispensary-nursery')
    masonry(g,-.19,.87,3.78,.38,1.71)
    # Continuous lapped oak boards screen the nursery. The tops step down toward the rock garden.
    for j in range(14):
        x=-1.65+j*.214;h=2.32-.28*(j/13)
        rect(g,x,x+.211,.615,.691,1.49,h,'boards',True)
    for x in [-1.66,-.15,1.23]:post(g,x,.695,2.28 if x<0 else 2.03)
    rect(g,-1.60,1.26,-.41,.36,.0,.40,'stone',True);rect(g,-1.52,1.18,-.34,.30,.399,.431,'soil')
    for j in range(8):
        for k in range(2):
            x=-1.29+j*.315;y=-.17+k*.28;h=.18+.075*math.sin(j*2.4+k)
            for a in [.1,2.2,4.36]:
                dx=.112*math.cos(a);dy=.094*math.sin(a)
                g.tube((x,y,.43),(x+dx,y+dy,.43+h),.050,'green',6,r2=.012)
    for x in [1.54,1.83]:
        g.tube((x,-.31,.01),(x,-.31,.40),.13,'grain',9,physical=True,r2=.196)
        g.tube((x,-.31,.40),(x,-.31,.409),.162,'soil',9)
    return g

def woodstore():
    g=Mesh('fuel-store')
    masonry(g,0,-.61,3.38,.30,1.95)
    for x in [-1.49,1.49]:post(g,x,.35,1.90)
    pent(g,0,-.11,3.62,1.55,2.12,'slate')
    for x in [-1.31,1.31]:rect(g,x-.052,x+.052,-.55,.48,.22,1.82,'oak',True)
    # Billets run toward the open front, with cut end grain and natural stacking gaps.
    g.solid([(-1.23,-.51,.12),(1.23,-.51,.12),(-1.23,.35,.12),(1.23,.35,.12),(-1.03,-.51,1.18),(1.03,-.51,1.18),(-1.03,.35,1.18),(1.03,.35,1.18)])
    for row in range(5):
        for j in range(10-(row%2)):
            x=-1.12+j*.245+(row%2)*.12;h=.23+row*.209;z=.29+.052*math.sin(j*3.31+row)
            pole(g,(x,-.45,h),(x,z,h),.132,'oak',7)
            pole(g,(x,z+.001,h),(x,z+.013,h),.123,'grain',7)
    return g

def waiting():
    g=Mesh('clinic-rest')
    masonry(g,-.54,0,2.92,.37,2.13)
    masonry(g,1.40,0,.92,.37,1.78)
    for x in [-1.38,.13]:
        block(g,(x,.34,.225),(.20,.44,.45),'stone',True,.033)
    for y in [.255,.42,.582]:block(g,(-.59,y,.525),(2.03,.14,.09),'oak',True,.017)
    for h in [.77,.99]:block(g,(-.59,.209,h),(2.03,.095,.125),'oak',False,.018)
    pole(g,(1.35,.202,1.08),(1.35,.223,1.08),.236,'patina',16)
    block(g,(1.35,.232,1.08),(.084,.029,.31),'brass')
    block(g,(1.35,.251,1.08),(.29,.022,.082),'brass')
    return g

def filters():
    g=Mesh('pump-filters')
    # Pipework follows a protected service channel from the pump's blank stone shoulder.
    masonry(g,-.15,0,3.50,.38,1.88)
    masonry(g,1.69,-.38,1.10,.33,1.50,'z')
    rect(g,-1.56,1.38,.205,.89,0,.31,'stone',True)
    for x in [-.97,.27]:
        g.tube((x,.52,.32),(x,.52,1.27),.32,'patina',12,True)
        g.tube((x,.52,1.27),(x,.52,1.39),.322,'iron',12,r2=.19)
        g.hoop((x,.52,1.05),(0,0,1),.323,.025,'brass',12,6)
        pole(g,(x,.52,1.38),(x,.52,1.47),.10,'brass',8)
    pole(g,(-1.51,.76,.51),(1.55,.76,.51),.071,'iron',9)
    g.path([(1.55,.76,.51),(1.55,.84,.51),(2.14,.84,.51),(2.14,.84,.12)],.077,'patina',9)
    for x in [-1.34,1.16]:
        g.hoop((x,.83,.84),(0,1,0),.144,.022,'brass',12,5)
        pole(g,(x,.78,.50),(x,.78,.84),.043,'iron',8)
    return g

if __name__=='__main__':
    for create in (laundry,refectory,archive,potting,shrine,cistern,porter,nursery,woodstore,waiting,filters):
        create().write()
