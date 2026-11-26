"""Exercise the actual two-button download and compiled Army code in a simulated TTS room."""
import base64,json,struct
from pathlib import Path
from lupa.lua52 import LuaRuntime,lua_type
from army_sideboards import LAUNCHER,check

def plain(v):
    if lua_type(v)!='table':return v
    keys=list(v.keys())
    if keys and all(isinstance(k,int) and 1<=k<=len(keys) for k in keys):return [plain(v[i]) for i in range(1,len(keys)+1)]
    return {str(k):plain(x) for k,x in v.items()}

def bridge(vm):
    g=vm.globals();g.JSON=vm.table_from({'decode':lambda s:vm.table_from(json.loads(s),recursive=True),'encode':lambda t:json.dumps(plain(t),separators=(',',':'),ensure_ascii=False)})

def run_launcher(manifest,parts,launcher=LAUNCHER):
    vm=LuaRuntime(unpack_returned_tuples=True);g=vm.globals();bridge(vm)
    g.body=json.dumps(manifest);g.chunks=vm.table_from(parts);g.launcher=launcher;g.rev=manifest['revision']
    def verify(text,side):
        d=json.loads(text);assert d['Tags'][-1]=='LoboArmySpawner'+side;return d['LuaScript']
    g.readScript=verify
    vm.execute("""
    vault={};timers={};objects={};requests={};spawned={};voices={};clock=1;lastScript=nil
    Global={getTable=function(k)return vault[k]end,setTable=function(k,v)vault[k]=v end}
    Wait={time=function(fn,delay)clock=clock+1;timers[clock]={fn=fn,delay=delay};return clock end,
          stop=function(t)timers[t]=nil end,frames=function(fn)fn()end}
    function printToColor(m)voices[#voices+1]=m end
    function getObjectFromGUID(k)return objects[k]end
    function getObjects()local v={}for _,o in pairs(objects)do v[#v+1]=o end return v end
    function getObjectsWithTag(k)local v={}for _,o in pairs(objects)do if o.hasTag(k)then v[#v+1]=o end end return v end
    Player={Red={},Blue={}}
    WebRequest={get=function(url,callback)requests[#requests+1]={url=url,callback=callback}end}
    function obj(id,side,version,button)
      local tags={};if button then tags.LoboArmyLauncher=true;tags['LoboArmyLauncher'..side]=true
      else tags.LoboArmySpawner=true;tags['LoboArmySpawner'..side]=true end
      local name=button and "Load Army Spawner" or "Infinity Army Spawner";local o
      local nop=function()end
      o={type='Block',held_by_color='',getPosition=function()return{x=side=='Blue' and 32 or -32}end,
         getGUID=function()return id end,hasTag=function(k)return tags[k]end,addTag=function(k)tags[k]=true end,
         getName=function()return name end,setName=function(n)name=n end,getVar=function(k)return version end,
         isDestroyed=function()return false end,call=function(n)assert(n=='onSave');return 'preserved-player-code' end,
         getButtons=function()return{}end,setDescription=nop,setVelocity=nop,setAngularVelocity=nop,setRotation=nop,
         setScale=nop,setPosition=nop,highlightOn=nop,clearButtons=nop,createButton=nop,editButton=nop,
         setLuaScript=function(s)lastScript=s;version=tonumber(s:match('LOBO_ARMY_DATA_REVISION = (%d+)'))end}
      o.reload=function()return o end;objects[id]=o;return o
    end
    function spawnObjectJSON(p)
      local side=JSON.decode(p.json).Tags;side=side[#side]:match('LoboArmySpawner(%a+)')
      lastScript=readScript(p.json,side);local o=obj('piece'..side,side,rev,false);spawned[#spawned+1]=side
      p.callback_function(o);return o
    end
    function activate(side)
      local env=setmetatable({self=obj('button'..side,side,nil,true)},{__index=_G})
      assert(load(launcher,'launcher','t',env))();env.onLoad()
      return function()env.loboLoadArmySpawner(nil,side)end
    end
    function takeManifest(status,text)
      local r=table.remove(requests,1);assert(r and r.url:match('/main/.*/army%-spawner%-current/release%.json$'),r and r.url)
      r.callback({response_code=status,text=text,is_error=status~=200})
    end
    function part(i,good)
      local r=table.remove(requests,1);assert(r and r.url:match('/'..JSON.decode(body).commit..'/') and r.url:match('army%-spawner%-'..i..'%.txt$'),r and r.url)
      r.callback({response_code=good and 200 or 502,text=good and chunks[i] or '',is_error=not good})
    end
    local blue,red=activate('Blue'),activate('Red')
    assert(#requests==0);blue();red();assert(#requests==1);takeManifest(200,body);part(1,false);assert(#spawned==0)
    blue();takeManifest(200,body);for i=1,4 do part(i,true) end;assert(spawned[1]=='Blue')
    for k,t in pairs(timers)do if t.delay==.6 then timers[k]=nil;t.fn();break end end
    takeManifest(200,body);for i=1,4 do part(i,true)end;assert(spawned[2]=='Red')
    blue();takeManifest(200,body);assert(#requests==0 and #spawned==2)
    objects.pieceBlue=nil
    local old=obj('old','Blue',20261125,false);blue();takeManifest(503,'')
    for i=1,4 do part(i,true)end
    assert(old.getVar('LOBO_ARMY_DATA_REVISION')==rev and old.script_state=='preserved-player-code' and #spawned==2)
    blue();takeManifest(200,'{"unexpected":true}');assert(#requests==0 and #spawned==2)
    objects.old=nil;local future=obj('newer','Blue',rev+100,false);blue();takeManifest(200,body);assert(#requests==0 and future.getVar('')==rev+100)
    """)
    return g.lastScript

def uint(n):return bytes([n]) if n<128 else struct.pack('>H',0x8000+n)
def string(s):b=s.encode();return uint(len(b))+b
def code(f,units):
    b=uint(f)+string('army')+string('Sideboard check')+uint(300)+uint(1)+uint(1)+b'\0'+uint(len(units))
    for i,(unit,group,opt,picks) in enumerate(units,1):
        b+=uint(i)+uint(unit)+uint(group)+uint(opt)+b'\0'+bytes([bool(picks)])
        if picks:
            b+=uint(len(picks))
            for row in picks:b+=string(json.dumps(row,separators=(',',':')))
    return base64.b64encode(b).decode()
def army_import(script):
    vm=LuaRuntime(unpack_returned_tuples=True);g=vm.globals();bridge(vm)
    vm.execute("""
    frames={};pieces={};messages={}
    Wait={time=function()return 1 end,stop=function()end,frames=function(f)frames[#frames+1]=f end}
    function getAllObjects()return{}end;function getObjectFromGUID()return nil end
    function printToAll(s)messages[#messages+1]=s end;printToColor=printToAll;broadcastToColor=printToAll;broadcastToAll=printToAll
    Player={Blue={broadcast=printToAll,print=printToAll}}
    function spawnObjectJSON(p)pieces[#pieces+1]=p.json;local o={};if p.callback_function then p.callback_function(o)end;return o end
    self={getPosition=function()return{x=0,y=1,z=0}end,getRotation=function()return{x=0,y=0,z=0}end,
          getTransformRight=function()return{x=1,y=0,z=0}end,getTransformForward=function()return{x=0,y=0,z=1}end,
          getGUID=function()return'test'end,getScale=function()return{x=5,y=.3,z=6}end,getBounds=function()return{size={x=5,y=.3,z=6}}end,
          editButton=function()end,getGMNotes=function()return''end}
    function drain()local n=0;while #frames>0 do n=n+1;assert(n<10000);table.remove(frames,1)()end end
    """)
    vm.execute(script+'\nbuildIndex();sculptMode="2d"')
    def spawn(f,units):
        vm.execute('pieces={};messages={}');g.onCodeInput(None,None,code(f,units));g.onSpawnClick(None,'Blue');g.drain()
        assert not any('pattern too complex' in v or 'Upgrade import failed' in v for v in g.messages.values())
        return [json.loads(g.pieces[i]) for i in range(1,len(g.pieces)+1)]
    allowed={101:[2],201:[1,2,3],301:[4],401:[1,5],501:[6],605:[1,2,7],701:[2],1001:[2,8],1101:[1,2,9]}
    pts={1:30,2:31,3:31,4:28,5:27,6:24,7:31,8:29,9:31}
    for f,options in allowed.items():
        units=[x for x in spawn(f,[(1942,1,i,[]) for i in options]) if 'SHADOWCROW' in x['Nickname']]
        assert len(units)==len(options),(f,options)
        for i,t in zip(options,units):
            assert f"[B]Points[/B]: {pts[i]}   [B]SWC[/B]: 0" in t['Description']
            assert len(t['AttachedDecals'])==2 and all(x['CustomDecal']['ImageURL'].endswith('/shadowcrow-decal.png') for x in t['AttachedDecals'])
    swiss=spawn(101,[(9,1,7,[])])[0];assert 'Missile Launcher (+1B)' in swiss['Description'] and 'Points[/B]: 61' in swiss['Description']
    picks=[[{'type':'stat','stat':'move0','q':15},{'type':'stat','stat':'move1','q':10},{'type':'skill','id':40,'extra':[1]}]]
    gui=spawn(201,[(1928,1,4,picks)])[0]['Description'].replace(' ','')
    assert 'MOV[/B]:6-4' in gui and 'Dodge(+3)' in gui and 'Dodge(+1")' in gui and 'Points[/B]:22' in gui and 'SWC[/B]:0.5' in gui
    aida=spawn(601,[(1160,1,1,[])]);assert sum(t['Nickname']=='Viral Mine' for t in aida)==2
    return sum(map(len,allowed.values()))

if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('manifest',type=Path);p.add_argument('parts',type=Path);p.add_argument('--collection',type=Path);args=p.parse_args()
    launcher=LAUNCHER
    if args.collection:
        room=json.loads(args.collection.read_bytes());print('Verified map owners',check(room,True))
        launcher=next(o['LuaScript'] for o in room['ObjectStates'] if 'LoboArmyLauncherBlue' in o.get('Tags',[]))
    m=json.loads(args.manifest.read_bytes())
    chunks=[(args.parts/f'army-spawner-{i}.txt').read_text() for i in range(1,5)]
    assert [len(s.encode()) for s in chunks]==m['sizes']
    script=run_launcher(m,chunks,launcher);assert script==json.loads(''.join(chunks))['LuaScript']
    print('Verified both seat buttons, stale-spawner upgrades, retry and release fallback;',army_import(script),'Shadowcrow army entries, Swiss Guard, Guifeng and Aida.')
