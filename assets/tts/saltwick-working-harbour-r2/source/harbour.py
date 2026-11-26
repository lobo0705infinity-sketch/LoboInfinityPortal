"""Working waterfront terrain in local (table X, table Z, height) inches."""
import math
import numpy as np
from mesh import Mesh
from props import bent_wire
from fleet import block, face, label, box_beam

def outward(g,verts,normal,material,physical=False):
    a=np.array(verts);inds=list(range(len(a)))
    if np.dot(np.cross(a[1]-a[0],a[2]-a[0]),normal)<0:inds.reverse()
    g.surface(a,[inds],material,physical=physical)

def rivet(g,p,side,r=.035,mat='bolt'):
    a=np.array(p);end=a+np.array(side)*.023
    g.tube(a,end,r,mat,8)

def slipway():
    g=Mesh('slipway-launch')
    stations=np.array([(-2.52,.56,.18),(-2.32,.83,.13),(-1.96,.94,.04),(-1.18,1.02,.0),(-.30,1.06,-.025),(.61,1.00,-.02),(1.23,.83,.025),(1.78,.60,.12),(2.22,.322,.24),(2.54,.045,.41)])
    def skin(i,f,side):
        x,r,sheer=stations[i]
        return (x,side*r*np.interp(f,[0,.18,.43,.72,1],[.02,.42,.74,.94,1]),.73+sheer*(.60+.40*f)+f*(1.13-.12*sheer))
    for s in (-1,1):
        for band,colour in enumerate(['redoxide','redoxide','hullblue','hullblue','hullblue','marinewhite']):
            f1,f2=band/6,(band+1)/6
            for i in range(len(stations)-1):
                verts=[skin(i,f1,s),skin(i+1,f1,s),skin(i+1,f2,s),skin(i,f2,s)]
                outward(g,verts,(0,s,0),colour)
            pts=[(x,y+s*.013,h+.004)for x,y,h in (skin(i,f2,s) for i in range(len(stations)))]
            bent_wire(g,pts,.019 if band<5 else .050,'teak' if band==5 else colour,7)
        # Inner sheer, a short return at the stem and the full thickness of the gunwale.
        for i in range(len(stations)-1):
            v=[skin(i,.99,s),skin(i+1,.99,s)]
            a,b=v
            top=[(x,y-s*.072,h+.003)for x,y,h in v]
            outward(g,[a,b,top[1],top[0]],(0,0,1),'teak')
            inner=[(x,y-s*.11,h-.40)for x,y,h in v]
            outward(g,[top[0],top[1],inner[1],inner[0]],(0,-s,0),'boardgreen')
        for x in (-1.91,-1.15,-.31,.53,1.23):
            r=np.interp(x,stations[:,0],stations[:,1])
            bent_wire(g,[(x,s*r*.34,1.15),(x,s*r*.62,1.29),(x,s*r*.84,1.48),(x,s*r*.92,1.76)],.037,'teak',7)
    # Flat sole boards are clipped to the station widths; every board terminates inside the hull.
    for j in range(-3,4):
        y=j*.195
        xs=np.linspace(-2.25,2.12,24)
        viable=[xx for xx in xs if np.interp(xx,stations[:,0],stations[:,1])*.74>abs(y)+.095]
        if viable:block(g,((viable[-1]+viable[0])/2,y,1.24),(viable[-1]-viable[0],.186,.090),'plywood' if j%3 else 'teak',.009)
    for x in (-1.62,.69):
        w=np.interp(x,stations[:,0],stations[:,1])*1.77
        block(g,(x,0,1.609),(.260,w,.095),'teak',.021)
        for y in (-w*.40,w*.40):block(g,(x,y,1.447),(.105,.091,.26),'boardgreen',.016)
    # A canvas-covered engine box, tied at the lower corners.
    x=-.36;rings=[]
    for z,w,d in ((1.26,.88,.83),(1.50,.91,.85),(1.67,.78,.76),(1.73,.56,.54)):
        rings.append([(x-w/2,-d/2,z),(x+w/2,-d/2,z+.008),(x+w/2,d/2,z),(x-w/2,d/2,z-.018)])
    g.rings(rings,'canvas',True,True)
    for xx in (-.64,-.10):bent_wire(g,[(xx,-.48,1.30),(xx,-.415,1.57),(xx,-.25,1.74),(xx,.27,1.74),(xx,.41,1.55),(xx,.46,1.30)],.018,'cable',6)
    fore=[(1.58,-.59,1.76),(1.91,-.41,1.85),(2.45,-.04,2.04),(2.45,.04,2.04),(1.91,.41,1.85),(1.58,.59,1.76)]
    outward(g,fore,(0,0,1),'boardgreen')
    for u,z in ((1.73,1.803),(1.90,1.852),(2.09,1.916)):
        w=np.interp(u,stations[:,0],stations[:,1])*.80;g.tube((u,-w,z),(u,w,z),.012,'darkwood',5)
    transom=[skin(0,k,s) for s in (-1,1)for k in ([1,.70,.32,.0] if s<0 else [0,.32,.70,1])]
    outward(g,transom,(-1,0,0),'hullblue')
    label(g,(-2.536,0,1.875),.74,.19,'left','boatname')
    for i in range(len(stations)-1):
        g.solid([skin(j,k,s)for j in (i,i+1)for k in (.04,.44,.96)for s in (-1,1)])
    bent_wire(g,[(-2.54,0,1.60),(-2.65,0,1.17),(-2.72,0,.90)],.040,'brass',7)
    block(g,(-2.67,0,1.09),(.23,.077,.38),'hullblue',.037)
    for x in (-2.0,1.58):
        for side in (-1,1):
            y=side*np.interp(x,stations[:,0],stations[:,1])*.93
            block(g,(x,y,1.93 if x<0 else 1.995),(.19,.056,.054),'brass',.014)
    # Gauge is measured between the bright rail heads in the mat (10.78 and 8.425).
    for x in (-1.55,1.38):
        block(g,(x,0,.411),(.245,2.58,.197),'iron',.025,True)
        g.tube((x,-1.26,.228),(x,1.26,.228),.102,'iron',12)
        for s in (-1,1):
            v=s*1.1775
            g.tube((x,v-.096,.23),(x,v+.096,.23),.228,'steel',18,True)
            g.tube((x,v-s*.080,.23),(x,v-s*.124,.23),.265,'iron',18)
            g.tube((x,v+s*.098,.23),(x,v+s*.131,.23),.096,'zinc',12)
            box_beam(g,(x,s*.96,.50),(x,s*.63,1.12),.18,.14,'redoxide',True)
            block(g,(x,s*.63,1.105),(.48,.18,.113),'darkwood',.028,True,rot=(-s*23,0,0))
    for s in (-1,1):block(g,(-.08,s*.96,.536),(3.67,.16,.17),'redoxide',.020,True)
    for x in (-1.52,.1,1.36):block(g,(x,0,.66),(.36,.32,.25),'darkwood',.020,True)
    return g

def slats(g,center,length,depth,z,material='teak'):
    x,y=center
    for i in range(4):block(g,(x-depth*.38+i*depth*.25,y,z),(depth*.20,length,.052),material,.011)
def bench(g,x,y,length):
    for v in (-length*.36,length*.36):
        for dx in (-.231,.227):block(g,(x+dx,y+v,.278),(.086,.10,.54),'gatebeam',.018,True)
        block(g,(x,y+v,.44),(.64,.080,.099),'iron',.012)
    slats(g,(x,y),length,.65,.566)
    block(g,(x,y,.52),(.62,length,.075),'darkwood',.011,True)
    for z in (.826,1.035):block(g,(x-.27,y,z),(.069,length,.151),'teak',.015,True)
    for v in (-length*.36,length*.36):block(g,(x-.27,y+v,.79),(.068,.075,.59),'gatebeam',.012)
def ferry():
    g=Mesh('ferry-entrance')
    # A solid planked windbreak shields the waiting bench on the exposed side of the arcade.
    for v in (-1.0,.55,2.10):
        block(g,(-.55,v,.97),(.146,.146,1.94),'gatebeam',.021,True)
        block(g,(-.55,v,.067),(.26,.26,.14),'coping',.017)
        block(g,(-.55,v,1.964),(.187,.187,.08),'brass',.018)
    for j in range(8):
        block(g,(-.55,.55,.255+j*.201),(.107,3.12,.197),'boardgreen',.009,True)
    block(g,(-.55,.55,1.811),(.18,3.24,.093),'teak',.015,True)
    bench(g,-.02,.55,2.57)
    # Freestanding enamel timetable shares the arcade footings, with a full walk-through break alongside.
    q=g.at((-.40,-3.02,0),(0,0,-8))
    for v in (-.70,.70):block(q,(0,v,1.06),(.122,.12,2.11),'gatebeam',.017,True)
    block(q,(0,0,1.41),(.136,1.41,1.67),'gatebeam',.024,True)
    label(q,(-.073,0,1.42),1.20,1.49,'left','ferryboard')
    block(q,(0,0,2.293),(.17,1.68,.316),'gatebeam',.023,True)
    label(q,(-.093,0,2.294),1.53,.27,'left','ferrysign')
    for v in (-.62,.62):rivet(q,(-.085,v,2.03),(-1,0,0),.03)
    return g

def netyard():
    g=Mesh('net-washing-rack')
    # The solid wash splashback provides cover independently of the open net weave.
    for v in (-2.12,0,2.12):
        block(g,(.20,v,1.14),(.183,.19,2.28),'darkwood',.020,True)
        block(g,(.20,v,.118),(.33,.31,.235),'wetstone',.021)
        for z in (.57,1.57):rivet(g,(.302,v,z),(1,0,0))
    for j in range(12):
        block(g,(.15,-1.944+j*.353,1.01),(.143,.339,1.95),'boardgreen' if j%4 else 'darkwood',.009,True)
    for z in (.24,1.82):block(g,(.256,0,z),(.105,4.42,.117),'darkwood',.014)
    g.tube((.16,-2.30,2.255),(.16,2.30,2.255),.064,'steel',12,True)
    # One continuous draped seine, with open diamond mesh, natural slack and cork floats.
    cols=23;rows=10
    def point(i,j):
        t=i/(cols-1);f=j/(rows-1);v=-2.0+4.0*t
        top=2.20-.17*math.sin(math.pi*t)**1.3
        return (.34+.09*math.sin(9*t+1.7*f)+.16*math.sin(f*math.pi),v,top-f*(1.64+.14*math.sin(6*t)))
    for i in range(cols):
        for direction in (-1,1):
            if not (i%2):continue
            row=[];col=i
            for j in range(rows):
                if not 0<=col<cols:break
                row.append(point(col,j));col+=direction
            if len(row)>1:bent_wire(g,row,.016,'netting',4)
    for j0 in range(2,rows-1,2):
        for start,direction in ((0,1),(cols-1,-1)):
            pts=[point(start+(j-j0)*direction,j)for j in range(j0,rows)]
            if len(pts)>1:bent_wire(g,pts,.016,'netting',4)
    bent_wire(g,[point(i,0)for i in range(cols)],.036,'cable',7)
    for i in range(1,cols-1,3):
        x,v,z=point(i,0);g.tube((x,v-.080,z),(x,v+.08,z),.072,'amber',9)
    # Concrete washing trough, drainage slots and a short return into the service apron.
    for x in (.402,1.16):block(g,(x,.24,.325),(.104,2.64,.65),'washedconcrete',.023,True)
    for v in (-1.08,1.56):block(g,(.782,v,.325),(.84,.104,.65),'washedconcrete',.022,True)
    block(g,(.782,.24,.205),(.66,2.53,.077),'wetstone',.017)
    bent_wire(g,[(.38,-1.57,.05),(.37,-1.57,.86),(.52,-1.57,1.02),(.76,-1.57,1.02),(.78,-1.57,.93)],.053,'steel',9)
    for j in range(13):block(g,(1.375,-.91+j*.171,.021),(.228,.051,.034),'iron',.004)
    # A right-angle section gives the rack a sheltered side without trapping models against the shed.
    for v in (-1.94,-1.76):
        block(g,(-.52,v,.797),(1.34,.071,1.58),'boardgreen',.014,True)
    block(g,(-1.16,-1.85,.84),(.16,.24,1.70),'darkwood',.018,True)
    return g

def wall_run(g,mid,length,height,along_u=False):
    wall=g.at(mid,(0,0,90 if along_u else 0))
    count=max(1,round(length/1.35));width=length/count
    for j in range(count):
        v=-length/2+width*(j+.5)
        block(wall,(0,v,height/2),(.255,width-.014,height),'washedconcrete',.024,True)
        block(wall,(0,v,height+.045),(.333,width-.009,.091),'coping',.018,True)
        for z in (.40,height-.34):
            for y in (v-width*.27,v+width*.27):
                wall.tube((-.132,y,z),(-.142,y,z),.031,'wetstone',9)
    block(wall,(0,0,.103),(.402,length+.045,.202),'wetstone',.025,True)

def valve_wheel(g,center,rad=.196):
    x,y,z=center
    g.tube((x,y-.16,z),(x,y+.034,z),.043,'brass',10)
    g.hoop(center,(0,1,0),rad,.028,'red',18,6)
    for a in np.arange(4)*math.tau/4:
        g.tube(center,(x+rad*math.cos(a),y,z+rad*math.sin(a)),.012,'redoxide',6)

def floodwall():
    g=Mesh('pump-forecourt')
    wall_run(g,(-1.78,-.46,0),3.49,2.04)
    wall_run(g,(-1.78,1.645,0),.69,1.21)
    wall_run(g,(-.15,-2.216,0),2.97,1.91,True)
    # A local water-service manifold connects to the existing pump cabinet and is accessible from the open end.
    positions=[(-.96,-1.32,.17),(-.96,-1.32,.78),(-.80,-1.32,.947),(.73,-1.32,.947),(.91,-1.28,.94),(1.077,-1.10,.94)]
    bent_wire(g,positions,.108,'gate',12)
    for u in (-.63,.19):
        g.tube((u-.057,-1.32,.947),(u+.057,-1.32,.947),.164,'steel',12)
        for a in np.arange(6)*math.tau/6:
            cy=-1.32+.143*math.cos(a);z=.947+.143*math.sin(a)
            g.tube((u-.071,cy,z),(u+.072,cy,z),.017,'bolt',6)
        g.tube((u,-1.32,.952),(u,-1.32,1.18),.071,'brass',10)
        valve_wheel(g,(u,-1.174,1.18),.143)
        block(g,(u,-1.32,.348),(.244,.28,.696),'washedconcrete',.025,True)
    # Motor-control box and trunking sit on the inside face of the return.
    block(g,(-.46,-1.921,1.09),(.79,.301,.89),'gatebeam',.025,True)
    block(g,(-.46,-1.752,1.10),(.707,.034,.813),'steel',.014)
    label(g,(-.46,-1.729,1.245),.52,.177,'front','valvelabel')
    for u in (-.632,-.495):g.tube((u,-1.74,1.021),(u,-1.713,1.021),.039,'red'if u<-.6 else'brass',9)
    for u in (-.75,-.59):g.tube((u,-1.86,.65),(u,-1.86,.072),.038,'cable',8)
    for j in range(10):block(g,(-.78+j*.16,-.30,.027),(.052,.31,.042),'iron',.003)
    return g

def weigh_office():
    g=Mesh('weigh-office')
    # A compact sealed brick and metal weigh office with a shuttered transaction window.
    block(g,(0,0,.105),(2.05,3.09,.21),'wetstone',.045,True)
    block(g,(0,0,1.125),(1.90,2.94,1.90),'washedconcrete',.035,True)
    # Deep weatherboards and drip course are part of the facade, with a higher opaque sill on the roadway side.
    for v in (-1,1):
        block(g,(0,v*1.463,1.39),(1.96,.080,1.38),'boardgreen',.016)
        for j in range(8):
            block(g,(0,v*1.51,.813+j*.158),(1.85,.041,.043),'gatebeam',.006)
    for u in (-.953,.953):
        block(g,(u,0,1.884),(.086,2.98,.31),'boardgreen',.013)
    roof=g.at((0,0,2.126),(0,-4,0))
    block(roof,(0,0,0),(2.21,3.20,.154),'gatebeam',.024,True)
    for j in range(11):block(roof,(0,-1.50+j*.301,.085),(2.12,.033,.029),'edge',.006)
    # Recess, bottom service opening and folded roller shutter, all above the standing cover sill.
    block(g,(.966,-.06,1.491),(.041,1.91,.88),'iron',.016)
    block(g,(.995,-.06,1.490),(.027,1.68,.684),'sidelight',.010)
    for j in range(5):
        block(g,(1.024,-.06,1.80-j*.064),(.036,1.77,.056),'fleetcream',.006)
    for v in (-.983,.868):block(g,(1.023,v,1.501),(.104,.095,.865),'gatebeam',.010)
    block(g,(1.09,-.058,1.095),(.325,2.038,.084),'teak',.017,True)
    # Transaction canopy, brackets and its projecting road-facing enamel sign.
    block(g,(1.177,-.050,2.042),(.502,2.47,.080),'zinc',.014,True,rot=(0,6,0))
    for v in (-1.05,.97):box_beam(g,(.972,v,1.817),(1.36,v,2.027),.048,.048,'iron')
    block(g,(1.383,-.040,2.029),(.052,1.60,.267),'gatebeam',.011)
    label(g,(1.415,-.04,2.029),1.525,.232,'right','weighsign')
    # Staff door opens on the short end; it is closed in this solid scatter piece.
    block(g,(0,-1.525,1.11),(1.073,.068,1.87),'darkwood',.019)
    block(g,(0,-1.573,1.103),(.890,.036,1.71),'boardgreen',.014)
    block(g,(0,-1.595,1.508),(.58,.024,.401),'sidelight',.012)
    block(g,(.314,-1.626,.972),(.159,.033,.033),'brass',.008)
    block(g,(0,-1.701,.09),(1.14,.287,.178),'coping',.023,True)
    return g

def ice_dispatch():
    g=Mesh('ice-dispatch')
    q=g.at((-.75,.22,0))
    for u in (-.69,.69):
        for v in (-.59,.59):
            block(q,(u,v,.57),(.107,.107,1.11),'gatebeam',.015,True)
            block(q,(u,v,.066),(.21,.21,.132),'coping',.015)
    # The strake stiffeners terminate on the hopper's sloping cheeks.
    rings=[]
    for w,d,z in ((.45,.40,.82),(1.48,1.27,1.40),(1.53,1.31,2.25)):
        rings.append([(-w/2,-d/2,z),(w/2,-d/2,z),(w/2,d/2,z),(-w/2,d/2,z)])
    q.rings(rings,'zinc',True,False)
    block(q,(0,0,2.292),(1.63,1.41,.103),'fleetcream',.043,True)
    for v in (-.51,.51):block(q,(0,v,2.352),(1.49,.046,.031),'edge',.007)
    for z in (1.46,2.16):block(q,(0,-.669,z),(1.52,.037,.061),'steel',.007)
    for u in (-.61,.61):block(q,(u,-.673,1.808),(.049,.041,.706),'edge',.007)
    block(q,(0,-.245,.86),(.53,.64,.102),'iron',.016,True)
    chute=q.at((0,-.72,.769),(14,0,0));block(chute,(0,0,0),(.61,.86,.082),'zinc',.015,True)
    for u in (-.289,.289):block(chute,(u,0,.092),(.045,.86,.187),'steel',.007)
    block(q,(0,-.67,1.87),(.97,.025,.32),'fleetcream',.010)
    label(q,(0,-.691,1.87),.91,.264,'rear','fishmark')
    # Feed duct from the solid end of the existing shed, bolted at the flange.
    block(q,(.52,1.22,1.91),(.45,1.30,.38),'steel',.025)
    for v in (.765,1.53):block(q,(.52,v,1.91),(.53,.058,.464),'edge',.012)
    # Catch boxes are open at the top. Recess their ribs and use separate hand grips.
    for u,v,w,d in ((-.75,-1.10,.81,.65),(.26,.63,.64,.67)):
        for du in (-1,1):block(g,(u+du*w/2,v,.262),(.054,d,.414),'hullblue',.011,True)
        for dv in (-1,1):block(g,(u,v+dv*d/2,.262),(w,.054,.414),'hullblue',.011,True)
        block(g,(u,v,.079),(w,d,.096),'gatebeam',.012,True)
        for dv in (-1,1):
            block(g,(u,v+dv*(d/2+.038),.341),(.22,.022,.063),'rubber',.014)
            for du in (-.30,-.11,.11,.30):
                if abs(du)<w/2:block(g,(u+du,v+dv*(d/2+.033),.226),(.022,.025,.242),'gatebeam')
    # The corrugated yard screen attaches to the same bay and shelters the stack from spray.
    for v in (-2.03,-.81,.41):
        block(g,(.88,v,.97),(.13,.136,1.94),'gatebeam',.015,True)
        block(g,(.88,v,.075),(.252,.246,.15),'coping',.015)
    for j in range(11):
        block(g,(.87,-1.92+j*.23,.913),(.085,.220,1.72),'boardgreen',.006,True)
    for z in (.22,1.63):block(g,(.936,-.81,z),(.060,2.55,.073),'iron',.009)
    return g

if __name__=='__main__':
    for make in [slipway,ferry,netyard,floodwall,weigh_office,ice_dispatch]:
        make().write()
