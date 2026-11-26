import json,re,hashlib,math
from pathlib import Path
from copy import deepcopy
from lupa.lua52 import LuaRuntime
r=Path(__file__).resolve().parent;prev=r.parent/'azure6/Release';dst=r/'Release'
read=lambda p:json.loads(p.read_bytes());tag='LoboMap:87b699';bagid='87b699'
def rec(o):
    yield o
    for x in [*o.get('ChildObjects',[]),*o.get('States',{}).values(),*o.get('ContainedObjects',[])]:yield from rec(x)
def root(s):return {o['GUID']:o for o in s['ObjectStates']}
old=read(prev/'Play-Table.json');play=read(dst/'Play-Table.json')
scene=[o for o in play['ObjectStates']if tag in o.get('Tags',[])];before=[o for o in old['ObjectStates']if tag in o.get('Tags',[])]
assert len(scene)==16
stand=read(dst/'Azure-Palace.json')['ObjectStates'][0];assert stand['GUID']==bagid
rows={}
for row in stand['LuaScript'].splitlines():
    g,*v=row.removeprefix('--').split(',');assert g not in rows and len(v)==6;rows[g]=list(map(float,v))
assert len(rows)==34
for obj,packed in zip(scene,stand['ContainedObjects'],strict=True):
    copy=deepcopy(packed);copy['Transform']=obj['Transform'];assert obj==copy
    assert [packed['Transform'][k]for k in ('posX','posY','posZ')]==[70,100,70]
    for q in [obj,*obj.get('States',{}).values()]:
        assert all(math.isclose(q['Transform'][k],v,abs_tol=1e-7) for k,v in zip(('posX','posY','posZ','rotX','rotY','rotZ'),rows[q['GUID']],strict=True))
assert [o for o in old['ObjectStates']if tag not in o.get('Tags',[])]==[o for o in play['ObjectStates']if tag not in o.get('Tags',[])]
assert all(v==old[k]for k,v in play.items()if k not in ('ObjectStates','SaveName'))
for oldb,newb in zip(before[1:13],scene[1:13],strict=True):
    assert oldb['Transform']==newb['Transform'] and oldb['States'].keys()==newb['States'].keys()
    for a,b in [(oldb,newb)]+[(o,newb['States'][key])for key,o in oldb['States'].items()]:
        for k in a:
            if k not in ('ChildObjects','States','CustomMesh'):assert a[k]==b[k]
        children=b['ChildObjects']; prior=a['ChildObjects'];original=prior[0]
        assert b['CustomMesh']==a['CustomMesh'] and children[0]['GUID']==original['GUID']
        has_split=oldb['Nickname'] in ('East Guest Villa','Azure Spa')
        porters=oldb['Nickname']=='Resort Reception'
        assert len(children)==(2 if has_split or porters else 1)
        assert [ch['CustomMesh']for ch in children]==[ch['CustomMesh']for ch in newb['ChildObjects']]
        for ch in children:
            assert ch['Transform']==original['Transform']
            assert ch['CustomMesh']['DiffuseURL']==original['CustomMesh']['DiffuseURL']
        if has_split:
            assert all('/azure-palace-r7/Assets/'in ch['CustomMesh'][f]for ch in children for f in ('MeshURL','ColliderURL'))
        else:assert children[0]==original
        if porters:assert children[1]['CustomMesh']['MeshURL'].endswith('/reception-porter-lodge.obj')
assert sum(len(o.get('States',{}))+1 for o in scene[1:13])==30
assert not any('AzureResortFixture' in o.get('Tags',[])for o in scene)
assert len(scene[0]['ChildObjects'])==1 and scene[0]['ChildObjects'][0]['CustomMesh']['MeshURL'].endswith('/pool-court.obj')
for a,b in zip(before[-3:-1],scene[-3:-1]):
    c=deepcopy(b);c['CustomMesh']['MeshURL']=a['CustomMesh']['MeshURL'];assert c==a
assert scene[0]['CustomMesh']['ColliderURL']==before[0]['CustomMesh']['ColliderURL']
controller=scene[-1]['LuaScript'];ids=[q['GUID'] for o in scene for q in rec(o)]
cfg=json.loads(re.search(r'local config=JSON.decode\(\[==\[(.*?)\]==\]\)',controller,re.S)[1]);assert ids==cfg['owned'] and len(set(ids))==len(ids)
tail=controller.split('-- BEGIN LOBO STANDARD MAP CONTROLS V1')[1];controls=json.loads(json.loads(re.search(r'local config=JSON.decode\(("[^\n]*")\)',tail)[1]))
assert controls['guids']==dict.fromkeys(ids,True) and controls['tags']==[tag]
vm=LuaRuntime(unpack_returned_tuples=True);comp=vm.eval("function(s) local f,e=load(s);return f~=nil,e end")
assert comp(controller.replace('!=','~='))[0] and 's18_crossing_lines' in controller
prior=read(prev/'Workshop-Save.json');work=read(dst/'Workshop-Save.json');a=root(prior);b=root(work)
assert a.keys()==b.keys() and all(a[k]==b[k]for k in a if k!=bagid)
assert work['LuaScript'].replace('Azure Palace R7','Azure Palace R6')==prior['LuaScript']
assert {k:v for k,v in b[bagid].items()if k!='Transform'}=={k:v for k,v in stand.items()if k!='Transform'} and b[bagid]['Transform']==a[bagid]['Transform']
count=sum(q.get('Name')=='Bag' and q.get('Nickname','').startswith('SET_') for o in work['ObjectStates'] for q in rec(o));assert count==107
assert comp(work['LuaScript'].replace('!=','~='))[0]
vm.globals().script=work['LuaScript'].split('-- Deploy Azure Palace through the regular map Stage',1)[1].split('\n',1)[1]
test=(r.parent/'azure2/check_entrances.py').read_text().split('vm.execute("""',1)[1].split('""")',1)[0];vm.execute(test.replace('810108',bagid))
extra=read(dst/'Azure-Palace-Scatter.json')['ObjectStates'][0];assert extra['ContainedObjects']==read(prev/'Azure-Palace-Scatter.json')['ObjectStates'][0]['ContainedObjects']
for file in [dst/'Play-Table.json',dst/'Workshop-Save.json',dst/'Azure-Palace.json']:
    assert b'preview.invalid' not in file.read_bytes()
print('107 catalogue entries; 30 building states; 34 Stage poses; villa, spa and porter attachments in every state; collection, first-open deploy and save/reload checks passed.')
