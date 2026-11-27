from plan import *
from build_station import AXES,poses
from lupa.lua52 import LuaRuntime
import hashlib
def verify():
 table=read(W/'room.json');bag=read(W/'bag.json')['ObjectStates'][0];roots=bag['ContainedObjects'];previous=read(r2.W/'room.json')
 keep=[o for o in previous['ObjectStates'] if TAG not in o.get('Tags',[])]
 assert table['ObjectStates']==keep+roots and len(keep)==138 and table['SaveName']==TITLE
 for k in ('LuaScript','LuaScriptState','XmlUI','SkyURL'):
  assert table.get(k)==previous.get(k)
 by={o['GUID']:o for o in roots};old={o['GUID']:o for o in source_bag()['ContainedObjects']}
 assert {g for g,o in by.items()if 'mission' in o['Tags']}=={'c7f100','c7f101','c7f102'}
 assert all(by[g]==old[g] for g in ['c7f100','c7f101','c7f102'])
 ids={s['GUID'] for o in roots for s in poses(o)}
 assert len(ids)==sum(len(poses(o))for o in roots)
 all_children=[x['GUID'] for o in roots for x in r2.walk(o)]
 assert len(all_children)==len(set(all_children)),[g for g in set(all_children) if all_children.count(g)>1]
 retired={s['GUID'] for g in RETIRED|{'e5100a'} for s in poses(old[g])}
 assert ids.isdisjoint(retired)
 owner=by['c70000']['LuaScript'];pre=' local config=JSON.decode(';line=next(l for l in owner.splitlines()if l.startswith(pre));cfg=json.loads(json.loads(line[len(pre):-1]))
 assert ids<=set(cfg['guids']) and retired.isdisjoint(cfg['guids'])
 rows={l[2:8]:list(map(float,l.split(',')[1:]))for l in bag['LuaScript'].splitlines()}
 assert set(rows)==ids
 pin=(W/'asset-pin.txt').read_text().strip();assets=set()
 for o in roots:
  for s in poses(o):
   assert all(abs(rows[s['GUID']][i]-s['Transform'][k])<1e-7 for i,k in enumerate(AXES))
   assert all(o['Transform'][k]==s['Transform'][k] for k in [*AXES,'scaleX','scaleY','scaleZ'])
  for s in r2.walk(o):
   for d in [s.get('CustomMesh',{}),s.get('CustomAssetbundle',{})]:
    for k,u in d.items():
     if not k.endswith('URL') or not u:continue
     assert u.startswith('https://') and '/LOCAL/' not in u and 'file:' not in u
     if '/'+PREFIX+'/' in u:
      assert (r2.RAW+pin+'/'+PREFIX+'/') in u;assets.add(u.rsplit('/',1)[-1])
 assert assets=={p.name for p in A.iterdir() if p.is_file()}==set(read(W/'public-qa.json'))
 assert all(len(poses(by[g]))==len(poses(old[g])) for g in ('c70007','c70025','c7a300','c70033','c70014','c70022','c70012','acd6a1'))
 stage=next(o['LuaScript'] for o in keep if o['Nickname']=='Stage')
 lua=LuaRuntime(unpack_returned_tuples=True);compile_lua=lua.eval('function(s)local f,e=load(s);return f~=nil,e end')
 scripts={s['LuaScript'] for o in table['ObjectStates'] for s in r2.walk(o) if s.get('LuaScript')}|{table['LuaScript'],bag['LuaScript']}
 for s in scripts:
  ok,error=compile_lua(s);assert ok,error
 # Run the original Stage and the anchor's rotate/clear functions on the R3 inputs.
 shared=(r2.ROOT/'src/verify_save.py').read_text();shared=shared[shared.index('lua.globals().decode='):shared.rindex('print(')]
 exec(compile(shared,'Stage lifecycle checks','exec'),{**globals(),**locals(),'axes':AXES})
 result=dict(mapObjects=len(roots),stateRecords=len(ids),publicAssets=len(assets),scripts=len(scripts),globalAndTableObjectsPreserved=len(keep),stageRotateTwiceClear=True,originalTechCoffins=3)
 write(W/'save-qa.json',result);print(result)
if __name__=='__main__':verify()
