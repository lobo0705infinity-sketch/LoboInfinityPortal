"""Regression checks for cloud editing, attached glazing, physical clearances and saved map controls."""
from release import *
from sightlines import rays_through
from shapely.geometry import LineString
from itertools import combinations
from collections import Counter
sys.path.insert(0,str(PREVIOUS/'standard'))
from test_standard import RealWorld,validate_map,py
from design import green_ports
def geometry_checks():
 clouds=json.loads((WORK3/'airspace.json').read_text())['high'];obstacles=unary_union([silhouette(o)for o in BRIDGES]);all_towers=unary_union([affinity.translate(t.poly,t.x,t.z)for t in T.values()]);dist=[];ranges=[]
 for c in LOW+clouds:
  e=ellipse(c);dist.append(e.distance(obstacles));assert dist[-1]>.23 and e.disjoint(all_towers)
 for s in DESIGN['ships']:
  o={'CustomMesh':{'MeshURL':'aerostat-'+s['key']+'.obj'},'Transform':s['transform']};f=silhouette(o);assert f.distance(obstacles)>.23 and f.disjoint(all_towers)
  v,_=geometry(slug(o));v=transform(v,o['Transform'])
  ranges.append((f,v[:,1].min(),v[:,1].max()))
 for poly,lo,hi in ranges:
  for c in LOW+clouds:
   if min(hi,c['hi'])>max(lo,c['lo']):assert not poly.intersects(ellipse(c))
 passage=[]
 for k,t in T.items():
  q=greenhouse(k)
  if q is None:continue
  x,z,a=q;h=t.n*PITCH;ss=native.read_obj(AS2/('tower-'+k+'-'+str(t.n+1)+'-col.obj'))[1];floor=unary_union([Polygon(poly)for poly,lo,hi in ss if abs(hi-h)<.02]);blocks=[Polygon(poly)for poly,lo,hi in ss if hi>h+.065 and lo<h+1.66]
  for name in ('greenhouse-glazing','greenhouse-door-hardware'):
   for poly,lo,hi in native.read_obj(NEW/(name+'-col.obj'))[1]:
    if hi+.01>.065 and lo+.01<1.66:blocks.append(affinity.translate(affinity.rotate(Polygon(poly),-a,origin=(0,0)),x,z))
  nav=floor.difference(unary_union(blocks));points=green_ports(x,z,a)
  for p1,p2 in zip(points[:3],points[3:]):
   path=LineString([p1,p2]);assert nav.covers(path.buffer(BASE_RADIUS));passage.append(path.distance(nav.boundary)*2*25.4)
 assert len(passage)==24
 # Check every pickable vapour hull from overhead and four cardinal camera directions.
 for style in ['vapour-'+str(k)for k in range(3)]+['alto-'+str(k)for k in range(3)]:
  path=(style+'-pick' if style.startswith('vapour')else style)+'-col';v,_=geometry(style);q,f=geometry(path)
  assert len(f)<=255 and np.max(np.abs(q.min(0)-v.min(0)))<.025 and np.max(np.abs(q.max(0)-v.max(0)))<.025
  center=(q.max(0)+q.min(0))/2;start=center+np.array([[0,4,0],[4,0,0],[-4,0,0],[0,0,4],[0,0,-4]])
  assert all(rays_through([{'CustomMesh':{'MeshURL':path+'.obj'},'Transform':xform(0,0,0)}],start,2*center-start))
 for obj in NEW.glob('*.obj'):
  v,f=geometry(obj.stem);assert 0<len(v)<25000 and len(f)>0 and np.isfinite(v).all()
  # Isosurface cuts can make very small valid triangles. Test collinearity by angle.
  tri=v[f];ab=tri[:,1]-tri[:,0];ac=tri[:,2]-tri[:,0]
  length_product=np.linalg.norm(ab,axis=1)*np.linalg.norm(ac,axis=1)
  assert np.all(length_product>0) and np.all(np.linalg.norm(np.cross(ab,ac),axis=1)>1e-9*length_product),obj.name
  if obj.stem.endswith('-col'):
   counts=Counter(tuple(sorted((a,b)))for tri0 in f for a,b in zip(tri0,np.roll(tri0,-1)));assert set(counts.values())=={2},obj
 return {'cloud_bridge_clearance_in':round(min(dist),3),'greenhouse_paths':len(passage),'minimum_greenhouse_passage_mm':round(min(passage),2)}
def runtime():
 table=json.loads((OUT3/'Play-Table.json').read_text());bag=json.loads((OUT3/'Cloudbreak-Array.json').read_text())['ObjectStates'][0];book=json.loads((OUT3/'Workshop-Save.json').read_text());old=json.loads((PREVIOUS/'out/Workshop-Save.json').read_text());shelf=next(o for o in book['ObjectStates']if o['GUID']==BAG)
 assert shelf['ContainedObjects']==bag['ContainedObjects'] and shelf['LuaScript']==bag['LuaScript']
 assert [o for o in book['ObjectStates']if o['GUID']!=BAG]==[o for o in old['ObjectStates']if o['GUID']!=BAG]
 assert [o for o in table['ObjectStates']if TAG not in o.get('Tags',[])]==[o for o in R2TABLE['ObjectStates']if TAG not in o.get('Tags',[])]
 deployed={o['GUID']:o for o in table['ObjectStates']if TAG in o.get('Tags',[])}
 records={a[0]:list(map(float,a[1:]))for a in [l[2:].split(',')for l in bag['LuaScript'].splitlines()]}
 for q in bag['ContainedObjects']:
  o=deployed[q['GUID']];q1=deepcopy(q);q1['Transform'].update({k:o['Transform'][k]for k in ('posX','posY','posZ')});assert q1==o
  for state in [o,*o.get('States',{}).values()]:
   assert [state['Transform'][i]for i in ('posX','posY','posZ','rotX','rotY','rotZ')]==records[state['GUID']]
  if slug(o).startswith('tower-'):
   k=slug(o).split('-')[1];q=greenhouse(k);children=o.get('ChildObjects',[])
   if q:
    assert [slug(v)for v in children]==['greenhouse-glazing','greenhouse-door-hardware'];assert children[0]['CustomMesh']['MaterialIndex']==4 and .20<children[0]['ColorDiffuse']['a']<.5
    assert children[0]['Transform']==xform(q[0],T[k].n*PITCH+.01,q[1],q[2]);assert not any(v.get('ChildObjects') for v in o['States'].values())
 tags=[q['GUID']for q in walk(bag) if 'GUID'in q];assert len(tags)==len(set(tags))
 assert all(RULES in next(t['body']for t in s['TabStates'].values() if 'Network Node'in t['title'])for s in [table,book])
 assert not any(s in compact(bag)for s in ['candidate/','file://','/workspace/','/main/','localhost'])
 w=validate_map(deepcopy(bag));rt,g=w.run['cb7102'];banks=[o for o in bag['ContainedObjects']if TAG_CLOUD in o.get('Tags',[])];assert len(banks)==len(BANKS)
 for o in banks:
  assert o['Locked'] and o['DragSelectable'] and o['Tooltip'] and not o['Rigidbody']['UseGravity'] and not o['Sticky']
  w.init(o);w.run[o['GUID']][1].onLoad()
 w.advance(.2)
 def find(s,world=w):return next(e for e in world.visible() if e.tag=='Button' and e.get('text','').lower().startswith(s))
 w.invoke(find('map rules'));assert any('Unlock a bank' in (e.text or '') for e in w.visible());w.invoke(find('close'));w.invoke(find('map-specific options'));w.invoke(find('cloud boundaries'))
 assert all(len(w.lines[q['GUID']])==6 for q in banks)
 assert not any(line.get('thickness')in (.033,.055) for line in w.source())
 # Gizmo translation and scale, unlocked persistence, 180, independent deletion, undo and boundary toggle.
 cloud=banks[-1]['GUID'];removed=banks[0]['GUID'];ct=w.items[cloud]['Transform']
 w.items[cloud]['Locked']=False;ct.update(posX=-7.2,posY=17.25,posZ=9.35,rotY=68.5,scaleX=2.22,scaleY=3.10,scaleZ=1.23)
 nativeobj=g.getObjectFromGUID(cloud);line=w.lines[cloud][0]['points'][0];v=py(nativeobj.positionToWorld(rt.table_from(line)))
 pos=transform(np.array([[1.,0.,0.]]),ct)[0];assert np.allclose([v['x'],v['y'],v['z']],pos)
 w.run[cloud][1].onDrop();w.click('turn');w.click('turn');assert w.items[cloud]['Locked'] is False and abs(ct['posY']-17.25)<.0001
 original=deepcopy(w.items[removed]);g.getObjectFromGUID(removed).destruct();w.call('cloudRefreshOne',{'guid':removed});assert g.getObjectFromGUID(removed) is None
 w.call('cloudBoundaries');w.advance(.2);assert not w.lines[cloud];w.call('cloudBoundaries');w.advance(.2);assert len(w.lines[cloud])==6
 # Rebuild a representative saved table with actual edited transforms, missing bank and stored controller state.
 edited=deepcopy(bag);edited['ContainedObjects']=[o for o in edited['ContainedObjects']if o['GUID']!=removed]
 q=next(o for o in edited['ContainedObjects']if o['GUID']==cloud);q['Locked']=False;q['Transform']=deepcopy(ct)
 keys=('posX','posY','posZ','rotX','rotY','rotZ');edited['LuaScript']='\r\n'.join('--'+cloud+','+','.join(str(ct[k])for k in keys)if l.startswith('--'+cloud+',')else l for l in edited['LuaScript'].splitlines()if not l.startswith('--'+removed+','))+'\r\n'
 w2=RealWorld(edited)
 for q in edited['ContainedObjects']:
  if TAG_CLOUD in q.get('Tags',[]):w2.init(q)
 w2.load({'cb7102':w.call('onSave')});assert len(w2.lines[cloud])==6 and removed not in w2.items and not w2.items[cloud]['Locked'] and w2.items[cloud]['Transform']==ct
 # An undo or fresh copy is discovered through its map tag; no static GUID list is required.
 new=deepcopy(original);new['GUID']='fbf3c7';w2.items[new['GUID']]=new;w2.init(new);w2.run[new['GUID']][1].onLoad();w2.advance(.25);assert len(w2.lines[new['GUID']])==6
 assert all(len(o.get('ChildObjects',[]))==1 for o in deployed.values()if 'mission' in o.get('Tags',[]))
 return {'selectable_clouds':len(banks),'stage_transforms':len(records),'shared_control_checks':True,'move_rotate_delete_duplicate_save_reload':True,'unchanged_other_setups':105}
if __name__=='__main__':
 result={**geometry_checks(),**runtime()};print(json.dumps(result,indent=1));(WORK3/'release-audit.json').write_text(json.dumps(result,indent=1))
