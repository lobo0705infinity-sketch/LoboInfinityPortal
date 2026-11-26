"""Z-up model in tabletop inches. OBJ is exported in TTS coordinates with explicit smooth normals and per-part UVs."""
import math, itertools
from pathlib import Path
import numpy as np
from scipy.spatial import ConvexHull
from scipy.spatial.transform import Rotation
from finish import INDEX,COLS,OUT,UNBAKED

def unit(a):
    a=np.array(a,float)
    return a/max(np.linalg.norm(a),1.e-12)

def rotation(angles):
    return Rotation.from_euler('xyz',angles,degrees=True).as_matrix()

def ring_rect(w,d,r,n=3):
    r=min(r,w*.47,d*.47)
    if r<.0001:return [(-w/2,-d/2),(w/2,-d/2),(w/2,d/2),(-w/2,d/2)]
    out=[]
    for cx,cy,start in [(w/2-r,d/2-r,0),(-w/2+r,d/2-r,90),(-w/2+r,-d/2+r,180),(w/2-r,-d/2+r,270)]:
        for ang in np.linspace(start,start+90,n+1):
            a=math.radians(ang);out.append((cx+r*math.cos(a),cy+r*math.sin(a)))
    return out

def from_z(direction):
    z=unit(direction);axis=(0,1,0) if abs(z[1])<.93 else (1,0,0)
    x=unit(np.cross(axis,z));return np.column_stack((x,np.cross(z,x),z))

def to_obj(v):return -v[0],v[2],v[1]
def fmt(n):return f'{n:.6f}'.rstrip('0').rstrip('.') if abs(n)>.0000005 else '0'

class Mesh:
    def __init__(self,name):
        self.name=name;self.surfaces=[];self.hulls=[];self.origin=np.zeros(3);self.axes=np.eye(3)
    def at(self,xyz,rot=(0,0,0)):
        sub=Mesh(self.name);sub.origin=self.origin+self.axes@xyz
        sub.axes=self.axes@rotation(rot);sub.surfaces=self.surfaces;sub.hulls=self.hulls
        return sub
    def surface(self,verts,faces,mat,physical=False,smooth=False,manual=None):
        p=np.array(verts,float);f=[list(q) for q in faces];normals=[]
        for q in f:normals.append(unit(np.cross(p[q[1]]-p[q[0]],p[q[2]]-p[q[0]])))
        mmin=p.min(0);span=np.maximum(p.max(0)-mmin,.00001)
        uvs=[]
        for i,q in enumerate(f):
            if manual is not None:
                uvs.append(manual[i]);continue
            axis=np.argmax(abs(normals[i]));uvaxes=[(1,2),(0,2),(0,1)][axis]
            if axis==2 and span[1]>span[0]*1.6:uvaxes=(1,0)
            if axis in (0,1) and span[2]>span[uvaxes[0]]*2:uvaxes=uvaxes[::-1]
            j,k=uvaxes;uvs.append([((p[v,j]-mmin[j])/span[j],(p[v,k]-mmin[k])/span[k]) for v in q])
        world=p@self.axes.T+self.origin
        self.surfaces.append((world,f,np.array(normals)@self.axes.T,mat,uvs,smooth))
        if physical:self.hulls.append(world)
    def solid(self,verts):
        self.hulls.append(np.array(verts)@self.axes.T+self.origin)
    def rings(self,rings,mat,physical=False,smooth=True):
        n=len(rings[0]);vs=sum((list(ring) for ring in rings),[])
        faces=[list(range(n-1,-1,-1))]
        for j in range(len(rings)-1):
            for i in range(n):
                a=j*n+i;b=j*n+(i+1)%n;faces.append([a,b,b+n,a+n])
        faces.append(list(range((len(rings)-1)*n,len(rings)*n)))
        self.surface(vs,faces,mat,physical,smooth)
    def box(self,xyz,size,mat,r=.0,b=.0,rot=(0,0,0),physical=False,n=2):
        w,d,h=size
        if min(w,d,h)<.044 and max(w,d,h)<1.6:
            n=1
            if b<.013: b=0
        b=min(b,h*.43,w*.15,d*.15);g=self.at(xyz,rot)
        levels=[(-h/2,0),(h/2,0)] if b<.0001 else [(-h/2,b),(-h/2+b,0),(h/2-b,0),(h/2,b)]
        rings=[[(x,y,z) for x,y in ring_rect(w-2*ins,d-2*ins,max(r-ins,.0002) if r else 0,n)]for z,ins in levels]
        g.rings(rings,mat,physical,True)
    def tube(self,a,b,r,mat,n=9,physical=False,r2=None):
        a=np.array(a,float);b=np.array(b,float);frame=from_z(b-a);r2=r if r2 is None else r2
        rings=[[p+frame@np.array((r0*math.cos(u),r0*math.sin(u),0)) for u in np.arange(n)*2*math.pi/n] for p,r0 in [(a,r),(b,r2)]]
        self.rings(rings,mat,physical,True)
    def path(self,pts,r,mat,n=7):
        for a,b in zip(pts,pts[1:]):self.tube(a,b,r,mat,n)
    def tyre(self,pos,r,width,mat='tyre',n=20):
        x,y,z=pos;profile=[(-.50,.62),(-.49,.82),(-.40,.96),(-.23,1),(.23,1),(.40,.96),(.49,.82),(.50,.62)]
        rings=[[np.array((x+a*width,y+r*b*math.cos(i*2*math.pi/n),z+r*b*math.sin(i*2*math.pi/n)))for i in range(n)] for a,b in profile]
        self.rings(rings,mat,False,True)
        samples=sorted(set(range(0,n,2))|{n//4,n//2,3*n//4})
        self.solid([rr[i] for rr in (rings[1],rings[-2],rings[3],rings[-4]) for i in samples])
    def hoop(self,center,normal,radius,thick,mat,n=16,s=6):
        frame=from_z(normal);verts=[];faces=[]
        for i in range(n):
            u=2*math.pi*i/n;rad=np.array([math.cos(u),math.sin(u),0])
            for j in range(s):
                v=2*math.pi*j/s
                verts.append(np.array(center)+frame@(rad*(radius+thick*math.cos(v))+[0,0,thick*math.sin(v)]))
        for i in range(n):
            for j in range(s):faces.append([i*s+j,((i+1)%n)*s+j,((i+1)%n)*s+(j+1)%s,i*s+(j+1)%s])
        self.surface(verts,faces,mat,smooth=True)
    def wheel(self,x,y,r=.096):
        self.tyre((x,y,r),r,r*.63,'rubber',12)
        for side in (-1,1):
            xx=x+side*r*.37
            self.tube((xx-.01,y,r),(xx+.01,y,r),r*.37,'edge',9)
            self.box((x+side*r*.42,y+.018,r*1.53),(.023,.062,r*.98),'steel',rot=(14,0,0))
        self.tube((x,y+.03,r*1.91),(x,y+.03,r*2.36),r*.35,'iron',8)
    def write(self):
        vertices={};norms={};uvs={};tri=[]
        def idx(store,arr):
            t=tuple(round(float(v),6)for v in arr)
            if t not in store:store[t]=len(store)+1
            return store[t]
        for part,(p,faces,normals,mat,uvset,smooth) in enumerate(self.surfaces):
            ids=[idx(vertices,to_obj(v))for v in p];adj=[[]for v in p]
            for i,q in enumerate(faces):
                for v in q:adj[v].append(i)
            mi=INDEX[mat];col,row=mi%COLS,mi//COLS
            for i,q in enumerate(faces):
                corners=[]
                for j,v in enumerate(q):
                    good=[normals[k]for k in adj[v] if np.dot(normals[k],normals[i])>.63] if smooth else [normals[i]]
                    normal=unit(np.sum(good,0)); u,vv=uvset[i][j]
                    if mat in ('teak','plywood','linen','cream','bag','leather','saddle','iron','alloy','rubber'):
                        # Give each plank and each folded textile a distinct cut from the same material.
                        span=.67+.24*((part*37%101)/100)
                        u=(1-u if part%2 else u)*span+(1-span)*((part*53%97)/96)
                        vv=vv*span+(1-span)*((part*71%89)/88)
                    uv=((col+.025+.95*u)/COLS,1-(row+.975-.95*vv)/COLS)
                    corners.append(f'{ids[v]}/{idx(uvs,uv)}/{idx(norms,to_obj(normal))}')
                for j in range(1,len(q)-1):
                    if np.linalg.norm(np.cross(p[q[j]]-p[q[0]],p[q[j+1]]-p[q[0]]))>1.e-10:
                        tri.append('f '+' '.join((corners[0],corners[j],corners[j+1])))
        data=['# Azure Palace | '+self.name,'g '+self.name]
        for token,vs in [('v',vertices),('vt',uvs),('vn',norms)]:data.extend(token+' '+' '.join(map(fmt,v))for v in vs)
        (UNBAKED/(self.name+'.obj')).write_text('\n'.join(data+tri)+'\n')
        lines=['# Individual convex collision volumes | '+self.name];offset=0
        for ix,world in enumerate(self.hulls):
            pts=np.unique(np.round(world,7),axis=0);hull=ConvexHull(pts);used=hull.vertices.tolist()
            lookup={j:offset+i+1 for i,j in enumerate(used)};lines.append(f'o part{ix:02}')
            lines.extend('v '+' '.join(map(fmt,to_obj(pts[i])))for i in used)
            for face,equ in zip(hull.simplices,hull.equations):
                a,b,c=face
                if np.dot(np.cross(pts[b]-pts[a],pts[c]-pts[a]),equ[:3])<0:b,c=c,b
                lines.append(f'f {lookup[a]} {lookup[b]} {lookup[c]}')
            offset+=len(used)
        (OUT/(self.name+'-col.obj')).write_text('\n'.join(lines)+'\n')
        print(self.name,len(vertices),'positions,',len(tri),'triangles,',len(self.hulls),'collider parts',flush=True)
