"""Compare exact visible TTS triangles and the published Zero Visibility volumes at standing figure height."""
from district import *
import trimesh
from trimesh.ray.ray_pyembree import RayMeshIntersector
from itertools import combinations
from shapely import contains_xy
from collections import Counter
@lru_cache(None)
def mesh_ray(key):
 meshes=[]
 for name,ts in key:
  pts,faces=geometry(name);a=transform(pts,dict(ts))
  meshes.append(trimesh.Trimesh(a,faces,process=False))
 return RayMeshIntersector(trimesh.util.concatenate(meshes))
def rays_through(objects,A,B):
 if not objects or not len(A):return np.zeros(len(A),dtype=bool)
 key=tuple((slug(o),tuple(o['Transform'].items()))for o in objects);ray=mesh_ray(key)
 v=B-A;length=np.linalg.norm(v,axis=1);v=v/length[:,None];hits=np.zeros(len(A),dtype=bool)
 for k in range(0,len(A),4500):
  loc,idx,_=ray.intersects_location(A[k:k+4500]+v[k:k+4500]*.006,v[k:k+4500],multiple_hits=False)
  ids=k+idx;hits[ids]=np.linalg.norm(loc-A[ids],axis=1)<length[ids]-.01
 return hits
def exterior_samples(k,count=9):
 t=T[k];h=t.n*PITCH;_,ss=native.read_obj(AS2/('tower-'+k+'-'+str(t.n+1)+'-col.obj'));floor=unary_union([Polygon(p) for p,lo,hi in ss if abs(hi-h)<.02])
 block=unary_union([Polygon(p) for p,lo,hi in ss if lo<h+1.60 and hi>h+.055])
 reserve=[block];g=greenhouse(k)
 if g:reserve.append(footprint_of('greenhouse',*g))
 if k in O and O[k][0]==t.n:reserve.append(Point(O[k][1],O[k][2]).buffer(.82))
 nav=floor.difference(unary_union(reserve)).buffer(-BASE_RADIUS-.04)
 minx,minz,maxx,maxz=nav.bounds
 x,z=np.meshgrid(np.arange(minx+.04,maxx,.32),np.arange(minz+.04,maxz,.32));a=np.column_stack([x.ravel(),z.ravel()]);a=a[contains_xy(nav,a[:,0],a[:,1])]
 ctr=np.array([nav.centroid.x,nav.centroid.y]);selected=[int(np.argmin(np.linalg.norm(a-ctr,axis=1)))]
 for _ in range(count-1):
  d=np.min([np.linalg.norm(a-a[i],axis=1)for i in selected],axis=0);i=int(np.argmax(d))
  if d[i]<1.05:break
  selected.append(i)
 return [[round(x+t.x,4),round(h+BASE_Y+EYE,4),round(z+t.z,4)] for x,z in a[selected]]
def cylinder(A,B,c):
 # Segment clipped to the horizontal ellipse and bounded vertical interval.
 d=B-A;a=math.radians(c.get('angle',0));cs,sn=math.cos(a),math.sin(a);px=A[:,0]-c['x'];pz=A[:,2]-c['z']
 xx=(px*cs-pz*sn)/c['rx'];zz=(px*sn+pz*cs)/c['rz'];dx=(d[:,0]*cs-d[:,2]*sn)/c['rx'];dz=(d[:,0]*sn+d[:,2]*cs)/c['rz']
 qa=dx**2+dz**2;qb=xx*dx+zz*dz;disc=qb*qb-qa*(xx**2+zz**2-1);rt=np.sqrt(np.maximum(disc,0));v=np.maximum(qa,1e-15)
 t0=np.maximum(0,(-qb-rt)/v);t1=np.minimum(1,(-qb+rt)/v);y0=A[:,1]+d[:,1]*t0;y1=A[:,1]+d[:,1]*t1
 return (disc>1e-8)&(t1>t0)&(np.maximum(y0,y1)>=c['lo'])&(np.minimum(y0,y1)<=c['hi'])
def all_cylinders(A,B,c):
 return np.logical_or.reduce([cylinder(A,B,i)for i in c]) if c else np.zeros(len(A),dtype=bool)
def body_mask(A,B,x,y,z,rx,ry,rz,angle=0):
 # Ray intersects the inscribed core of a candidate cloud or opaque airship envelope.
 a=math.radians(angle);c,s=math.cos(a),math.sin(a)
 def local(Q):
  p=Q-[x,y,z];return np.column_stack([(p[:,0]*c-p[:,2]*s)/rx,p[:,1]/ry,(p[:,0]*s+p[:,2]*c)/rz])
 P=local(A);D=local(B)-P;t=np.clip(-np.sum(P*D,axis=1)/np.maximum(1e-12,np.sum(D*D,axis=1)),0,1)
 return np.sum((P+t[:,None]*D)**2,axis=1)<1
def old_geometry():
 return [o for o in PIECES if slug(o).startswith(('tower-','bridge-','moored-'))]
def baseline():
 samples={k:exterior_samples(k)for k in T};pa=[];pb=[];labels=[]
 for a,b in combinations(T,2):
  for i,x in enumerate(samples[a]):
   for j,y in enumerate(samples[b]):
    if np.linalg.norm(np.array(x)[[0,2]]-np.array(y)[[0,2]])>=10:
     pa.append(x);pb.append(y);labels.append(a+b)
 A,B=np.array(pa),np.array(pb);labels=np.array(labels);physical=rays_through(old_geometry(),A,B)
 # Five standard consoles have authentic geometry plus attached bases.
 cons=[o for o in PIECES if 'mission' in o.get('Tags',[])]
 if cons:
  import shutil
  console_mesh=PREVIOUS/'work/console-render.obj';name='exact-test-console'
  raw=console_mesh.read_text().splitlines();tv=[];tf=[]
  for row in raw:
   ls=row.split()
   if ls and ls[0]=='v':tv.append((-float(ls[1]),float(ls[2]),float(ls[3])))
   elif ls and ls[0]=='f':tf.append([int(q.split('/')[0])-1 for q in ls[1:]])
  meshes=[trimesh.Trimesh(transform(np.array(tv),o['Transform']),tf,process=False)for o in cons]
  base=trimesh.creation.cylinder(radius=40/25.4/2,height=.12,sections=32);base.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2,[1,0,0]))
  for o in cons:
   t=o['Transform'];b=base.copy();b.apply_translation([t['posX'],t['posY']-.045,t['posZ']]);meshes.append(b)
  cr=RayMeshIntersector(trimesh.util.concatenate(meshes));V=B-A;length=np.linalg.norm(V,axis=1);loc,ix,_=cr.intersects_location(A,V/length[:,None],multiple_hits=False);physical[ix]|=np.linalg.norm(loc-A[ix],axis=1)<length[ix]-.01
 visible=~(physical|all_cylinders(A,B,LOW))
 np.savez_compressed(WORK3/'baseline.npz',A=A,B=B,labels=labels,visible=visible,physical=physical)
 (WORK3/'positions.json').write_text(json.dumps(samples,indent=1));print(len(A),'pairs;',visible.sum(),'previously clear;',len(set(labels[visible])),'roof pairs',flush=True)
if __name__=='__main__':baseline()
