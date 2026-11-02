from pathlib import Path
import json,copy,re,xml.etree.ElementTree as ET,collections
from lupa import LuaRuntime
ROOT=Path('/workspace/scratch/c1076e27af4c/contrast')
data=json.load(open(ROOT/'package/Files/Lobo-Workshop-Current-Maps-and-Rules.json'))
controllers=json.load(open('/workspace/scratch/c1076e27af4c/cleanup/controllers.json'))
L=LuaRuntime(unpack_returned_tuples=True);G=L.globals()
def table(x):
 if isinstance(x,dict):return L.table_from({k:table(v) for k,v in x.items()})
 if isinstance(x,list):return L.table_from([table(v) for v in x])
 return x
def plain(x):
 if hasattr(x,'items'):
  d={k:plain(v) for k,v in x.items()}
  if not d:return []
  if all(isinstance(k,int) for k in d) and sorted(d)==list(range(1,len(d)+1)):return [d[k] for k in range(1,len(d)+1)]
  return d
 return x
G.pyDecode=lambda s:table(json.loads(s))
G.pyEncode=lambda x:json.dumps(plain(x),ensure_ascii=False,sort_keys=True,separators=(',',':'))
# Keep the real UI asynchronous: reads return the last committed XML while loading.
G.parseUI=lambda xml:table([xmlnode(e) for e in ET.fromstring('<root>'+xml+'</root>')])
def xmlnode(e):
 n={'tag':e.tag,'attributes':dict(e.attrib),'children':[xmlnode(c) for c in e]}
 if e.text:n['value']=e.text
 return n
L.execute(r'''
JSON={decode=function(s) return pyDecode(s) end,encode=function(t) return pyEncode(t) end}
now=0;frame=0;nextTask=0;tasks={};objects={};globals={};errors={};logs={};spawnCount=0;lastSpawn=nil
function Vector(x,y,z) return {x=x,y=y,z=z, x,y,z} end
function log(s) logs[#logs+1]=tostring(s) end
print=log
function printToColor(s) log(s) end
function broadcastToAll(s) log(s) end
function broadcastToColor(s) log(s) end
function getObjectFromGUID(g) local o=objects[g];if o and not o.dead then return o end end
function getAllObjects() local t={};for _,o in pairs(objects) do if not o.dead then t[#t+1]=o end end;return t end
getObjects=getAllObjects
function getObjectsWithTag(tag) local t={};for _,o in pairs(objects) do if not o.dead and o.hasTag(tag) then t[#t+1]=o end end;return t end
Global={getVar=function(k) return globals[k] end,setVar=function(k,v) globals[k]=v end}
Physics={cast=function() return {} end}
function schedule(fn,delay,repetitions,condition,timeout,onTimeout)
 nextTask=nextTask+1;local id=nextTask
 tasks[id]={fn=fn,due=now+delay,delay=delay,repetitions=repetitions or 1,condition=condition,timeout=timeout and now+timeout or nil,onTimeout=onTimeout}
 return id
end
Wait={time=function(fn,d,r) return schedule(fn,d,r) end,
 frames=function(fn,n) return schedule(fn,(n or 1)/60,1) end,
 condition=function(fn,c,t,to) return schedule(fn,1/60,1,c,t,to) end,
 stop=function(id) tasks[id]=nil end}
UI={loading=false,roots={{tag='Panel',attributes={id='unrelated-scoreboard'},children={}}},commits=0}
function UI.getXmlTable() return pyDecode(pyEncode(UI.roots)) end
function UI.getCustomAssets() return {} end
function UI.setXml(xml,assets)
 assert(not UI.loading,'OVERLAPPING NATIVE UI WRITE')
 local parsed=parseUI(xml);UI.loading=true
 Wait.frames(function() UI.roots=parsed;UI.loading=false;UI.commits=UI.commits+1 end,2)
end
function find(nodes,id)
 for _,n in ipairs(nodes) do if n.attributes and n.attributes.id==id then return n end;local f=find(n.children or {},id);if f then return f end end
end
function UI.setAttribute(id,k,v)
 local n=find(UI.roots,id);assert(n,'MISSING NATIVE UI NODE: '..id);n.attributes[k]=v
end
function UI.getAttribute(id,k) local n=find(UI.roots,id);return n and n.attributes[k] end
function makeObject(d)
 local o={guid=d.GUID or ('be'..string.format('%04x',spawnCount)),dead=false,data=d,env=nil,lines={},interactable=true}
 local tr=d.Transform or {};o.pos=Vector(tr.posX or 0,tr.posY or 1,tr.posZ or 0)
 o.getGUID=function() assert(not o.dead,'GET GUID ON DELETED OBJECT');return o.guid end
 o.isDestroyed=function() return o.dead end
 o.getPosition=function() assert(not o.dead,'POSITION ON DELETED OBJECT');return o.pos end
 o.setPosition=function(p) o.pos=Vector(p.x or p[1],p.y or p[2],p.z or p[3]) end
 o.setLock=function(v) o.locked=v end
 o.setInvisibleTo=function(c) end
 o.getName=function() return d.Nickname or '' end
 o.getVar=function(k) return o.env and o.env[k] end
 o.call=function(fn,p) assert(not o.dead,'CALL ON DELETED OBJECT');assert(o.env and o.env[fn],fn);return o.env[fn](p) end
 o.hasTag=function(tag) for _,t in ipairs(d.Tags or {}) do if t==tag then return true end end;return false end
 o.positionToWorld=function(v) assert(not o.dead,'WORLD POINT ON DELETED MAT');return v end
 o.positionToLocal=function(v) assert(not o.dead,'LOCAL POINT ON DELETED MAT');return v end
 o.setVectorLines=function(lines) assert(not o.dead,'DRAW ON DELETED MAT');o.lines=lines end
 o.getVisualBoundsNormalized=function() return nil end
 o.destruct=function() destroy(o.guid) end
 objects[o.guid]=o;return o
end
function runScript(o,s)
 local env=setmetatable({self=o},{__index=_G});env._G=env;o.env=env
 local fn,err=load(s,'object_'..o.guid,'t',env);assert(fn,err);fn();return env
end
function spawnObjectData(p)
 spawnCount=spawnCount+1;local o=makeObject(p.data);lastSpawn=o.guid
 runScript(o,p.data.LuaScript)
 if o.env.onLoad then o.env.onLoad('') end
 return o
end
function destroy(guid)
 local o=getObjectFromGUID(guid);if not o then return end
 -- A valid object reference is passed before onDestroy, matching TTS.
 for _,other in ipairs(getAllObjects()) do if other.env and other.env.onObjectDestroy then other.env.onObjectDestroy(o) end end
 if o.env and o.env.onDestroy then o.env.onDestroy() end
 o.dead=true
end
function advance(frames)
 for n=1,frames do
  frame=frame+1;now=frame/60
  local due={};for id,t in pairs(tasks) do if t.due<=now+1e-9 then due[#due+1]=id end end;table.sort(due)
  for _,id in ipairs(due) do
   local t=tasks[id]
   if t then
    if t.condition then
     if t.condition() then tasks[id]=nil;t.fn()
     elseif t.timeout and now>=t.timeout then tasks[id]=nil;if t.onTimeout then t.onTimeout() end
     else t.due=now+1/60 end
    else
     if t.repetitions==1 then tasks[id]=nil else t.due=now+t.delay;if t.repetitions>1 then t.repetitions=t.repetitions-1 end end
     t.fn()
    end
   end
  end
 end
end
function assertNoMapUI()
 assert(#UI.roots==1 and UI.roots[1].attributes.id=='unrelated-scoreboard','STALE MAP UI REMAINS')
end
function assertLiveTargets()
 local function visit(nodes)
  for _,n in ipairs(nodes) do
   for k,v in pairs(n.attributes or {}) do
    if k:sub(1,2)=='on' then local guid=v:match('^([a-f0-9]+)/');if guid then assert(getObjectFromGUID(guid),'DEAD UI CALLBACK '..v) end end
   end
   visit(n.children or {})
  end
 end
 visit(UI.roots)
end
''')
# Compile all changed controller scripts and the manager.
compile=L.eval('function(s) local f,e=load(s);return f~=nil,e end')
bags={b['GUID']:b for b in data['ObjectStates'] if b.get('Nickname','').startswith('SET_')}
count=0
for c in controllers:
 b=bags[c['bag']];o=next(o for o in b['ContainedObjects'] if o['GUID']==c['controller'])
 ok,err=compile(o['LuaScript']);assert ok,(c['map'],err);count+=1

def loadmap(c):
 b=bags[c['bag']]
 records={}
 for line in b['LuaScript'].splitlines():
  if re.match(r'^--[a-f0-9]{6},',line):
   guid,*v=line[2:].split(',');records[guid]=list(map(float,v))
 for d in b['ContainedObjects']:
  obj=G.makeObject(table(d))
  if d['GUID'] in records:obj.setPosition(table(records[d['GUID']][:3]))
 o=G.getObjectFromGUID(c['controller']);G.runScript(o,next(d for d in b['ContainedObjects'] if d['GUID']==c['controller'])['LuaScript']);o.env.onLoad('')
 return o

def clear(c,order='anchor'):
 ids=[d['GUID'] for d in bags[c['bag']]['ContainedObjects']]
 first=c['anchor'] if order=='anchor' else c['controller']
 G.destroy(first)
 for guid in ids:
  G.destroy(guid)

# All 52 actual controllers: open a panel, start an asynchronous overlay, clear
# the anchor before its controller, then drain callbacks to detect stale accesses.
for index,c in enumerate(controllers):
 o=loadmap(c);G.advance(65);assert len(G.UI.roots)>=2,c['map'];G.assertLiveTargets()
 player=table({'color':'White'})
 if o.env.loboMissionToggle:o.env.loboMissionToggle(player)
 else:o.env.loboTop40ToggleMission(player,None,None)
 if o.env.loboDeploymentToggle:o.env.loboDeploymentToggle(player)
 else:o.env.loboTop40ToggleDeployment(player,None,None)
 G.advance(1)
 clear(c,'anchor' if index%2==0 else 'controller')
 G.advance(70);G.assertNoMapUI()
print('PASS',count,'actual controllers: mount, open mission, pending overlay, clear both destruction orders, no stale controls/callbacks.')
assert G.spawnCount==1,('duplicate persistent service',G.spawnCount)
# Rapid A -> B, delayed A callbacks, same map reload with the same GUIDs.
for a,b in [(controllers[-1],controllers[0]),(controllers[0],controllers[2]),(controllers[2],controllers[3]),(controllers[-1],controllers[-1])]:
 loadmap(a);G.advance(65);clear(a,'anchor');loadmap(b);G.advance(70);G.assertLiveTargets()
 assert len(G.UI.roots)>=2
 clear(b,'controller');G.advance(70);G.assertNoMapUI()
# Delete during boot, before registration/mount; no delayed mount may reappear.
c=controllers[-1];loadmap(c);clear(c,'anchor');G.advance(150);G.assertNoMapUI()
# Clear exactly while native UI is loading, then immediately deploy the next map.
a,b=controllers[-1],controllers[0];loadmap(a)
for _ in range(120):
 G.advance(1)
 if G.UI.loading:break
else:raise AssertionError('No asynchronous UI mount observed')
clear(a,'anchor');loadmap(b);G.advance(100);G.assertLiveTargets();clear(b);G.advance(70);G.assertNoMapUI()
assert G.spawnCount==1
result={'actual_map_controllers_tested':count,'asynchronous_UI_simulated':True,'both_destruction_orders_passed':True,'pending_overlay_cancellation_passed':True,'rapid_switch_cases_passed':4,'same_GUID_reload_passed':True,'clear_during_boot_passed':True,'clear_during_UI_loading_passed':True,'unrelated_scoreboard_preserved':True,'persistent_services_spawned':G.spawnCount,'live_TTS_tested':False}
(ROOT/'lifecycle-validation.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
