from pathlib import Path
import json,math
from shapely.geometry import box,Point
from shapely.affinity import rotate,translate
R=Path(__file__).resolve().parents[1]
def make():
 records=json.loads((R/'Source/geometry-manifest.json').read_text());by={r['slug']:r for r in records};items=[];occupied=[]
 for r in records:
  if r['kind']not in ['building','ground']:continue
  items.append({'slug':r['slug'],'x':r['x'],'z':r['z'],'rot':r['rot'],'state':1})
  if r['kind']=='building':
   w,d=r['footprint'];p=translate(rotate(box(-w/2,-d/2,w/2,d/2),-r['rot'],origin=(0,0)),r['x'],r['z']);occupied.append(p.buffer(.3))
 pool=box(-3.6,-6.6,3.6,4.6)
 protected=[pool,Point(0,12).buffer(2),Point(0,-12).buffer(2)]
 order=['luggage-trolley','limestone-planter','bronze-sculpture','linen-cart','maintenance-unit','stacked-loungers','pool-bar-cart','shade-screen']
 points=[(-20,-10,0),(20,10,180),(-14,-6,0),(14,6,180),(-4,-15,90),(4,15,270),(-5,7,0),(5,-8,180),(-20,9,90),(20,-9,270),(-13,22,0),(13,-22,180),(-13,-22,0),(13,22,180),(-9,-20,0),(9,20,180),(-20,-5,0),(20,5,180),(-14,3,90),(14,-3,270),(-3,16,0),(3,-16,180),(-11,9,45),(11,-9,225),(-5,-10,90),(5,10,270),(-20,22,0),(20,-22,180),(-23,-10,90),(23,10,270),(-16,7,45),(16,-7,225)]
 for i,(x,z,rot)in enumerate(points):
  slug=order[i%8];r=by[slug];b=r['states'][0]['bounds'];shape=box(b[0],b[2],b[3],b[5]);placed=None
  for dx,dz in [(0,0),(0,1.5),(0,-1.5),(1.5,0),(-1.5,0),(0,3),(0,-3)]:
   p=translate(rotate(shape,-rot,origin=(0,0)),x+dx,z+dz)
   if not box(-23.8,-23.8,23.8,23.8).covers(p):continue
   if any(p.intersects(q)for q in occupied+protected):continue
   placed=(x+dx,z+dz,p);break
  if placed:
   xx,zz,p=placed;items.append({'slug':slug,'x':xx,'z':zz,'rot':rot,'state':1});occupied.append(p.buffer(.22))
 # Short walls interrupt open outer lanes without forming continuous barriers.
 for x,z,rot in [(-15,-10,15),(15,10,195),(-11,17,90),(11,-17,270),(-14,11,0),(14,-11,180),(-5,-18,90),(5,18,270),(-22,-7,90),(22,7,270),(-22,7,90),(22,-7,270)]:
  p=translate(rotate(box(-1.95,-.35,1.95,.35),-rot,origin=(0,0)),x,z)
  if any(p.intersects(q)for q in occupied+protected):continue
  items.append({'slug':'garden-wall','x':x,'z':z,'rot':rot,'state':1});occupied.append(p.buffer(.2))
 assert {x['slug']for x in items}.issuperset(order),'All eight approved scatter pieces must be represented'
 (R/'Source/layout.json').write_text(json.dumps(items,indent=2));print('Layout:',len(items),'terrain objects;',len([i for i in items if by[i['slug']]['kind']=='scatter']),'scatter placements')
 return items
if __name__=='__main__':make()
