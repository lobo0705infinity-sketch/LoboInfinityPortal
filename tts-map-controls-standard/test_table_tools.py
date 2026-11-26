"""Verify on-demand Army sideboards and legacy preinstalled table tools."""
import json
from pathlib import Path

from lupa.lua52 import LuaRuntime

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT.parent/'lobo-infinity-portal/public/assets/maps/table-tools-20261125-r3'


def check(collection, payload):
    if any('LoboArmyLauncher' in o.get('Tags', []) for o in collection['ObjectStates']):
        from army_sideboards import check as check_sideboards
        from re import search
        if 'release-extras.json' in payload.namelist():
            files = [x['PlayFile'] for x in json.loads(payload.read('release-extras.json'))['Setups'].values()]
        else:
            files = ['Play-Table.json']
        for room in [collection, *(json.loads(payload.read(f)) for f in files)]:
            assert check_sideboards(room, require_room=True) > 0
            panel, = [o for o in room['ObjectStates'] if 'LoboInfinityOrderPanel' in o.get('Tags', [])]
            version = search(r'(?m)^LOBO_ORDER_PANEL_REVISION\s*=\s*(\d+)', panel['LuaScript'])
            assert version and panel['Nickname'].endswith(' R' + version[1])
            for item in [panel, *(o for o in room['ObjectStates'] if 'LoboArmyLauncher' in o.get('Tags', []))]:
                assert max(abs(item['Transform']['posX']), abs(item['Transform']['posZ'])) > 26
        return
    panel = json.loads((ASSETS/'order-panel.json').read_bytes())
    army = json.loads(b''.join((ASSETS/f'army-spawner-{i}.txt').read_bytes() for i in range(1, 5)))
    assert panel['LuaScript'] == (ROOT/'order-panel.lua').read_text()
    assert '__lobo_zoc_hotkey_provider_r6' in army['LuaScript']
    extras = json.loads(payload.read('release-extras.json'))
    for room in [collection, *(json.loads(payload.read(x['PlayFile'])) for x in extras['Setups'].values())]:
        for tag, source in [('LoboArmySpawner', army), ('LoboInfinityOrderPanel', panel)]:
            item, = [o for o in room['ObjectStates'] if tag in o.get('Tags', [])]
            assert item['LuaScript'] == source['LuaScript']
            assert max(abs(item['Transform']['posX']), abs(item['Transform']['posZ'])) > 26
    vm = LuaRuntime(unpack_returned_tuples=True)
    g = vm.globals()
    g.loader = (ROOT/'table-tools.lua').read_text()
    g.JSON = vm.table(decode=lambda raw: vm.table_from(json.loads(raw), recursive=True))
    g.bodies = vm.table_from({p.name: p.read_text() for p in ASSETS.iterdir() if p.suffix in ['.json', '.txt']})
    vm.execute("""
objects, leases, requests, spawns = {}, {}, {}, {}
local now=100
os.time=function()return now end
Global={getTable=function(k)return leases[k] end,setTable=function(k,v)leases[k]=v end}
function getObjectFromGUID(id)return objects[id] end
function getObjects()local a={} for _,o in pairs(objects)do a[#a+1]=o end return a end
function getObjectsWithTag(t)local a={} for _,o in pairs(objects)do if o.hasTag(t)then a[#a+1]=o end end return a end
function object(id,kind,name,tags,revision)
 local o={type=kind,tags={},name=name,revision=revision}
 for _,t in ipairs(tags or {}) do o.tags[t]=true end
 o.hasTag=function(t)return o.tags[t] end
 o.addTag=function(t)o.tags[t]=true end
 o.getName=function()return o.name end
 o.setName=function(v)o.name=v end
 o.getGUID=function()return id end
 o.isDestroyed=function()return false end
 o.getVar=function(k)return k=='LOBO_ORDER_PANEL_REVISION' and o.revision or nil end
 o.setLuaScript=function(s)o.script=s end
 o.reload=function()o.revision=3;return o end
 objects[id]=o;return o
end
WebRequest={get=function(url,callback)
 local file=url:match('/([^/]+)$');assert(bodies[file],file)
 requests[#requests+1]={file=file,fn=callback}
end}
function spawnObjectData(p)
 assert(p.data.Name=='BlockSquare' and #p.data.LuaScript>10000 and math.abs(p.position[1])>24)
 spawns[#spawns+1]=p.data.Nickname
 return object('tool'..#spawns,'Block',p.data.Nickname,p.data.Tags)
end
function activate(id)
 local active=true
 local env=setmetatable({self=object(id,'Block','Map controls'),deployed=function()return active end},{__index=_G})
 local tick=assert(load(loader..'\\nreturn ensureTableTools','map-tools','t',env))()
 return tick,function()active=false;objects[id]=nil end
end
function answer(i,code)
 local req=table.remove(requests,i)
 req.fn({response_code=code,is_error=code~=200,text=code==200 and bodies[req.file] or ''})
end
local a,retire=activate('mapA');local b=activate('mapB')
a();b();assert(#requests==5 and #spawns==0)
-- Two map owners overlap. Deliver bytes out of order, then switch maps and reload.
while #requests>0 do answer(#requests,200) end
assert(#spawns==2);retire();now=now+4;b();assert(#requests==0)
local c=activate('mapC');c();assert(#spawns==2 and #requests==0)
-- Reuse an untagged R6 and upgrade an R2 panel in place even after a download error.
objects,leases,requests,spawns={},{},{},{}
local older=object('old','Block','Lobo Infinity Order Panel R2',{'LoboInfinityOrderPanel'},2)
object('056963','Block','Infinity Army Spawner - Team Ops Fixed')
local d=activate('mapD');d();assert(#requests==1)
answer(1,503);d();assert(#requests==0 and #spawns==0 and older.revision==2)
now=now+10;d();answer(1,200);assert(older.revision==3 and #spawns==0 and #requests==0)
-- A manual drop during download wins the race. A cleared map cannot spawn late objects.
objects,leases,requests,spawns={},{},{},{}
local e,clear=activate('mapE');e()
object('manual','Block','Lobo Infinity Order Panel R3',{'LoboInfinityOrderPanel'},3)
answer(1,200);clear();while #requests>0 do answer(1,200) end
assert(#spawns==0)
local f=activate('mapF');f();assert(#requests==4);while #requests>0 do answer(1,200) end
assert(#spawns==1 and spawns[1]:find('Army Spawner',1,true))
""")
    print('Verified tool deployment, out-of-order requests, retry, map switching, manual drops and old panels.')
