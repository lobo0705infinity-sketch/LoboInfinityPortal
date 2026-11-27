"""Rebuild four watertight, matching highland quadrants with a single land surface."""
from common import *
import numpy as np

STEP=.3
SIZE=161
AX=np.linspace(-24,24,SIZE)
X,Z=np.meshgrid(AX,AX)
LEVEL=3.25
BOTTOM=1.
def smooth(x):
    x=np.clip(x,0,1)
    return x*x*(3-2*x)
def surface():
    # The source exporter used a 0.3-inch grid before splitting each crater into three objects.
    # The surrounding hills are recovered from the surface layer at its original grid points.
    heights=np.full((SIZE,SIZE),-np.inf)
    for o in ORIGINAL['ContainedObjects']:
        if not o['GUID'].startswith('c7b'):continue
        verts,_=mesh(resource(o['CustomMesh']['MeshURL']))
        x,z=-verts[:,0],verts[:,2]
        ix=np.rint((x+24)/STEP).astype(int);iz=np.rint((z+24)/STEP).astype(int)
        keep=(abs(x-AX[ix])<.00001)&(abs(z-AX[iz])<.00001)&(verts[:,1]>1.01)
        np.maximum.at(heights,(iz[keep],ix[keep]),verts[keep,1])
    assert np.isfinite(heights).all()
    features=read(DATA/'layout.json')['landforms']
    # Even the diffuse outer ejecta can extend beyond the visibly depressed bowl.
    for c in features:
        if c['kind']=='crater':
            cx,cz=c['center'];heights[np.hypot(X-cx,Z-cz)<=1.53*c['radius']]=LEVEL
    assert heights.min()>=LEVEL-1e-6,heights.min()
    # The standalone western spur intersected an existing raised spine. Retire that
    # whole spine here and sculpt a single ridge all the way to the western edge.
    west=(X<-21.83)&(Z>=-10.8)&(Z<=-6.30)
    heights[west]=LEVEL
    for edge,coord,length,width,peak,bend in [
        ('west',-8.85,1.76,1.18,2.24,.22),('east',1.69,1.49,1.25,2.29,-.22),
        ('north',-3.89,2.22,1.05,2.29,.30),('south',-8.58,2.04,1.10,2.28,.13)]:
        into,along={'west':(24+X,Z),'east':(24-X,Z),'north':(24-Z,X),'south':(24+Z,X)}[edge]
        t=np.clip(into/length,0,1)
        centre=coord+bend*t+.11*np.sin(t*4)
        a=np.abs(along-centre)/(width*(1-.38*t))
        shape=(1-smooth((a-.13)/.87))*(1-smooth((t-.31)/.69))
        crown=peak*(.965+.035*np.cos(4.7*t))
        heights=np.maximum(heights,LEVEL+crown*shape)
    # A shallow, ramped maintenance pad on the crew side. Its floor is part of the grade.
    bay=smooth((X-20.96)/.46)*smooth((24-X)/.38)*smooth((Z-14.36)/.92)*smooth((19.56-Z)/.52)
    heights+=(LEVEL-.14-heights)*bay
    # A sealed sample trolley cannot climb natural rock. Grade the full cart lane
    # and taper disturbed regolith into the untouched ridge beside its shoulder.
    from cartway import station_route
    from scipy.spatial import cKDTree
    centres=np.vstack([np.asarray([g.interpolate(t).coords[0] for t in np.linspace(0,g.length,1+int(g.length/.035))]) for g in station_route()])
    dist,_=cKDTree(centres).query(np.c_[X.ravel(),Z.ravel()])
    shoulder=smooth((dist.reshape(X.shape)-1.07)/.80)
    heights=LEVEL+(heights-LEVEL)*shoulder
    return heights

class Objs:
    def __init__(self,display):
        self.display=display;self.positions={};self.uv={};self.normals={};self.faces=[];self.parts=0
    @staticmethod
    def index(store,point):return store.setdefault(tuple(round(float(v),6) for v in point),len(store)+1)
    def face(self,ps,normals=None):
        p=np.array(ps,dtype=float);normal=np.cross(p[1]-p[0],p[2]-p[0]);normal/=np.linalg.norm(normal)
        axes=([2,1],[0,2],[0,1])[np.argmax(abs(normal))]
        corners=[]
        for i,pt in enumerate(p):
            vi=self.index(self.positions,(-pt[0],pt[1],pt[2]))
            if self.display:
                tex=self.index(self.uv,(pt[list(axes)]+24)/48)
                n=normal if normals is None else normals[i]
                ni=self.index(self.normals,(-n[0],n[1],n[2]));corners.append(f'{vi}/{tex}/{ni}')
            else:corners.append(str(vi))
        for i in range(1,len(corners)-1):self.faces.append(f'f {corners[0]} {corners[i+1]} {corners[i]}')
    def part(self):
        self.parts+=1;self.faces.append(f'o hull_{self.parts}')
    def prism(self,top,normals=None):
        bottom=[(x,BOTTOM,z) for x,_,z in top]
        self.part();self.face(top,normals);self.face(bottom[::-1])
        for i in range(len(top)):
            j=(i+1)%len(top);self.face([top[j],top[i],bottom[i],bottom[j]])
    def save(self,p):
        lines=['# Kestrel R2 - native 48-inch TTS table units']
        for store,label in [(self.positions,'v'),(self.uv,'vt'),(self.normals,'vn')]:
            lines += [label+' '+' '.join(f'{v:.6f}'.rstrip('0').rstrip('.') or '0' for v in point) for point in store]
        p.write_text('\n'.join(lines+self.faces)+'\n')

def tile(i0,j0,h,n,number):
    graphic,collider=Objs(True),Objs(False)
    def point(i,j):return (AX[i],h[j,i],AX[j])
    def tri(ids):
        v=[point(i,j) for i,j in ids];norms=[n[j,i] for i,j in ids]
        graphic.face(v,norms);collider.prism(v)
    # Horizontal quads can be combined. Walls of collider components are buried and
    # never sent to the visible mesh. Every square contributes once to the top.
    localh=h[j0:j0+81,i0:i0+81];flat=np.ones((80,80),bool)
    for di,dj in [(0,0),(1,0),(0,1),(1,1)]:flat &= np.abs(localh[dj:dj+80,di:di+80]-LEVEL)<1e-7
    handled=np.zeros_like(flat)
    for j in range(80):
        for i in range(80):
            if handled[j,i]:continue
            ix=i+i0;iz=j+j0
            if flat[j,i]:
                x1=i+1
                while x1<80 and flat[j,x1] and not handled[j,x1]:x1+=1
                z1=j+1
                while z1<80 and np.all(flat[z1,i:x1]&~handled[z1,i:x1]):z1+=1
                handled[j:z1,i:x1]=True
                # Split the display's flat top into the native grid. This gives
                # adjacent faces identical edges and shading even at the toes of ridges.
                for lz in range(j,z1):
                    for lx in range(i,x1):
                        a=lx+i0;b=lz+j0
                        ids=[(a,b),(a,b+1),(a+1,b+1),(a+1,b)]
                        graphic.face([point(*v) for v in ids],[n[z,x] for x,z in ids])
                top=[point(ix,iz),point(ix,z1+j0),point(x1+i0,z1+j0),point(x1+i0,iz)]
                collider.prism(top)
            else:
                tri([(ix,iz),(ix,iz+1),(ix+1,iz+1)])
                tri([(ix,iz),(ix+1,iz+1),(ix+1,iz)])
    # Only the outside boundary has a visible vertical face. Adjacent quadrants
    # share vertices and have no coincident interior skirts.
    for j in range(j0,j0+80):
        for i in [i0,i0+80]:
            if i not in [0,160]:continue
            a,b=point(i,j),point(i,j+1)
            if i==160:a,b=b,a
            graphic.face([b,a,(a[0],BOTTOM,a[2]),(b[0],BOTTOM,b[2])])
    for i in range(i0,i0+80):
        for j in [j0,j0+80]:
            if j not in [0,160]:continue
            a,b=point(i,j),point(i+1,j)
            if j==0:a,b=b,a
            graphic.face([b,a,(a[0],BOTTOM,a[2]),(b[0],BOTTOM,b[2])])
    graphic.face([(AX[i0],BOTTOM,AX[j0]),(AX[i0+80],BOTTOM,AX[j0]),(AX[i0+80],BOTTOM,AX[j0+80]),(AX[i0],BOTTOM,AX[j0+80])])
    graphic.save(OUT/f'highlands-{number}.obj');collider.save(OUT/f'highlands-{number}-collider.obj')
    print(number,len(graphic.positions),'visual vertices;',collider.parts,'convex collider parts',flush=True)
if __name__=='__main__':
    h=surface();dz,dx=np.gradient(h,STEP);normals=np.stack([-dx,np.ones_like(h),-dz],axis=-1)
    normals/=np.linalg.norm(normals,axis=-1)[:,:,None]
    for i in range(2):
        for j in range(2):tile(i*80,j*80,h,normals,1+2*i+j)
    np.save(W/'native-heights.npy',h)
