"""Wear and engineering markings baked into the real ground UVs, with no overlay geometry."""
from common import *
from PIL import Image,ImageDraw,ImageFilter
from shapely.geometry import LineString
import numpy as np
from scipy.ndimage import gaussian_filter
import math,random
RNG=np.random.default_rng(481)
N=2048
S=N/48
def pix(p):return ((p[0]+24)*S,(24-p[1])*S)
def reg_mask():return Image.new('L',(N,N),0)
def line(draw,pts,width,val=255):draw.line([pix(p) for p in pts],fill=val,width=max(1,round(width*S)),joint='curve')
def poly(draw,pts,val=255):draw.polygon([pix(p) for p in pts],fill=val)
def route(points):
    pts=np.asarray(points,float)
    for _ in range(3):
        a=.75*pts[:-1]+.25*pts[1:];b=.25*pts[:-1]+.75*pts[1:]
        pts=np.vstack([pts[0],np.stack([a,b],axis=1).reshape(-1,2),pts[-1]])
    return LineString(pts)
def station_route():
    return [route([(8.1,-21.6),(10.67,-20.70),(10.88,-18.45),(10.90,-15.28),(10.20,-14.15),(10.20,-13.30)]),
            route([(10.2,-10.25),(10.2,-9.90),(11.54,-9.87),(12.65,-10.68),(13.58,-11.52),(15.65,-11.72),(17.12,-11.52),(18.40,-10.55),(18.66,-9.22),(18.70,-7.68),(17.85,-7.68)])]
def at(g,t):
    p=np.array(g.interpolate(float(t)).coords[0]);a=np.array(g.interpolate(max(0,float(t)-.035)).coords[0]);b=np.array(g.interpolate(min(g.length,float(t)+.035)).coords[0]);u=b-a;u/=max(1e-8,np.linalg.norm(u))
    return p,u,np.array([-u[1],u[0]])
def main():
    im=Image.open(ASSETS/'station-regolith.jpg').convert('RGB')
    base=np.array(im,dtype=np.float32);lum=base@np.array([.26,.57,.17],dtype='float32')
    mineral=lum-gaussian_filter(lum,6)
    cloud=gaussian_filter(RNG.normal(0,1,(N,N)).astype('float32'),12)
    cloud/=max(cloud.std(),.0001);noise=RNG.normal(0,1,(N,N)).astype('float32')*2.4+1.7*cloud
    def mix(mask,col,strength,grain=.42):
        nonlocal base
        a=np.asarray(mask,dtype='float32')[:,:,None]*(strength/255)
        base+=a*(np.asarray(col,dtype='float32')[None,None,:]+(mineral*grain+noise)[:,:,None]-base)
    tracks=station_route()
    shoulder=reg_mask();road=reg_mask();cuts=reg_mask();treads=reg_mask();tread_marks=reg_mask();stops=reg_mask();edges=reg_mask();stripe=reg_mask()
    sh,rd,cd,td,md,sd,ed,yd=[ImageDraw.Draw(v) for v in (shoulder,road,cuts,treads,tread_marks,stops,edges,stripe)]
    for n,g in enumerate(tracks):
        line(sh,g.coords,2.04);line(rd,g.coords,1.64)
        for travel in np.arange(.47,g.length-.25,1.18):
            p,u,v=at(g,travel);line(cd,[p-.79*v,p+.79*v],.035)
        # The two tread bands terminate on the dirty and clean sides of the dust lock.
        for side in [-1,1]:
            pts=[]
            for t in np.linspace(.05,g.length-.14,round(g.length*18)):
                p,u,v=at(g,t);pts.append(p+v*side*.419)
            line(td,pts,.148,230)
            for t in np.arange(.12,g.length-.17,.235):
                p,u,v=at(g,t);p+=v*side*.419
                line(md,[p-v*.071-u*.026,p,p+v*.072-u*.04],.029,228)
        for t in np.arange(.4,g.length-.36,2.28):
            p,u,v=at(g,t);line(ed,[p-v*.745-u*.21,p-v*.745+u*.21],.040,225)
    for z in [-13.39,-10.08]:
        for left,right in [(-.78,-.30),(.30,.78)]:
            line(sd,[(10.2+left,z),(10.2+right,z)],.093)
    for x in np.arange(9.52,10.94,.24):line(yd,[(x-.055,-13.55),(x+.04,-13.43)],.065)
    mix(shoulder.filter(ImageFilter.GaussianBlur(6.8)),(99,96,89),.74,.65)
    mix(road.filter(ImageFilter.GaussianBlur(.85)),(67,70,70),.90,.49)
    mix(cuts,(45,47,47),.85,.30);mix(treads.filter(ImageFilter.GaussianBlur(.9)),(47,49,50),.82,.32)
    mix(tread_marks,(86,84,75),.82,.36);mix(edges,(162,151,124),.86,.46)
    mix(stops,(214,207,180),.95,.35);mix(stripe,(204,151,61),.96,.36)
    # Sintered service slabs follow the physical recessed crew pad and the ramp.
    slab=reg_mask();slots=reg_mask();safety=reg_mask()
    poly(ImageDraw.Draw(slab),[(21.01,14.54),(21.26,14.31),(23.79,14.31),(23.95,14.54),(23.95,19.40),(23.74,19.60),(21.26,19.60),(21.01,19.40)])
    sl=ImageDraw.Draw(slots);sa=ImageDraw.Draw(safety)
    for z in [15.10,16.47,17.84,19.20]:line(sl,[(21.12,z),(23.82,z)],.046)
    line(sl,[(22.47,14.54),(22.47,19.40)],.034)
    for x in np.arange(21.21,23.48,.27):line(sa,[(x,14.72),(x+.15,14.52)],.077,235)
    for z in [15.24,18.20]:
        line(sa,[(21.30,z),(21.30,z+.50)],.075,215)
    mix(slab.filter(ImageFilter.GaussianBlur(.75)),(85,91,92),.91,.58)
    mix(slots,(47,52,53),.86,.33);mix(safety,(197,156,78),.92,.38)
    result=Image.fromarray(np.uint8(np.clip(base,0,255)))
    result.save(OUT/'station-ground-r2.jpg',quality=91,optimize=True)
    write(W/'cartway.json',[[list(p) for p in g.coords] for g in tracks])
if __name__=='__main__':main()
