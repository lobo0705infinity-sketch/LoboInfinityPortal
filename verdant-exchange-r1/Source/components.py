from geometry import *

from shapely.affinity import rotate, translate

from shapely.ops import unary_union

STREET_Y=1.0

def cyl(m,a,b,r,mat='silver',n=12,collision=True,r2=None):
    m[0].cylinder(a,b,r,mat,n,r2)
    if collision:
        c=Mesh();c.groups.append(0);c.cylinder(a,b,r,mat,n,r2);m[1].merge(c)

def ring(m,poly,y,h,w=.12,mat='concrete'):
    slab(m,poly.buffer(w/2,join_style=2).difference(poly.buffer(-w/2,join_style=2)),y,h,mat)

def ladder(m,x,z,h,angle=0,base_y=0):
    # Local ladder face is on the rear solid corner pier; cap has an access gap.
    t=pair()
    for dx in [-.37,.37]:cyl(t,(dx,.04,0),(dx,h+.55,0),.035,'silver',8)
    for y in np.arange(.22,h+.3,.24):cyl(t,(-.37,y,0),(.37,y,0),.026,'silver',6,False)
    for y in np.arange(.3,h,.9):
        for dx in [-.37,.37]:t[0].beam((dx,y,0),(dx,y,.24),.038,mat='metal')
    a=math.radians(angle);R=np.array([[math.cos(a),0,math.sin(a)],[0,1,0],[-math.sin(a),0,math.cos(a)]])
    for mesh in t:mesh.v=[tuple(np.array(v)@R.T+np.array([x,base_y,z])) for v in mesh.v]
    m[0].merge(t[0]);m[1].merge(t[1])

def case(m,x,z,y=0,w=1.15,h=.72,d=.82,mat='blue'):
    solid(m,(x,y+h/2,z),(w,h,d),mat)
    # Recessed middle panel, raised metal corner guards and functional latches.
    for zz in [-d/2-.012,d/2+.012]:
        m[0].box((x,y+h*.5,z+zz),(w*.72,h*.57,.025),'composite')
        for xx in [-w*.37,w*.37]:m[0].box((x+xx,y+h*.64,z+zz*1.025),(.07,.16,.04),'silver')
    for xx in [-w/2,w/2]:
        for zz in [-d/2,d/2]:m[0].box((x+xx,y+h/2,z+zz),(.075,h+.025,.075),'metal')
    for xx in [-w*.32,w*.32]:m[0].box((x+xx,y+h+.012,z),(.055,.025,d+.06),'silver')

def cabinet(m,x,z,y=0,w=.75,h=1.45,d=.55,mat='blue'):
    solid(m,(x,y+h/2,z),(w,h,d),mat)
    m[0].box((x,y+h*.52,z-d/2-.018),(w*.85,h*.86,.028),'composite')
    m[0].box((x+w*.29,y+h*.52,z-d/2-.045),(.045,.2,.04),'silver')
    for i in range(5):m[0].box((x,y+h*.74+i*.055,z-d/2-.036),(w*.6,.018,.035),'metal')
    for xx in [-w*.4,w*.4]:m[0].box((x+xx,y+.05,z),(.09,.10,d+.08),'metal')

def hvac(m,x,z,y,w=1.25,d=.95,h=.75):
    solid(m,(x,y+h/2,z),(w,h,d),'silver')
    for zz in [-d/2-.02,d/2+.02]:
        m[0].box((x,y+h*.53,z+zz),(w*.87,h*.69,.025),'metal')
        for i in range(8):m[0].box((x-w*.39+i*w*.11,y+h*.53,z+zz*1.04),(.027,h*.65,.03),'silver')
    rad=min(w,d)*.32
    cyl(m,(x,y+h+.01,z),(x,y+h+.045,z),rad,'metal',20,False)
    for r in [rad*.4,rad*.7,rad]:
        pts=[(x+r*math.cos(t),y+h+.055,z+r*math.sin(t)) for t in np.arange(24)*2*math.pi/24]
        for a,b in zip(pts,pts[1:]+pts[:1]):m[0].beam(a,b,.018,mat='silver')
    for j in range(4):
        a=j*math.pi/2;m[0].beam((x,y+h+.06,z),(x+rad*math.cos(a),y+h+.06,z+rad*math.sin(a)),.035,mat='metal')

def wall(m,a,b,y,h,door=False,windows=True,mat='plaster',skin=False,door_center=None,reserve_intervals=None):
    a,b=np.array(a,float),np.array(b,float);L=float(np.linalg.norm(b-a));u=(b-a)/L
    # Keep 0.75 inches of solid wall at corners for ladders and service runs.
    openings=[]
    dc=L*.5 if door_center is None else door_center
    if door:openings.append((dc-.76,dc+.76,0,2.22))
    if windows:
        for c in np.arange(1.6,L-1.05,1.85):
            if door and abs(c-dc)<1.6:continue
            if any(c+.55>lo and c-.55<hi for lo,hi in (reserve_intervals or [])):continue
            openings.append((c-.55,c+.55,.95,2.12))
    xs=sorted(set([0,L]+[max(0,min(L,t)) for o in openings for t in o[:2]]))
    ys=sorted(set([0,h]+[max(0,min(h,t)) for o in openings for t in o[2:]]))
    angle=-math.degrees(math.atan2(u[1],u[0]))
    for x1,x2 in zip(xs,xs[1:]):
        for y1,y2 in zip(ys,ys[1:]):
            cx,cy=(x1+x2)/2,(y1+y2)/2
            if any(o[0]<cx<o[1] and o[2]<=cy<o[3] for o in openings):continue
            if min(x2-x1,y2-y1)<.003:continue
            p=a+u*cx;solid(m,(p[0],y+cy,p[1]),(x2-x1,y2-y1,.18),mat,angle)
    for lo,hi,bottom,top in openings:
        for xx in [lo,hi]:
            p=a+u*xx;m[0].box((p[0],y+(bottom+top)/2,p[1]),(.055,top-bottom,.23),'metal',angle)
        p=a+u*((lo+hi)/2)
        for yy in [bottom,top]:m[0].box((p[0],y+yy,p[1]),(hi-lo+.06,.055,.25),'metal',angle)
        if bottom>0:m[0].box((p[0],y+bottom-.04,p[1]),(hi-lo+.16,.07,.34),'silver',angle)
    # Raised cladding belt is outside the masonry, not superimposed floor planes.
    if skin:
        normal=np.array([-u[1],u[0]])*.112
        p=(a+b)/2+normal
        m[0].box((p[0],y+h-.24,p[1]),(L,.23,.045),'blue',angle)

def staircase(m,sx,sz,width,run,rise,y=0):
    for i in range(12):
        height=rise*(i+1)/12
        solid(m,(sx,y+height/2,sz+run*(i+.5)/12),(width,height,run/12),'concrete')
    for side in [-1,1]:
        for i in [0,3,6,9,12]:
            p=np.array([sx+side*(width/2+.04),y+rise*i/12,sz+run*i/12])
            cyl(m,p,p+[0,.82,0],.026,'silver',6,False)
        m[0].beam((sx+side*(width/2+.04),y+.82,sz),(sx+side*(width/2+.04),y+rise+.82,sz+run),.035,mat='silver')

def cooling():
    m=pair();solid(m,(0,.07,0),(4.3,.14,2.15),'concrete')
    for x in [-1.05,.8]:
        hvac(m,x,0,.14,1.7,1.6,1.55)
        for zz in [-.55,.55]:cyl(m,(x-.65,.38,zz),(x+.65,.38,zz),.07,'silver',8,False)
    cabinet(m,1.55,.62,.14,.65,2.25,.65)
    for y in [.35,.62]:cyl(m,(-1.9,y,-.93),(1.8,y,-.93),.065,'silver',8,False)
    return register('cooling-installation',m)

def tanks():
    m=pair();solid(m,(0,.07,0),(3.65,.14,2.25),'concrete')
    for x in [-.8,.8]:
        cyl(m,(x,.2,0),(x,2.5,0),.64,'silver',20)
        cyl(m,(x,2.5,0),(x,2.73,0),.64,'silver',20,True,.25)
        for y in [.38,1.4,2.4]:
            cyl(m,(x,y-.025,0),(x,y+.025,0),.66,'metal',20,False)
        cyl(m,(x,2.73,0),(x,2.96,0),.075,'silver',8,False)
        for zz in [-.9,-.65]:cyl(m,(x,.44,zz),(x,.44,-.15),.055,'silver',8,False)
        cyl(m,(x,.42,-.71),(x,.74,-.71),.035,'rust',6,False)
        cyl(m,(x-.12,.74,-.71),(x+.12,.74,-.71),.026,'yellow',6,False)
    cabinet(m,1.35,-.52,.14,.65,1.7,.8)
    cyl(m,(-.8,.35,-.85),(1.4,.35,-.85),.08,'silver',10,False)
    return register('process-tanks',m)

def generator():
    m=pair();solid(m,(0,.06,0),(3.3,.12,1.9),'concrete')
    solid(m,(-.45,1.03,0),(2.2,1.94,1.55),'blue')
    for z in [-.79,.79]:
        m[0].box((-.7,1.05,z),(1.25,1.5,.025),'metal')
        for i in range(12):m[0].box((-.7,.43+i*.11,z*1.02),(1.2,.028,.035),'silver')
        m[0].box((.15,1.03,z),(.05,1.66,.035),'silver')
        m[0].box((.4,1,z*1.03),(.045,.25,.045),'silver')
    for x in [-1.25,.4]:solid(m,(x,.12,0),(.13,.16,1.8),'metal')
    cabinet(m,1.08,.1,.12,.65,1.35,.9,'tarp')
    cyl(m,(-.9,2,.4),(-.9,2.5,.4),.07,'silver',8,False)
    cyl(m,(-.9,2.5,.4),(-.62,2.5,.4),.07,'silver',8,False)
    return register('backup-generator',m)

def cargo(large=False):
    m=pair();case(m,-.65,0,w=1.45,h=.9,d=1.25);case(m,.8,.05,w=1.25,h=.85,d=1.15,mat='composite')
    case(m,-.55,-.05,.9,1.3,.85,1.15,'tarp')
    if large:case(m,.65,.05,.85,1.1,.85,1.0,'blue');case(m,-.45,-.05,1.75,1.05,.55,.9,'composite')
    for x in [-.95,-.65,-.35]:m[0].box((x,1.77 if not large else 2.32,-.05),(.04,.025,1.2 if not large else .95),'silver')
    case(m,.35,1.03,w=.85,h=.6,d=.7,mat='tarp')
    return register('cargo-large' if large else 'cargo-medium',m)

def maintenance():
    m=pair();solid(m,(-.85,.44,0),(1.2,.88,.85),'tarp')
    cyl(m,(-1.3,.8,0),(-.4,.8,0),.38,'tarp',14)
    solid(m,(-.83,1.32,0),(.7,.55,.65),'metal')
    for i in range(6):m[0].box((-.83,1.1+i*.07,-.34),(.65,.025,.04),'silver')
    cabinet(m,.2,0,0,.8,1.5,.75)
    for y in [.25,.48,.71,.94,1.17]:m[0].box((.2,y,-.4),(.7,.035,.035),'silver')
    for x in [1.15,2.1]:solid(m,(x,.5,0),(.1,1,.9),'metal')
    for y in [.3,.65,1]:
        for z in [-.24,.15]:cyl(m,(.85,y,z),(2.3,y,z),.12,'silver',10,False)
    # Pipe bundle collider leaves the rack readable without hundreds of parts.
    m[1].box((1.55,.66,0),(1.45,.9,.7),tile=10000)
    return register('maintenance-cluster',m)

def ellipsoid(mesh,center,radii,mat,n=8,rows=4):
    x,y,z=center;rx,ry,rz=radii
    rings=[]
    for j in range(rows+1):
        phi=-math.pi/2+j*math.pi/rows
        rings.append([(x+rx*math.cos(phi)*math.cos(t),y+ry*math.sin(phi),z+rz*math.cos(phi)*math.sin(t)) for t in np.arange(n)*2*math.pi/n])
    for j in range(rows):
        for i in range(n):mesh.face([rings[j][i],rings[j][(i+1)%n],rings[j+1][(i+1)%n],rings[j+1][i]],mat)

def planter(large=False):
    m=pair();random.seed(120+int(large));poly=Polygon([(-1.9,-.65),(1.9,-.65),(1.9,.65),(-.6,.65),(-.6,2),(-1.9,2)]) if large else box(-.8,-.65,.8,.65)
    # Hollow planter walls, inset soil surface and dense real-volume bushes.
    slab(m,poly.difference(poly.buffer(-.12,join_style=2)),0,.68,'concrete')
    slab(m,poly.buffer(-.12,join_style=2),.48,.12,'soil')
    x0,z0,x1,z1=poly.bounds
    for x in np.arange(x0+.32,x1,.43):
        for z in np.arange(z0+.3,z1,.43):
            if not poly.buffer(-.16).contains(Point(x,z)):continue
            h=random.uniform(1.2,1.75) if large else random.uniform(.95,1.3)
            # Branched shrub cores and individually shaped leaves avoid smooth
            # low-poly spheres. Leaf silhouettes are real geometry, not balls.
            for j in range(5):
                a=j*2.399;end=np.array([x+math.cos(a)*.28,h+.18,z+math.sin(a)*.28])
                cyl(m,(x,.56,z),end,.018,'rust',5,False)
            for j in range(72):
                a=random.random()*math.tau;v=random.uniform(-1,1);rad=random.random()**(1/3)
                ringrad=math.sqrt(1-v*v)
                center=np.array([x+.4*rad*ringrad*math.cos(a),h+.52*rad*v,z+.4*rad*ringrad*math.sin(a)])
                theta=random.random()*math.tau
                direction=np.array([math.cos(theta),random.uniform(-.5,.5),math.sin(theta)]);direction/=np.linalg.norm(direction)
                across=np.cross(direction,[0,1,0]);across/=np.linalg.norm(across)
                L=random.uniform(.12,.19);W=L*.42
                points=[center-direction*L,center+across*W+[0,.025,0],center+direction*L,center-across*W+[0,.025,0]]
                m[0].face(points,'foliage');m[0].face(points[::-1],'foliage')
            # Foliage volumes have matching solid cover; fine leaves remain visual.
            m[1].box((x,(h+.25)/2,z),(.57,h-.25,.57),tile=10000)
    return register('planter-large' if large else 'planter-small',m)
