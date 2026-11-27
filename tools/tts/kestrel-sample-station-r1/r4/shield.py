"""Integrate the returned bank into the last cell of the existing shuttle exhaust shield."""
from final_map import A,W
from hardware import baffle,md
from shapely.geometry import Polygon,box
from shapely.geometry.polygon import orient
from shapely.ops import triangulate,unary_union
import numpy as np
FAR=-2.45
NEAR=-2.02
END=4.15
START=.15
def chamfer(x0,z0,x1,z1,r):
 return Polygon([(x0+r,z0),(x1-r,z0),(x1,z0+r),(x1,z1-r),(x1-r,z1),(x0+r,z1),(x0,z1-r),(x0,z0+r)])
def skin(mesh,outline,y0,y1,material):
 """A continuous skin over the L. No interior face at the corner."""
 outline=orient(outline,sign=1)
 xmin,zmin,xmax,zmax=outline.bounds
 def uv(pts):return [((x-xmin)/(xmax-xmin),(z-zmin)/(zmax-zmin))for x,y,z in pts]
 mesh.part()
 for tri in triangulate(outline):
  if not outline.covers(tri):continue
  ring=list(orient(tri,sign=1).exterior.coords)[:-1]
  for level,order in ((y0,ring),(y1,ring[::-1])):
   pts=[(x,level,z) for x,z in order];mesh.face(pts,material,coords=uv(pts))
 border=list(outline.exterior.coords)
 for (x,z),(nx,nz) in zip(border,border[1:]):
  mesh.face([(x,y0,z),(x,y1,z),(nx,y1,nz),(nx,y0,nz)],material)
def make():
 md.ASSETS=A
 m=baffle()
 # Only the outermost cell gets an elbow; the other four are exactly their R3 parts.
 for geo in (m.m,m.c):
  geo.faces=[f for f in geo.faces if np.max(f[1][:,2])>=-1.65]
 cell=chamfer(-.375,-2.7375,.375,-1.6625,.075)
 full_leg=chamfer(START,FAR,END,NEAR,.026)
 section=unary_union([cell,full_leg])
 cap=unary_union([chamfer(-.395,-2.7375,.395,-1.6625,.05),chamfer(START,FAR,END,NEAR,.035)])
 skin(m.m,section,0,1.98,'graphite')
 skin(m.m,cap,1.98,2.055,'basalt')
 # Two adjoining closed convex hulls cover the L with the same outside corners.
 # The narrow belly of the return starts where the straight wall ends.
 for shape in (cell,full_leg.intersection(box(.375,-3,5,-1))):
  skin(m.c,shape,0,1.98,'graphite')
 for shape in (chamfer(-.395,-2.7375,.395,-1.6625,.05),chamfer(START,FAR,END,NEAR,.035).intersection(box(.395,-3,5,-1))):
  skin(m.c,shape,1.98,2.055,'basalt')
 for xx in [-.397,.397]:
  for zz in [-2.63,-2.20,-1.77]:
   if xx>0 and FAR<=zz<=NEAR:continue
   m.shell((xx,1.02,zz),(.045,1.88,.033),'steel',.007)
  if xx<0:m.shell((xx,1.75,-2.2),(.048,.075,1.02),'saffron',.007)
  else:
   for a,b in [(-2.71,FAR), (NEAR,-1.69)]:m.shell((xx,1.75,(a+b)/2),(.048,.075,b-a-.025),'saffron',.007)
 # Sheet ribs, recessed expansion seams and the same ochre band as the straight cells.
 # The core behind the seams stays opaque across the whole return.
 for z,side in ((FAR,-1),(NEAR,1)):
  for a,b in [(0.42,1.32),(1.36,2.26),(2.30,3.20),(3.24,4.10)]:
   m.shell(((a+b)/2,1.75,z+.008*side),(b-a,.075,.02),'saffron',.004)
   for x in (a+.04,b-.04):
    m.shell((x,1.02,z+.013*side),(.034,1.86,.026),'steel',.005)
    for y in (.37,1.56):m.tube((x,y,z+.020*side),(x,y,z+.037*side),.022,'steel',6)
 for x in (1.34,2.28,3.22):
  m.shell((x,2.063,(FAR+NEAR)/2),(.038,.016,.38),'steel',.004)
 m.save('shuttle-blast-shield')
if __name__=='__main__':make()
