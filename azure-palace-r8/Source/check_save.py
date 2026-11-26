"""Validate the normal play table, first open via the Workshop Stage, optional Saved Objects and Lua ownership."""
from copy import deepcopy
import json,re,math,sys,hashlib
from pathlib import Path
from lupa.lua52 import LuaRuntime
from package import read,BASE,PRIOR,OUTPUT,TAG,BAG,CONSOLES,objects
spec=read(BASE/'Source/scatter.json');ids={p['guid'] for p in spec}
before=read(PRIOR/'Play-Table.json');after=read(OUTPUT/'Play-Table.json')
def by_guid(os):return {o['GUID']:o for o in os}
a,b=by_guid(before['ObjectStates']),by_guid(after['ObjectStates'])
assert set(b)-set(a)==ids and set(a)<=set(b)
assert all(a[i]==b[i]for i in a if i not in (*CONSOLES,'8428d8'))
assert all(before[k]==v for k,v in after.items()if k not in ('ObjectStates','SaveName'))
scene=[o for o in after['ObjectStates']if TAG in o.get('Tags',[])]
assert len(scene)==20 and len([q for root in scene[1:13]for q in [root,*root.get('States',{}).values()]])==30
bundle=read(BASE/'Review/cache/asset-source.json')
measure=read(BASE/'Review/cache/console-bounds.json')
for i in CONSOLES:
    o=b[i];assert 'CustomMesh' not in o and o['Locked'] and o['Name']=='Custom_Assetbundle'
    assert o['CustomAssetbundle']['AssetbundleURL']==bundle['url'] and 'antenna' in o['Description']
    t=o['Transform'];old=a[i]['Transform']
    assert t['rotY']==270 and all(t['scale'+axis]==1 for axis in 'XYZ')
    assert math.isclose(t['posX']-measure['center'][1],old['posX'],abs_tol=1.e-6)
    assert math.isclose(t['posZ']+measure['center'][0],old['posZ'],abs_tol=1.e-6)
    assert math.isclose(t['posY']+measure['bottom'],3.9,abs_tol=1.e-6) and abs(2*measure['radius']*25.4-40)<.15
for item in spec:
    obj=b[item['guid']];t=obj['Transform'];assert obj['Locked']
    assert [t['posX'],t['posZ'],t['rotY']]==item['pose'] and t['posY']==3.9
    for key,suffix in [('MeshURL','.obj'),('ColliderURL','-col.obj'),('DiffuseURL','-diffuse.jpg')]:
        assert obj['CustomMesh'][key].endswith('/'+item['slug']+suffix)
bag=read(OUTPUT/'Azure-Palace.json')['ObjectStates'][0];rows={}
for ln in bag['LuaScript'].splitlines():
    key,*pose=ln[2:].split(',');assert key not in rows;rows[key]=[float(v)for v in pose]
assert len(rows)==38
for obj,packed in zip(scene,bag['ContainedObjects'],strict=True):
    t=packed['Transform'];assert [t[k]for k in ('posX','posY','posZ')]==[70,100,70]
    clone=deepcopy(packed);clone['Transform']=obj['Transform'];assert clone==obj
    for q in [obj,*obj.get('States',{}).values()]:
        assert all(math.isclose(v,q['Transform'][k],abs_tol=1.e-7)for k,v in zip(('posX','posY','posZ','rotX','rotY','rotZ'),rows[q['GUID']],strict=True))
owned=[o['GUID']for root in scene for o in objects(root)]
ctrl=b['8428d8']['LuaScript'];cfg=json.loads(re.search(r'local config=JSON.decode\(\[==\[(.*?)\]==\]\)',ctrl,re.S)[1])
assert cfg['owned']==owned and len(owned)==len(set(owned))
tail=ctrl.split('-- BEGIN LOBO STANDARD MAP CONTROLS V1')[1]
cfg2=json.loads(json.loads(re.search(r'local config=JSON.decode\(("[^\n]*")\)',tail)[1]))
assert cfg2['guids']==dict.fromkeys(owned,True) and cfg2['tags']==[TAG]
vm=LuaRuntime(unpack_returned_tuples=True);comp=vm.eval('function(s) local f,e=load(s);return f~=nil,e end')
assert comp(ctrl.replace('!=','~='))[0] and 's18_crossing_lines' in ctrl
oldwork=read(PRIOR/'Workshop-Save.json');newwork=read(OUTPUT/'Workshop-Save.json')
oldroots=by_guid(oldwork['ObjectStates']);newroots=by_guid(newwork['ObjectStates'])
assert oldroots.keys()==newroots.keys() and all(oldroots[i]==newroots[i] for i in oldroots if i!=BAG)
assert newwork['LuaScript'].replace('Azure Palace R8','Azure Palace R7')==oldwork['LuaScript']
assert {k:v for k,v in newroots[BAG].items()if k!='Transform'}=={k:v for k,v in bag.items()if k!='Transform'}
assert oldroots[BAG]['Transform']==newroots[BAG]['Transform']
assert sum(o.get('Name')=='Bag' and o.get('Nickname','').startswith('SET_')for root in newwork['ObjectStates']for o in objects(root))==107
assert comp(newwork['LuaScript'].replace('!=','~='))[0]
vm.globals().script=newwork['LuaScript'].split('-- Deploy Azure Palace through the regular map Stage',1)[1].split('\n',1)[1]
from package import revision
fixture=(revision(2)/'check_entrances.py').read_text().split('vm.execute("""',1)[1].split('""")',1)[0];vm.execute(fixture.replace('810108',BAG))
extras=read(OUTPUT/'Azure-Palace-Scatter.json')['ObjectStates'][0]['ContainedObjects']
assert extras[:-4]==read(PRIOR/'Azure-Palace-Scatter.json')['ObjectStates'][0]['ContainedObjects']
for entry,cp in zip(spec,extras[-4:],strict=True):
    assert cp['GUID']==entry['copy'] and not cp['Locked'] and cp['CustomMesh']==b[entry['guid']]['CustomMesh'] and TAG not in cp['Tags']
print('Two native consoles correctly centred and grounded; four props, four loose copies; 38 Stage poses; first-open deployment validated in Lua; other 106 map setups preserved.')
