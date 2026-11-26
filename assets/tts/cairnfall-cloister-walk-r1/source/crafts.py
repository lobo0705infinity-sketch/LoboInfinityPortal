"""Cairnfall site fittings. Local coordinates are tabletop X, Z and height, in inches."""
import math
import numpy as np
from mesh import Mesh
from materials import OUT

def block(g,p,size,mat,solid=False,r=0):
    g.box(p,size,mat,r=r,b=min(r*.5,.015),n=1,physical=solid)
def placard(g,p,w,h,face,mat):
    dx,dy={'north':(-1,0),'south':(1,0),'east':(0,1),'west':(0,-1)}[face]
    verts=[(p[0]+dx*a*w/2,p[1]+dy*a*w/2,p[2]+b*h/2)for a,b in [(-1,-1),(1,-1),(1,1),(-1,1)]]
    g.surface(verts,[[0,1,2,3]],mat,manual=[[(0,0),(1,0),(1,1),(0,1)]])
def rect(g,x0,x1,z0,z1,h0,h1,material,solid=False):
    block(g,((x0+x1)/2,(z0+z1)/2,(h0+h1)/2),(x1-x0,z1-z0,h1-h0),material,solid)
def rail(g,a,b,r,mat,n=8):g.tube(a,b,r,mat,n)
def porch():
    # Global origin (17,4,-6.4). Terrace top and ramp crest are .75 above grade.
    g=Mesh('patient-receiving');deck=.75
    rect(g,4.401,6.71,-6.100,1.61,0,deck,'stone',True)
    rect(g,1.384,4.399,.552,1.61,0,deck,'stone',True)
    rect(g,-3.26,-1.385,.552,2.00,0,deck,'stone',True)
    # Stone threshold rising from the widened landing to the original interior floor.
    # The clinic floor is exactly .25 higher and begins at world Z=-6.50.
    g.surface([(-.86,-.10,.75),(.86,-.10,.75),(.86,1.0,.75),(-.86,1.0,.75),
               (-.86,-.10,1.00),(.86,-.10,1.00),(.86,1.0,.756),(-.86,1.0,.756)],
              [[3,2,1,0],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]],'stone',True)
    # A narrow coping sits on the outside edge, clear of the original ramp and public stair.
    for z in np.arange(-5.91,1.39,.53):
        rect(g,6.59,6.71,z,z+.49,.75,.80,'slate')
    for x,y in [(6.53,-5.70),(6.53,-3.70),(6.53,-1.69),(6.53,.53)]:
        block(g,(x,y,1.28),(.092,.096,1.05),'green',True,.012)
        block(g,(x,y,.802),(.18,.17,.098),'iron')
    for h in (1.18,1.77):
        rail(g,(6.53,-5.71,h),(6.53,.54,h),.041,'bronze',10)
    # Permanent columns on the flanks, leaving the full native stair width free.
    for x,z,foot in [(-2.85,1.72,.75),(3.82,1.42,.75),(-2.86,.19,.75)]:
        rect(g,x-.133,x+.133,z-.14,z+.14,foot,foot+.14,'stone',True)
        rect(g,x-.073,x+.073,z-.075,z+.075,foot+.14,3.00,'oak',True)
        rect(g,x-.094,x+.094,z-.10,z+.10,2.87,3.02,'bronze')
        for dz in (-.081,.081):rail(g,(x,z+dz,2.76),(x,z+dz,2.81),.022,'edge',6)
    # The stretcher hangs vertically below a modest privacy screen in the equipment bay.
    rect(g,-3.20,-3.07,.49,1.93,.76,2.47,'green',True)
    for y in np.linspace(.54,1.87,8):rect(g,-3.055,-3.033,y,y+.034,.82,2.40,'oak')
    block(g,(-2.965,1.13,1.55),(.115,.68,1.42),'canvas',True,.050)
    for y in (.76,1.50):
        rail(g,(-2.90,y,.82),(-2.90,y,2.38),.032,'edge',9)
        for h in (.82,2.26):rail(g,(-2.90,y,h),(-2.90,y,h+.13),.045,'bronze',8)
    for h in (1.20,1.88):rect(g,-2.894,-2.865,.76,1.50,h,h+.052,'oak')
    # Four swivel casters, bumpers, a canvas hamper and a pile of folded sheets.
    cart=g.at((-2.03,1.06,.754),(0,0,-7))
    for x in (-.345,.345):
        for y in (-.238,.238):
            rail(cart,(x-.044,y,.116),(x+.044,y,.116),.103,'iron',12)
            rail(cart,(x-.060,y,.116),(x+.060,y,.116),.045,'edge',9)
            rect(cart,x-.034,x+.034,y-.035,y+.035,.16,.275,'bronze')
    block(cart,(0,0,.292),(.91,.66,.084),'green',True,.04)
    block(cart,(0,0,.59),(.81,.56,.5),'canvas',True,.07)
    for x in (-.448,.448):
        for y in (-.30,.30):rail(cart,(x,y,.29),(x,y,.94),.023,'edge')
        rail(cart,(x,-.30,.94),(x,.30,.94),.030,'edge')
    for y in (-.30,.30):rail(cart,(-.448,y,.875),(.448,y,.875),.025,'edge')
    for i in range(4):
        sub=cart.at((.032*math.sin(i),.014*math.cos(i),.889+i*.059),(0,0,(-1)**i*6))
        block(sub,(0,0,0),(.64-.019*i,.435,.068),'linen',False,.026)
        rect(sub,-.29,.28,.211,.219,-.010,.004,'paper')
    return g

def roof():
    g=Mesh('receiving-canopy')
    for x in (-2.85,3.82):
        for a,b in [((x,1.46,2.51),(x,.98,3.09)),((x,.20,2.61),(x,.66,3.12))]:rail(g,a,b,.067,'oak',6)
    for z,h in [(.06,3.25),(1.70,3.02)]:block(g,(.49,z,h),(7.20,.14,.17),'oak',True,.012)
    # Standing seams follow the fall into the gutter. Separate cut copper sheets weather independently.
    sub=g.at((.49,.89,3.29),(-7.5,0,0))
    block(sub,(0,0,0),(7.30,2.25,.105),'patina',True,.017)
    for i in range(15):
        x=-3.63+i*.518
        if x<3.63:rect(sub,x,x+.030,-1.115,1.115,.051,.10,'bronze')
    for x in (-3.64,3.64):rect(sub,x-.019,x+.019,-1.15,1.15,-.07,.10,'bronze')
    rail(g,(-3.17,2.012,3.101),(4.15,2.012,3.101),.057,'patina',10)
    for x in (-2.93,-1.31,.31,1.94,3.73):rail(g,(x,1.96,3.07),(x,2.014,3.12),.037,'bronze',7)
    for x in (-.71,.71):rect(g,x-.024,x+.024,1.79,1.84,2.68,3.04,'bronze')
    block(g,(0,1.85,2.68),(1.95,.074,.48),'green',False,.024);placard(g,(0,1.89,2.68),1.89,.445,'north','clinic')
    for x in (-.95,.95):rail(g,(x,1.89,2.68),(x,1.912,2.68),.015,'bronze',6)
    return g

def fountain():
    # World origin on the guesthouse wall centerline. Vitreous spout and limestone bowl face east.
    g=Mesh('well-court-fountain')
    rect(g,.264,.365,-.69,.69,.10,1.52,'slate',True)
    rect(g,.367,1.00,-.76,.76,.07,.19,'stone',True)
    rect(g,.377,.53,-.68,.68,.18,.71,'stone',True)
    for z in (-.675,.675):block(g,(.733,z,.42),(.52,.135,.46),'stone',True,.03)
    block(g,(.952,0,.42),(.138,1.43,.46),'stone',True,.029)
    rect(g,.505,.887,-.60,.60,.244,.253,'patina')
    for y in (-.22,.22):
        rail(g,(.365,y,1.06),(.565,y,1.06),.052,'bronze',11);rail(g,(.565,y,1.08),(.565,y,.98),.047,'bronze',9)
        rail(g,(.448,y,1.06),(.448,y,1.19),.019,'iron',8);rail(g,(.448,y-.075,1.19),(.448,y+.075,1.19),.024,'bronze',8)
    block(g,(.375,0,1.39),(.030,.94,.273),'green',False,.01)
    placard(g,(.393,0,1.39),.91,.253,'east','water')
    return g

def drying():
    g=Mesh('physic-herb-rack')
    for z in (-.82,.82):
        rect(g,-.30,-.19,z-.05,z+.05,0,1.94,'oak',True)
        rect(g,.12,.22,z-.05,z+.05,0,1.80,'oak',True)
    rect(g,-.31,-.22,-.84,.84,.22,1.81,'oak',True)
    for h in (.34,.69,1.04):
        rect(g,-.24,.23,-.83,.83,h,h+.048,'willow',True)
        rect(g,.195,.24,-.85,.85,h+.05,h+.125,'oak')
        for z in np.arange(-.76,.81,.14):rect(g,-.22,.185,z,z+.026,h+.049,h+.070,'willow')
    hood=g.at((-.04,0,1.91),(0,7.,0))
    block(hood,(0,0,0),(.76,1.98,.094),'slate',True,.015)
    rail(g,(-.05,-.82,1.69),(-.05,.82,1.69),.025,'bronze')
    for n,z in enumerate([-.56,-.23,.12,.45,.63]):
        rail(g,(-.05,z,1.69),(.048,z,1.56),.010,'linen',5)
        for j in range(5):
            a=j*2.40+.44*n;u=.095*math.cos(a);v=.086*math.sin(a);h=1.31-.022*((n+j)%3)
            rail(g,(.048,z,1.56),(.065+u,z+v,h),.010,'willow',5)
            g.tube((.065+u,z+v,h+.06),(.065+1.05*u,z+1.05*v,h-.046),.038,'green',6,r2=.013)
    block(g,(.21,0,.84),(.030,.91,.23),'green');placard(g,(.227,0,.84),.88,.21,'east','herbs')
    return g

if __name__=='__main__':
    for f in (porch,roof,fountain,drying):f().write()
