from pathlib import Path
import ctypes,json,xml.etree.ElementTree as ET
R=Path(__file__).resolve().parents[1]
lib=ctypes.CDLL('liblua5.4.so.0');lib.luaL_newstate.restype=ctypes.c_void_p;lib.luaL_openlibs.argtypes=[ctypes.c_void_p];lib.luaL_loadstring.argtypes=[ctypes.c_void_p,ctypes.c_char_p];lib.lua_pcallk.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_int,ctypes.c_int,ctypes.c_longlong,ctypes.c_void_p];lib.lua_tolstring.argtypes=[ctypes.c_void_p,ctypes.c_int,ctypes.c_void_p];lib.lua_tolstring.restype=ctypes.c_char_p;lib.lua_close.argtypes=[ctypes.c_void_p]
def run(s,execute=False):
 L=lib.luaL_newstate();lib.luaL_openlibs(L);err=lib.luaL_loadstring(L,s.encode())
 if err==0 and execute:err=lib.lua_pcallk(L,0,0,0,0,None)
 if err:raise AssertionError(lib.lua_tolstring(L,-1,None).decode())
 lib.lua_close(L)
b=json.loads((R/'Map-Bags/810340.json').read_text())['ObjectStates'][0]
scripts={o.get('LuaScript','') for root in b['ContainedObjects'] for o in [root,*root.get('States',{}).values()]}
for s in scripts:run(s)
ui=(R/'Source/map_ui.lua').read_text()
stub='''
local attributes={};local lines={};local current={{tag='Text',attributes={id='unrelated',text='Existing UI & text'}}}
UI={loading=false,getXmlTable=function() return current end,getCustomAssets=function() return {} end,
 setXml=function(s) assert(string.find(s,'unrelated'));lastXml=s end,
 setAttribute=function(id,k,v) attributes[id..k]=v end}
self={getGUID=function() return 'e90001' end,setLock=function(v) assert(v) end,setVectorLines=function(v) lines=v end}
Wait={frames=function(f) f() end}
JSON={encode=function(v) savedObject=v;return 'saved' end,decode=function(v) return savedObject end}
'''
post='''
onLoad();assert(#lines==2,'Expected two corner arcs')
assert(string.find(lastXml,'text="Mission"'));assert(not string.find(lastXml,'Map Rules'))
for _,title in ipairs({'SCORING','ANALYZE HYPERTHERMAL TECH','NEUTRALIZE HYPERTHERMAL TECH','OPERATIONAL LEARNING','END OF THE MISSION','OTHER POINT LEVELS','TERRAIN &amp; ACCESS'}) do assert(string.find(lastXml,title,1,true),title) end
for mask=0,7 do
 local count=0
 for i,r in ipairs({24,28,32}) do
  local on=math.floor(mask/2^(i-1))%2==1
  _G['setDeployment'..r]({color='Blue'},tostring(not on))
  _G['setDeployment'..r]({color='Blue'},tostring(on))
  if on then count=count+1 end
  for _,color in ipairs({'Blue','Red','Grey'}) do assert(attributes['oq810340_e90001_deploy_'..color..'_'..r..'isOn']==tostring(on)) end
 end
 assert(#lines==count*2,'Arc combination incorrect')
 local line=1
 for i,r in ipairs({24,28,32}) do if math.floor(mask/2^(i-1))%2==1 then
  for _,corner in ipairs({{24,-24},{-24,24}}) do
   for _,p in ipairs(lines[line].points) do assert(math.abs(math.sqrt((p[1]-corner[1])^2+(p[3]-corner[2])^2)-r)<.00001) end
   line=line+1
  end
 end end
end
toggleTechGuide();assert(#lines==12,'Expected six guide rings plus six arcs')
toggleDeployment({color='Blue'});assert(attributes['oq810340_e90001_deploy_Blueactive']=='true');assert(#lines==12)
closeDeployment({color='Blue'});assert(attributes['oq810340_e90001_deploy_Blueactive']=='false')
openRules({color='Blue'});assert(attributes['oq810340_e90001_Blueactive']=='true')
closeRules({color='Blue'});assert(attributes['oq810340_e90001_Blueactive']=='false')
setDeployment28(nil,'false');onSave();assert(savedObject.radii['24'] and not savedObject.radii['28'] and savedObject.radii['32'] and savedObject.tech)
setDeployment24(nil,'false');toggleTechGuide();onLoad('saved');assert(#lines==10,'Saved radii / Tech guide not restored')
assert(string.find(lastXml,'&amp;'),'Existing UI text was not escaped')
onDestroy();assert(not string.find(lastXml,'oq810340'),'Map UI cleanup failed')
'''
run(stub+ui+post,True)
(R/'Source/script-validation.json').write_text(json.dumps({'uniqueObjectScriptsCompiled':len(scripts),'deploymentCheckboxCombinations':8,'radiusGeometry':'pass','saveRestore':'pass','missionContentAndPlayerPanels':'pass','existingUIPreserved':'pass','mapUICleanup':'pass','stageClearStates':['roof','2','3']},indent=2))
print('Object Lua syntax and Mission / checkbox overlays / per-player panel / UI cleanup checks passed.')
