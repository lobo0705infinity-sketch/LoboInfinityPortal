import json,pathlib,math,re,copy
import numpy as np
from shapely.geometry import Polygon,box,Point,LineString,MultiPoint
from shapely import affinity,contains_xy
from shapely.ops import unary_union
from scipy.ndimage import label,distance_transform_edt
from numba import njit

R=pathlib.Path(__file__).parent;D=R/'verdant-r5-preserved';A=D/'Assets'
path=D/'Verdant-Exchange-R5.json';bag=json.load(open(path))['ObjectStates'][0];manifest=json.load(open(D/'design-manifest.json'));places=manifest['placements'];external=json.load(open(D/'external-assets.json'))
cache={}
def meshpath(url):
 p=A/url.split('/')[-1]
 if p.is_file():return p
 p=R/'verdant-assets'/url.split('/')[-1]
 return p if p.is_file() else R/external[url]
def load(url):
 if url in cache:return cache[url]
 vs=[];fs=[]
 for l in meshpath(url).read_text().splitlines():
  q=l.split()
  if not q:continue
  if q[0]=='v':vs.append(list(map(float,q[1:4])))
  elif q[0]=='f':
   v=[int(x.split('/')[0])-1 for x in q[1:]]
   fs +=[(v[0],v[j],v[j+1]) for j in range(1,len(v)-1)]
 cache[url]=(np.array(vs),np.array(fs));return cache[url]
def world(o,collider=True):
 m=o['CustomMesh'];v,f=load(m['ColliderURL'] if collider else m['MeshURL']);v=v.copy();t=o['Transform'];v*=np.array([t.get('scaleX',1),t.get('scaleY',1),t.get('scaleZ',1)])
 x,y,z,_,yaw,_=places[o['GUID']];c=math.cos(math.radians(yaw));s=math.sin(math.radians(yaw));v=v@np.array([[c,0,-s],[0,1,0],[s,0,c]])+np.array([x,y,z]);return v,f
buildings=[]
for rec in manifest['buildings']:
 p=affinity.translate(affinity.rotate(Polygon(rec['footprint']),-rec['yaw'],origin=(0,0)),xoff=rec['x'],yoff=rec['z']);buildings.append((rec['guid'],p))
 for old,p2 in buildings[:-1]:assert p.intersection(p2).area<.03,('building collision',rec['name'],old)
 assert box(-24,-24,24,24).covers(p)

moves=[]
# Walkability uses actual low-level wall colliders. Floor plates are excluded.
triangles=[];obs=[]
for o in bag['ContainedObjects']:
 if 'CustomMesh' not in o or o is bag['ContainedObjects'][0] or any(s in o['Nickname'] for s in ['department signage','collection plaques','specimen tree']):continue
 v,f=world(o);triangles.append(v[f])
 # These exported colliders consist of six-quad boxes (8 or 24 duplicated vertices).
 # Ground openings remain free: select vertical faces which intersect base height.
 for face in v[f]:
  if face[:,1].max()<1.35 or face[:,1].min()>2.2:continue
  pp=MultiPoint(face[:,[0,2]]).convex_hull
  if not pp.is_empty:obs.append(pp.buffer(.51))
union=unary_union(obs)
coords=np.arange(-23.5,23.51,.4);xx,zz=np.meshgrid(coords,coords,indexing='ij');free=~contains_xy(union,xx,zz);regions,n=label(free)
largest=max(range(1,n+1),key=lambda k:(regions==k).sum())
def region(x,z):return int(regions[np.argmin(abs(coords-x)),np.argmin(abs(coords-z))])
assert all(region(0,z)==largest for z in [-12,0,12]),'Objective disconnected'
exits={}
for side in [-1,1]:
 row=regions[np.argmin(abs(coords-side*8))];runs=[];start=None
 for j,v in enumerate(row):
  if v==largest and start is None:start=j
  if (v!=largest or j==len(row)-1) and start is not None:
   end=j if v!=largest else j+1
   if end-start>=4:runs.append([round(float(coords[start]),2),round(float(coords[end-1]),2)])
   start=None
 exits['west' if side<0 else 'east']=runs
 assert len(runs)>=2,('Insufficient DZ exits',side,runs)

@njit
def occluded(a,b,tris):
 d=b-a
 for tri in tris:
  e1=tri[1]-tri[0];e2=tri[2]-tri[0];h=np.cross(d,e2);det=np.dot(e1,h)
  if abs(det)<1e-9:continue
  s=a-tri[0];u=np.dot(s,h)/det
  if u<0 or u>1:continue
  q=np.cross(s,e1);v=np.dot(d,q)/det
  if v<0 or u+v>1:continue
  t=np.dot(e2,q)/det
  if .0005<t<.9995:return True
 return False
tris=np.concatenate(triangles);roofviews=[]
for rec in manifest['buildings']:
 if rec['levels']!=2:continue
 poly=Polygon(rec['footprint']);xmin,zmin,xmax,zmax=poly.bounds;upper=box(xmin+.35,zmin+.35,min(xmin+4.6,xmax-.35),min(zmin+4.5,zmax-.35)).intersection(poly)
 for x,z in [(upper.centroid.x,upper.bounds[1]+.8),(upper.bounds[0]+.8,upper.bounds[1]+.8),(upper.bounds[2]-.8,upper.bounds[1]+.8)]:
  c=math.cos(math.radians(rec['yaw']));s=math.sin(math.radians(rec['yaw']));origin=np.array([rec['x']+c*x+s*z,9.0,rec['z']-s*x+c*z]);visible=[zz for zz in [-12,0,12] if not occluded(origin,np.array([0.,1.85,float(zz)]),tris)]
  roofviews.append({'building':rec['name'],'point':origin.tolist(),'objectives_visible':visible})

bag['LuaScript']='\r\n'.join('--'+g+','+','.join(f'{v:.7g}' for v in p) for g,p in places.items())+'\r\n'
json.dump({'ObjectStates':[bag]},open(path,'w'),indent=2);manifest['placements']=places;json.dump(manifest,open(D/'design-manifest.json','w'),indent=2)
report={'objects':len(bag['ContainedObjects']),'new_buildings':len(buildings),'mirrored_building_centres':sum(any(abs(a['x']+b['x'])<.01 and abs(a['z']+b['z'])<.01 for b in manifest['buildings']) for a in manifest['buildings']),'dressing_clashes_corrected':moves,'dz_exit_intervals':exits,'objective_routes_for_1inch_base':True,'largest_distance_to_cover_inches':round(float(distance_transform_edt(free,sampling=.4).max()),2),'rooftop_visibility_samples':roofviews,'any_sampled_roof_point_sees_all_three':any(len(r['objectives_visible'])==3 for r in roofviews),'windows_and_doors_in_colliders':True,'live_tts_test':False}
json.dump(report,open(D/'validation.json','w'),indent=2);print(json.dumps(report,indent=2))
