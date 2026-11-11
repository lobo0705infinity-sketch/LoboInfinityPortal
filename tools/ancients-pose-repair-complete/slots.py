from geometry import *
from collections import defaultdict
def planar_groups(v,u,f):
 p=v[f[:,:,0]]; t=u[f[:,:,1]]
 norm=np.cross(p[:,1]-p[:,0],p[:,2]-p[:,0])[:,2]
 keep=(np.ptp(p[:,:,2],axis=1)<1e-5)&(abs(norm)>1e-10)&(np.ptp(t[:,:,0],axis=1)>1e-6)&(np.ptp(t[:,:,1],axis=1)>1e-6)
 idx=np.flatnonzero(keep);p=p[idx];t=t[idx]
 n=np.arange(len(t))
 low=t.argmin(axis=1); high=t.argmax(axis=1)
 a=(p[n,high[:,0],0]-p[n,low[:,0],0])/(t[n,high[:,0],0]-t[n,low[:,0],0])
 c=(p[n,high[:,1],1]-p[n,low[:,1],1])/(t[n,high[:,1],1]-t[n,low[:,1],1])
 b=p[:,0,0]-a*t[:,0,0]
 d=p[:,0,1]-c*t[:,0,1]
 by=defaultdict(list)
 for key,i in zip(zip(np.sign(norm[idx]),np.round(p[:,0,2],4),np.round(a,2),np.round(b,2),np.round(c,2),np.round(d,2)),idx):
  by[key].append(i)
 return [(k,np.array(i)) for k,i in by.items()]

def candidates(v,u,f):
 for k,i in planar_groups(v,u,f):
  p=v[f[i,:,0]]
  lo=p.min(axis=(0,1));hi=p.max(axis=(0,1))
  if hi[1]-lo[1]>.45 and hi[0]-lo[0]>.10 and len(i)>=8:
   yield k,i,lo,hi

if __name__=='__main__':
 import json
 from collections import Counter
 root=Path(__file__).parent
 for name,(url,tex) in json.loads((root/'main.json').read_text()).items():
  v,u,f=mesh(root/'source'/url.split('/')[-1])
  a=Counter((int(k[0]),len(i),round(lo[1],3),round(hi[1],3),tuple(np.round(u[f[i,:,1]].mean(axis=(0,1)),2))) for k,i,lo,hi in candidates(v,u,f))
  print(name,len(a),a.most_common(14))
