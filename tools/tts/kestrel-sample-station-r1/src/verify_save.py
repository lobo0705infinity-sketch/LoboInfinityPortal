"""Exercise the two delivery formats with the stage and rotation code carried by the save."""
from pathlib import Path
import json, re
from lupa.lua52 import LuaRuntime
from assemble import FILETAG, REV, DAY
from base import DATA, WORK, ORIGINAL, PREFIX, ASSETS, walk

def read(path):return json.loads(path.read_bytes())
table=read(WORK/'room.json')
bag=read(WORK/'bag.json')['ObjectStates'][0]
roots=bag['ContainedObjects']
previous=read(DATA/'table.json')
keep=[o for o in previous['ObjectStates'] if not any(t.startswith('LoboMap:') for t in o.get('Tags',[]))]
assert table['ObjectStates']==keep+roots and len(roots)==83
assert table['LuaScript']==previous['LuaScript'] and table['SaveName']==REV+' - Play Table' and table['SkyURL']==DAY
object_by_guid={o['GUID']:o for o in roots}
assert all(o==object_by_guid[o['GUID']] for o in ORIGINAL['ContainedObjects'] if 'mission' in o.get('Tags',[]))
assert sum('mission' in o['Tags'] for o in roots)==3
stage=next(o for o in keep if o['Nickname']=='Stage')['LuaScript']
owner=object_by_guid['c70000']['LuaScript']
config_line=next(l for l in owner.splitlines() if l.startswith(' local config=JSON.decode('))
config=json.loads(json.loads(config_line[len(' local config=JSON.decode('):-1]))
states=[x for o in roots for x in [o,*o.get('States',{}).values()]]
stage_rows={l[2:8]:list(map(float,l.split(',')[1:])) for l in bag['LuaScript'].splitlines()}
assert len(states)==len(stage_rows)==len({o['GUID'] for o in states})
axes=('posX','posY','posZ','rotX','rotY','rotZ')
for o in states:
    assert o['GUID'] in config['guids'] and FILETAG in o['Tags']
    assert all(abs(o['Transform'][axis]-n)<1e-7 for n,axis in zip(stage_rows[o['GUID']],axes))
for o in roots:
    for s in o.get('States',{}).values():
        assert all(o['Transform'][k]==s['Transform'][k] for k in axes)
paths=set()
for root in roots:
    for o in walk(root):
        for section in ['CustomMesh','CustomAssetbundle']:
            for key,url in o.get(section,{}).items():
                if key.endswith('URL') and url:
                    assert url.startswith('https://') and '/LOCAL/' not in url,url
                    if '/'+PREFIX+'/' in url:paths.add(url.split('/')[-1])
assert paths=={p.name for p in ASSETS.iterdir()}
assert len(read(WORK/'public-qa.json'))==len(paths)
lua=LuaRuntime(unpack_returned_tuples=True)
compile_lua=lua.eval('function(source) local f,e=load(source);return f~=nil,e end')
scripts=[table['LuaScript'],stage,bag['LuaScript']]+[ob['LuaScript'] for r in table['ObjectStates'] for ob in walk(r) if ob.get('LuaScript')]
for src in set(scripts):
    ok,error=compile_lua(src)
    assert ok,error

# Run the exact rotation handler and native Stage parser using TTS object-method stand-ins.
lua.globals().decode=lambda t:lua.table_from(json.loads(t),recursive=True)
lua.execute("""
JSON={decode=decode}
Global={getVar=function() return 0 end,setVar=function() end}
Wait={frames=function(f,n)f()end}
loboLifeCall=function()end; loboZoneWrite=function()end
broadcastToAll=function()end;broadcastToColor=function()end
objects={};byGuid={}
function vec(x,y,z)return {x=x,y=y,z=z,x,y,z}end
function getObjectFromGUID(g)return byGuid[g]end
function getAllObjects()return objects end
function add_object(g,n,t,pos,rot,tags,lock)
 local o={type=t,tag=t,p=vec(pos[1],pos[2],pos[3]),r=vec(rot[1],rot[2],rot[3]),locked=lock,gone=false}
 o.getGUID=function()return g end; o.getName=function()return n end
 o.getTags=function()return tags end; o.hasTag=function(s)for _,v in ipairs(tags)do if s==v then return true end end return false end
 o.isDestroyed=function()return o.gone end;o.destruct=function()o.gone=true end
 o.getPosition=function()return o.p end;o.getRotation=function()return o.r end
 o.setPosition=function(v)o.p=vec(v[1],v[2],v[3])end;o.setRotation=function(v)o.r=vec(v[1],v[2],v[3])end
 o.getLock=function()return o.locked end;o.setLock=function(v)o.locked=v end
 o.getVar=function()return nil end;o.getTable=function()return nil end
 o.setVelocity=function()end;o.setAngularVelocity=function()end
 objects[#objects+1]=o;byGuid[g]=o
end
""")
for o in table['ObjectStates']:
    vals=[o['Transform'][k] for k in axes]
    lua.globals().add_object(o['GUID'],o.get('Nickname',''),o['Name'],lua.table_from(vals[:3]),lua.table_from(vals[3:]),lua.table_from(o.get('Tags',[])),o.get('Locked',False))
lua.execute(owner[owner.index('do\n local config=JSON.decode('):owner.index(' function loboStandardMissionOpen(player)')]+'\nend')
for iteration in [1,2]:
    lua.globals().loboRotateMap180('Blue')
    assert lua.globals().LOBO_MAP_ROTATION_FLIPPED==(iteration==1)
    for o in roots:
        f=lua.globals().getObjectFromGUID(o['GUID']);t=o['Transform'];direction=(-1)**iteration
        assert abs(f.p.x-direction*t['posX'])<1e-7 and abs(f.p.z-direction*t['posZ'])<1e-7 and abs(f.p.y-t['posY'])<1e-7
        assert abs((f.r.y-t['rotY']-180*iteration+180)%360-180)<1e-7
        assert f.locked==o.get('Locked',False)
for o in keep:
    if 'LoboTableTool' in o.get('Tags',[]):
        f=lua.globals().getObjectFromGUID(o['GUID']);assert f.p.x==o['Transform']['posX'] and f.p.z==o['Transform']['posZ']
lua.execute(stage)
lua.globals().prs=','.join(bag['LuaScript'].splitlines())+','
for o in roots:
    f=lua.globals().getObjectFromGUID(o['GUID'])
    if f.hasTag('LoboManagedPlacement'):continue
    lua.execute('ss=...;zz=0;z2=0;uls=""',o['GUID'])
    f.setPosition(lua.table_from([0,-8,0]))
    lua.globals().popSet()
    got=[f.p.x,f.p.y,f.p.z,f.r.x,f.r.y,f.r.z]
    assert all(abs(v-o['Transform'][k])<1e-7 for k,v in zip(axes,got)), (o['GUID'],o['Nickname'],got,[o['Transform'][k] for k in axes],lua.globals().ss,lua.globals().zz)
    lua.globals().popSet()
    assert lua.globals().ss==''
assert lua.globals().loboClearOwnedMaps()==len(roots)
assert all(lua.globals().byGuid[o['GUID']].gone for o in roots)
assert not any(lua.globals().byGuid[o['GUID']].gone for o in keep)
print(f'{len(roots)} terrain objects, {len(states)} placement/state records, {len(paths)} pinned new assets, {len(set(scripts))} unique Lua scripts. Stage, two rotations, clear, objectives and {len(keep)} persistent table objects passed.')
