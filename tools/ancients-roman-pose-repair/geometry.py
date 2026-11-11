import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from pathlib import Path
def mesh(path):
 v=[];uv=[];faces=[]
 for l in path.read_text().splitlines():
  if l.startswith('v '):v.append(tuple(map(float,l.split()[1:])))
  elif l.startswith('vt '):uv.append(tuple(map(float,l.split()[1:])))
  elif l.startswith('f '):faces.append([tuple(int(k)-1 for k in t.split('/')[:2]) for t in l.split()[1:]])
 return np.array(v),np.array(uv),np.array(faces)
def groups(v,faces):
 f=faces[:,:,0];e=np.c_[f[:,[0,1,2]].ravel(),f[:,[1,2,0]].ravel()]
 _,lab=connected_components(coo_matrix((np.ones(len(e)),(e[:,0],e[:,1])),shape=(len(v),len(v))).tocsr(),directed=False)
 groups={}
 for f,i in zip(faces,lab[faces[:,0,0]]):
  groups.setdefault(i,[]).append(f)
 return [np.array(x) for x in groups.values()]
if __name__=='__main__':
 for name in ['label-mesh-1c9cbe0bce36f0fe.obj','label-mesh-162249e2dd609adf.obj','persian-infantry-6ab4d1f8623fa29e.obj','label-mesh-008d33172e479fc7.obj','label-mesh-26bfcc454baf55ff.obj']:
  p=Path('/tmp/pose-audit/meshes')/name
  v,uv,fs=mesh(p);g=groups(v,fs)
  from collections import Counter
  print(name, len(g),Counter(len(x) for x in g).most_common(8))
  for x in g[:15]:
   u=uv[x[:,:,1]];p=v[x[:,:,0]]
   print(len(x),'xyz',p.min(axis=(0,1)).round(3),p.max(axis=(0,1)).round(3),'uv',u.min(axis=(0,1)).round(3),u.max(axis=(0,1)).round(3))
