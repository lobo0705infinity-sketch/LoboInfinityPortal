from common import *
from assemble_r2 import TITLE,TAG
from lupa.lua52 import LuaRuntime
import numpy as np
from shapely.geometry import LineString

table=read(W/'room.json');bag=read(W/'bag.json')['ObjectStates'][0]
roots=bag['ContainedObjects']
before=read(WORK/'room.json')
keep=[o for o in before['ObjectStates'] if TAG not in o.get('Tags',[])]
assert table['ObjectStates']==keep+roots and len(roots)==68 and len(keep)==138
assert table['SaveName']==TITLE and before['SkyURL']==table['SkyURL'] and before['LuaScript']==table['LuaScript']
by={o['GUID']:o for o in roots}
assert set(by).isdisjoint(BLANKED)
for o in ORIGINAL['ContainedObjects']:
    if 'mission' in o.get('Tags',[]):assert o==by[o['GUID']]
assert len([o for o in roots if 'mission' in o['Tags']])==3
states=[x for o in roots for x in [o,*o.get('States',{}).values()]]
all_ids=[o['GUID'] for o in states];assert len(set(all_ids))==len(all_ids)
stage=next(o['LuaScript'] for o in keep if o['Nickname']=='Stage')
owner=by['c70000']['LuaScript']
pre=' local config=JSON.decode('
cfg=next(l for l in owner.splitlines()if l.startswith(pre));config=json.loads(json.loads(cfg[len(pre):-1]))
assert set(config['guids']).isdisjoint(BLANKED) and all(g in config['guids'] for g in all_ids)
assert all(x not in json.dumps(roots,ensure_ascii=False).lower() for x in ['sunken bowl','crater-rim','crater-bowl','westlip.obj','ejecta lips','impact basins','crater rims'])
axes=('posX','posY','posZ','rotX','rotY','rotZ')
rows={l[2:8]:list(map(float,l.split(',')[1:])) for l in bag['LuaScript'].splitlines()}
assert set(rows)==set(all_ids)
for o in states:
    assert TAG in o['Tags'] and all(abs(a-o['Transform'][k])<1e-7 for a,k in zip(rows[o['GUID']],axes))
for o in roots:
    for n in o.get('States',{}).values():
        assert all(n['Transform'][k]==o['Transform'][k] for k in axes)
assets=set();new_ids=[]
for o in roots:
    for s in walk(o):
        if s['GUID'].startswith('e52'):new_ids.append(s['GUID'])
        for m in [s.get('CustomMesh',{}),s.get('CustomAssetbundle',{})]:
            for k,u in m.items():
                if k.endswith('URL') and u:
                    assert u.startswith('https://') and '/LOCAL/' not in u
                    if '/'+RELEASE+'/' in u:
                        assert (W/'asset-pin.txt').read_text().strip() in u
                        assets.add(u.rsplit('/',1)[-1])
assert assets=={p.name for p in OUT.iterdir()}==set(read(W/'public-qa.json')) and len(new_ids)==len(set(new_ids))
assay=by['c70014'];algae=by['c7a300']
def stems(o):return [c.get('CustomMesh',{}).get('MeshURL','').rsplit('/',1)[-1] for c in o.get('ChildObjects',[])]
assert stems(assay).count('assay-shutters.obj')==1 and not any('assay-shutters.obj' in stems(x) for x in assay['States'].values())
assert sorted(algae['States'])==['1','2'] and algae['States']['1']['GUID']=='c7a302'
for o in [algae,*algae['States'].values()]:
    assert stems(o).count('algae-rows.obj')==1
    assert all(all(x['Transform'][k]==0 for k in axes) for x in o['ChildObjects'])
    assert sum('glass' in x['Tags'] for x in o['ChildObjects'])==int(o is algae)
    assert not any('algae-rows.obj' in x.get('CustomMesh',{}).get('MeshURL','') for x in roots)
# Exact cart footprint above the finished physical ground. Both tread bands and
# the whole working width must be level through the cut beside the assay dome.
h=np.load(W/'relief.npy')
from cartway import station_route,at
residuals=[]
for g in station_route():
    for d in np.linspace(0,g.length,round(g.length*16)):
        p,along,n=at(g,d)
        for off in [-.82,-.48,0.,.48,.82]:
            x,z=np.rint((p+off*n+24)*10).astype(int);residuals.append(abs(h[z,x]-6.25))
assert max(residuals)<.06,max(residuals)
lua=LuaRuntime(unpack_returned_tuples=True)
compile_lua=lua.eval('function(s)local f,e=load(s);return f~=nil,e end')
scripts={s['LuaScript'] for o in table['ObjectStates'] for s in walk(o) if s.get('LuaScript')}|{table['LuaScript'],bag['LuaScript']}
for text in scripts:
    ok,error=compile_lua(text);assert ok,error
# Exercise precisely the same Stage and rotate/clear simulation used for R1.
shared=(ROOT/'src/verify_save.py').read_text().split('# Run the exact rotation handler',1)[1]
shared=shared[shared.index('lua.globals().decode='):shared.rindex('print(')]
exec(compile(shared,'R1 Stage/rotation tests','exec'),globals())
result={'roots':len(roots),'placementRecords':len(states),'persistentObjects':len(keep),'scriptsCompiled':len(scripts),'pinnedNewFiles':len(assets),'cartwayMaxGradeDifference':float(max(residuals)),'stageRotateTwiceAndClear':'passed','buildingStateAttachments':'passed'}
write(W/'save-qa.json',result);print(result)
