"""Read the finished save and OBJ files independently of the build routines."""
import base64,json,math,re
from pathlib import Path
import lz4.block
import numpy as np
from shapely.geometry import Polygon,box
from audit_assets import ROOT,bags,walk,meta

def obj(path):
 v=[];uv=[];faces=[]
 for l in path.read_text().splitlines():
  a=l.split()
  if not a:continue
  if a[0]=='v':v.append(list(map(float,a[1:4])))
  elif a[0]=='vt':uv.append(list(map(float,a[1:3])))
  elif a[0]=='f':faces.append([int(x.split('/')[0])-1 for x in a[1:]])
 v=np.asarray(v);assert np.isfinite(v).all() and np.isfinite(uv).all()
 assert all(len(f)==3 and min(f)>=0 and max(f)<len(v) for f in faces)
 return v,faces

def height(g,x,z):
 gx=(x-g['x0'])/g['stepX'];gz=(z-g['z0'])/g['stepZ']
 ix=min(g['nx']-1,max(0,int(gx)));iz=min(g['nz']-1,max(0,int(gz)))
 a=g['heights'][iz*(g['nx']+1)+ix];b=g['heights'][iz*(g['nx']+1)+ix+1]
 c=g['heights'][(iz+1)*(g['nx']+1)+ix];d=g['heights'][(iz+1)*(g['nx']+1)+ix+1]
 u=gx-ix;v=gz-iz
 return a+u*(b-a)+v*(d-b) if u>=v else a+v*(c-a)+u*(d-c)

def rotation(t):
 x,y,z=[math.radians(t['rot'+k]) for k in 'XYZ'];cx,sx=math.cos(x),math.sin(x);cy,sy=math.cos(y),math.sin(y);cz,sz=math.cos(z),math.sin(z)
 return np.array([[cy,0,sy],[0,1,0],[-sy,0,cy]])@np.array([[1,0,0],[0,cx,-sx],[0,sx,cx]])@np.array([[cz,-sz,0],[sz,cz,0],[0,0,1]])

def main():
 old=json.loads((ROOT/'release-r11/Clash-of-Empires-Workshop-Release.json').read_text());new=json.loads((ROOT/'release-r12/Clash-of-Empires-Workshop-Release.json').read_text())
 targets={b['GUID'] for b in bags(old)};unchanged=0
 for a,b in zip(old['ObjectStates'][-1]['ContainedObjects'],new['ObjectStates'][-1]['ContainedObjects']):
  assert a['GUID']==b['GUID']
  if a['GUID'] not in targets:assert a==b;unchanged+=1
 assert old['LuaScript']==new['LuaScript']
 assert old['ObjectStates'][:-1]==new['ObjectStates'][:-1]
 assert len(new['ObjectStates'][-1]['ContainedObjects'])==37
 models=json.loads((ROOT/'original13-models.json').read_text());meshstats=[]
 for m in models.values():
  for i,fn in enumerate(m['meshes']):
   v,f=obj(ROOT/'original13-assets'/fn);assert v[:,1].min()>=-1e-6
   c=m['checks'][i];assert c['overlap_count']==0 and c['out_of_base']==0
   assert c['standing']+c['fallen']==c['figures'];assert len(v)<65000
   meshstats.append({'file':fn,'vertices':len(v),'triangles':len(f)})
 result={'scope':'13 battles / 16 layouts','collection_bags':37,'unchanged_bags':unchanged,'model_identities':len(models),'model_states':len(meshstats),'max_vertices':max(m['vertices'] for m in meshstats),'max_triangles':max(m['triangles'] for m in meshstats),'layouts':[],'limits':['Static geometry and serialized-save validation. No live Tabletop Simulator or Windows installer test.']}
 for b in bags(new):
  bm=meta(b);layout=json.loads(lz4.block.decompress(base64.b64decode(bm['r28_packed_layout']),uncompressed_size=bm['r28_layout_length']))
  for o in b['ContainedObjects']:
   p=layout[layout['_guidSlots'][o['GUID']]];t=o['Transform']
   for key,fields in [('position',['posX','posY','posZ']),('rotation',['rotX','rotY','rotZ']),('scale',['scaleX','scaleY','scaleZ'])]:assert p[key]==[t[k] for k in fields]
   for key,f in [('mesh','MeshURL'),('texture','DiffuseURL'),('collider','ColliderURL')]:
    if o.get('CustomMesh',{}).get(f):assert p['assets'][key]==o['CustomMesh'][f]
  ground=[o for o in b['ContainedObjects'] if 'LoboGroundMesh' in o.get('Tags',[])];g=next(meta(o)['r23Surface'] for o in ground if meta(o).get('r23Surface'));err=0.;groundvertices=0
  for o in ground:
   v,faces=obj(ROOT/'original13-assets'/o['CustomMesh']['MeshURL'].split('/')[-1]);v[:,0]*=-1;groundvertices+=len(v)
   assert o['CustomMesh']['MeshURL']==o['CustomMesh']['ColliderURL']
   for p in v:err=max(err,abs(p[1]-height(g,p[0],p[2])))
   for f in faces:
    p=v[f].mean(axis=0);err=max(err,abs(p[1]-height(g,p[0],p[2])))
  assert err<1e-7,(b['Nickname'],err)
  units=[];polys=[];gaps=[];commanders=0;reserve=0
  for o in walk(b):
   if not o.get('States') or not any(t in o.get('Tags',[]) for t in ['LoboUnit','LoboCommander']):continue
   cmd='LoboCommander' in o['Tags'];commanders+=cmd;units.append(o)
   assert len(o['States'])==(1 if cmd else 2)
   assert len({s['CustomMesh']['MeshURL'] for s in [o,*o['States'].values()]})==(2 if cmd else 3)
   for s in [o,*o['States'].values()]:
    assert s['Transform']==o['Transform'] and not s['Rigidbody']['UseGravity']
    m=meta(s);assert m['standing_figures']+m['fallen_figures']==m['full_figures']
    assert 'LoboTerrainGrounding' in s['Tags']
   t=o['Transform'];rad=1 if cmd else 1.5
   points=np.array([[rad*math.cos(a),0,rad*math.sin(a)] for a in np.linspace(0,2*math.pi,129)]) if cmd else np.array([[x,0,z] for x,z in [(-rad,-rad),(rad,-rad),(rad,rad),(-rad,rad)]])
   points=points*np.array([t['scale'+a] for a in 'XYZ']);points=points@rotation(t).T+np.array([t['pos'+a] for a in 'XYZ']);p=Polygon(points[:,[0,2]])
   assert box(-48,-36,48,36).buffer(.01).covers(p)
   assert all(p.intersection(q).area<.001 for q in polys),(b['Nickname'],o['Nickname'],'overlapping bases')
   polys.append(p)
   # Check actual serialized Euler transforms at every base corner and edge sample.
   for i,a in enumerate(points):
    c=points[(i+1)%len(points)]
    for u in np.linspace(0,1,17):
     q=a*(1-u)+c*u;gaps.append(q[1]-height(g,q[0],q[2]))
  assert min(gaps)>-.0001,(b['Nickname'],min(gaps))
  for r in b['ContainedObjects']:
   if 'LoboCraterusReserve' not in r.get('Tags',[]):continue
   rm=meta(r)
   for i,o in enumerate(r['ContainedObjects'],1):
    assert rm[o['GUID']]==rm[str(i)]==[o['Transform'][f] for f in ['posX','posY','posZ']];reserve+=1
  result['layouts'].append({'battle':b['Nickname'],'stands':len(units),'commanders':commanders,'reserve_stands':reserve,'ground_vertices':groundvertices,'terrain_error_inches':err,'minimum_base_edge_clearance_inches':min(gaps),'base_overlaps':0})
 result['stands']=sum(r['stands'] for r in result['layouts']);result['commanders']=sum(r['commanders'] for r in result['layouts']);result['reserve_stands']=sum(r['reserve_stands'] for r in result['layouts']);result['passed']=True
 (ROOT/'original13-validation.json').write_text(json.dumps(result,indent=2));print(json.dumps({k:v for k,v in result.items() if k!='layouts'},indent=2))
if __name__=='__main__':main()
