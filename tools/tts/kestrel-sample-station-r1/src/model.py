"""Station hardware in table inches, with independent simplified native colliders."""
from base import *
from materials import uv
import math, random
TAU=math.tau
def v3(x):return np.array(x,dtype=float)
class Mesh:
    def __init__(self):self.faces=[];self.parts=0
    def part(self):self.parts+=1
    def face(self,verts,mat,center=None,coords=None):
        v=np.array(verts,float)
        if coords is None:
            normal=np.cross(v[1]-v[0],v[2]-v[0]);drop=np.argmax(np.abs(normal));axes=([2,1],[0,2],[0,1])[drop];p=v[:,axes];span=np.ptp(p,axis=0);coords=(p-p.min(axis=0))/np.maximum(span,.0001)
        tex=np.array([uv(mat,*p) for p in coords])
        if center is not None and np.dot(np.cross(v[1]-v[0],v[2]-v[0]),v.mean(axis=0)-center)<0:
            v=v[::-1];tex=tex[::-1]
        self.faces.append((self.parts,v,tex))
    def box(self,c,s,mat='ivory',bevel=0):
        self.part();x,y,z=c;w,h,d=s;X=w/2;Z=d/2;b=min(bevel,.45*min(w,d))
        ring=[(-X+b,-Z),(X-b,-Z),(X,-Z+b),(X,Z-b),(X-b,Z),(-X+b,Z),(-X,Z-b),(-X,-Z+b)] if b>0 else [(-X,-Z),(X,-Z),(X,Z),(-X,Z)]
        lower=[(x+i,y-h/2,z+j)for i,j in ring];upper=[(a,y+h/2,k)for a,_,k in lower]
        self.face(lower,mat,v3(c));self.face(upper,mat,v3(c))
        for k in range(len(ring)):
            j=(k+1)%len(ring);self.face([lower[k],lower[j],upper[j],upper[k]],mat,v3(c))
    def tube(self,a,b,r,mat='steel',n=10,r2=None):
        a,b=v3(a),v3(b);axis=b-a;axis/=np.linalg.norm(axis);ref=v3([1,0,0] if abs(axis[0])<.85 else [0,1,0]);u=np.cross(axis,ref);u/=np.linalg.norm(u);v=np.cross(axis,u)
        ds=[math.cos(TAU*i/n)*u+math.sin(TAU*i/n)*v for i in range(n)]
        lo=[a+r*p for p in ds];hi=[b+(r if r2 is None else r2)*p for p in ds];c=(a+b)/2
        self.part();self.face(lo,mat,c);self.face(hi,mat,c)
        for i in range(n):j=(i+1)%n;self.face([lo[i],lo[j],hi[j],hi[i]],mat,c,[(i/n,0),((i+1)/n,0),((i+1)/n,1),(i/n,1)])
    def label(self,c,w,h,key,side=-1):
        x,y,z=c
        ps=[(x-i*side*w/2,y+j*h/2,z) for i,j in [(-1,-1),(1,-1),(1,1),(-1,1)]]
        self.part();self.face(ps,key,v3([x,y,z-side]),[(0,0),(1,0),(1,1),(0,1)])
    def save(self,file,collider=False):
        verts={};tex={};faces=[];last=None
        for part,v,u in self.faces:
            if collider and part!=last:faces.append('o hull_%03d'%part);last=part
            pairs=[]
            for pt,uvv in zip(v,u):
                xyz=tuple(np.round(pt*[-1,1,1],5));ij=tuple(np.round(uvv,5));vi=verts.setdefault(xyz,len(verts)+1);ti=tex.setdefault(ij,len(tex)+1)
                pairs.append(str(vi) if collider else f'{vi}/{ti}')
            for i in range(1,len(pairs)-1):faces.append('f '+' '.join([pairs[0],pairs[i+1],pairs[i]]))
        data=['# Kestrel sample station. Native TTS right-handed OBJ.']+['v %.5f %.5f %.5f'%p for p in verts]
        if not collider:data+=['vt %.5f %.5f'%p for p in tex]
        (ASSETS/file).write_text('\n'.join(data+faces)+'\n')
        assert len(verts)<23000 and (not collider or len(verts)<255), (file,len(verts))
class Model:
    def __init__(self):self.m=Mesh();self.c=Mesh()
    def solid(self,p,s,mat='ivory',b=.06):
        self.m.box(p,s,mat,b);self.c.box(p,s,mat,min(b,.09))
    def shell(self,p,s,mat='ivory',b=.05):self.m.box(p,s,mat,b)
    def tube(self,a,b,r,mat='steel',n=10,r2=None): self.m.tube(a,b,r,mat,n,r2)
    def plate(self,x,y,z,w,h,key,sign=-1):
        self.shell((x,y,z),(w+.07,h+.07,.045),'graphite',.01)
        self.m.label((x,y,z+sign*.025),w,h,key,sign)
    def pipe(self,points,r,mat):
        for a,b in zip(points,points[1:]):self.tube(a,b,r,mat,10)
    def save(self,name):
        self.m.save(name+'.obj');self.c.save(name+'-collider.obj',True)
def feet(q,x,z):
    for xx in (-x,x):
        for zz in (-z,z):
            q.shell((xx,.06,zz),(.40,.12,.38),'graphite',.06)
            q.tube((xx,.10,zz),(xx,.27,zz),.105,'steel',8)
def ring(q,a,b,r,mat='saffron'):q.tube(a,b,r,mat,16)
def handrail(q,pts,r=.037,mat='saffron'):q.pipe(pts,r,mat)
def intake(closed):
    q=Model();m=q.m
    q.solid((0,.055,0),(3.02,.11,2.62),'steel',.10)
    for x in [-1.39,1.39]:
        q.solid((x,1.08,0),(.24,2.06,2.59),'ivory')
        for z in [-1.22,-.8,.1,.89,1.22]:q.shell((x,1.10,z),(.32,2.08,.09),'steel')
        q.shell((x*1.037,.53,.07),(.11,.53,1.82),'teal')
        q.shell((x*1.051,1.55,-.03),(.07,.58,1.55),'graphite')
        for n in range(9):q.shell((x*1.079,1.55,-.66+n*.15),(.045,.48,.045),'steel',0)
    for z in [-1.24,1.24]:
        for x in [-1.16,1.16]:
            q.solid((x,1.03,z),(.24,2.0,.23),'graphite')
            q.shell((x,1.12,z),(.15,2.01,.26),'saffron')
            q.shell((x,.39,z),(.19,.13,.275),'seal')
        if closed:q.solid((0,2.13,z),(2.57,.25,.28),'ivory')
    for z in [-.88,-.58,-.28,.02,.32,.62,.92]:q.shell((0,.117,z),(2.03,.013,.13),'grate',.005)
    for z in [-1.05,.98]:
        q.shell((-1.19,.88,z),(.13,.37,.17),'graphite');q.shell((-1.105,.92,z),(.04,.16,.14),'light')
    q.pipe([(-1.58,.34,-.94),(-1.58,.34,.95),(-1.58,1.17,1.09)],.045,'saffron')
    if closed:
        q.solid((0,2.32,0),(3.08,.20,2.68),'ivory',.12)
        q.shell((0,2.45,.02),(2.59,.07,2.03),'foil',.11)
        for x in [-1.05,-.52,.52,1.05]:q.shell((x,2.51,.03),(.06,.06,1.98),'graphite')
        for z in [-1.14,1.14]:q.shell((0,2.48,z),(2.85,.10,.11),'steel')
        for z,side in [(-1.39,-1),(1.39,1)]:q.plate(.01,2.22,z,1.30,.31,'intake',side)
    return q
def corevault():
    q=Model();feet(q,1.53,.51)
    q.solid((0,.25,0),(3.70,.31,1.53),'graphite',.10)
    q.solid((0,1.08,.47),(3.70,1.52,.46),'teal',.07)
    for x in [-1.66,0,1.66]:
        q.shell((x,1.09,.48),(.09,1.65,.56),'steel')
    for x in [-1.20,-.02,1.15]:
        q.tube((x-.44,.79,-.25),(x+.44,.79,-.25),.37,'foil',16)
        for dx in [-.38,-.26,.30,.39]:
            q.tube((x+dx-.02,.79,-.25),(x+dx+.02,.79,-.25),.39,'steel' if abs(dx)>.35 else 'graphite',16)
        q.shell((x,.46,-.23),(.91,.15,.78),'seal')
        q.shell((x,1.23,-.18),(.38,.09,.13),'saffron')
    q.solid((0,.72,-.22),(3.32,.65,.66),'foil')
    q.plate(-.73,1.45,.222,1.04,.45,'corevault')
    return q
def power():
    q=Model();feet(q,1.74,.49);q.solid((0,.20,0),(3.82,.30,1.24),'graphite',.14)
    for x in [-1.17,0,1.17]:
        q.solid((x,1.06,.04),(1.10,1.52,1.02),'teal' if x else 'ivory',.10)
        q.shell((x,1.89,.04),(1.15,.13,1.12),'steel',.08)
        q.shell((x,1.28,-.49),(.85,.86,.055),'graphite',.02)
        if x:
            for j in range(8):q.shell((x,1.0+j*.092,-.54),(.73,.039,.07),'steel',.008)
        else:
            q.plate(x,1.28,-.57,.69,.69,'power')
        q.shell((x,.54,-.46),(.41,.15,.10),'saffron')
    for z in [.28,.53]:q.pipe([(-1.77,1.79,z),(-1.77,2.11,z),(1.77,2.11,z),(1.77,1.79,z)],.055,'saffron' if z<.4 else 'steel')
    return q
def suits():
    q=Model();q.solid((0,.09,0),(4.08,.18,1.44),'grate',.12)
    q.solid((0,1.26,.42),(4.0,2.35,.42),'teal',.12)
    q.solid((0,2.55,.04),(4.12,.18,1.41),'ivory',.14)
    for x in [-1.19,0,1.19]:
        q.shell((x,1.40,.14),(.90,1.87,.12),'graphite',.11)
        q.tube((x,1.65,-.07),(x,1.91,-.07),.249,'ivory',16,.19)
        q.shell((x,1.78,-.26),(.34,.16,.11),'glass',.035)
        q.shell((x,1.26,-.09),(.58,.57,.36),'cloth',.13)
        q.shell((x,1.30,-.29),(.27,.24,.10),'ivory',.025)
        for dx in [-.22,.22]:
            q.tube((x+dx*.57,.44,-.02),(x+dx*.63,1.04,-.01),.108,'cloth',10,.12)
            q.tube((x+dx*1.55,1.10,-.08),(x+dx*1.16,1.49,-.06),.105,'cloth',10)
            q.shell((x+dx*.64,.39,-.07),(.24,.13,.36),'seal')
        q.pipe([(x+.32,1.43,.04),(x+.44,1.29,-.01),(x+.46,.89,-.01),(x+.33,.80,.07)],.035,'saffron')
    q.plate(0,2.32,.17,1.48,.34,'suits')
    return q
def drill():
    q=Model();feet(q,1.08,.62);q.solid((0,.26,0),(2.56,.40,1.66),'graphite',.16)
    q.solid((.38,.98,.26),(1.48,1.17,.85),'saffron',.13)
    q.shell((.38,1.61,.26),(1.50,.09,.93),'ivory')
    for j in range(7):q.shell((.76, .72+j*.108,-.192),(.45,.055,.09),'graphite')
    q.plate(.02,1.08,-.20,.55,.57,'drill')
    for z in [-.39,.05]:
        q.tube((-.78,.38,z),(-.65,2.82,z),.065,'steel')
        q.tube((-.34,.38,z),(-.65,2.82,z),.042,'saffron')
    for h in [.80,1.25,1.70,2.15,2.6]:q.tube((-.84+.065*h,h,-.41),(-.59,h,.06),.035,'ivory',8)
    q.tube((-.64,.12,-.22),(-.64,2.66,-.22),.09,'steel',12)
    q.shell((-.64,1.73,-.20),(.46,.4,.57),'saffron')
    for x in [-.85,-.45]:q.tube((x,.42,-.57),(x,.42,-.77),.20,'seal')
    q.pipe([(-.69,2.69,-.46),(-.54,2.9,-.47),(-.34,2.62,-.48),(-.07,1.51,-.48),(.26,1.36,-.43)],.035,'graphite')
    q.c.box((-.67,1.55,-.20),(.37,2.43,.45),'steel')
    return q
def shield(key):
    q=Model()
    for x,w,h in [(-.96,1.67,2.05),(.85,1.9,1.82)]:
        q.solid((x,h*.49,0),(w,h,.99),'cloth',.075)
        q.shell((x,.09,0),(w+.04,.115,1.02),'graphite')
        for z in [-.51,.51]:
            for i in range(9):q.shell((x-w*.45+i*w*.112, h*.50,z),(.018,h*.89,.018),'steel',0)
            for j in range(4):q.shell((x,.20+j*h*.22,z),(w,.018,.021),'steel',0)
        q.shell((x,h+.015,0),(w-.12,.07,.82),'basalt',.13)
        for j in [-.38,.38]:
            for z in [-.48,.48]:
                q.pipe([(x+j*w,h-.20,z),(x+j*w,h+.11,z),(x+j*w+.12,h+.11,z),(x+j*w+.12,h-.1,z)],.024,'steel')
    q.plate(-.96,1.14,-.535,.78,.52,key)
    return q
def water():
    q=Model();q.solid((0,.18,0),(3.66,.28,1.46),'graphite',.12)
    for x in [-.94,.40]:
        q.tube((x-.58,1.02,0),(x+.58,1.02,0),.67,'foil',20)
        q.tube((x-.72,1.02,0),(x-.58,1.02,0),.47,'ivory',20,.67)
        q.tube((x+.58,1.02,0),(x+.72,1.02,0),.67,'ivory',20,.47)
        for dx in [-.44,.44]:q.tube((x+dx-.037,1.02,0),(x+dx+.037,1.02,0),.69,'steel',20)
        q.c.tube((x-.68,1.0,0),(x+.68,1.0,0),.66,'steel',12)
    q.solid((1.47,1.10,.04),(.72,1.64,1.30),'teal',.12);q.plate(1.46,1.32,-.63,.55,.58,'water')
    for z in [-.24,.24]:q.pipe([(-1.59,1.39,z),(-1.59,1.80,z),(1.46,1.80,z),(1.46,1.95,z)],.05,'steel' if z>0 else 'teal')
    return q
def passage(closed,long=False):
    q=Model();q.solid((0,.094,0),(2.39,.188,2.95),'grate',.07)
    q.solid((1.09,1.06,0),(.20,1.99,2.96),'teal',.08)
    for z in [-1.16,1.16]:q.solid((-1.09,1.06,z),(.20,1.99,.56),'teal',.04)
    for z in [-1.40,-1.24,-1.08,-.91,.91,1.08,1.24,1.40]:
        for xx in [-1.06,1.06]:
            q.shell((xx,.99,z),(.33,1.91,.053),'graphite' if abs(z)>1.31 else 'ivory',.01)
        if closed:q.shell((0,2.13,z),(2.42,.106,.078),'ivory')
    for z in [-.79,-.55,-.31,-.07,.17,.41,.65]:
        q.shell((1.197,1.20,z),(.068,.85,.108),'ivory',.02)
    for z in [-.84,.84]:
        q.shell((-1.12,1.08,z),(.28,2.03,.095),'saffron')
    q.shell((-1.26,.15,0),(.28,.12,1.58),'steel',.04)
    if closed:
        q.solid((0,2.065,0),(2.39,.21,2.96),'ivory',.10)
        q.shell((0,2.21,0),(1.76,.080,1.48),'teal',.10)
        for z in [-.51,-.23,.11,.39]:
            q.shell((0,2.266,z),(1.43,.04,.032),'steel')
        q.pipe([(.57,2.18,-1.34),(.57,2.29,-1.14),(.57,2.29,.99),(.57,2.18,1.28)],.039,'saffron')
    if long:
        # Retain a person-sized EVA hatch at midspan and stretch the sealed bays towards both buildings.
        def extend(z):return float(z) if abs(z)<.84 else math.copysign(.84+(abs(z)-.84)*2.5875,z)
        for mesh in (q.m,q.c):
            for _,verts,_ in mesh.faces:verts[:,2]=[extend(z) for z in verts[:,2]]
        for end in [-1,1]:
            for z in [1.58,1.80,2.03,2.28]:
                for x in [-1.06,1.06]:q.shell((x,1.0,z*end),(.36,1.86,.065),'graphite',.015)
        if closed:
            q.shell((0,2.20,-1.60),(1.70,.08,.65),'teal')
            for z in [-1.55,1.55]:q.shell((0,2.23,z),(2.38,.12,.10),'ivory')
    return q
def rock(key,length,width,peak,seed):
    q=Model();r=random.Random(seed);rings=[]
    # A continuous wedge crosses the board edge, splitting into a low, asymmetric toe.
    for t,wy,zh in [(0,1.,.95),(.16,.97,1.),(.38,.79,.89),(.57,.74,.72),(.73,.58,.52),(.90,.42,.31),(1,.17,.08)]:
        x=t*length;mid=.22*math.sin(t*4+seed)*width;hw=wy*width*.5;h=peak*zh
        ring=[(x,-.13,mid-hw),(x,.24*h,mid-hw*1.01),(x,.49*h,mid-hw*.74),
              (x,.77*h,mid-hw*.62),(x,h,mid-hw*.17),(x,.87*h,mid+hw*.27),
              (x,.56*h,mid+hw*.71),(x,.22*h,mid+hw*.96),(x,-.13,mid+hw)]
        rings.append(np.array(ring))
    for i,(left,right) in enumerate(zip(rings,rings[1:])):
        center=np.vstack([left,right]).mean(axis=0)
        for dest in [q.m,q.c]:
            dest.part()
            if dest is q.c or i==0:dest.face(left,'basalt',center)
            if dest is q.c or i==len(rings)-2:dest.face(right,'basalt',center)
            for j in range(len(left)):
                k=(j+1)%len(left)
                quad=[left[j],left[k],right[k],right[j]]
                if j in (2,3,5,6):
                    dest.face([quad[0],quad[1],quad[2]],'basalt',center)
                    dest.face([quad[0],quad[2],quad[3]],'basalt',center)
                else:dest.face(quad,'basalt',center)
    return q
def build_models():
    for key,fn in [('intake-open',lambda:intake(False)),('intake-closed',lambda:intake(True)),('corevault',corevault),('power',power),('suits',suits),('drill',drill),('westshield',lambda:shield('westshield')),('northshield',lambda:shield('northshield')),('water',water),('transfer-open',lambda:passage(False,True)),('transfer-closed',lambda:passage(True,True)),('passage-open',lambda:passage(False)),('passage-closed',lambda:passage(True))]:
        q=fn();q.save(key)
    for key,l,w,h,seed in [('westlip',2.75,2.08,2.03,13),('eastlip',3.21,2.43,2.28,37),('northlip',2.21,1.90,2.04,43),('southlip',1.92,2.21,1.94,91)]:rock(key,l,w,h,seed).save(key)
if __name__=='__main__':build_models()
