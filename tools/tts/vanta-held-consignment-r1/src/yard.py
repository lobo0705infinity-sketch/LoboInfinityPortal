"""Geometry and data access for the Vanta Customs Yard B-Pong playtest."""
import sys, json, math, os, hashlib, urllib.request, time
from pathlib import Path
from copy import deepcopy
import numpy as np
from scipy.spatial.transform import Rotation
from shapely.geometry import MultiPoint, Polygon
R=Path(__file__).resolve().parents[1];W=R/'work';A=R/'assets';D=R/'dist';C=W/'cache'
for p in (W,A,D,C):p.mkdir(exist_ok=True)
ROOT=R.parent
REPO='lobo0705infinity-sketch/LoboInfinityPortal'
RAW='https://raw.githubusercontent.com/'+REPO+'/'
PREFIX='assets/tts/vanta-held-consignment-r1'
TAG='LoboMap:810053'
GRADE=4.
TITLE='Vanta Customs Yard - Held Consignment - B-Pong - Playtest'
def load(p):return json.loads(Path(p).read_bytes())
def save(p,d):Path(p).write_text(json.dumps(d,ensure_ascii=False,separators=(',',':'),allow_nan=False))
def originals():return load(R/'baseline/stage-bag.json')
def flat(o,states=True):
 yield o
 for c in o.get('ChildObjects',[]):yield from flat(c,states)
 if states:
  for c in o.get('States',{}).values():yield from flat(c,states)
def urls(b):
 return sorted({u for o in b['ContainedObjects'] for s in flat(o) for field in ('CustomMesh','CustomAssetbundle') for k,u in s.get(field,{}).items() if k.endswith('URL') and isinstance(u,str) and u})
def get(url):
 for i in range(4):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Vanta-Customs-Yard-TTS'}),timeout=32) as r:return r.read()
  except OSError:
   if i==3:raise
   time.sleep(.4+i*.4)
def cache(u):
 if '/'+PREFIX+'/' in u:return A/u.split('/')[-1]
 return C/(hashlib.sha256(u.encode()).hexdigest()[:12]+'-'+u.split('/')[-1])
def download(u):
 p=cache(u)
 if not p.is_file() or p.stat().st_size==0:p.write_bytes(get(u))
 return p
def matrix(t):
 m=np.eye(4);m[:3,:3]=Rotation.from_euler('YXZ',[t['rotY'],t['rotX'],t['rotZ']],degrees=True).as_matrix() @ np.diag([t[k] for k in ('scaleX','scaleY','scaleZ')]);m[:3,3]=[t[k]for k in ('posX','posY','posZ')];return m
def meshdata(p):
 from functools import lru_cache
 return _mesh(str(p))
from functools import lru_cache
@lru_cache(maxsize=512)
def _mesh(p):
 v=[];f=[];g=0;groups=[]
 for line in Path(p).read_text(errors='replace').splitlines():
  a=line.split()
  if not a:continue
  if a[0]=='v':v.append(tuple(map(float,a[1:4])))
  elif a[0] in ('g','o'):g+=1
  elif a[0]=='f':
   i=[int(t.split('/')[0]) for t in a[1:]];i=[k-1 if k>0 else len(v)+k for k in i]
   for j in range(1,len(i)-1):f.append((i[0],i[j],i[j+1]));groups.append(g)
 return np.array(v)*[-1,1,1],np.array(f),np.array(groups)
def geo(obj,collider=True):
 m=matrix(obj['Transform']);cm=obj.get('CustomMesh',{});u=(cm.get('ColliderURL') if collider else None) or cm.get('MeshURL')
 if not u:return None
 v,f,g=meshdata(cache(u))
 return v@m[:3,:3].T+m[:3,3],f,g
def footprint(o):
 geometry=geo(o)
 if geometry is None:return None
 v,_,_=geometry;return MultiPoint(v[:,[0,2]]).convex_hull
def where(o):
 t=o['Transform'];return (t['posX'],t['posZ'])
def at(o,x,z,yaw,y=4.003):
 o['Transform'].update(posX=float(x),posY=float(y),posZ=float(z),rotX=0.,rotY=float(yaw)%360,rotZ=0.)
if __name__=='__main__':
 from concurrent.futures import ThreadPoolExecutor
 us=urls(originals()); print(len(us),'urls',flush=True)
 with ThreadPoolExecutor(10) as pool:list(pool.map(download,us))
 for o in originals()['ContainedObjects']:
  if not o.get('CustomMesh') or o['GUID'] in ('810007','810008'):continue
  fp=footprint(o)
  print(o['GUID'],o['Nickname'].split(' | ')[0][:25],tuple(round(i,2)for i in fp.bounds))
