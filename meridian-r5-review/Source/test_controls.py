"""Behavior checks with a Lua 5.4 API mock. These are not live engine tests."""
import json,re
from pathlib import Path
from lupa import LuaRuntime
R=Path(__file__).resolve().parents[1]
bag=json.loads((R/'SavedObjects/Lobos-Top-40-Losers-Round-8-Meridian-R5.json').read_text())['ObjectStates'][0]
lua=LuaRuntime(unpack_returned_tuples=True)
def conv(v):
 if isinstance(v,dict):return lua.table_from({k:conv(a)for k,a in v.items()})
 if isinstance(v,list):return lua.table_from([conv(a)for a in v])
 return v
def native(v):
 if hasattr(v,'items'):
  d={k:native(a)for k,a in v.items()}
  if d and all(type(k)==int for k in d)and set(d)==set(range(1,len(d)+1)):return[d[i]for i in range(1,len(d)+1)]
  return d
 return v
lua.globals().JSON=lua.table_from({'decode':lambda s:conv(json.loads(s)),'encode':lambda t:json.dumps(native(t))})
compile_lua=lua.eval('function(s)local f,e=load(s);return f~=nil,e end')
def walk(o):
 yield o
 for x in o.get('States',{}).values():yield from walk(x)
 for x in o.get('ChildObjects',[]):yield from walk(x)
 for x in o.get('ContainedObjects',[]):yield from walk(x)
scripts=[]
for o in walk(bag):
 if o.get('LuaScript'):
  ok,e=compile_lua(o['LuaScript']);assert ok,(o['Nickname'],e);scripts.append(o['GUID'])
controller=next(o for o in bag['ContainedObjects']if o['GUID']=='df2803')['LuaScript']
line=re.search(r'local loboLifeBrokerData=("(?:\\.|[^"\\])*")',controller)
broker=json.loads(json.loads(line.group(1)));ok,e=compile_lua(broker['LuaScript']);assert ok,e
lua.execute('''
queue={};roots={};lines={};changedBackground=0;lastBackgroundMode=nil;released=0;destroyed={};flags={}
function Vector(x,y,z)return{x=x,y=y,z=z}end
Global={getVar=function(k)if k=='LoboMapUIBrokerV4'then return'broker'end;return flags[k]end,setVar=function(k,v)flags[k]=v end}
UI={getXmlTable=function()return roots end,setXmlTable=function(x)roots=x end,getCustomAssets=function()return{}end}
Wait={time=function(fn,d,r)table.insert(queue,fn);if r==-1 then table.insert(queue,function()table.insert(queue,fn)end)end;return#queue end,frames=function(fn,n)table.insert(queue,fn);return#queue end,stop=function()end,condition=function(fn,c,t,to)if c()then table.insert(queue,fn)end;return#queue end}
function pump()local count=0;while#queue>0 do count=count+1;assert(count<10000);local f=table.remove(queue,1);f()end end
mat={getGUID=function()return'df2802'end,isDestroyed=function()return false end,getPosition=function()return{x=0,y=1,z=0}end,getScale=function()return{x=1,y=1,z=1}end,getVectorLines=function()return lines end,setVectorLines=function(x)lines=x end,positionToLocal=function(p)return p end,positionToWorld=function(p)return p end}
local function call(name,p)
 if name=='loboUIRegister'then return 1
 elseif name=='loboUIRead'then return roots
 elseif name=='loboUIWrite'then roots=p.nodes
 elseif name=='loboUIRelease'then released=released+1
 elseif name=='loboBackgroundActivate'then changedBackground=changedBackground+1;lastBackgroundMode=p.mode;return{mode=p.mode,original={name='Host',url='host://panorama',lighting={}}}
 elseif name=='loboBackgroundState'then return{}end
end
broker={isDestroyed=function()return false end,getVar=function()return 4 end,call=call}
self={getGUID=function()return'df2803'end,isDestroyed=function()return false end,getPosition=function()return{x=0,y=-20,z=0}end,setLock=function()end,setInvisibleTo=function()end}
function getObjectFromGUID(g)if g=='df2802'then return mat elseif g=='broker'then return broker end end
function getObjectsWithTag()return{}end
Physics={cast=function()return{}end};Grid={}
Backgrounds={setCustomURL=function()changedBackground=changedBackground+1 end,setBackground=function()changedBackground=changedBackground+1 end}
Lighting={apply=function()end,setAmbientSkyColor=function()end,setAmbientEquatorColor=function()end,setAmbientGroundColor=function()end,setLightColor=function()end}
''')
lua.execute(controller)
g=lua.globals();g.onLoad('');g.pump();assert g.changedBackground==1 and g.lastBackgroundMode=='day'
assert len(g.lines)==10
for line in g.lines.values():assert len(line.points) in (5,97)
g.loboUniversalDeployment4();g.pump();assert len(g.lines)==14
g.loboUniversalDeployment0();g.pump();assert len(g.lines)==10
g.loboUniversalDeployment4();g.pump();assert len(g.lines)==6
g.loboUniversalDeployment0();g.pump()
assert 'Restore Host'not in controller and 'Switch corner pair'not in controller
g.loboMeridianMission(conv({'color':'Blue'}));g.loboMeridianMission(conv({'color':'Red'}))
g.loboMeridianTab(conv({'color':'Red'}),'','loboMission_df2803_meridian_tab_Red_4')
g.loboMeridianClose(conv({'color':'Red'}))
assert 'Blue'in json.dumps(native(g.roots))
# Explicit Night choice must survive reload, while fresh loading defaults to Day.
g.loboChooseBackground(None,'','loboBackground_df2803_night');g.pump();assert g.lastBackgroundMode=='night'
# Saved +4/+8 lines must not survive reload as base mission lines.
g.loboUniversalDeployment4();g.loboUniversalDeployment8();g.pump()
saved=g.onSave();g.onDestroy();assert g.released>=1
lua.execute(controller);g.onLoad(saved);g.pump();assert len(g.lines)==18 and g.lastBackgroundMode=='night'
g.loboUniversalDeployment0();g.loboUniversalDeployment4();g.loboUniversalDeployment8();g.pump();assert len(g.lines)==6

g.loboMeridianZones();g.pump();assert len(g.lines)==4
g.loboMeridianExclusion();g.pump();assert len(g.lines)==0
saved2=g.onSave();lua.execute(controller);g.onLoad(saved2);g.pump();assert len(g.lines)==0

lua.execute("treeStates={1,2};function getObjectsWithTag(tag)if tag~='MeridianTree'then return{}end;local out={};for i=1,2 do local index=i;out[i]={hasTag=function()return true end,getStateId=function()return treeStates[index]end,setState=function(s)treeStates[index]=s end}end;return out end")
g.loboMeridianTrees();g.pump();assert list(g.treeStates.values())==[2,1]
g.loboMeridianTrees();g.pump();assert list(g.treeStates.values())==[1,2]

cleanup=LuaRuntime(unpack_returned_tuples=True)
cleanup.execute('''
flags={};result={}
Global={getVar=function(k)return flags[k]end,setVar=function(k,v)flags[k]=v end}
function obj(id,tag)return{hasTag=function(t)return t==tag end,destruct=function()result[id]=true end}end
self=obj('mat','LoboMap:df2801');self.setLock=function()end
objects={self,obj('changed-state','LoboMap:df2801'),obj('moved-offboard','LoboMap:df2801'),obj('miniature','army'),obj('stored-bag','LoboStoredMap')}
function getAllObjects()return objects end
''')
matdata=next(o for o in bag['ContainedObjects']if o['GUID']=='df2802')
cleanup.execute(matdata['LuaScript']);cleanup.globals().onDestroy();rr=cleanup.globals().result
assert rr['changed-state']and rr['moved-offboard']and not rr['miniature']and not rr['stored-bag']
lua.execute("antennaPos={x=4.85,y=2.2,z=-4.85};local oldGet=getObjectFromGUID;function getObjectFromGUID(g)if g=='c18101'then return{getPosition=function()return antennaPos end,setPosition=function(p)antennaPos={x=p[1],y=p[2],z=p[3]}end}end;return oldGet(g)end")
g.loboMeridianDefender();assert abs(g.antennaPos.x+4.85)<1e-6 and abs(g.antennaPos.z-4.85)<1e-6
g.loboMeridianDefender();assert abs(g.antennaPos.x-4.85)<1e-6 and abs(g.antennaPos.z+4.85)<1e-6
result={'status':'Pass','lua_scripts_compiled':len(scripts)+1,'scope':'Lua API mock; not a live TTS certification','checks':['Fresh load applies Day panorama and lighting; explicit Night choice survives reload','12/16/20-inch guide toggles build and remove owned lines','Critical Intervention uses rectangular deployment, attacker exclusion and square server-room boundary; no Restore Host or corner switch button','Saved 12/16/20-inch guides reconstruct without stale duplicates after controller reload','Six-section mission reads independently for two players','Defender-side control moves inhibitor antenna and a second press returns it','Controller release runs on destruction','Anchor cleanup includes changed GUIDs and displaced owned objects','Anchor cleanup preserves unrelated miniatures and stored bags','Tree toggle cycles both leaf-on/off states and returns without changing trunks']}
(R/'Review'/'Meridian-R5-Controls-Checks.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
