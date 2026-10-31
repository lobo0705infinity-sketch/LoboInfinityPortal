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
local attributes={};local lines={};local root='oq810340_e90001';local current={{tag='Text',attributes={id='unrelated',text='Existing UI & text'}}}
local matPresent=true;local overlayFailure=false;local stopped=false;local rebuilds=0
UI={loading=false,getXmlTable=function() return current end,getCustomAssets=function() return {} end,
 setXml=function(s)
  assert(string.find(s,'unrelated'));lastXml=s;rebuilds=rebuilds+1
  current={{tag='Text',attributes={id='unrelated',text='Existing UI & text'}}}
  if string.find(s,'id="'..root..'"',1,true) then current[2]={tag='Panel',attributes={id=root}} end
 end,
 setAttribute=function(id,k,v) attributes[id..k]=v end}
self={getGUID=function() return 'e90001' end,setLock=function(v) assert(v) end,
 getPosition=function() return {x=32,y=1.3,z=0} end,setInvisibleTo=function(c) assert(#c==12) end}
local mat={setVectorLines=function(v) if overlayFailure then error('Model still loading') end;lines=v end}
function getObjectFromGUID(g) if matPresent and g=='e90001' then return mat end end
Wait={frames=function(f) f() end,time=function(f,seconds,repetitions) assert(seconds==.5 and repetitions==-1);return 7 end,stop=function(id) stopped=true end}
JSON={encode=function(v) savedObject=v;return 'saved' end,decode=function(v) return savedObject end}
'''
post='UI.loading=true;onLoad();assert(lastXml==nil,\'UI loaded before assets ready\');UI.loading=false;checkDeployment();assert(#lines==2,\'Expected two corner arcs\')\nassert(string.find(lastXml,\'text="Mission"\'));assert(not string.find(lastXml,\'Map Rules\'));assert(not string.find(lastXml,\'<Toggle\'),\'Startup UI must mount buttons before panels\')\n-- Reproduce the exact TTS restriction from the user\'s screenshot.\nstring.gmatch=function() error(\'pattern too complex: TTS pattern restriction\') end\nUI.loading=true;openRules({color=\'Blue\'});UI.loading=false;checkDeployment()\nfor _,title in ipairs({\'SCORING\',\'ANALYZE HYPERTHERMAL TECH\',\'NEUTRALIZE HYPERTHERMAL TECH\',\'OPERATIONAL LEARNING\',\'END OF THE MISSION\',\'OTHER POINT LEVELS\',\'TERRAIN &amp; ACCESS\'}) do assert(string.find(lastXml,title,1,true),title) end\ntoggleDeployment({color=\'Blue\'});toggleDeployment({color=\'Red\'})\nfor mask=0,7 do\n local radiiCount=0\n for i,r in ipairs({24,28,32}) do\n  local on=math.floor(mask/2^(i-1))%2==1\n  _G[\'setDeployment\'..r]({color=\'Blue\'},tostring(not on));_G[\'setDeployment\'..r]({color=\'Blue\'},tostring(on))\n  if on then radiiCount=radiiCount+1 end\n  for _,color in ipairs({\'Blue\',\'Red\'}) do assert(attributes[\'oq810340_e90001_deploy_\'..color..\'_\'..r..\'isOn\']==tostring(on)) end\n end\n for sideMask=0,3 do\n  local a=sideMask%2==1;local b=math.floor(sideMask/2)%2==1\n  setDeploymentSideA(nil,tostring(a));setDeploymentSideB(nil,tostring(b))\n  local sideCount=(a and 1 or 0)+(b and 1 or 0)\n  assert(#lines==radiiCount*sideCount,\'Radius/side combination incorrect\')\n  local index=1\n  for i,r in ipairs({24,28,32}) do if math.floor(mask/2^(i-1))%2==1 then\n   for j,c in ipairs({{24,-24},{-24,24}}) do if (j==1 and a) or (j==2 and b) then\n    for _,p in ipairs(lines[index].points) do assert(math.abs(math.sqrt((p[1]-c[1])^2+(p[3]-c[2])^2)-r)<.00001) end\n    index=index+1\n   end end\n  end end\n  for _,color in ipairs({\'Blue\',\'Red\'}) do assert(attributes[\'oq810340_e90001_deploy_\'..color..\'_sideAisOn\']==tostring(a));assert(attributes[\'oq810340_e90001_deploy_\'..color..\'_sideBisOn\']==tostring(b)) end\n end\nend\ntoggleTechGuide();assert(#lines==12,\'Expected six guide rings plus six arcs\')\ncloseDeployment({color=\'Blue\'});assert(attributes[\'oq810340_e90001_deploy_Blueactive\']==\'false\')\nopenRules({color=\'Blue\'});assert(string.find(lastXml,\'id="oq810340_e90001_Blue"\'))\ncloseRules({color=\'Blue\'});assert(attributes[\'oq810340_e90001_Blueactive\']==\'false\')\nsetDeployment28(nil,\'false\');setDeploymentSideA(nil,\'false\');onSave()\nassert(savedObject.radii[\'24\'] and not savedObject.radii[\'28\'] and savedObject.radii[\'32\'] and not savedObject.sides.A and savedObject.sides.B and savedObject.tech)\nsetDeployment24(nil,\'false\');setDeploymentSideA(nil,\'true\');toggleTechGuide();onLoad(\'saved\');assert(#lines==8,\'Saved radii / sides / guide not restored\')\nassert(string.find(lastXml,\'&amp;\'),\'Existing UI text was not escaped\')\nio.open(\'/tmp/old-quarter-live-ui.xml\',\'w\'):write(lastXml):close()\nlocal n=rebuilds;checkDeployment();assert(rebuilds==n,\'Unchanged UI unnecessarily rebuilt\')\ncurrent={{tag=\'Text\',attributes={id=\'unrelated\',text=\'Existing UI & text\'}}};overlayFailure=true\nsetDeploymentSideA(nil,\'true\');checkDeployment();assert(string.find(lastXml,\'text="Mission"\'),\'HUD did not recover after reset / overlay failure\')\noverlayFailure=false;matPresent=false;checkDeployment();assert(not string.find(lastXml,root),\'Stale HUD remained after map removed\')\nmatPresent=true;checkDeployment();assert(string.find(lastXml,\'text="Deployment"\'),\'HUD did not recover when map arrived late\')\nonDestroy();assert(stopped,\'Watcher not stopped\');assert(not string.find(lastXml,\'oq810340\'),\'Map UI cleanup failed\')\n'
run(stub+ui+post,True)
xml=ET.fromstring('<Root>'+Path('/tmp/old-quarter-live-ui.xml').read_text()+'</Root>')
assert len(xml.findall('.//Toggle'))==10
texts={t.attrib.get('id'):t.attrib.get('text') for t in xml.findall('.//Text')}
for color in ['Blue','Red']:
 for suffix in ['sideA','sideB','24','28','32']:
  assert texts['oq810340_e90001_deploy_'+color+'_'+suffix+'_label']
assert xml.find('.//VerticalScrollView/VerticalLayout/Text') is not None
(R/'Source/script-validation.json').write_text(json.dumps({'uniqueObjectScriptsCompiled':len(scripts),'deploymentCheckboxCombinations':32,'explicitCheckboxLabels':'pass','TTSComplexPatternRestrictionEmulated':'pass','missionQueuedWhileUILoading':'pass','radiusGeometry':'pass','saveRestore':'pass','delayedLoadAndGlobalUIResetRecovery':'pass','overlayFailureDoesNotHideHUD':'pass','controllerLifecycle':'pass','lightweightButtonsBeforeLazyPanels':'pass','missionContentAndPlayerPanels':'pass','existingUIPreserved':'pass','mapUICleanup':'pass','stageClearStates':['roof','2','3']},indent=2))
print('Object Lua syntax and Mission / checkbox overlays / per-player panel / UI cleanup checks passed.')
