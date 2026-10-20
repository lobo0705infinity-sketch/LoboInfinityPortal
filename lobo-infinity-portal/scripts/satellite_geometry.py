import io,itertools,functools,json
import numpy as np
from scipy.spatial.transform import Rotation
from shapely.geometry import MultiPoint,box
from shapely.ops import unary_union
import UnityPy,trimesh
from satellite_sources import cached

def vec(v):return np.array([v.x,v.y,v.z],float)
def matrix(p,r,s):
 m=np.eye(4);m[:3,:3]=r@np.diag(s);m[:3,3]=p;return m
def corners(center,extent):return np.array([center+np.array(a)*extent for a in itertools.product([-1,1],repeat=3)])
@functools.lru_cache(None)
def local_parts(url,kind):
 p=cached(url)
 if not p.exists():raise ValueError('Asset not available: '+url)
 if kind=='obj':
  v=np.array([list(map(float,l.split()[1:4]))for l in p.read_text(errors='replace').splitlines()if l.startswith('v ')])
  if not len(v):raise ValueError('No vertices: '+url)
  return [v]
 env=UnityPy.load(str(p));transforms={};gos={};filters=[]
 for reader in env.objects:
  if reader.type.name=='Transform':
   t=reader.read();transforms[t.m_GameObject.path_id]=(reader.path_id,t)
  elif reader.type.name=='GameObject':gos[reader.path_id]=reader.read()
  elif reader.type.name=='MeshFilter':filters.append(reader.read())
 byid={id:t for id,t in transforms.values()}
 @functools.lru_cache(None)
 def pose(id):
  t=byid[id];q=t.m_LocalRotation;r=Rotation.from_quat([q.x,q.y,q.z,q.w]).as_matrix()
  m=matrix(vec(t.m_LocalPosition),r,vec(t.m_LocalScale));parent=t.m_Father.path_id
  return pose(parent)@m if parent in byid else m
 out=[]
 for f in filters:
  go=gos[f.m_GameObject.path_id]
  if not go.m_IsActive:continue
  tid,t=transforms[f.m_GameObject.path_id]
  try:
   mesh=f.m_Mesh.read();a=mesh.m_LocalAABB;v=corners(vec(a.m_Center),vec(a.m_Extent))
  except Exception:
   if f.m_Mesh.path_id not in [10202,10206,10207]:continue
   v=corners(np.zeros(3),np.ones(3)*.5)
  out.append((np.c_[v,np.ones(len(v))]@pose(tid).T)[:,:3])
 if not out:raise ValueError('No render bounds: '+url)
 return out
def parts(obj,record):
 t=obj['Transform'];s=[t.get('scale'+k,1)for k in 'XYZ'];r=Rotation.from_euler('zxy',[record[5],record[3],record[4]],degrees=True).as_matrix();m=matrix(record[:3],r,s)
 if obj['Name']=='BlockSquare':vs=[corners(np.zeros(3),np.ones(3)*.5)]
 elif obj['Name']=='Custom_Model':vs=local_parts(obj['CustomMesh']['MeshURL'],'obj')
 elif obj['Name']=='Custom_Assetbundle':vs=local_parts(obj['CustomAssetbundle']['AssetbundleURL'],'bundle')
 else:return []
 return [(np.c_[v,np.ones(len(v))]@m.T)[:,:3]for v in vs]
def footprint(obj,record):
 ps=parts(obj,record)
 footprints=[MultiPoint(v[:,[0,2]]).convex_hull for v in ps if v[:,1].max()>4.9 and v[:,1].min()<14]
 return unary_union(footprints) if footprints else None
