"""Measurements use the released solids. Outdoor routes treat whole buildings as impassable."""
from pathlib import Path
import math
from collections import deque
import shapely
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra
from scipy.spatial import cKDTree
from site_check import *
from architecture import dims,CLEAR,FRONT,BACK,HEIGHT
from shapely import contains_xy
from shapely.geometry import MultiPoint
metrics={};shells=envelopes();courts=court_hulls();cover=union_all([*shells.values(),*courts.values()]);basin=pool
step=.25;coords=np.arange(-24,24.001,step);X,Z=np.meshgrid(coords,coords);H,W=X.shape
def check_paths(diameter):
 # Treat the entire building envelope and pool as solid. A route passing this test works without interiors or pool stairs.
 radius=diameter/25.4/2
 solid=union_all([cover,basin]).buffer(radius+.045)
 obstacles=union_all([solid,*[obj.buffer(.7874+radius) for obj in objectives]])
 valid=~contains_xy(obstacles.buffer(step*math.sqrt(2)/2+.002),X,Z)
 valid&=(np.abs(X)<24-radius-.01)&(np.abs(Z)<24-radius-.01)
 index=np.arange(H*W).reshape(H,W);starts=[];ends=[];weights=[]
 for dz,dx in [(0,1),(1,0),(1,1),(1,-1)]:
  i,j=np.where(valid);n=i+dz;m=j+dx;ok=(n>=0)&(n<H)&(m>=0)&(m<W);i=i[ok];j=j[ok];n=n[ok];m=m[ok];ok=valid[n,m]
  q,k=index[i[ok],j[ok]],index[n[ok],m[ok]]
  starts.extend([q,k]);ends.extend([k,q]);weights.extend([np.full(len(q),step*np.hypot(dz,dx))]*2)
 G=csr_matrix((np.concatenate(weights),(np.concatenate(starts),np.concatenate(ends))),shape=(H*W,H*W))
 vi,vj=np.where(valid);gridpoints=np.c_[X[vi,vj],Z[vi,vj]];ids=index[vi,vj];tree=cKDTree(gridpoints)
 az=np.arange(32)*2*math.pi/32
 result={}
 for direction,sg in [('west',-1),('east',1)]:
  sources=index[valid & (sg*X>=12+radius)]
  dist=dijkstra(G,directed=True,indices=sources,min_only=True)
  for lab,obj in zip(['south','north'],objectives):
   lengths=[]
   for a in az:
    p=np.array([obj.x,obj.y])+(.7874+radius)*np.array([math.cos(a),math.sin(a)])
    alts=[]
    for j in tree.query_ball_point(p,.68):
     line=LineString([gridpoints[j],p])
     if line.intersects(solid) or line.distance(obj)<.7874+radius-1.e-5:continue
     if np.isfinite(dist[ids[j]]):alts.append(dist[ids[j]]+line.length)
    if alts:lengths.append(min(alts))
   assert len(lengths)==len(az),(diameter,direction,lab,len(lengths))
   result[direction+'-'+lab]=round(min(lengths),2)
 # Verify a model can approach the four stair mouths from either deployment side.
 for dev,sign in [('west',-1),('east',1)]:
  dists=dijkstra(G,indices=index[valid & (sign*X>=12+radius)],min_only=True)
  for ident,(x,z) in {'south':(0,-6.34-radius),'north':(0,4.34+radius),'east':(3.34+radius,-1),'west':(-3.34-radius,-1)}.items():
   lineopts=[]
   for j in tree.query_ball_point((x,z),1.15):
    ln=LineString([gridpoints[j],(x,z)])
    if not ln.intersects(solid) and np.isfinite(dists[ids[j]]):lineopts.append(dists[ids[j]]+ln.length)
   assert lineopts,(diameter,dev,ident,'no stair access')
   result[dev+'-stair-'+ident]=round(min(lineopts),2) if lineopts else None
 return result
metrics['outdoor_paths_inches']={mm:check_paths(mm) for mm in (25,40)}
def horizontal_wall(file,y,z):
    rows=section(file,y);g=LineString([(-6,z),(6,z)]);return MultiLineString(rows.tolist()).intersection(g)
door_meta=[];radius=25/25.4/2
for k,(w,d,levels,role) in dims.items():
    for ix,n in enumerate([levels]+list(range(1,levels+1)),1):
        for lev in range(n):
            for side,cx in [(-1,FRONT),(1,BACK)]:
                # Sample both visible and physical jambs, halfway into the wall and partway into the recessed frame.
                for suffix in ['.obj','-col.obj']:
                    path=OUT/(k+'-'+str(ix)+suffix)
                    for z in [side*(d/2+.018),side*(d/2+.108)]:
                        for h in [.46,1.19,2.09]:
                            intersection=horizontal_wall(path,lev*3.1+h,z)
                            pts=shapely.get_coordinates(intersection)[:,0]
                            low=max(x for x in pts if x<cx);high=min(x for x in pts if x>cx)
                            assert abs((high-low)-CLEAR)<.00003,(k,ix,lev,side,h,suffix,low,high)
                # An inward and outward sweep of the 25 mm base must fit between the real colliders and the furnishings.
                parts=chunks(OUT/(k+'-'+str(ix)+'-col.obj'));solid=[]
                for v in parts:
                    if v[:,1].max()<=lev*3.1+.31 or v[:,1].min()>=lev*3.1+1.74:continue
                    solid.append(MultiPoint(v[:,[0,2]]).convex_hull)
                cyl=LineString([(cx,side*(d/2+.76)),(cx,side*(d/2-.74))]).buffer(radius,quad_segs=24)
                assert not union_all(solid).intersects(cyl),(k,ix,lev,side,'obstructed base')
                if lev==0:assert not move(cyl,k).intersects(courts[k]),(k,'exterior fixture crosses door')
                door_meta.append((k,ix,lev,side))
metrics['unique_doorways']=sum(2*n for w,d,n,role in dims.values())
metrics['state_specific_door_checks']=len(door_meta);metrics['jamb_mm']=CLEAR*25.4
assert BACK-FRONT>CLEAR
metrics['open_sampled_lines_R4']= [574,167,88];metrics['open_sampled_lines_R5']=sight_data()
metrics['sample_per_span']=74**2
def gaps(segments,axis,lo,hi):
    v=segments[:,:,axis];cur=lo
    for low,high in sorted(zip(v.min(1),v.max(1))):
        if high<=lo or low>=hi:continue
        if low>cur+1e-5:return True
        cur=max(cur,high)
    return cur<hi-1e-5
for y in [1.,1.57,1.83]:
    for suffix in ['.obj','-col.obj']:
        segs=np.vstack([segments(OUT/(k+'-court'+suffix),k,y) for k in sites])
        assert all(not gaps(segs,ax,lo,hi) for ax in (0,1) for lo,hi in [(-24.,-24+30/25.4),(24-30/25.4,24.)]),(y,suffix)
metrics['guarded_board_edges']=4
print(json.dumps(metrics,indent=2),flush=True);write(ROOT/'Review/physics.json',metrics)
