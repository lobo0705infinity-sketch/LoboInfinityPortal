from plan import *
from build_station import build,poses,AXES
from check_layout import summary,contact,ENDS
import check_geometry as qa,survey
import numpy as np
from shapely.geometry import LineString,Point,box
from shapely.ops import unary_union
from PIL import Image,ImageDraw
from scipy import ndimage
from pathlib import Path
def terrain():
 # Reuse the actual triangle rasterizer, including the oblique sampling pass used in R2.
 import ast
 source=(r2.R2/'verify_ground.py').read_text()
 code=ast.parse(source)
 definitions=[x for x in code.body if isinstance(x,ast.FunctionDef) and x.name in ('tops','raster')]
 scope={'np':np,'mesh':r2.mesh,'axis':np.arange(481)/10-24}
 exec(compile(ast.fix_missing_locations(ast.Module(body=definitions,type_ignores=[])),'terrain raster','exec'),scope)
 top=[A/f'highlands-{i}.obj' for i in range(1,5)];coll=[A/f'highlands-{i}-collider.obj' for i in range(1,5)]
 vis,area=scope['raster'](top);phy,_=scope['raster'](coll)
 err=float(np.max(abs(vis-phy)));assert err<.00001
 scope['raster'](top,(.02731,.04137));np.save(W/'relief.npy',phy)
 x,z=np.meshgrid(np.arange(481)/10-24,np.arange(481)/10-24)
 sites=[c for c in read(r2.DATA/'layout.json')['landforms']if c['kind']=='crater']
 for c in sites:
  a,b=c['center'];f=phy[np.hypot(x-a,z-b)<=c['radius']*1.31]
  assert abs(f.min()-6.25)<1e-5 and abs(f.max()-6.25)<.025
 return dict(squareInches=area,maxHeightError=err,formerImpactSites=len(sites))
def rays(height,sections,relief):
 # Test base-height, corner and diagonal lines through the full length of each DZ, in table coordinates.
 solids=unary_union(list(sections.values()));open_lines=[];eligible=0
 from shapely.prepared import prep
 blockers=prep(solids)
 for z0 in np.arange(-23,23.01,1.0):
  for z1 in np.arange(-23,23.01,1.0):
   a=(-22,z0);b=(22,z1)
   if blockers.intersects(Point(a)) or blockers.intersects(Point(b)):continue
   eligible+=1;ln=LineString([a,b])
   if blockers.intersects(ln):continue
   coords=np.linspace(a,b,901);idx=np.clip(np.rint((coords+24)*10).astype(int),0,480)
   if not np.any(relief[idx[:,1],idx[:,0]]>6.25+height):open_lines.append([z0,z1])
 return eligible,open_lines
def geometry():
 r=terrain();b=build();qa.WORK=W;qa.local=resource;survey.local=resource
 # The outside-route checker takes each building's whole foundation as blocked, except the
 # known open-sided receiver and original crew passage. This is conservative at all new halls.
 secs=qa.scene_sections(b,1.5)
 # These two new freight airlocks have opposing, modeled open doors. Use the actual
 # physical cross-sections of their jambs; a convex hull would falsely close both.
 def traversable(bag):
  result=survey.footprints(bag)
  for guid in ('e53204','e53206'):result[guid]=secs[guid]
  return result
 qa.footprints=traversable
 r['objectiveContacts']=qa.targets(b,secs);r['edgeLines']=qa.edge_runs(secs,1.5)
 assert max(r['edgeLines'].values())<30,r['edgeLines']
 threshold=summary(False)
 assert all(min(v)>25/25.4 for v in threshold.values()),threshold
 r['minNewGalleryClearanceInches']=min(min(v)for v in threshold.values())
 r['newGalleries']=8
 # Verify the actual decks meet at each module, with the roof on.
 decks={};index={o['GUID']:o for o in b['ContainedObjects']}
 for g,(_,a,c) in {**LINKS,CREW_LINK[0]:CREW_LINK[1:]}.items():
  p,q=ENDS[g];u=np.array(a);v=np.array(c);direction=(v-u)/np.linalg.norm(v-u)
  through=LineString([(u-.58*direction)[::-1],(v+.58*direction)[::-1]])
  gap=through.difference(unary_union([contact(k,index,.08)for k in (p,g,q)]))
  length=max([x.length for x in (gap.geoms if hasattr(gap,'geoms')else [gap])],default=0)
  assert length<.025,(g,length);decks[g]=round(length,4)
 r['deckSeamsInches']=decks
 crossings={}
 active={o['GUID']:o for o in b['ContainedObjects']}
 for key in ['e53204','e53206']:
  o=active[key];t=o['Transform'];pt=np.array([t['posX'],t['posZ']])
  across=np.array([1.,0.]) if key=='e53204' else np.array([0.,1.])
  line=LineString([pt-across*1.40,pt+across*1.40])
  vals=[2*line.distance(unary_union(qa.component_sections(st,6.25+h)))for st in poses(o)for h in [.29,.75,1.4,1.6]]
  assert min(vals)>40/25.4,(key,vals)
  crossings[key]=round(min(vals),3)
 r['crossingClearWidths']=crossings
 # Original joined crew row and flight-side dustlock.
 by={o['GUID']:o for o in b['ContainedObjects']}
 throats=[]
 for ids,pts in [(['c70030','e51009','c70012'],[(19,11.4),(19,15.05)]),(['e51001'],[(10.2,-13.36),(10.2,-10.08)])]:
  for h in [.26,.76,1.38]:
   wall=unary_union([contact(g,by,h)for g in ids]);throats.append(2*wall.distance(LineString(pts)))
 assert min(throats)>25/25.4
 r['originalLinksMin']=round(min(throats),3)
 p=survey.footprints(b);pairs=[]
 for g,shape in p.items():
  off=shape.difference(box(-24.01,-24.01,24.01,24.01)).area;assert off<.001,(g,off)
  for j,other in p.items():
   if j<=g:continue
   inter=shape.intersection(other).area
   if inter>.11:pairs.append([g,j,round(inter,2)])
 r['intentionalOverlapPairs']=pairs
 r['deepDZrays'],r['openDeepDZrays']=rays(1.5,secs,np.load(W/'relief.npy'))
 assert not r['openDeepDZrays'],r['openDeepDZrays']
 write(W/'geometry-qa.json',r)
 print(json.dumps(r),flush=True)
if __name__=='__main__':geometry()
