"""Six approved scatter families and constructed architectural detail.

All sizes are inches. Small decorative hardware deliberately has no collision;
the visible mass, legs and working surfaces retain physical primitives.
"""
from architecture import *

def decoration(m, fn, *args, **kw):
    ns, ne, nf = len(m.solids), len(m.physical_extras), len(m.free_ranges)
    fn(m, *args, **kw)
    del m.solids[ns:]; del m.physical_extras[ne:]; del m.free_ranges[nf:]

def bolt(m,x,y,z,r=.025,mat='bronze'):
    decoration(m,bevel,x-r,y-r,z,r*2,r*2,.035,mat,.005)

def grip(m,x,y,z,w=.28):
    for xx in [x-w/2,x+w/2]:decoration(m,rod,(xx,y,z+.04),(xx,y,z-.045),.017,'bronze',6)
    decoration(m,rod,(x-w/2,y,z-.045),(x+w/2,y,z-.045),.022,'bronze',8)

def travel_case(w=1.0,h=.72,d=.65,mat='sage'):
    t=Mesh();bevel(t,0,0,0,w,h,d,mat,.06)
    for x in [-w*.34,w*.34]:
        decoration(t,bevel,x,.02,-d/2-.012,.055,h-.04,.025,'bronze',.006)
        decoration(t,bevel,x,h-.04,0,.055,.055,d+.02,'bronze',.006)
        decoration(t,bevel,x,.43*h,-d/2-.035,.1,.13,.035,'bronze',.008)
    grip(t,0,h+.035,0,.3)
    for x in [-w/2+.045,w/2-.045]:
        for y in [.035,h-.09]:decoration(t,bevel,x,y,-d/2-.025,.13,.10,.07,'bronze',.015)
    return t

def waiting_bench(length=2.75):
    t=Mesh()
    for side in [-1,1]:
        x=side*(length/2-.22)
        for z in [-.32,.32]:
            rod(t,(x,0,z),(x,.62,z*.85),.065,'sage',10)
            bevel(t,x,0,z,.20,.055,.20,'bronze',.025)
        rod(t,(x,.5,.28),(x,1.35,.4),.06,'sage',10)
        rod(t,(x,.78,-.33),(x,1.0,-.23),.04,'sage',10)
        rod(t,(x,1.0,-.23),(x,1.02,.27),.055,'sage',10)
    for i in range(5):bevel(t,0,.58,-.35+i*.16,length,.105,.125,'wood',.018)
    for i in range(5):bevel(t,0,.78+i*.13,.35+i*.018,length,.105,.085,'wood',.014)
    rod(t,(-length/2+.22,.28,.18),(length/2-.22,.28,.18),.04,'sage',8)
    for x in [-length/2+.22,length/2-.22]:
        for y in [.82,1.08,1.32]:bolt(t,x,y,.30)
    t.add(travel_case(.65,.47,.48,'wood').moved(.65,-.10))
    return t

def customs_desk():
    t=Mesh();w=3.25
    for x in [-1.12,1.12]:
        bevel(t,x,.05,0,.90,.94,1.30,'sage',.035)
        for yy in [.10,.36,.62]:
            decoration(t,bevel,x,yy,-.663,.80,.23,.025,'sage',.012)
            grip(t,x,yy+.12,-.70,.28)
            decoration(t,bevel,x-.22,yy+.13,-.69,.12,.055,.018,'enamel',.003)
    bevel(t,0,1.0,0,w,.14,1.5,'wood',.045)
    for x in [-1.47,1.47]:
        for z in [-.64,.64]:decoration(t,bevel,x,1.0,z,.20,.16,.21,'bronze',.025)
    # A visibly recessed inspection terminal, rather than a screen painted on a box.
    bevel(t,.82,1.14,.18,.64,.20,.50,'sage',.035)
    panel3d(t,[(.50,1.36,-.04),(1.14,1.36,-.04),(1.14,1.75,.25),(.50,1.75,.25)],.055,'rubber')
    decoration(t,panel3d,[(.56,1.39,-.055),(1.08,1.39,-.055),(1.08,1.68,.16),(.56,1.68,.16)],.012,'glass')
    decoration(t,bevel,.82,1.20,-.10,.40,.035,.15,'bronze',.008)
    # Articulated lamp with weighted foot, two arms and shade.
    t.cyl(-1.08,1.14,.27,.16,.055,'bronze',16)
    decoration(t,rod,(-1.08,1.19,.27),(-1.08,1.70,.27),.025,'bronze',8)
    decoration(t,rod,(-1.08,1.70,.27),(-.66,1.93,.13),.03,'bronze',8)
    decoration(t,rod,(-.66,1.93,.13),(-.48,1.80,-.02),.03,'bronze',8)
    decoration(t,bevel,-.48,1.74,-.02,.38,.09,.26,'sage',.035)
    decoration(t,bevel,-.38,1.14,-.30,.58,.035,.36,'enamel',.006)
    decoration(t,bevel,-.38,1.18,-.30,.025,.008,.36,'wood',.002)
    decoration(t,bevel,.12,1.14,.22,.49,.31,.42,'fabric',.018)
    for x in [-.02,.25]:decoration(t,bevel,x,1.14,.22,.025,.33,.44,'bronze',.005)
    return t

def workshop_bench():
    t=Mesh()
    for x in [-1.32,1.32]:
        for z in [-.46,.46]:bevel(t,x,0,z,.14,1.04,.14,'sage',.02)
    bevel(t,0,1.04,0,3.0,.17,1.25,'wood',.04)
    bevel(t,0,.18,0,2.70,.10,1.0,'wood',.02)
    bevel(t,-.82,.28,0,.95,.73,.96,'sage',.025)
    for y in [.34,.55,.76]:
        decoration(t,bevel,-.82,y,-.50,.83,.16,.025,'sage',.008);grip(t,-.82,y+.08,-.54)
    # Separate rails, perforated backing, individually shaped hand tools.
    for x in [-1.34,1.34]:bevel(t,x,1.21,.54,.08,1.17,.09,'sage',.015)
    bevel(t,0,1.27,.57,2.75,1.04,.06,'wood',.012)
    for i in range(10):
        x=-1.13+i*.247;y=1.48+(i%3)*.12
        decoration(t,rod,(x,y,.50),(x,y+.44,.50),.022,'bronze',6)
        decoration(t,rod,(x-.075,y+.45,.50),(x+.075,y+.45,.50),.022,'bronze',6)
        for dx in [-.07,.07]:decoration(t,rod,(x+dx,y+.45,.50),(x+dx,y+.54,.50),.02,'bronze',6)
    bevel(t,-1.0,1.21,-.43,.45,.22,.38,'sage',.025)
    bevel(t,-1.0,1.43,-.43,.49,.10,.28,'bronze',.018)
    decoration(t,rod,(-1.0,1.32,-.42),(-1.0,1.32,-.83),.045,'bronze',10)
    decoration(t,rod,(-1.15,1.32,-.83),(-.85,1.32,-.83),.022,'bronze',8)
    t.add(travel_case(.77,.38,.62).moved(.6,0,y=.28))
    # Compact lathe: bed, tail stock, motor, chuck and hand wheel.
    bevel(t,.60,1.21,.14,1.08,.12,.50,'sage',.025)
    for x in [.16,.94]:bevel(t,x,1.33,.14,.23,.32,.39,'sage',.025)
    decoration(t,rod,(.14,1.55,.14),(.94,1.55,.14),.06,'bronze',12)
    for x in [.28,.38,.48]:decoration(t,rod,(x,1.55,.14),(x+.035,1.55,.14),.13,'bronze',12)
    return t

def freight_pallet():
    t=Mesh()
    for x in [-1.12,0,1.12]:bevel(t,x,0,0,.24,.14,1.85,'wood',.018)
    for z in [-.80,-.4,0,.4,.80]:bevel(t,0,.14,z,2.65,.11,.28,'wood',.012)
    t.add(travel_case(2.45,.92,1.64,'sage').moved(y=.25))
    t.add(travel_case(1.35,.65,1.45,'wood').moved(-.52,0,y=1.17))
    t.add(travel_case(.87,.55,1.40,'rubber').moved(.72,0,y=1.17))
    for x in [-.84,.84]:
        decoration(t,bevel,x,.27,-.85,.09,1.58,.025,'fabric',.005)
        decoration(t,bevel,x,1.83,0,.09,.025,1.72,'fabric',.005)
        decoration(t,bevel,x,.75,-.90,.18,.23,.06,'bronze',.012)
    return t

def power_cabinet():
    t=Mesh()
    for x in [-1.16,1.16]:bevel(t,x,0,0,.18,.16,1.0,'bronze',.025)
    bevel(t,0,.12,0,2.65,2.05,1.1,'sage',.07)
    for x in [-.64,.64]:
        decoration(t,bevel,x,.25,-.565,1.21,1.75,.035,'sage',.025)
        for yy in [.42,.54,.66,1.7,1.82]:decoration(t,bevel,x,yy,-.60,.72,.035,.055,'rubber',.009)
        grip(t,x+(.37 if x<0 else -.37),1.12,-.62,.07)
        for yy in [.44,1.65]:decoration(t,bevel,x+(-.55 if x<0 else .55),yy,-.62,.085,.22,.065,'bronze',.01)
    bevel(t,0,2.17,0,2.78,.11,1.21,'bronze',.035)
    decoration(t,bevel,.65,1.32,-.62,.44,.29,.045,'enamel',.012)
    for x in [.52,.67,.82]:decoration(t,bevel,x,1.40,-.65,.012,.07,.012,'rubber',.002)
    for x in [-1.40,-1.52]:
        decoration(t,rod,(x,.04,-.34),(x,1.75,-.34),.055,'bronze',8)
        decoration(t,rod,(x,1.75,-.34),(-1.15,1.93,-.34),.055,'bronze',8)
    return t

def stone_planter(seed=1):
    t=Mesh();w=3.0;d=1.30;h=1.05
    # Closed foot and open soil vessel: no floating flat slab under the prop.
    bevel(t,0,0,0,w,.14,d,'limestone',.025)
    for z in [-d/2+.10,d/2-.10]:bevel(t,0,.14,z,w,.88,.20,'limestone',.025)
    for x in [-w/2+.10,w/2-.10]:bevel(t,x,.14,0,.20,.88,d-.35,'limestone',.025)
    for z in [-d/2,d/2]:bevel(t,0,h,z,w+.12,.13,.28,'limestone',.025)
    for x in [-w/2,w/2]:bevel(t,x,h,0,.28,.13,d+.12,'limestone',.025)
    bevel(t,0,.88,0,w-.38,.08,d-.38,'soil',.01)
    # Actual individual leaves, fine stems, and flowers; decorative only.
    rng=random.Random(seed)
    for i in range(26):
        x=rng.uniform(-1.22,1.22);z=rng.uniform(-.40,.40);hi=rng.uniform(1.25,1.75)
        decoration(t,rod,(x,.95,z),(x+.08,hi,z),.012,'fabric',6)
        for j in range(5):
            for k in range(4):
                a=k*math.pi/2+j*.65+rng.uniform(-.2,.2)
                c=np.array([x,1.00+j*.12,z]);u=np.array([math.cos(a),.20,math.sin(a)])*rng.uniform(.19,.32)
                v=np.array([-math.sin(a),0,math.cos(a)])*.075
                pts=[c,c+u*.30-v*.8,c+u*.72-v,c+u,c+u*.72+v,c+u*.30+v*.8]
                t._solid_depth+=1;t.face(pts,'fabric');t.face(pts[::-1],'fabric');t._solid_depth-=1
        if i%3==0:
            for j in range(5):
                a=j*math.tau/5;c=np.array([x+.08,hi,z]);q=c+np.array([math.cos(a)*.065,.025,math.sin(a)*.065])
                # Rounded six-vertex petal surfaces, not cuboid flower placeholders.
                petals=[q+np.array([math.cos(b)*.045,.008,math.sin(b)*.045])for b in np.linspace(0,math.tau,7)[:-1]]
                t._solid_depth+=1;t.face(petals,'enamel');t.face(petals[::-1],'enamel');t._solid_depth-=1
    return t

def put(m,part,x,z,y=0,rot=0):m.add(part.moved(x,z,y=y,rot=rot))

def facade_detail(m,p,y,h,kinds,material='limestone'):
    """Profiles follow actual openings. Nothing crosses a door or fills a window."""
    poly=Polygon(p)
    for i,(aa,bb) in enumerate(zip(p,p[1:]+p[:1])):
        a=np.array(aa,float);b=np.array(bb,float);u=b-a;L=np.linalg.norm(u);u/=L
        # Choose outward-facing normal by testing the polygon.
        n=np.array([u[1],-u[0]])
        if poly.contains(Point(*((a+b)/2+n*.1))):n=-n
        def line(t0,t1,yy,r,mat):
            q=a+u*t0+n*.155;v=a+u*t1+n*.155
            decoration(m,rod,(q[0],yy,q[1]),(v[0],yy,v[1]),r,mat,8)
        for yy,r in [(y+.12,.055),(y+h-.21,.07),(y+h-.08,.045)]:line(0,L,yy,r,material)
        kind=kinds.get(i,'solid')
        if kind=='door' and L>=2.4:
            width=min(2.25,L-.5);t0=(L-width)/2;t1=t0+width
            for t in [t0-.08,t1+.08]:
                q=a+u*t+n*.16;decoration(m,rod,(q[0],y,q[1]),(q[0],y+2.71,q[1]),.075,material,8)
            line(t0-.13,t1+.13,y+2.72,.09,material)
        elif kind=='window' and L>=1.4:
            sill=min(1.05,h*.25);head=h-.30
            for t in [.29,L-.29]:
                q=a+u*t+n*.16;decoration(m,rod,(q[0],y+sill,q[1]),(q[0],y+head,q[1]),.055,material,8)
            for yy in [y+sill-.04,y+head+.04]:line(.24,L-.24,yy,.065,material)
            # Slim intermediate mullions preserve the opening and silhouette.
            for t in np.arange(1.65,L-.8,1.65):
                q=a+u*t
                rod(m,(q[0],y+sill,q[1]),(q[0],y+head,q[1]),.032,'bronze',8)
        # Deliberate quoin blocks at corners and constructed downpipe, not a print.
        if L>2.5:
            q=a+n*.13
            for yy in np.arange(y+.3,y+h-.3,.42):decoration(m,bevel,q[0],yy,q[1],.23,.25,.23,material,.02)
    # One rainwater outlet per building, clear of all openings.
    x,z=p[0];decoration(m,rod,(x-.17,y+.08,z-.17),(x-.17,y+h-.12,z-.17),.055,'bronze',10)

def roof_fittings(m,p,y):
    # Only decorative external gutters/bolts: access and collision remain unchanged.
    for a,b in zip(p,p[1:]+p[:1]):
        decoration(m,rod,(a[0],y,a[1]),(b[0],y,b[1]),.045,'bronze',8)
