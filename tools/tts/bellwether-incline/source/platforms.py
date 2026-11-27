"""Seat the loose station furnishings on level ground with clear approaches."""
import math
import numpy as np
from shapely import box, Point, union_all
from shapely.affinity import rotate, translate
from hillside import STAIR_LENGTH,STAIR_WIDTH,GATES,SOUTH_EDGE,NORTH_EDGE,LINES,cut,apron
from gate_sites import geom,MOVED
from shapely.geometry import LineString

def fix_furnishings(objects):
 fixed=[o for o in objects if o['kind'] in ('building','arcade','terrace')]
 limits=box(-23.80,-23.80,23.80,23.80)
 blocked=[geom(o).buffer(.14) for o in fixed]
 blocked.extend(Point(x,z).buffer(1.84) for x,z in [(-12,0),(12,0),(0,-12),(0,12)])
 blocked.extend(box(a-.64,z-STAIR_WIDTH/2-.12,a+STAIR_LENGTH+.64,z+STAIR_WIDTH/2+.12) for a,z,_ in GATES)
 blocked.extend(box(x-1.16,TRACK-.0-5.67,x+1.16,TRACK+5.67) for x,TRACK in [(-22.6,5.55),(-8.65,5.55),(8.05,5.55),(22.6,5.55)])
 blocked.append(box(-24,SOUTH_EDGE-.01,24,NORTH_EDGE+.01))
 for side in ('south','north'):
  for line in LINES[side]:blocked.append(LineString([(x,z) for z,x in line]).buffer(.20))
 keepout=union_all(blocked)
 moved=[]
 for o in objects:
  if o['kind'] not in ('scatter','edge'):continue
  if o.get('localElevation',0)>.1:continue
  if o['kind']=='edge':span=box(-24.012,-24.012,24.012,24.012)
  else:span=limits
  start=MOVED.get(o['key'],(o['x'],o['z']))
  relative=rotate(box(-o['w']/2,-o['d']/2,o['w']/2,o['d']/2),-o['rot'],origin=(0,0))
  dxs=range(-21,22);dzs=range(-21,22)
  if o['kind']=='edge':
   if abs(o['x'])>20:dxs=[0];dzs=range(-115,116)
   if abs(o['z'])>20:dzs=[0];dxs=range(-115,116)
  candidates=sorted(((dx*.4,dz*.4) for dx in dxs for dz in dzs),key=lambda q:(q[0]**2+q[1]**2,abs(q[0]),q[1]))
  for dx,dz in candidates:
   x,z=round(start[0]+dx,3),round(start[1]+dz,3);shape=translate(relative,x,z)
   if span.covers(shape) and not shape.intersects(keepout) and not any(shape.distance(p)<.33 for p in moved):
    o['x'],o['z']=x,z;moved.append(shape);break
  else:raise ValueError('No level placement for '+o['label'])
