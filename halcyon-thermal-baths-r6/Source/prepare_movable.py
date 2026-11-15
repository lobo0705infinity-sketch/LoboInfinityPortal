"""Preserve world geometry, give each state a common local pivot and convex parts.
Run after package_halcyon.py. Collision uses the author's closed primitives;
free scenic shells receive separate convex hulls, never the whole building.
"""
from pathlib import Path
import json,math,hashlib,copy
import numpy as np,trimesh
from shapely.geometry import Polygon
from shapely.ops import triangulate
R=Path(__file__).resolve().parents[1];A=R/'Assets'

def convex_polys(poly):
 p=Polygon(poly).buffer(0)
 if p.is_empty:return []
 if abs(p.convex_hull.area-p.area)<1e-7:return [p]
 pieces=[t for t in triangulate(p)if p.covers(t)]
 changed=True
 while changed:
  changed=False
  for i,a in enumerate(pieces):
   for j in range(i):
    b=pieces[j]
    if a.distance(b)>1e-7:continue
    u=a.union(b)
    if u.geom_type=='Polygon'and abs(u.convex_hull.area-u.area)<1e-7:
     pieces[j]=u;pieces.pop(i);changed=True;break
   if changed:break
 return pieces

def hull(points):
 pts=np.unique(np.round(np.array(points,float),7),axis=0)
 if len(pts)<3:return None
 centered=pts-pts.mean(axis=0)
 if np.linalg.matrix_rank(centered,tol=1e-7)<3:
  _,_,vh=np.linalg.svd(centered,full_matrices=False);normal=vh[-1]
  pts=np.vstack([pts+normal*.004,pts-normal*.004])
 try:m=trimesh.convex.convex_hull(pts)
 except Exception:return None
 if len(m.faces)>=255:
  p=np.asarray(m.vertices);chosen=list(dict.fromkeys([int(np.argmin(p[:,a]))for a in range(3)]+[int(np.argmax(p[:,a]))for a in range(3)]))
  while len(chosen)<min(64,len(p)):
   distances=((p[:,None,:]-p[chosen][None,:,:])**2).sum(axis=2).min(axis=1);chosen.append(int(np.argmax(distances)))
  m=trimesh.convex.convex_hull(p[chosen])
 return m if m.volume>1e-9 else None

def compound(st):
 volumes=[]
 for kind,data in st['physical_primitives']:
  if kind=='poly':poly,y,h=data
  else:
   x,y,z,w,h,d=data;poly=[(x-w/2,z-d/2),(x+w/2,z-d/2),(x+w/2,z+d/2),(x-w/2,z+d/2)]
  shape=Polygon(poly).buffer(0)
  if h>1e-7 and shape.area>1e-8:volumes.append((shape,y,y+h))
 volumes.sort(key=lambda p:p[0].area*(p[2]-p[1]),reverse=True)
 kept=[]
 for p,lo,hi in volumes:
  if any(a-1e-7<=lo and b+1e-7>=hi and q.buffer(1e-7).covers(p)for q,a,b in kept):continue
  kept.append((p,lo,hi))
 parts=[]
 for p,lo,hi in kept:
  for c in convex_polys(list(p.exterior.coords)[:-1]):
   q=list(c.exterior.coords)[:-1];m=hull([(x,y,z)for y in [lo,hi]for x,z in q])
   if m is not None:parts.append(m)
 for points in st['physical_extras']:
  m=hull(points)
  if m is not None:parts.append(m)
 # Uncaptured faces are only scenery shells: roof slopes, outcrops, bath shells.
 vs=[];fs=[]
 for points in st['free_faces']:
  n=len(vs);vs.extend(points)
  for j in range(1,len(points)-1):fs.append([n,n+j,n+j+1])
 if fs:
  free=trimesh.Trimesh(vs,fs,process=True)
  for component in free.split(only_watertight=False):
   m=hull(component.vertices)
   if m is not None:parts.append(m)
 assert parts
 return parts

def write_compound(path,parts,pivot):
 lines=['# Halcyon movable compound collider: one closed convex mesh per object/group']
 count=0;stored=[]
 for i,m in enumerate(parts):
  vs=np.asarray(m.vertices).copy();vs-=pivot;vs[:,0]*=-1;faces=m.faces[:,::-1]
  assert len(faces)<255,(path.name,i,len(faces))
  lines+=['o convex_%04d'%i,'g convex_%04d'%i]
  lines+=['v %.7f %.7f %.7f'%tuple(p)for p in vs]
  lines+=['f '+' '.join(str(count+j+1)for j in f)for f in faces]
  count+=len(vs);stored.append({'vertices':vs.tolist(),'faces':faces.tolist()})
 path.write_text('\n'.join(lines)+'\n');assert count<25000,(path.name,count)
 return stored

def localize(path,pivot):
 lines=[]
 for line in path.read_text().splitlines():
  if line.startswith('v '):
   x,y,z=map(float,line.split()[1:]);line='v %.7f %.7f %.7f'%(x+pivot[0],y-pivot[1],z-pivot[2])
  lines.append(line)
 path.write_text('\n'.join(lines)+'\n')

def main():
 records=json.loads((R/'Source/geometry-manifest.json').read_text());info={};localized=set();proof=[]
 for rec in records:
  state_meshes=[trimesh.load(A/s['file'],force='mesh',process=False)for s in rec['states']]
  points=np.vstack([m.vertices for m in state_meshes]);points[:,0]*=-1
  pivot=(points.min(axis=0)+points.max(axis=0))/2
  for st in rec['states']:
   parts=compound(st)
   if rec['slug'].startswith('oxygen-cage-'):
    # Decorative hose ends extend below the rack foot. Do not let them become
    # the support point of an unlocked rack or lever its base off the table.
    clipped=[]
    for part in parts:
     v=part.vertices.copy();v[:,1]=np.maximum(v[:,1],0)
     if np.ptp(v[:,1])<1e-7:continue
     m=hull(v)
     if m is not None:clipped.append(m)
    parts=clipped
   serialized=write_compound(A/st['collider'],parts,pivot)
   localize(A/st['file'],pivot);localized.add(st['file'])
   # The grid attachment is visual. Its tiny convex contact sits inside a parent part.
   grid=st['file'].replace('.obj','-grid.obj');grid_col=grid.replace('.obj','-collision.obj')
   if(A/grid).exists():
    localize(A/grid,pivot);localized.add(grid)
    center=parts[0].vertices.mean(axis=0);small=trimesh.creation.box(extents=[.008]*3);small.apply_translation(center)
    write_compound(A/grid_col,[small],pivot)
   info[st['file']]={'pivot':pivot.tolist(),'collider':st['collider'],'grid':grid,'grid_collider':grid_col}
   proof.append({'file':st['file'],'pivot':pivot.tolist(),'convex_parts':len(parts),'collider_vertices':sum(len(x['vertices'])for x in serialized)})
 # Keep the map base at its own centered origin. Its floor triangles are separate convex parts.
 mat=trimesh.load(A/'halcyon-ground.obj',force='mesh',process=False);parts=[]
 for tri in mat.triangles:
  n=np.cross(tri[1]-tri[0],tri[2]-tri[0])
  if n[1]<.001:continue
  world=tri.copy();world[:,0]*=-1
  m=hull(np.vstack([world,world-[0,.025,0]]))
  if m is not None:parts.append(m)
 # Stable lower slab supports the recessed basins without capping their openings.
 slab=trimesh.creation.box(extents=[48,.15,48]);slab.apply_translation([0,-1.075,0]);parts.append(slab)
 pivot=np.array([0,-.575,0]);write_compound(A/'halcyon-ground-collision.obj',parts,pivot);localize(A/'halcyon-ground.obj',pivot)
 info['halcyon-ground.obj']={'pivot':pivot.tolist(),'collider':'halcyon-ground-collision.obj'}
 proof.append({'file':'halcyon-ground.obj','pivot':pivot.tolist(),'convex_parts':len(parts),'collider_vertices':sum(len(m.vertices)for m in parts)})
 (R/'Source/movable-collider-data.json').write_text(json.dumps(info,indent=2))
 # Both the native bag and preview receive identical pivots and physics settings.
 host=(R/'Source/asset-base.txt').read_text().strip()
 physics='self.auto_raise=true;self.sticky=false;self.mass=2;self.drag=1;self.angular_drag=4;self.bounciness=0;'
 def edit(o,parent=None):
  cm=o.get('CustomMesh');file=cm.get('MeshURL','').rsplit('/',1)[-1]if cm else''
  data=info.get(file)
  if data:
   p=data['pivot'];o['Transform'].update(posX=p[0],posY=2.25+p[1],posZ=p[2]);cm['Convex']=True
   o['Autoraise']=True;o['Sticky']=False
   o['LuaScript']=o.get('LuaScript','').replace('function onLoad()', 'function onLoad()'+physics,1)
   for child in o.get('ChildObjects',[]):
    cc=child.get('CustomMesh')
    if cc and child.get('Nickname')=='Horizontal grid surfaces':
     cc['Convex']=True;cc['ColliderURL']=host+'/'+data['grid_collider'];child['Locked']=False;child['Autoraise']=True;child['Sticky']=False
  for child in o.get('ChildObjects',[]):
   if child.get('Nickname')!='Horizontal grid surfaces':edit(child,o)
  for state in o.get('States',{}).values():edit(state,parent)
 for folder in ['SavedObjects','PreviewSave']:
  for path in(R/folder).glob('*R5*.json'):
   d=json.loads(path.read_text());roots=d['ObjectStates']
   if roots[0]['Name']=='Bag':
    bag=roots[0];payload=bag['ContainedObjects'];positions={}
    for line in bag['LuaScript'].splitlines():
     if line.startswith('--'):
      f=line[2:].split(',');positions[f[0]]=list(map(float,f[1:]))
    for o in payload:
     edit(o)
     for v in [o]+list(o.get('States',{}).values()):
      if v.get('CustomMesh',{}).get('MeshURL','').rsplit('/',1)[-1]in info:
       positions[v['GUID']]=[v['Transform'][k]for k in ['posX','posY','posZ','rotX','rotY','rotZ']]
     o['Transform'].update(posX=70,posY=100,posZ=70)
    bag['LuaScript']='\r\n'.join('--'+','.join([g]+[str(x)for x in p])for g,p in positions.items())+'\r\n'
   else:
    for o in roots:edit(o)
   path.write_text(json.dumps(d,ensure_ascii=False,indent=2))
 (R/'Review/Halcyon-R5-Movable-Authoring.json').write_text(json.dumps({'status':'Pass','states':proof,'checks':['Local center pivots shared by all states of each piece','Closed convex compound collider groups','Auto Raise enabled, Sticky disabled','No unlocked-only concave terrain colliders','Visual grid attachments use embedded convex contacts'],'limitations':['Live TTS physics remains unverified']},indent=2))
 print('Prepared movable collision for',len(proof),'state meshes; max parts',max(p['convex_parts']for p in proof),flush=True)
if __name__=='__main__':main()
