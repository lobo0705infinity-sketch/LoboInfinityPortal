"""A hollow escape pod with a connected open hatch and a clear entrance."""
import math
import numpy as np
from scipy.spatial import ConvexHull
from cover_mesh import Mesh,uvbox

class Compound:
    def __init__(self):self.parts=[]
    def solid(self,name,points):self.parts.append((name,np.array(points,float)))
    def box(self,name,center,size,yaw=0,translate=(0,0,0)):
        v=np.array([(x,y,z)for x in [-.5,.5]for y in [-.5,.5]for z in [-.5,.5]])*size+center
        t=math.radians(yaw);co,si=math.cos(t),math.sin(t)
        v=v@np.array([[co,0,-si],[0,1,0],[si,0,co]])+translate
        self.solid(name,v)
    def write(self,name):
        from cover_mesh import A
        lines=['# R11 hollow capsule: separate convex collision components','s off'];base=0;ni=0;count=0
        for label,points in self.parts:
            v=np.unique(np.round(points*[-1,1,1],5),axis=0);h=ConvexHull(v)
            lines+=['o '+label,'g '+label]+['v %.5f %.5f %.5f'%tuple(p)for p in v]
            for face,eq in zip(h.simplices,h.equations):
                p=v[face]
                if np.dot(np.cross(p[1]-p[0],p[2]-p[0]),eq[:3])<0:face=face[::-1]
                ni+=1;lines.append('vn %.8f %.8f %.8f'%tuple(eq[:3]));lines.append('f '+' '.join(f'{base+int(i)+1}//{ni}'for i in face));count+=1
            base+=len(v)
        (A/(name+'.obj')).write_text('\n'.join(lines)+'\n')
        return {'name':name,'parts':len(self.parts),'vertices':base,'triangles':count}

def capsule():
    m=Mesh();c=Compound();N=32;half=.85
    def face(q,tile,direction,uv=None):
        p=np.array(q)
        if np.dot(np.cross(p[1]-p[0],p[2]-p[0]),direction)<0:q=q[::-1];uv=uv[::-1]if uv else None
        m.face(q,tile,uv)
    def ring(y,r):
        alpha=math.asin(half/r)
        return [(r*math.cos(t),y,r*math.sin(t))for t in np.linspace(-math.pi/2+alpha,3*math.pi/2-alpha,N+1)]
    levels=[(.30,1.14),(.48,1.40),(1.72,1.40),(2.45,1.14),(2.70,1.0)]
    # Connected, thick exterior and interior skin. A constant-width entry cut
    # keeps the doorway straight even where the pressure hull tapers.
    for k,((y0,r0),(y1,r1))in enumerate(zip(levels,levels[1:])):
        a,b=ring(y0,r0),ring(y1,r1);ia,ib=ring(y0,r0-.085),ring(y1,r1-.085)
        tile=1 if k<2 else 0;u0,v0,u1,v1=uvbox(tile)
        for j in range(N):
            q=[a[j],a[j+1],b[j+1],b[j]];iq=[ia[j],ia[j+1],ib[j+1],ib[j]]
            center=np.mean(q,axis=0)*[1,0,1]
            uv=[(u0+(u1-u0)*j/N,v0),(u0+(u1-u0)*(j+1)/N,v0),(u0+(u1-u0)*(j+1)/N,v1),(u0+(u1-u0)*j/N,v1)]
            face(q,tile,center,uv);face(iq,35,-center)
            if j%2==0:
                c.solid(f'hull_{k}_{j}',[ringpoints[n]for ringpoints in (a,b,ia,ib)for n in (j,j+1,j+2)])
        for idx in (0,N):
            face([a[idx],b[idx],ib[idx],ia[idx]],2,[0,0,-1])
        if k==0:
            for j in range(N):face([a[j],ia[j],ia[j+1],a[j+1]],2,[0,-1,0])
        if k==len(levels)-2:
            for j in range(N):face([b[j],b[j+1],ib[j+1],ib[j]],2,[0,1,0])
        # Real jamb returns connect the curved cut edges to the hatch frame.
        for side,idx in [(-1,N),(1,0)]:
            x=side*half
            q=[(x,y0,-1.26),(x,y1,-1.26),b[idx],a[idx]]
            face(q,35,[-side,0,0]);oq=[(px+side*.09,py,pz)for px,py,pz in q]
            face(oq,0,[side,0,0]);c.solid(f'jamb_return_{k}_{side}',q+oq)
    # Closed domed crown, with an interior ceiling and finished hatch header.
    roof=[];rings=[]
    for y,r in [(2.70,1.0),(2.91,.80),(3.09,.38),(3.16,.08)]:
        rings.append([(r*math.cos(t),y,r*math.sin(t))for t in np.linspace(0,2*math.pi,24,endpoint=False)])
    for a,b in zip(rings,rings[1:]):
        for j in range(24):
            jj=(j+1)%24;q=[a[j],a[jj],b[jj],b[j]]
            face(q,0,np.mean(q,axis=0)*[1,0,1]+[0,.4,0])
    face(rings[0],35,[0,-1,0]);face(rings[-1],2,[0,1,0])
    c.solid('closed_crown',[p for ringpoints in rings for p in ringpoints])
    # A sealed return above the entry joins the straight header to the crown.
    xs=np.linspace(-.95,.95,13)
    for j,(a,b)in enumerate(zip(xs,xs[1:])):
        q=[(a,2.71,-1.26),(b,2.71,-1.26),(b,2.71,-math.sqrt(1.0**2-b*b)),(a,2.71,-math.sqrt(1.0**2-a*a))]
        bottom=[(x,y-.08,z)for x,y,z in q]
        face(q,0,[0,1,0]);face(bottom,35,[0,-1,0]);c.solid(f'header_return_{j}',q+bottom)
        for k in range(4):
            kk=(k+1)%4;m.face([q[k],q[kk],bottom[kk],bottom[k]],2)

    # Original landing skid footprint and a flat, genuinely usable floor.
    m.box((0,.15,0),(2.2,.3,2.2),2);c.box('floor',(0,.15,0),(2.2,.3,2.2))
    m.box((0,.15,-1.19),(1.85,.3,.25),3);c.box('threshold',(0,.15,-1.19),(1.85,.3,.25))
    for x in [-1,1]:
        m.rounded((x,.12,0),(.6,.24,2.7),2,.06);c.box(f'skid_{x}',(x,.12,0),(.6,.24,2.7))
    # Seat stays behind the entrance; its own collider follows the seat.
    m.box((0,.55,.48),(.65,.5,.65),2)
    m.rounded((0,.85,.48),(.8,.2,.78),4,.08)
    m.rounded((0,1.28,.78),(.8,.78,.17),4,.06)
    for x in [-.43,.43]:m.box((x,1.02,.48),(.1,.16,.78),2)
    c.box('seat_pedestal',(0,.55,.48),(.65,.5,.65))
    c.box('seat_cushion',(0,.85,.48),(.8,.2,.78))
    c.box('seat_back',(0,1.28,.78),(.8,.78,.17))
    for x in [-.43,.43]:c.box(f'seat_arm_{x}',(x,1.02,.48),(.1,.16,.78))
    for side in [-1,1]:
        x=side*.925;m.box((x,1.48,-1.26),(.15,2.36,.18),2)
        c.box(f'hatch_jamb_{side}',(x,1.48,-1.26),(.15,2.36,.18))
        m.box((side*.84,1.48,-1.29),(.025,2.31,.065),6)
    m.box((0,2.77,-1.26),(2,.24,.2),2);c.box('hatch_header',(0,2.77,-1.26),(2,.24,.2))
    m.sign((0,2.78,-1.375),1.55,.19,16,-1)
    m.box((0,2.925,-1.275),(1.45,.045,.10),7)
    # Door pivots on its actual right-hand hinge axis and opens away from the
    # entrance. All handles, latches, window and hinges are attached geometry.
    door=Mesh();hinge=(.95,0,-1.30);yaw=-105
    door.rounded((-.84,1.48,0),(1.68,2.30,.14),0,.055)
    door.box((-.84,1.65,-.078),(.66,.68,.035),6)
    door.box((-.84,1.65,-.100),(.55,.57,.02),8)
    door.box((-.84,1.65,.078),(.66,.68,.035),6)
    door.box((-.84,1.65,.100),(.55,.57,.02),8)
    for side in [-1,1]:
        z=side*.13
        for y in [1.0,1.3]:door.cyl((-1.41,y,side*.06),(-1.41,y,z),.028,2,8)
        door.cyl((-1.41,1.0,z),(-1.41,1.3,z),.034,2,10)
    door.box((-.84,.43,-.075),(1.45,.12,.025),33)
    m.merge(door,hinge,yaw);c.box('open_hatch',(-.84,1.48,0),(1.68,2.30,.14),yaw,hinge)
    for y in [.57,2.35]:
        m.box((.925,y,-1.29),(.22,.25,.13),2)
        m.cyl((.95,y-.16,-1.30),(.95,y+.16,-1.30),.065,2,12)
    # Small bonded brackets and fasteners replace the disconnected old rods.
    for x in [-.925,.925]:
        for y in [.48,1.48,2.48]:m.cyl((x,y,-1.365),(x,y,-1.385),.024,2,8)
    return m,c

if __name__=='__main__':
    import json
    from pathlib import Path
    m,c=capsule();stats=[m.write('escape-capsule'),c.write('escape-capsule-collider')]
    Path(__file__).with_name('capsule-build-r11.json').write_text(json.dumps(stats,indent=2)+'\n')
    print(stats)
