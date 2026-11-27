"""Cut only the thin collar segments traversing existing personnel doors.
Deduplicate OBJ vertex/UV directories while preserving the original convex components and UVs.
"""
from plan import *
from shapely.geometry import MultiPoint,LineString
import numpy as np
from collections import defaultdict
def cuts(src,t,lines,dest):
 v=[];uv=[];norm=[];groups=defaultdict(list);group='main'
 for line in src.read_text().splitlines():
  k,*vals=line.split() if line.strip() else ('#',)
  if k=='v':v.append(tuple(vals[:3]))
  elif k=='vt':uv.append(tuple(vals[:2]))
  elif k=='vn':norm.append(tuple(vals[:3]))
  elif k in ('o','g'):group=vals[0]
  elif k=='f':groups[group].append(vals)
 a=r2.world(np.array(v,dtype=float),t)
 skip=set()
 for group,faces in groups.items():
  ids={int(f.split('/')[0])-1 for face in faces for f in face};p=a[list(ids)]
  low=p[:,1].min()-6.25;hi=p[:,1].max()-6.25
  # Both types of ring are original raised sill sections, physically separate from floor and load-bearing framing.
  if low<.17 or hi>1.0 or hi-low>.22:continue
  poly=MultiPoint(p[:,[0,2]]).convex_hull
  if any(poly.distance(line)<.57 for line in lines):skip.add(group)
 if not skip:return False
 arrays=[v,uv,norm];stores=[{}, {}, {}];result=[]
 def reference(token):
  ix=token.split('/');out=[]
  for i,k in enumerate(ix):
   if not k:out.append('');continue
   value=tuple(round(float(x),6) for x in arrays[i][int(k)-1]);out.append(str(stores[i].setdefault(value,len(stores[i])+1)))
  return '/'.join(out)
 for group,faces in groups.items():
  if group in skip:continue
  result.append('o '+group)
  result.extend('f '+' '.join(reference(f) for f in face) for face in faces)
 header=['# Kestrel R3 - flush personnel thresholds.']
 for name,s in zip(('v','vt','vn'),stores):
  for coord in s:header.append(name+' '+' '.join(('%0.6f'%v).rstrip('0').rstrip('.') or '0' for v in coord))
 dest.write_text('\n'.join(header+result)+'\n')
 return True
def main():
 from build_station import build
 by={o['GUID']:o for o in build(repair=False)['ContainedObjects']}
 def axis(a,b):return LineString([a[::-1],b[::-1]])
 paths={
  'c70007':[axis((-15.00,-10),(-13.20,-10))],
  'c70025':[axis((-12.10,-10),(-10.78,-10)),axis((-3.28,-10),(-1.88,-10)),axis((-7,-15.12),(-7,-13.76)),axis((-7,-6.38),(-7,-4.85))],
  'c7a300':[axis((-1.70,-19),(-.57,-19))],
  'c7002b':[axis((.38,-10),(1.43,-10)),axis((2.7,-8.62),(2.7,-7.35)),axis((4.05,-10),(5,-10)),axis((2.7,-12.6),(2.7,-11.4))]
 }
 manifest={}
 for g,lines in paths.items():
  obj=by[g];found={}
  for r in [obj,*obj.get('States',{}).values()]:
   for k,s in [('MeshURL',''),('ColliderURL','-c')]:
    url=r['CustomMesh'][k]
    if url in found:continue
    name='port-'+r['GUID']+s+'.obj';found[url]=name if cuts(resource(url),r['Transform'],lines,A/name) else None
  manifest[g]={u:n for u,n in found.items() if n}
 (ROOT/'ports.json').write_text(json.dumps(manifest,indent=1)+'\n')
if __name__=='__main__':main()
