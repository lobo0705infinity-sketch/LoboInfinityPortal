from pathlib import Path
import json,ctypes,re,os
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT.parent
lib=ctypes.CDLL('liblua5.4.so.0');lib.luaL_newstate.restype=ctypes.c_void_p;lib.luaL_openlibs.argtypes=[ctypes.c_void_p];lib.luaL_loadstring.argtypes=[ctypes.c_void_p,ctypes.c_char_p];lib.lua_pcallk.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_longlong,ctypes.c_void_p];lib.lua_tolstring.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_void_p];lib.lua_tolstring.restype=ctypes.c_char_p;lib.lua_close.argtypes=[ctypes.c_void_p]
dumps=lambda v,**kw:json.dumps(v,ensure_ascii=False,**kw)
stage=(ROOT/'Source'/'original_stage.lua').read_text().replace('!=','~=')
results=[]
collection=json.load(open(ROOT/'Map-Bags/Verdant-Exchange-Uplink-Center-R2.json'))
for bag in collection['ObjectStates']:
 if bag.get('Name')!='Bag' or not bag.get('Nickname','').startswith('SET_'):continue
 script=bag['LuaScript'];entries=[];states={};positions={}
 assert script.endswith('\r\n') and not re.search(r'(?<!\r)\n',script)
 for line in script.splitlines():
  if not re.match(r'^--[0-9a-f]{6},',line):continue
  f=line[2:].split(',');assert len(f)==7;positions[f[0]]=list(map(float,f[1:]))
 for o in bag['ContainedObjects']:
  assert o['GUID'] in positions;entries.append({'guid':o['GUID'],'name':o['Nickname']})
  if o.get('States') and os.environ.get('STATE_MODE') != 'baseline':states[o['GUID']]=o['States'].get(os.environ.get('STATE_MODE','2'),next(iter(o['States'].values())))['GUID']
 pre='''
local registry={};local vars={hld=0}
Global={getVar=function(k) return vars[k] end,setVar=function(k,v) vars[k]=v end}
function broadcastToAll() end
function getObjectFromGUID(g) return registry[g] end
local function object(g,name,p,rotation)
 local o={guid=g,name="Custom_Model",alive=true,p=p or {0,3,0},r=rotation or {0,0,0}}
 o.getGUID=function() return o.guid end
 o.getName=function() return name end
 o.getPosition=function() return o.p end
 o.setPosition=function(v) o.p=v end
 o.getRotation=function() return o.r end
 o.setRotation=function(v) o.r=v end
 o.lock=function() end;o.unlock=function() end;o.setScale=function() end
 o.destruct=function() o.alive=false;registry[o.guid]=nil end
 registry[g]=o;return o
end
self={guid="2d647a",getPosition=function() return {30,1,0} end}
local incoming=object("incoming","SET_Echo R3")
incoming.name="Bag"
incoming.getLuaScript=function() return __SCRIPT__ end
local entries=__ENTRIES__
incoming.getObjects=function() return entries end
incoming.setName=function() end
incoming.takeObject=function(t)
 local e
 for _,v in ipairs(entries) do if v.guid==t.guid then e=v end end
 assert(e,"missing payload")
 local o=object(t.guid,e.name,t.position,t.rotation)
 if t.callback then _G[t.callback](o) end
end
'''.replace('__SCRIPT__',dumps(script)).replace('__ENTRIES__','{'+','.join('{guid='+dumps(e['guid'])+',name='+dumps(e['name'])+'}' for e in entries)+'}')
 post='''
cb=nil;zz=0;bb=nil;sid=nil
onCollisionEnter({collision_object=incoming})
assert(Global.getVar("hld")==1,"Stage did not start deployment")
local count=0
for g,p in pairs(__POSITIONS__) do
 local o=registry[g]
 if o then
  count=count+1
  for i=1,3 do assert(math.abs(o.p[i]-p[i])<.0001,"Stage position mismatch");assert(math.abs(o.r[i]-p[i+3])<.0001,"Stage rotation mismatch") end
 end
end
assert(count==__COUNT__,"Stage did not deploy all root payloads")
local sentinel=object("sentinel","Unrelated miniature",{0,3,0})
-- Exercise cleanup after manually moving and rotating every single-piece ridge.
for _,entry in ipairs(entries) do
 if entry.name:find('Sandstone Ridge ',1,true) then
  local moved=registry[entry.guid];moved.setPosition({2,1,3});moved.setRotation({0,45,0})
 end
end
-- Simulate state changes that replace root GUIDs, preserving the world transform.
for old,new in pairs(__STATES__) do
 local o=registry[old];assert(o);assert(registry[new]==nil,"Duplicate active state GUID");registry[old]=nil;o.guid=new;registry[new]=o
end
cb=nil;Global.setVar("hld",0)
btnTrash()
assert(bb==nil,"Stage retained the spent map marker")
assert(registry.sentinel==sentinel,"CLEAR TABLE removed an unrelated miniature");registry.sentinel=nil
for _,left in pairs(registry) do local p=left.getPosition();assert(not (math.abs(p[3])<26 and math.abs(p[1])<44 and math.abs(p[2])<26),"CLEAR TABLE left an on-table map object or alternate state behind") end
'''.replace('__COUNT__',str(len(entries))).replace('__POSITIONS__','{'+','.join('['+dumps(g)+']={'+','.join(map(str,p))+'}' for g,p in positions.items())+'}').replace('__STATES__','{'+','.join('['+dumps(a)+']='+dumps(b) for a,b in states.items())+'}')
 L=lib.luaL_newstate();lib.luaL_openlibs(L);status=lib.luaL_loadstring(L,(pre+stage+post).encode())
 if status==0:status=lib.lua_pcallk(L,0,0,0,0,None)
 if status:
  results.append({'map':bag['Nickname'],'error':str(lib.lua_tolstring(L,-1,None)),'status':'fail'});lib.lua_close(L);continue
 lib.lua_close(L);results.append({'map':bag['Nickname'],'root_components':len(entries),'alternate_states_tested':len(states),'original_stage_deploy_and_clear':'pass'})
(ROOT/'Source'/('stage-integration-results-'+os.environ.get('STATE_MODE','2')+'.json')).write_text(dumps(results,indent=2));print(dumps({'tested':len(results),'passed':sum(r.get('original_stage_deploy_and_clear')=='pass' for r in results),'failed':sum(r.get('status')=='fail' for r in results),'examples':[r for r in results if r.get('status')=='fail'][:3]},indent=2))
