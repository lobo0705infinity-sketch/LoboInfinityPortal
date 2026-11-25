"""Geometry, transforms and saved positions shared with the previous Cloudbreak release."""
from pathlib import Path
from functools import lru_cache
from contextlib import contextmanager
import sys, math, json, hashlib
import numpy as np
from shapely import affinity
from shapely.geometry import Point, Polygon, MultiPoint, box
from shapely.ops import unary_union
SOURCES=Path(__file__).resolve().parents[1]
PREVIOUS=next(p for p in (SOURCES.parent/'cloudbreak-array-r2',SOURCES.parent/'r2') if (p/'src/project.py').is_file())
sys.path.insert(0,str(PREVIOUS/'src'))
import model as native
from project import T, O, BASE_Y, PITCH, MAT_Y, BAG, TAG
from fixtures import SIZE
from design import footprint_of
NEW=SOURCES/'assets'; WORK3=SOURCES/'work'; OUT3=SOURCES/'out'
BASE=PREVIOUS/'base'; AS2=PREVIOUS/'assets'
R2TABLE=json.loads((PREVIOUS/'out/Play-Table.json').read_text())
PIECES=[o for o in R2TABLE['ObjectStates'] if TAG in o.get('Tags',[])]
ARR=json.loads((PREVIOUS/'work/arrangement.json').read_text())
LOW=json.loads((PREVIOUS/'work/clouds.json').read_text())
OLD_MOOR=next(o for o in PIECES if o['Nickname'].startswith('Mistral'))
BASE_RADIUS=25/25.4/2
EYE=1.44   # A test point just below the top of a standing 40 mm S2 silhouette.
def slug(o):return o.get('CustomMesh',{}).get('MeshURL','').split('/')[-1].removesuffix('.obj')
def obj_path(name):
 for d in (NEW,AS2,BASE/'assets'):
  p=d/(name+'.obj')
  if p.is_file():return p
 raise FileNotFoundError(name)
@lru_cache(None)
def geometry(name):
 v=[];f=[]
 for line in obj_path(name).read_text().splitlines():
  a=line.split()
  if not a:continue
  if a[0]=='v':v.append((-float(a[1]),float(a[2]),float(a[3])))
  elif a[0]=='f':f.append([int(k.split('/')[0])-1 for k in a[1:]])
 return np.array(v),np.array(f,dtype='int32')
def transform(points,t):
 p=points*np.array([t['scaleX'],t['scaleY'],t['scaleZ']]);a=math.radians(t['rotY']);c,s=math.cos(a),math.sin(a)
 return np.column_stack([c*p[:,0]+s*p[:,2]+t['posX'],p[:,1]+t['posY'],-s*p[:,0]+c*p[:,2]+t['posZ']])
def xform(x,y,z,angle=0,sx=1,sy=1,sz=1):
 return dict(posX=round(x,4),posY=round(y,4),posZ=round(z,4),rotX=0,rotY=angle,rotZ=0,scaleX=sx,scaleY=sy,scaleZ=sz)
def silhouette(o):
 points,_=geometry(slug(o));a=transform(points,o['Transform']);return MultiPoint(a[:,[0,2]]).convex_hull
BRIDGES=[o for o in PIECES if 'skybridge |'in o['Nickname']]
@lru_cache(None)
def obstacles():
 footprints=[affinity.translate(t.poly,t.x,t.z)for t in T.values()]
 return unary_union(footprints+[silhouette(o) for o in BRIDGES]+[silhouette(OLD_MOOR)])
def ellipse(c):
 p=affinity.scale(Point(c['x'],c['z']).buffer(1,quad_segs=48),c['rx'],c['rz'],origin=(c['x'],c['z']))
 return affinity.rotate(p,-c.get('angle',0),origin=(c['x'],c['z']))
@lru_cache(None)
def greenhouse(k):
 return next(((x,z,a) for n,x,z,a in ARR[k][str(T[k].n)] if n=='greenhouse'),None)
def gid(label):return hashlib.sha256(('Cloudbreak R3/'+label).encode()).hexdigest()[:6]
def export(mesh,name):
 previous=native.AS
 try:
  native.AS=NEW;return mesh.save(name)
 finally:native.AS=previous
def direct_face(m,points,uvs,normals=None):
 n=native.normal(*points[:3]);v=[(tuple(p),tuple(uvs[i]),tuple(normals[i]) if normals is not None else n)for i,p in enumerate(points)]
 for j in range(1,len(v)-1):m.faces.append((v[0],v[j],v[j+1]))
