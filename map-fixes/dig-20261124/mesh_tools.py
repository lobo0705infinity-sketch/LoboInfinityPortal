from pathlib import Path
import numpy as np
class Obj:
 def __init__(self,p):
  self.lines=Path(p).read_text().splitlines();self.v=[];self.uv=[];self.faces=[];self.fi=[]
  for i,l in enumerate(self.lines):
   if l.startswith('v '):self.v.append(list(map(float,l.split()[1:4])))
   elif l.startswith('vt '):self.uv.append(list(map(float,l.split()[1:3])))
   elif l.startswith('f '):self.faces.append([int(s.split('/')[0])-1 for s in l.split()[1:]]);self.fi.append(i)
  self.v=np.array(self.v);self.faces=np.array(self.faces)
 def groups(self):
  parent=list(range(len(self.faces)));seen={}
  def root(a):
   while parent[a]!=a:parent[a]=parent[parent[a]];a=parent[a]
   return a
  for i,f in enumerate(self.faces):
   for v in f:
    k=tuple(self.v[v].round(6))
    if k in seen:parent[root(i)]=root(seen[k])
    else:seen[k]=i
  groups={}
  for i in range(len(parent)):groups.setdefault(root(i),[]).append(i)
  return list(groups.values())
 def bounds(self,fs):
  v=self.v[self.faces[fs].flatten()];return np.array([v.min(0),v.max(0)])
if __name__=='__main__':
 import sys
 o=Obj(sys.argv[1]);gs=o.groups();print('groups',len(gs))
 for i,g in enumerate(gs):
  a,b=o.bounds(g)
  if a[0]>-3 and b[0]<3 and a[2]>-2.8 and b[2]<2.8:print(i,len(g),a.round(3),b.round(3))
