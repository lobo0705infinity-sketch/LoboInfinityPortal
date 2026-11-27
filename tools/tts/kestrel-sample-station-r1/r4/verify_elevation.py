"""Check S2-height rays on the final triangles, including the three objective prefabs."""
import json,math
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import numpy as np
w=Path(__file__).resolve().parent/'work'
rows=json.loads((w/'render-scene.json').read_bytes())
cache={};allverts=[];allfaces=[];glassverts=[];glassfaces=[]
def source(p):
 if p not in cache:
  v=[];f=[]
  for line in Path(p).read_text().splitlines():
   if line.startswith('v '):v.append([float(t)for t in line.split()[1:4]])
   elif line.startswith('f '):
    ix=[int(a.split('/')[0])-1 for a in line.split()[1:]];f.extend([(ix[0],ix[j+1],ix[j])for j in range(1,len(ix)-1)])
  cache[p]=np.array(v)*[-1,1,1],np.array(f)
 return cache[p]
for row in rows:
 v,f=source(row['mesh']);m=np.array(row['t']);vs=v@m[:3,:3].T+m[:3,3]
 av,af=(glassverts,glassfaces) if row['glass'] else (allverts,allfaces)
 af.extend((f+len(av)).tolist());av.extend(vs.tolist())
hard=BVHTree.FromPolygons(allverts,allfaces,all_triangles=True);glass=BVHTree.FromPolygons(glassverts,glassfaces,all_triangles=True)
def hit(tree,p,q):
 v=Vector(q)-Vector(p);return tree.ray_cast(Vector(p),v.normalized(),v.length)[0] is not None
ring=[(0,0)]+[(.482*math.cos(i*math.pi/6),.482*math.sin(i*math.pi/6))for i in range(12)]
up=Vector((0,1,0));down=-up;grade=6.25
def floors(x,z,cap,imin=2):
 heights=[]
 for dx,dz in ring:
  floor,n,_,_=hard.ray_cast(Vector((x+dx,cap,z+dz)),down,cap-grade+1)
  if floor is None or floor.y<grade+imin or abs(n.y)<.95:return None
  heights.append(floor.y)
 if max(heights)-min(heights)>.095:return None
 height=max(heights)
 for dx,dz in ring:
  if hard.ray_cast(Vector((x+dx,height+.035,z+dz)),up,1.48)[0] is not None:return None
 return height
targets={};angles=24
for cz in (-20,0,20):
 opts=[]
 for i in range(angles):
  a=2*math.pi*i/angles;x=1.29*math.cos(a);z=cz+1.29*math.sin(a)
  h=floors(x,z,grade+.50,-.15)
  if h is not None:opts.append((i,(x,h+1.5,z)))
 targets[cz]=opts
print('target spots',[(k,len(v))for k,v in targets.items()])
room=json.loads((w/'Kestrel-Lunar-Base.json').read_bytes())['ObjectStates'][0]['ContainedObjects']
results=[]
for obj in room:
 if obj['GUID'] not in ('e53102','c70033'):continue
 t=obj['Transform'];cx=t['posX'];cz=t['posZ'];nick=obj['Nickname'].split(' | ')[0]
 # Restrict roof ownership by the actual collider's convex extent around the local origin.
 cm=obj.get('CustomMesh')
 if not cm:continue
 row=next((r for r in rows if r['name']==obj['Nickname'] and abs(r['t'][0][3]-cx)<.02 and abs(r['t'][2][3]-cz)<.02),None)
 if row is None:continue
 vert,_=source(row['mesh']);m=np.array(row['t']);v=vert@m[:3,:3].T+m[:3,3];l=v.min(0);u=v.max(0)
 roofmax=u[1]
 spots={}
 for x in np.arange(l[0]+.49,u[0]-.42,.50):
  for z in np.arange(l[2]+.49,u[2]-.42,.50):
   for cap in [roofmax+.20,grade+5.65,grade+3.08]:
    h=floors(x,z,cap)
    if h is not None and h<=roofmax+.035:
     spots[(round(float(x),2),round(float(h),2),round(float(z),2))]=(x,h,z)
 top=[]
 for pos,(x,h,z) in spots.items():
  eye=(x,h+1.50,z);counts=[];aperture=[]
  for opts in targets.values():
   vals=[(i,pt)for i,pt in opts if not hit(hard,eye,pt)];aperture.append(len(vals));counts.append(sum(not hit(glass,eye,pt) for i,pt in vals))
  top.append((pos,counts,aperture))
 results.append({'name':nick,'guid':obj['GUID'],'spots':top})

observations={rec['guid']:[spot[1][0] for spot in rec['spots']] for rec in results}
assert len(targets[-20])==18 and observations['e53102']==[0]*4,observations
assert observations['c70033']==[18]*12,observations
report={'leftObjectiveContactPoints':18,'serviceHallRoofVisible':observations['e53102'],'shuttleCradleVisible':observations['c70033']}
(w/'elevation-qa.json').write_text(json.dumps(report,indent=2))
print(report)
