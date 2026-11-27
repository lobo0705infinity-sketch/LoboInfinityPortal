"""Freeport hardware in table inches, with independent simplified native colliders."""
from yard import A as ASSETS, np
from finishes import uv
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
        data=['# Vanta Customs Yard. Native TTS right-handed OBJ.']+['v %.5f %.5f %.5f'%p for p in verts]
        if not collider:data+=['vt %.5f %.5f'%p for p in tex]
        (ASSETS/file).write_text('\n'.join(data+faces)+'\n')
        assert len(verts)<23000 and (not collider or len(verts)<1200), (file,len(verts))
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
