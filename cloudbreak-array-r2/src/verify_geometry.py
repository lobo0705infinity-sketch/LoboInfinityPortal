"""Independently measure the final OBJ colliders, state routes, clouds and greenhouse aisles."""
from project import *
from design import access,structure,green_ports,pieces,footprint_of
from shapely.geometry import LineString
from collections import Counter
from itertools import combinations
from math import sin,cos,radians
from shapely.ops import nearest_points
BASER=25/25.4/2;ARR=json.loads((WORK/'arrangement.json').read_text());REPORT={}
def exported(s):return read_obj(AS/(s+'-col.obj'))[1]
def clouds():
 banks=json.loads((WORK/'clouds.json').read_text());outer=[]
 for o in bridges:
  t=o['Transform'];fs,_=read_obj(AS/(slug(o)+'.obj'));fp=MultiPoint([(p[0]*t['scaleX'],p[2]*t['scaleZ'])for f in fs for p,_,_ in f]).convex_hull
  outer.append(affinity.translate(affinity.rotate(fp,-t['rotY'],origin=(0,0)),*center(o)))
 bridge=unary_union(outer);towers=unary_union([affinity.translate(t.poly,t.x,t.z) for t in T.values()]);clear=[]
 for c in banks:
  s='vapour-'+str(c['variant']);f,_=read_obj(AS/(s+'.obj'));assert all(x*x+z*z<=1.00001 and -.00001<=y<=1.00001 for ff in f for (x,y,z),uv,n in ff)
  x,z=c['x'],c['z'];p=affinity.scale(Point(x,z).buffer(1,quad_segs=80),c['rx'],c['rz'],origin=(x,z));clear.append(bridge.distance(p));assert not p.intersects(bridge) and not p.intersects(towers)
 REPORT.update(clouds=len(banks),minimum_clearance_from_visible_bridge_in=round(min(clear),4))
def interiors():
 pairs=[];clear=[];anchorn=0;floorn=0;numroof=0;furn=0;green=0;mins=[];diag=[]
 for k,t in T.items():
  for l in range(t.n+1):
   roof=l==t.n;floor,prior,anchors,reserve=access(t,l);coll=exported('tower-'+k+'-'+str(l+1));h=l*PITCH;fixtures=ARR[k][str(l)]
   if roof:numroof+=len(fixtures)
   else:furn+=len(fixtures);floorn+=1;assert len(fixtures)>=2
   actual=unary_union([Polygon(fp) for fp,lo,hi in coll if hi>h+.065 and lo<h+1.66]);origin=floor.difference(prior).buffer(-BASER,quad_segs=8)
   walk=floor.difference(actual);route=walk.buffer(-BASER,quad_segs=8);newparts=pieces(route)
   # The baseline approach point is measured before inserting the freestanding fittings.
   for oldpart in pieces(origin):
    mandatory=[a for a in anchors if oldpart.buffer(.04).covers(a)]
    if mandatory:
     assert any(all(part.buffer(.035).covers(p)for p in mandatory)for part in newparts),(k,l,'landing connection')
     anchorn+=len(mandatory)
   fp=[footprint_of(typ,x,z,a)for typ,x,z,a in fixtures]
   for p,q in combinations(fp,2):pairs.append(p.distance(q))
   for kind,x,z,angle in fixtures:
    if kind!='greenhouse':continue
    green+=1;ports=green_ports(x,z,angle)
    for a,b in zip(ports[:3],ports[3:]):
     path=LineString([a,b]);radius=path.distance(walk.boundary);clear.append(radius*2)
     assert radius>=BASER and walk.covers(path.buffer(BASER,quad_segs=8)),(k,l,radius)
     assert any(part.buffer(.015).covers(a) and part.buffer(.015).covers(b) for part in newparts),(k,l,'greenhouse entries')
   ob=O.get(k)
   if ob and ob[0]==l:
    # Exactly the 40 mm base from the collection, plus a 25 mm trooper, tangent at each sampled angle.
    p=Point(ob[1],ob[2]);ring=p.buffer((40/25.4)/2+BASER,resolution=48)
    cnt=sum(route.covers(Point(x,z)) for x,z in list(ring.exterior.coords)[:-1]);assert cnt>=12,(k,l,cnt);mins.append((k,round(cnt/192*360)))
 REPORT.update(enterable_floors=floorn,freestanding_furniture=furn,roof_installations=numroof,greenhouses=green,paths_through_greenhouses=len(clear),minimum_greenhouse_passage_mm=round(min(clear)*25.4,2),minimum_spacing_between_placed_assemblies_in=round(min(pairs),3),reachable_access_points=anchorn,console_contact_angles_degrees=mins)
def mesh_integrity():
 stats=[]
 for p in sorted(AS.glob('*.obj')):
  vs=[];group=[];count=0;coll=p.name.endswith('-col.obj')
  def close():
   if not coll or not group:return
   edges=Counter(tuple(sorted(e)) for tri in group for e in zip(tri,tri[1:]+tri[:1]));assert set(edges.values())=={2},(p,len(edges))
   assert len(group)<=255
   v=np.array(vs);v0=v[group[0][0]];vol=0
   for a,b,c in group:vol+=np.dot(v[a]-v0,np.cross(v[b]-v0,v[c]-v0))
   assert abs(vol)>1e-9,(p,vol)
  for line in p.read_text().splitlines():
   cs=line.split()
   if not cs:continue
   if cs[0]=='v':vs.append(tuple(map(float,cs[1:4])))
   elif cs[0]=='g':close();group=[]
   elif cs[0]=='f':
    tri=tuple(int(a.split('/')[0])-1 for a in cs[1:]);assert len(set(tri))==3 and 0<=min(tri)<=max(tri)<len(vs)
    if coll:group.append(tri)
    count+=1
  close();assert len(vs)<25000 and count>0;stats.append((len(vs),count))
 REPORT.update(checked_OBJ_files=len(stats),max_vertices_per_model=max(a for a,b in stats),max_triangles_per_model=max(b for a,b in stats))
def guards():
 for style in ('open','service'):
  parts=exported('bridge-'+style)
  for x in (-1.915,1.915):
   guard=LineString([(x,-1.999),(x,1.999)])
   assert all(unary_union([Polygon(p) for p,lo,hi in parts if lo<y<hi]).covers(guard) for y in (.04,.45,.89))
  for z in (-1.98,1.98):
   lane=LineString([(-1.65,z),(1.65,z)]);assert not unary_union([Polygon(p)for p,l,h in parts if l<.45<h]).intersects(lane)
 REPORT['bridges']=len(bridges)
if __name__=='__main__':
 mesh_integrity();clouds();interiors();guards()
 print(json.dumps(REPORT,indent=1));(WORK/'geometry-audit.json').write_text(json.dumps(REPORT,indent=1))
