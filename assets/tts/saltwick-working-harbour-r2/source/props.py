import numpy as np
from math import cos,sin,pi
from mesh import unit

def box(g,p,d,m,solid=False,bevel=.012):
    g.box(p,d,m,r=bevel,b=bevel,physical=solid,n=1)

def bent_wire(g,points,r,material='cable',ns=6):
    p=np.asarray(points,float);rings=[]
    for i,c in enumerate(p):
        tang=unit(p[min(i+1,len(p)-1)]-p[max(0,i-1)])
        ref=np.array((0.,1.,0.)) if abs(tang[1])<.92 else np.array((1.,0.,0.))
        if i:
            side=prev-tang*np.dot(tang,prev)
            if np.linalg.norm(side)<.03:side=np.cross(tang,ref)
            a=unit(side)
        else:a=unit(np.cross(tang,ref))
        b=np.cross(tang,a);prev=a
        rings.append([c+r*(a*cos(j*2*pi/ns)+b*sin(j*2*pi/ns))for j in range(ns)])
    g.rings(rings,material,False,True)

def pallet(g,u,v,h,w=1.05,d=.92):
    for y in (-d*.39,0,d*.39):
        box(g,(u,v+y,h+.073),(w,.113,.146),'darkwood')
    for j in range(6):box(g,(u-w*.43+j*w*.172,v,h+.178),(w*.153,d,.068),'plywood',False,.006)
