"""Remove coplanar overlapping surfaces while retaining interpolated texture UVs."""
from pathlib import Path
from collections import defaultdict
import numpy as np
from shapely.geometry import Polygon
from shapely.ops import unary_union
from shapely import constrained_delaunay_triangles

def load_obj(p):
 v=[];uv=[];faces=[]
 for line in p.read_text().splitlines():
  a=line.split()
  if not a:continue
  if a[0]=='v':v.append(list(map(float,a[1:4])))
  elif a[0]=='vt':uv.append(list(map(float,a[1:3])))
  elif a[0]=='f':
   ids=[x.split('/') for x in a[1:]]
   for i in range(1,len(ids)-1):
    f=[ids[j] for j in [0,i,i+1]];faces.append((np.array([v[int(x[0])-1] for x in f]),np.array([uv[int(x[1])-1] for x in f])))
 return faces

def planes(faces):
 groups=defaultdict(list)
 for i,(v,uv) in enumerate(faces):
  n=np.cross(v[1]-v[0],v[2]-v[0]);length=np.linalg.norm(n)
  if length<1e-10:continue
  n/=length;ax=int(np.argmax(abs(n)));sign=1 if n[ax]>0 else -1;n*=sign;dist=np.dot(n,v[0]);key=tuple(np.round(n,4))+(round(dist,4),)
  drop=int(np.argmax(abs(n)));keep=[j for j in range(3) if j!=drop];poly=Polygon(v[:,keep])
  if poly.area>1e-10:groups[key].append((i,sign,poly,keep))
 return groups

def audit(faces):
 total=0.;pairs=0
 for items in planes(faces).values():
  polys=[q[2] for q in items]
  if len(polys)<2:continue
  from shapely.strtree import STRtree
  tree=STRtree(polys)
  for i,p in enumerate(polys):
   for j in tree.query(p):
    if j<=i:continue
    a=p.intersection(polys[j]).area
    if a>1e-7:pairs+=1;total+=a
 return dict(overlap_pairs=pairs,overlap_area=round(total,6))

def clean(source,dest):
 faces=load_obj(source);before=audit(faces);out=[]
 for items in planes(faces).values():
  unions={s:unary_union([q[2] for q in items if q[1]==s]) for s in [-1,1]}
  occupied={-1:Polygon(),1:Polygon()}
  for i,sign,poly,keep in reversed(items):
   clipped=poly.difference(unions[-sign]).difference(occupied[sign]);occupied[sign]=occupied[sign].union(poly)
   if clipped.is_empty:continue
   v,uv=faces[i];a=v[:,keep];M=np.vstack([a.T,np.ones(3)]);inv=np.linalg.inv(M)
   for part in getattr(clipped,'geoms',[clipped]):
    if part.geom_type!='Polygon' or part.area<1e-9:continue
    for tri in constrained_delaunay_triangles(part).geoms:
     if tri.area<1e-9:continue
     pts=np.array(tri.exterior.coords)[:3];weights=np.column_stack([pts,np.ones(3)])@inv.T;vv=weights@v;tt=weights@uv
     if np.dot(np.cross(vv[1]-vv[0],vv[2]-vv[0]),np.cross(v[1]-v[0],v[2]-v[0]))<0:vv=vv[::-1];tt=tt[::-1]
     out.append((vv,tt))
 lines=['# R13 surface cleanup | original coordinates, face winding and texture mapping retained'];ids=1
 for v,uv in out:
  for p,t in zip(v,uv):lines.append('v '+' '.join(f'{x:.8f}' for x in p));lines.append('vt '+' '.join(f'{x:.8f}' for x in t))
  lines.append(f'f {ids}/{ids} {ids+1}/{ids+1} {ids+2}/{ids+2}');ids+=3
 dest.write_text('\n'.join(lines)+'\n');after=audit(load_obj(dest));assert after['overlap_pairs']==0,(dest.name,after)
 return dict(source=source.name,output=dest.name,triangles_before=len(faces),triangles_after=len(out),before=before,after=after)
if __name__=='__main__':
 import json
 R=Path(__file__).resolve().parents[1];A=R/'Assets';bag=json.load(open(R/'Saved-Objects/Redline-Interchange-R12-Signage-Artwork.json'));names=set();buildings=[]
 for o in bag['ObjectStates'][0]['ContainedObjects']:
  if 'building' not in o.get('Tags',[]):continue
  buildings.append(o)
  for q in [o]+list(o.get('States',{}).values()):names.add(q['CustomMesh']['MeshURL'].rsplit('/',1)[-1])
 reports=[]
 for name in sorted(names):
  output=name.replace('r11-','r13-');report=clean(A/name,A/output);reports.append(report);print(name,report['before'],'->',report['after'],flush=True)
 (R/'Source/R13-mesh-cleanup.json').write_text(json.dumps(reports,indent=2));print('Verified',len(buildings),'buildings;',len(names),'unique state meshes')
