from pathlib import Path
import base64,copy,hashlib,json,math,sys,xml.etree.ElementTree as ET
import lz4.block
import numpy as np
from PIL import Image
from package_release import ROOT,OUT,BASE,SAVE,GUID,block
sys.path.insert(0,str(ROOT/'reference'))
from simulation import Simulation,GroundSimulation

def main():
 data=json.loads((OUT/SAVE).read_text());before=json.loads((BASE/SAVE).read_text())
 bags=data['ObjectStates'][3]['ContainedObjects'];oldbags=before['ObjectStates'][3]['ContainedObjects']
 cat=json.loads(block(data['LuaScript'],'catalogue')[1]);assert len(bags)==len(cat)==37
 assert [b['GUID'] for b in bags]==[c['bag'] for c in cat]
 assert all(a==b for a,b in zip(oldbags,bags) if a['GUID']!=GUID)
 for xml in [data['XmlUI'],block(data['LuaScript'],'artOverlayTemplate')[1]]:
  root=ET.fromstring('<Root>'+xml+'</Root>');assert [o.text for o in root.find(".//Dropdown[@id='battleSelect']").findall('Option')]==[b['name'] for b in cat]
 bag=next(b for b in bags if b['GUID']==GUID);old=next(b for b in oldbags if b['GUID']==GUID);assert len(bag['ContainedObjects'])==48
 notes=json.loads(bag['GMNotes']);layout=json.loads(lz4.block.decompress(base64.b64decode(notes['r28_packed_layout']),uncompressed_size=notes['r28_layout_length']))
 assert len(layout['_order'])==48
 oldobjs={o['GUID']:o for o in old['ContainedObjects']};states=0;commanders=0;carts=0
 for o in bag['ContainedObjects']:
  t=o['Transform'];pose=layout[layout['_guidSlots'][o['GUID']]];assert pose['position']==[t['posX'],t['posY'],t['posZ']]
  assert pose['name']==o['Nickname']
  if 'LoboUnit' not in o['Tags'] and 'LoboCommander' not in o['Tags']:continue
  ot=oldobjs[o['GUID']]['Transform'];assert all(t[k]==ot[k] for k in ['posX','posZ','rotY'])
  cmd='LoboCommander' in o['Tags'];cart='Battle Cart' in o['Nickname'];commanders+=int(cmd);carts+=int(cart)
  assert set(o['States'])==({'2'} if cmd else {'2','3'})
  for i,st in enumerate([o,*o['States'].values()]):
   states+=1;n=json.loads(st['GMNotes']);assert st['Transform']==t
   assert st['Gravity']==st['Rigidbody']['UseGravity']==False
   assert 'LoboTerrainGrounding' in st['Tags']
   assert n['status']==(['Normal','Wounded'] if cmd else ['Full','Disordered','Shaken'])[i]
   assert st['Nickname'].endswith(' | '+n['status'])
   assert n['label_identity']['name']==n['name']
   cm=st['CustomMesh'];assert cm['ColliderURL'].endswith('stand-round.obj' if cmd else 'stand-square.obj')
   if cmd:assert n['wounded']==(i==1) and n['standing_figures']==n['full_figures']
   if cart:assert n['model_count']==n['cart_models_per_base']==n['full_figures']==1
 assert (states,commanders,carts)==(132,6,8)
 grid=json.loads(bag['ContainedObjects'][0]['GMNotes'])['r23Surface']
 vv=np.array([[float(v) for v in l.split()[1:4]] for l in (ROOT/'assets/field.obj').read_text().splitlines() if l.startswith('v ')])
 expected=np.array([[-48+x,grid['heights'][z*97+x],-36+z] for z in range(73) for x in range(97)])
 vv[:,0]*=-1;assert np.max(abs(vv-expected))<1e-8
 roots=json.loads((ROOT/'tree-root-checks.json').read_text());assert len(roots)==20
 assert all(-.05<r['root_y']-r['ground_y']<0 for r in roots)
 assets=json.loads((OUT/'Expansion-Visual-Cache.json').read_text())
 for a in assets:assert hashlib.sha256((OUT/'ExpansionVisuals'/a['file']).read_bytes()).hexdigest()==a['sha256']
 mesh_count=0
 for p in (ROOT/'assets').glob('*.obj'):
  vertices=[];uv=[];faces=[]
  for line in p.read_text().splitlines():
   w=line.split()
   if not w:continue
   if w[0]=='v':vertices.append(list(map(float,w[1:4])))
   elif w[0]=='vt':uv.append(list(map(float,w[1:3])))
   elif w[0]=='f':faces.append([list(map(int,b.split('/')[:2])) for b in w[1:]])
  v=np.array(vertices);assert 0<len(v)<25000 and np.isfinite(v).all();assert np.isfinite(uv).all()
  assert all(1<=ix<=len(v) and 1<=it<=len(uv) for f in faces for ix,it in f)
  if p.name not in ['field.obj','palms.obj']:
   assert np.max(abs(v[:,[0,2]]))<=1.501
   if 'command' in p.name or p.name=='stand-round.obj':assert np.max(np.hypot(v[:,0],v[:,2]))<=1.001
  if p.name.startswith('stand-'):assert v[:,1].min()==0 and abs(v[:,1].max()-.15)<1e-6
  mesh_count+=1
 for a in json.loads((ROOT/'hosted-assets.json').read_text()):
  if a['file'].endswith(('.png','.jpg')):
   with Image.open(ROOT/'assets'/a['file']) as im:im.verify()
 # Exercise all catalogue routes in Lua 5.2, using ground/raycast support for Lagash.
 testdata=copy.deepcopy(data);testdata['LuaScript']+='\n__groundHeight=r23WorldHeight\n__groundPose=r33Pose\n'
 sim=None
 for i,b in enumerate(cat):
  s=GroundSimulation(testdata) if b['bag'] in [GUID,'fe07a5'] else Simulation(data);g=s.lua.globals()
  g.selectBattle(s.player,str(i));g.loadBattle(s.player);s.drain()
  assert s.chest_requests==[b['bag']]
  assert s.api.state.lastLoadReport.status=='complete',(b['name'],s.messages)
  assert s.api.state.lastLoadReport.ready==len(bags[i]['ContainedObjects'])
  if b['bag']==GUID:sim=s
 # Actual replacement state objects: copy each state JSON, destroy previous mock,
 # trigger the real state-change handler and check contact and heading each time.
 g=sim.lua.globals();ground=next(o for o in sim.world if not o['_dead'] and o.hasTag('LoboGroundMesh'))
 meta=sim.table(json.loads(ground.getGMNotes()));contact=[];events=0;drops=0
 stand_sources={o['GUID']:o for o in bag['ContainedObjects'] if o.get('States')}
 for o in list(sim.world):
  if o['_dead'] or not o.hasTag('LoboTerrainGrounding'):continue
  src=stand_sources[o.getGUID()];p=sim.python(o.getPosition());yaw=o.getRotation().y;cmd=o.hasTag('LoboCommander')
  pose=g.__groundPose(ground,meta,o.getPosition(),yaw,o.getScale(),cmd)
  assert abs(p['y']-pose.position[2])<1e-7
  o.setPosition(sim.table({'x':p['x'],'y':20,'z':p['z']}));g.onObjectDrop('White',o);sim.drain();drops+=1
  assert abs(o.getPosition().y-p['y'])<1e-7 and abs(o.getRotation().y-yaw)<1e-7
  sequence=[2,1,2,1] if cmd else [2,3,1,2,1]
  for state in sequence:
   prev=o;st=copy.deepcopy(src if state==1 else src['States'][str(state)])
   o=sim.object(st);sim.world.append(o);prev['_dead']=True
   o.setPosition(sim.table({'x':p['x'],'y':12,'z':p['z']}));g.onObjectStateChange(o,prev.getGUID());sim.drain()
   assert abs(o.getPosition().y-p['y'])<1e-7 and abs(o.getRotation().y-yaw)<1e-7;events+=1
  xa=sim.python(pose.xaxis);za=sim.python(pose.zaxis);r=1 if cmd else 1.5;gaps=[]
  for lx in np.linspace(-r,r,15):
   for lz in np.linspace(-r,r,15):
    if cmd and lx*lx+lz*lz>1:continue
    x=p['x']+xa['x']*lx+za['x']*lz;z=p['z']+xa['z']*lx+za['z']*lz
    h=g.__groundHeight(ground,meta,x,z);gaps.append(p['y']+xa['y']*lx+za['y']*lz-h)
  assert min(gaps)>=.0119 and max(gaps)<.1,(src['GUID'],min(gaps),max(gaps))
  contact.append({'guid':src['GUID'],'position':p,'rotation':sim.python(o.getRotation()),'min_gap':min(gaps),'max_gap':max(gaps)})
 # Drops on each crossing and bank, with arbitrary facing, preserve valid ground contact.
 extra=0;o=next(o for o in sim.world if not o['_dead'] and o.hasTag('LoboUnit'))
 for x in [-33,-31,-29,29,31,33]:
  for z in [-8,8]:
   o.setPosition(sim.table({'x':x,'y':20,'z':z}));o.setRotation(sim.table({'x':0,'y':37,'z':0}));g.onObjectDrop('White',o);sim.drain()
   pose=g.__groundPose(ground,meta,o.getPosition(),37,o.getScale(),False)
   assert abs(o.getPosition().y-pose.position[2])<1e-7 and abs(o.getRotation().y-37)<1e-7;extra+=1
 result={'passed':True,'battle_routes':37,'unchanged_other_battles':36,'stands':46,'stand_states':states,'commanders_two_states':commanders,'single_cart_bases':carts,'tree_roots':20,'mesh_files':mesh_count,'cache_hashes':len(assets),'drop_tests':drops+extra,'replacement_state_change_events':events,'surface_contact':contact,'live_TTS':'unverified','Windows_installer':'unverified'}
 (ROOT/'validation.json').write_text(json.dumps(result,indent=2));print(json.dumps({k:v for k,v in result.items() if k!='surface_contact'}))

if __name__=='__main__':main()
