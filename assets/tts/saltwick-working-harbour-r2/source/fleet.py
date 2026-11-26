"""Saltwick municipal fleet. Longitudinal axis points forward along +V."""
import math
import numpy as np
from mesh import Mesh
from props import bent_wire, pallet

def block(g,p,size,mat,rad=0,solid=False,rot=(0,0,0)):
    g.box(p,size,mat,r=rad,b=rad*.62,physical=solid,rot=rot,n=2)

def face(g,points,material,uv=None):
    uv=uv or [(0,0),(1,0),(1,1),(0,1)]
    g.surface(points,[list(range(len(points)))],material,manual=[uv])

def label(g,center,w,h,side,material):
    u,v,z=center
    right={'front':(-1,0),'rear':(1,0),'left':(0,-1),'right':(0,1)}[side]
    pts=[(u+right[0]*a*w/2,v+right[1]*a*w/2,z+b*h/2)for a,b in [(-1,-1),(1,-1),(1,1),(-1,1)]]
    face(g,pts,material)

def arc_fender(g,x,y,z,outer,inner,width,material):
    coords=np.linspace(-.23,math.pi+.23,25)
    verts=[]
    for u,rr in [(x-width/2,outer),(x+width/2,outer),(x+width/2,inner),(x-width/2,inner)]:
        verts.extend([(u,y+rr*math.cos(t),z+rr*math.sin(t)) for t in coords])
    n=len(coords)
    sides=[[a*n+i,a*n+i+1,(a+1)%4*n+i+1,(a+1)%4*n+i]for a in range(4)for i in range(n-1)]
    sides += [[3*n,2*n,n,0],[n-1,2*n-1,3*n-1,4*n-1]]
    g.surface(verts,sides,material,smooth=True)

def road_wheel(g,side,y,front):
    x=side*.854;r=.410;width=.264;z=.412
    g.tyre((x,y,z),r,width,'tyrewall',28)
    outer=x+side*.138
    def disc(a,b,rad,mat,steps=18):
        g.tube((outer+side*a,y,z),(outer+side*b,y,z),rad,mat,steps)
    # Rim lips, cast dished hub, wheel ventilation ports and exposed studs.
    disc(-.016,.012,.266,'rubber',28);disc(.014,.031,.245,'zinc',30);disc(.032,.040,.210,'iron',26)
    disc(.041,.052,.176,'steel',26);disc(.054,.084,.084 if front else .099,'zinc',20)
    for j in range(8):
        angle=j*math.tau/8
        for radial,rr,out,material,n in [(.204,.038,.051,'soot',8),(.123,.021,.073,'bolt',6)]:
            cy=y+radial*math.cos(angle);cz=z+radial*math.sin(angle)
            g.tube((outer+side*(out-.012),cy,cz),(outer+side*out,cy,cz),rr,material,n)
    g.hoop((outer+side*.002,y,z),(1,0,0),.335,.008,'rubber',32,4)
    # Chevron siping is confined to the tyre shoulder, leaving the rubber footprint round.
    for j in range(27):
        th=j*math.tau/27
        q=[]
        for offset,ang,rad in [(.112,th,.384),(.064,th+.052,.406),(.064,th+.074,.406),(.112,th+.023,.384)]:
            q.append((x+side*offset,y+rad*math.cos(ang),z+rad*math.sin(ang)))
        g.surface(q,[[0,1,2,3] if side==1 else [3,2,1,0]],'soot')
    if not front:
        disc(-.44,-.28,.362,'tyrewall',20)
        arc_fender(g,x,y,z,.487,.444,.35,'rubber')
        block(g,(x,y-.445,.34),(.33,.046,.43),'rubber',.018)

def chassis(g,paint):
    for x in (-.54,.54):
        block(g,(x,-.08,.47),(.155,4.12,.194),'iron',.022,True)
    for y in (-1.37,1.37):
        g.tube((-.81,y,.41),(.81,y,.41),.092,'iron',12)
        for x in (-.53,.53):
            block(g,(x,y,.47),(.14,.93,.080),'soot',.020)
    for side in (-1,1):
        road_wheel(g,side,1.37,True);road_wheel(g,side,-1.37,False)
    tank=g.at((.767,-.025,.458))
    block(tank,(0,0,0),(.34,.90,.36),'zinc',.077,True)
    for y in (-.25,.25):block(tank,(0,y,0),(.351,.053,.368),'iron',.04)
    block(g,(-.775,-.15,.464),(.35,.87,.37),'iron',.045,True)
    for x in (-.80,.80):
        block(g,(x,-2.04,.55),(.23,.23,.22),'iron',.025,True)
    block(g,(0,-2.10,.49),(1.72,.14,.14),'steel',.032)
    g.tube((-.51,-.20,.32),(-.62,-.56,.31),.066,'soot',10)

def cab(g,paint,number):
    # Upper cab is pressed as a tapered shell. The lower sides are split around the steering wheel arches.
    layers=[(1.84,.55,2.41,1.01,.138),(1.92,.53,2.45,1.27,.15),(1.90,.55,2.42,1.40,.16),(1.75,.63,2.13,2.06,.15),(1.70,.66,2.08,2.126,.13)]
    rings=[]
    for w,back,front,z,r in layers:
        pts=[]
        for cx,cy,start in [(w/2-r,front-r,0),(-w/2+r,front-r,90),(-w/2+r,back+r,180),(w/2-r,back+r,270)]:
            for ang in np.linspace(start,start+90,4):
                a=math.radians(ang);pts.append((cx+r*math.cos(a),cy+r*math.sin(a),z))
        rings.append(pts)
    g.rings(rings[:3],paint,True,True)
    # The windscreen and side windows have real openings behind the pillars.
    # Leaving the driver's drop glass part open exposes the seat, wheel and fascia.
    n=len(rings[2]);upper=rings[2]+rings[3]
    faces=[[i,(i+1)%n,(i+1)%n+n,n+i] for i in range(n) if i not in (3,7,15)]
    g.surface(upper,faces,paint,smooth=True)
    g.rings(rings[3:],paint,False,True)
    g.solid(rings[2]+rings[-1])
    block(g,(0,1.36,1.394),(1.72,1.44,.090),'soot',.042)
    block(g,(0,1.995,1.488),(1.54,.432,.122),'soot',.060)
    block(g,(.433,1.087,1.605),(.453,.228,.374),'rubber',.069,rot=(-8,0,0))
    block(g,(-.443,1.087,1.605),(.453,.228,.374),'rubber',.069,rot=(-8,0,0))
    for x in (-.445,.429):
        block(g,(x,1.051,1.856),(.288,.176,.170),'soot',.043)
    g.tube((.432,1.838,1.467),(.432,1.710,1.645),.044,'iron',8)
    g.hoop((.432,1.699,1.653),(0,-.64,.77),.179,.024,'rubber',16,6)
    for x in (.280,.581):g.tube((.432,1.699,1.653),(x,1.705,1.656),.020,'soot',7)
    block(g,(0,.669,1.762),(1.50,.046,.60),'soot',.018)
    block(g,(0,1.37,2.138),(1.75,1.49,.096),paint,.105,True)
    block(g,(0,1.93,.87),(1.69,.64,.37),paint,.060,True)
    block(g,(0,.65,.90),(1.87,.31,.35),paint,.048,True)
    block(g,(0,2.325,.82),(1.80,.18,.39),paint,.047)
    # Joined windshield surround and two individual panes with a raked windscreen and a continuous upper visor.
    def glass_v(z,offset):return float(np.interp(z,[1.4,2.06],[2.42,2.13]))+offset
    def front_pane(ul,ur,z1,z2,offset,mat,uv=None):
        face(g,[(ur,glass_v(z1,offset),z1),(ul,glass_v(z1,offset),z1),(ul*.91,glass_v(z2,offset),z2),(ur*.91,glass_v(z2,offset),z2)],mat,uv)
    front_pane(-.817,.817,1.41,2.041,.012,'rubber')
    for j,(ul,ur) in enumerate([(-.782,-.009),(.009,.782)]):
        low=.49 if j==0 else 0;high=low+.51
        front_pane(ul,ur,1.443,2.006,.024,'windshield',[(low,0),(high,0),(high,1),(low,1)])
    block(g,(0,2.114,2.068),(1.67,.144,.068),paint,.026)
    for u in (-.40,.395):
        g.tube((u+.13,glass_v(1.440,.046),1.440),(u-.115,glass_v(1.565,.046),1.565),.014,'soot',6)
        g.tube((u-.29,glass_v(1.552,.050),1.552),(u+.08,glass_v(1.577,.050),1.577),.017,'rubber',6)
    for s in (-1,1):
        x=s*.955
        def side_face(poly,mat,offset=.013):
            pts=[(s*(float(np.interp(z,[1.4,2.06],[.950,.875]))+offset),v,z) for v,z in poly]
            g.surface(pts,[[0,1,2,3] if s==1 else [3,2,1,0]],mat,manual=[[(0,0),(1,0),(1,1),(0,1)]])
        outer=[(.665,1.395),(2.242,1.395),(1.989,2.045),(.664,2.045)]
        inner=[(.725,1.442),(2.157,1.442),(1.940,1.992),(.725,1.992)]
        for j in range(4):side_face([outer[j],outer[(j+1)%4],inner[(j+1)%4],inner[j]],'rubber',.018)
        side_face([(.725,1.442),(1.037,1.442),(1.037,1.992),(.725,1.992)],'sidelight',.020)
        side_face([(1.037,1.439),(1.071,1.439),(1.071,1.993),(1.037,1.993)],'rubber',.023)
        if s<0:
            side_face([(1.071,1.442),(2.157,1.442),(1.940,1.992),(1.071,1.992)],'windshield',.020)
        else:
            side_face([(1.071,1.442),(2.157,1.442),(2.090,1.605),(1.071,1.605)],'sidelight',.019)
            side_face([(1.071,1.602),(2.090,1.602),(2.086,1.612),(1.071,1.612)],'edge',.021)
        arc_fender(g,s*.879,1.37,.413,.570,.470,.32,paint)
        arc_fender(g,s*.929,1.37,.414,.491,.459,.236,'rubber')
        block(g,(s*.901,.71,.78),(.167,.40,.46),paint,.035)
        for v,z in [(.66,.52),(.73,.70)]:
            block(g,(s*.948,v,z),(.218,.435,.065),'grip',.014)
            for j in range(5):block(g,(s*1.016,v-.149+.068*j,z+.035),(.054,.022,.012),'edge')
        block(g,(s*.956,1.14,1.232),(.027,.88,.032),'ivory',.010)
        block(g,(s*.970,.779,1.316),(.039,.146,.052),'soot',.012)
        g.tube((s*.969,.663,.983),(s*.969,.663,1.33),.008,'iron',5)
        bent_wire(g,[(s*.91,2.14,1.65),(s*1.10,2.17,1.57),(s*1.151,2.00,1.68),(s*1.151,1.956,1.95)],.024,'iron',7)
        block(g,(s*1.147,1.936,1.832),(.151,.101,.304),'soot',.036)
        block(g,(s*1.147,1.88,1.847),(.120,.014,.223),'sidelight',.017)
        block(g,(s*1.149,1.883,1.707),(.116,.015,.053),'edge',.013)
        block(g,(s*.925,2.235,1.184),(.061,.118,.071),'amber',.015)
    # Recessed grille, stacked slats, lamp clusters and inset front plate.
    block(g,(0,2.439,1.144),(1.224,.046,.373),'rubber',.03)
    for z in (1.008,1.079,1.15,1.221,1.292):
        block(g,(0,2.474,z),(1.086,.044,.027),'steel',.007)
    block(g,(0,2.498,1.245),(.187,.016,.080),'edge',.009)
    block(g,(0,2.432,.700),(1.913,.16,.190),'iron',.041,True)
    for s in (-1,1):
        block(g,(s*.758,2.437,1.023),(.342,.089,.169),'soot',.03)
        for k in (-1,1):block(g,(s*.758+.078*k,2.492,1.036),(.130,.036,.094),'lamp',.017)
        block(g,(s*.762,2.481,.938),(.239,.056,.040),'amber',.009)
        block(g,(s*.80,2.518,.708),(.127,.022,.069),'lamp',.009)
        block(g,(s*.57,1.68,2.206),(.111,.220,.061),'amber',.025)
    label(g,(0,2.520,.699),.39,.093,'front','fleetplate'+str(number))

def tail_lamps(g,v,plate):
    for s in (-1,1):
        block(g,(s*.761,v,.658),(.304,.092,.123),'rubber',.018)
        for k,col in enumerate(['redlamp','amber','lamp']):
            block(g,(s*(.661+.098*k),v-.061,.660),(.079,.035,.084),col,.010)
    label(g,(0,v-.078,.62),.405,.099,'rear','fleetplate'+str(plate))

def box_body(g,open_rear):
    paint='steel' if open_rear else 'fleetcream'
    box_mid=-.77;front=.78;back=-2.28
    block(g,(0,box_mid,.83),(2.006,3.18,.163),'iron',.025,True)
    block(g,(0,box_mid,.931),(1.93,3.104,.063),'darkwood',.007,True)
    for s in (-1,1):
        x=s*.964
        block(g,(x,box_mid,1.751),(.081,3.10,1.63),paint,.022,True)
        if open_rear:
            for j in range(20):
                block(g,(s*1.009,back+.11+j*.148,1.76),(.020,.028,1.54),'zinc',.004)
        else:
            for j in range(4):block(g,(s*1.009,back+.16+j*.77,1.74),(.014,.014,1.56),'zinc')
        for z in (.960,2.544):
            block(g,(s*1.01,box_mid,z),(.055,3.14,.070),'zinc',.009)
        for v in (back+.02,front-.055):block(g,(s*1.009,v,1.762),(.061,.060,1.69),'edge',.008)
        mark='fleetmark' if open_rear else 'fishmark'
        block(g,(s*1.026,box_mid,1.86),(.022,1.68,.438),'ivory' if open_rear else 'zinc',.012)
        label(g,(s*1.041,box_mid,1.86),1.63,.398,'right' if s>0 else 'left',mark)
    block(g,(0,front-.045,1.76),(1.95,.079,1.66),paint,.022,True)
    block(g,(0,box_mid,2.625),(2.077,3.19,.125),'zinc'if open_rear else'fleetcream',.042,True)
    for j in range(5):block(g,(-.77+j*.386,box_mid,2.693),(.021,2.94,.014),'edge')
    if open_rear:
        for s in (-1,1):block(g,(s*.965,back-.025,1.77),(.083,.086,1.72),'edge',.011)
        g.tube((-.905,back+.086,2.457),(.905,back+.086,2.457),.14,'steel',24)
        for j in range(4):block(g,(0,back-.031,2.546-j*.061),(1.84,.048,.051),'steel',.006)
        for u in (-.78,.78):g.tube((u,-2.07,.54),(u,-2.985,.735),.047,'iron',8)
        block(g,(0,-2.70,.766),(1.83,1.04,.116),'grip',.025,True)
        for u in (-.89,.89):block(g,(u,-2.71,.828),(.040,.93,.023),'mark')
        pallet(g,0,-2.26,.832,1.12,1.0)
        block(g,(0,-2.27,1.372),(1.07,.865,.663),'teak',.022,True)
        for u in (-.43,.43):block(g,(u,-2.27,1.367),(.071,.888,.69),'plywood',.006)
        for v in (-2.55,-2.03):
            block(g,(0,v,1.723),(1.06,.048,.027),'iron')
            for u in (-.543,.543):block(g,(u,v,1.373),(.026,.046,.66),'iron')
        label(g,(0,-2.71,1.376),.46,.248,'rear','tag')
        tail_lamps(g,back+.03,2)
    else:
        # Rear reefer doors, rubber perimeter seals, locking rods and hinges.
        for s in (-1,1):
            block(g,(s*.476,back,1.765),(.95,.09,1.67),'rubber',.025,True)
            block(g,(s*.477,back-.05,1.765),(.905,.031,1.594),'fleetcream',.018)
            for z in (1.12,1.68,2.38):
                block(g,(s*.878,back-.09,z),(.142,.070,.098),'steel',.012)
            for u in (s*.29,s*.64):
                g.tube((u,back-.095,.99),(u,back-.095,2.527),.022,'edge',8)
                for z in (1.10,1.77,2.43):block(g,(u,back-.105,z),(.063,.06,.061),'steel')
            block(g,(s*.46,back-.135,1.42),(.31,.056,.039),'iron',.006)
        # A front-mounted refrigeration pack is visible above the cab roof.
        block(g,(0,.818,2.358),(1.60,.264,.535),'fleetcream',.073,True)
        for u in (-.395,.395):
            g.tube((u,.944,2.372),(u,.983,2.372),.197,'soot',24)
            for ang in range(7):
                a=math.tau*ang/7
                blade=[(u+.036*math.cos(a),.989,2.372+.036*math.sin(a)),(u+.171*math.cos(a+.14),.989,2.372+.171*math.sin(a+.14)),(u+.166*math.cos(a+.58),.989,2.372+.166*math.sin(a+.58))]
                g.surface(blade,[[2,1,0]],'steel')
            for rr in (.086,.154,.190):g.hoop((u,.997,2.372),(0,1,0),rr,.009,'edge',20,4)
            g.tube((u,.997,2.372),(u,1.022,2.372),.041,'iron',10)
        tail_lamps(g,back-.025,3)

def box_beam(g,a,b,w,d,mat,solid=False):
    from mesh import from_z,unit
    a,b=np.array(a),np.array(b)
    frame=from_z(b-a)
    corners=[(-w/2,-d/2,0),(w/2,-d/2,0),(w/2,d/2,0),(-w/2,d/2,0)]
    g.rings([[p+frame@np.array(c) for c in corners]for p in (a,b)],mat,solid,False)

def fitter_bed(g):
    block(g,(0,-.80,.834),(2.02,3.12,.174),'iron',.026,True)
    for j in range(8):
        block(g,(-.853+j*.244,-.80,.947),(.232,3.06,.065),'teak',.008)
    for s in (-1,1):
        for level in range(3):
            block(g,(s*.976,-.80,1.04+level*.145),(.075,3.12,.136),'fleetochre',.014,True)
        for v in (-2.27,-1.19,-.11,.66):
            block(g,(s*1.019,v,1.185),(.047,.075,.45),'zinc',.009)
        for v in (-1.72,-.55):
            block(g,(s*1.039,v,.996),(.043,.194,.05),'iron',.006)
        label(g,(s*1.021,-.54,1.236),.86,.176,'right'if s>0 else'left','fittermark')
    block(g,(0,-2.359,1.16),(1.98,.091,.45),'fleetochre',.019,True)
    block(g,(0,.69,1.35),(1.95,.095,.87),'iron',.022,True)
    for j,(u,w,z) in enumerate([(-.46,.23,1.075),(-.19,.24,1.075),(.09,.23,1.075),(.37,.23,1.075),(-.29,.25,1.27),(.00,.25,1.27),(.29,.23,1.27)]):
        block(g,(u,-1.12,z),(w,1.99-j%2*.105,.18),'teak' if j%3 else 'plywood',.018,j in (0,3,4,6))
    for v in (-1.79,-.51):
        block(g,(0,v,1.38),(.88,.073,.027),'mark')
        for side in (-1,1):g.tube((side*.44,v,1.37),(side*.72,v,.99),.029,'mark',6)
    # Folded knuckle boom. The open spaces between the arms, ram and polished piston are real.
    u=-.57;v=.39
    g.tube((u,v,.960),(u,v,1.19),.268,'iron',16,True)
    g.tube((u,v,1.185),(u,v,1.41),.187,'redoxide',16,True)
    a=(u,v,1.36);b=(u-.014,v-.11,2.19);c=(u+.10,-.96,1.61);d=(u+.11,-.23,1.44)
    box_beam(g,a,b,.245,.235,'redoxide',True);box_beam(g,b,c,.225,.166,'redoxide',True);box_beam(g,c,d,.140,.108,'fleetochre',True)
    for z0,z1 in [((u+.136,v-.10,1.49),(u+.136,-.13,1.842)),((u-.122,.06,1.99),(u-.122,-.57,1.63))]:
        mid=tuple(.35*x+.65*y for x,y in zip(z0,z1))
        g.tube(z0,mid,.055,'iron',10);g.tube(mid,z1,.030,'edge',10)
    for q in (b,c,d):g.tube((q[0]-.145,q[1],q[2]),(q[0]+.145,q[1],q[2]),.067,'zinc',10)
    for s in (-.061,.061):
        bent_wire(g,[(u+s,v+.12,1.34),(u+s,v+.17,1.73),(u+s,v+.13,2.02),(u+s,-.03,2.18),(u+s,-.17,2.13),(u+s,-.53,1.93),(u+s,-.91,1.77)],.017,'rubber',6)
    g.hoop((u+.11,-.23,1.36),(1,0,0),.084,.021,'iron',12,5)
    tail_lamps(g,-2.37,1)

def tank_body(g):
    height=1.565;middle=-.76
    profile=[(-1.70,.23),(-1.66,.49),(-1.54,.78),(-1.40,.94),(-1.22,1.),(.98,1.),(1.13,.94),(1.29,.76),(1.41,.47),(1.46,.21)]
    verts=[[(.906*rad*math.cos(t),middle+v,height-.692*rad*math.sin(t)) for t in np.arange(32)*math.tau/32]for v,rad in profile]
    g.rings(verts,'tankalloy',False,True)
    g.solid([ring[j]for ring in verts[1:-1]for j in range(0,32,4)])
    for v in (-1.80,-.43,.15):
        rings=[[(.920*math.cos(t),v+dy,height-.706*math.sin(t))for t in np.arange(32)*math.tau/32] for dy in (-.045,.045)]
        g.rings(rings,'fleetgreen',False,True)
        block(g,(0,v,.888),(1.54,.16,.25),'iron',.022,True)
    for v in (-1.60,-.48):
        g.tube((0,v,2.21),(0,v,2.298),.237,'iron',20);g.tube((0,v,2.299),(0,v,2.351),.255,'fleetgreen',20)
        block(g,(0,v,2.395),(.162,.045,.071),'edge',.014)
    for s in (-1,1):
        block(g,(s*.858,-.795,1.590),(.112,1.215,.30),'fleetgreen',.025)
        label(g,(s*.921,-.795,1.59),1.15,.241,'right'if s>0 else'left','watermark')
    # Racked suction hoses have ribbed jackets, brass couplings and visible bends.
    for h in (1.06,1.207):
        pts=[(-.865,.37,h+.07),(-.988,.21,h),(-1.004,-.12,h),(-1.004,-1.81,h),(-.955,-1.99,h+.047)]
        bent_wire(g,pts,.064,'rubber',10)
        for v in np.linspace(-1.72,.045,13):
            g.hoop((-1.004,v,h),(0,1,0),.065,.0075,'soot',10,4)
        g.tube((-.956,-1.980,h+.044),(-.929,-2.063,h+.064),.084,'brass',10)
    for v in (-1.64,-.22):
        block(g,(-.925,v,1.032),(.203,.073,.063),'iron',.009)
    # Rear suction manifold and ladder. Treads are spaced to show the daylight between them.
    for u in (.48,.83):g.tube((u,-2.06,.68),(u,-2.04,2.16),.033,'steel',8)
    for z in np.linspace(.76,2.05,7):g.tube((.48,-2.065,z),(.83,-2.065,z),.023,'edge',7)
    for u in (-.36,.0):
        g.tube((u,-2.193,1.26),(u,-2.423,1.26),.107,'iron',12)
        g.tube((u,-2.426,1.26),(u,-2.486,1.26),.137,'brass',12)
    block(g,(0,-2.13,.789),(1.73,.51,.076),'grip',.025,True)
    tail_lamps(g,-2.35,4)

VEHICLES=[('lorry-slipway-fitter','fleetochre',1,fitter_bed),('lorry-tide-delivery','fleetblue',2,lambda g:box_body(g,True)),('lorry-cold-stores','fleetcream',3,lambda g:box_body(g,False)),('lorry-pump-service','fleetgreen',4,tank_body)]
def build():
    for name,paint,number,body in VEHICLES:
        g=Mesh(name);chassis(g,paint);cab(g,paint,number);body(g);g.write()
if __name__=='__main__':build()
