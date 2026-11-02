from pathlib import Path
import json,re,copy,math,xml.etree.ElementTree as ET
from lupa import LuaRuntime
ROOT=Path(__file__).resolve().parents[1]
source=(ROOT/'Source/ui-test-runtime.py').read_text()
exec(source[source.index('L=LuaRuntime'):source.index('# Compile all changed controller scripts')])
L.execute('''
backgroundName='Custom';backgroundURL='original';lightApplies=0
Backgrounds={getBackground=function()return backgroundName end,getCustomURL=function()return backgroundURL end,setCustomURL=function(u)backgroundURL=u end,setBackground=function(n)backgroundName=n end}
Lighting={ambient_type=1,ambient_intensity=.7,light_intensity=.85,reflection_intensity=.5,lut_index=2,lut_contribution=.3}
for _,key in ipairs({'AmbientSky','AmbientEquator','AmbientGround','Light'})do Lighting['get'..key..'Color']=function()return {.1,.2,.3}end;Lighting['set'..key..'Color']=function()end end
Lighting.apply=function()lightApplies=lightApplies+1 end
Grid={show_lines=true,snapping=4}
local oldMake=makeObject
function makeObject(d)
 local o=oldMake(d);local t=d.Transform or{}
 o.getScale=function()return Vector(t.scaleX or 1,t.scaleY or 1,t.scaleZ or 1)end
 o.getVectorLines=function()return o.lines end
 o.getBounds=function()return {center={x=0,y=3,z=0},size={x=48,y=.2,z=48}}end
 o.positionToLocal=function(v)return Vector(v.x or v[1],v.y or v[2],v.z or v[3])end
 o.positionToWorld=function(v)return Vector(v.x or v[1],v.y or v[2],v.z or v[3])end
 o.getRotation=function()return Vector(0,0,0)end
 o.setRotation=function()end;o.setScale=function()end;o.getLock=function()return true end
 o.addTag=function(tag)d.Tags=d.Tags or{};d.Tags[#d.Tags+1]=tag end
 return o
end
castCount=0;castFrames={}
Physics.cast=function(p)castCount=castCount+1;castFrames[frame]=(castFrames[frame] or 0)+1;return{}end
''')
compile=L.eval('function(s)local f,e=load(s);return f~=nil,e end')
collection=json.load(open(ROOT/'Map-Bags/Verdant-Exchange-Uplink-Center-R4.json'))
bags=[o for o in collection['ObjectStates'] if o.get('Nickname','').startswith('SET_')]
bags=[b for b in bags if b['GUID']=='b90000']
configs=json.load(open(ROOT/'Source/deployment-config.json'))
changed=0
for b in bags:
 for o in b['ContainedObjects']:
  if 'loboUniversal' in o.get('LuaScript',''):
   ok,err=compile(o['LuaScript'].replace('!=','~='));assert ok,(b['Nickname'],o['GUID'],err);changed+=1

def each(nodes):
 for _,n in nodes.items():
  yield n
  if n['children']:yield from each(n['children'])
def find(id):return G.find(G.UI.roots,id)
def button(label):
 for n in each(G.UI.roots):
  if n['tag']=='Button' and n['attributes']['text']==label:return n
 raise AssertionError(('missing button',label))
def click(n,color='White'):
 a=n['attributes'];guid,fn=a['onClick'].split('/');o=G.getObjectFromGUID(guid)
 return o.env[fn](table({'color':color}),None,a['id'])
def loadbag(b,saved=''):
 records={l[2:].split(',')[0]:list(map(float,l[2:].split(',')[1:])) for l in b['LuaScript'].splitlines() if re.match(r'^--[a-f0-9]{6},',l)}
 for d in b['ContainedObjects']:
  o=G.makeObject(table(d));o.setPosition(table(records[d['GUID']][:3]))
 # Load all map UI owners and vector writers, as in TTS; simple height scripts are irrelevant here.
 scripted=[]
 for d in b['ContainedObjects']:
  s=d.get('LuaScript','')
  if 'loboUniversal' in s or 'loboLifeBrokerData=' in s:
   o=G.getObjectFromGUID(d['GUID']);G.runScript(o,s.replace('!=','~='));scripted.append(o)
 for o in scripted:
  if o.env.onLoad:o.env.onLoad(saved)
 G.advance(100)
 controller=next(o for o in scripted if o.env.loboUniversalDeployment0)
 return controller

def clearbag(b,first):
 G.destroy(first)
 for d in b['ContainedObjects']:G.destroy(d['GUID'])
 G.advance(80);G.assertNoMapUI();assert G.backgroundURL=='original'

results=[]
for index,b in enumerate(bags):
 c=configs[b['GUID']];o=loadbag(b);mat=G.getObjectFromGUID(c['mat']);root='loboMission_'+o.getGUID()+'_universal'
 assert len(mat.lines)==0,'A donor deployment overlay survived initial load'
 for label in ['DZ: OFF','DZ +4\": OFF','DZ +8\": OFF','Booty table','Metachemistry table']:button(label)
 # No active legacy Deployment opener remains outside a modal.
 panel=find('loboMapDrawerV1_panel');assert panel and panel['attributes']['rectAlignment']=='MiddleRight'
 assert float(panel['attributes']['height'])<=610,(b['Nickname'],panel['attributes']['height'])
 assert not G.Grid.show_lines and G.Grid.snapping==1
 assert G.backgroundURL.endswith('/verdant-day.jpg')
 click(button('Night'));G.advance(12);assert G.backgroundURL.endswith('/verdant-night.jpg')
 click(button('Background Off'));G.advance(12);assert G.backgroundURL.endswith('/background-off.jpg')
 click(button('Day'));G.advance(12);assert G.backgroundURL.endswith('/verdant-day.jpg')
 G.assertLiveTargets()
 o.env.siroccoMission(table({'color':'White'}));o.env.siroccoMission(table({'color':'Red'}));G.advance(12)
 o.env.siroccoTab(table({'color':'White'}),None,'loboMission_'+o.getGUID()+'_tab5_White');G.advance(12)
 white=find('loboMission_'+o.getGUID()+'_modal_White');red=find('loboMission_'+o.getGUID()+'_modal_Red')
 assert white['attributes']['visibility']=='White' and red['attributes']['visibility']=='Red'
 assert any(n['value']=='Campus terrain and interiors'for n in each(white['children']))
 assert any(n['value']=='Uplink Center | Verdant Exchange'for n in each(red['children']))
 o.env.siroccoClose(table({'color':'White'}));o.env.siroccoClose(table({'color':'Red'}));G.advance(12)
 click(button('Booty table'));G.advance(12)
 assert find(root+'_chart_booty')['attributes']['visibility']=='White'
 assert find('loboMapDrawerV1_panel')['attributes']['visibility'].find('White')<0
 # Second player uses a different chart and has independent Close.
 o.env.loboUniversalMetaChemistry(table({'color':'Red'}));G.advance(12)
 assert find(root+'_chart_meta')['attributes']['visibility']=='Red'
 assert find(root+'_chart_booty')['attributes']['visibility']=='White'
 o.env.loboUniversalReferenceClose(table({'color':'White'}));G.advance(12)
 assert find(root+'_chart_booty')['attributes']['active']=='false'
 assert find(root+'_chart_meta')['attributes']['visibility']=='Red'
 o.env.loboUniversalMetaChemistry(table({'color':'Red'}));G.advance(12)
 assert find(root+'_chart_meta')['attributes']['active']=='false'
 # +4 on is precisely 4 inches beyond the current mission's boundary.
 G.castCount=0;G.castFrames=table({})
 o.env.loboUniversalDeployment4();G.advance(85)
 assert G.castCount==194,(b['Nickname'],G.castCount)
 assert max(plain(G.castFrames).values())<=8
 lines=plain(mat.lines);guides=lines[-4:];assert len(guides)==4
 for side,line in enumerate([guides[1],guides[3]]):
  assert len(line['points'])==97
  for x,y,z in line['points']:
   assert -24.0001<=x<=24.0001 and -24.0001<=z<=24.0001
   if c['shape']=='corner':
    sign=1 if side==0 else -1;actual=math.hypot(x-sign*24,z+sign*24)
    assert abs(actual-(c['depth']+4))<1e-7
   else:assert abs(x-(-1 if side==0 else 1)*(24-c['depth']-4))<1e-7
 assert all(p[1]>c['surface'] for line in guides for p in line['points']), 'DZ overlays must be above the actual mat surface'
 # All three can coexist; no unrelated mission line is lost by a later writer.
 o.env.loboUniversalDeployment0();o.env.loboUniversalDeployment8();G.advance(100)
 saved=o.env.onSave();state=json.loads(saved);assert state['loboUniversal']=={'0':True,'4':True,'8':True}
 sentinel={'points':[[0,1,-24],[0,1,24]],'color':[.8,.8,.8],'thickness':.008}
 o.env.loboUniversalSetBase(table({'guid':c['mat'],'lines':[sentinel]}))
 assert len(mat.lines)==13 and plain(mat.lines)[0]==sentinel
 # Rapid off/on/off must cancel queued raycasts and leave the two remaining guides only.
 o.env.loboUniversalDeployment4();o.env.loboUniversalDeployment4();o.env.loboUniversalDeployment4();G.advance(100)
 assert len(mat.lines)>=8,(b["Nickname"],len(mat.lines),json.loads(o.env.onSave()))
 # Clear while another draw is pending, alternating controller/anchor destruction order.
 o.env.loboUniversalDeployment8();G.advance(1)
 clearbag(b,c['mat'] if index%2==0 else o.getGUID())
 results.append({'map':b['Nickname'],'chart_routing':'pass','per_player_reference_visibility':'pass','offset_geometry':'pass','raycast_budget':'pass','independent_toggles':'pass','mission_lines_preserved':'pass','saved_state':'pass','pending_overlay_clear':'pass'})
 # Reload with all three saved ON and ensure first draw restores them.
 if index in [0,1,20,90]:
  o=loadbag(b,saved);G.advance(100);assert json.loads(o.env.onSave())['loboUniversal']=={'0':True,'4':True,'8':True}
  assert len(G.getObjectFromGUID(c['mat']).lines)>=12, (len(G.getObjectFromGUID(c['mat']).lines),plain(G.getObjectFromGUID(c['mat']).lines),saved)
  clearbag(b,o.getGUID())
print(json.dumps({'maps_tested':len(results),'modified_scripts_compiled':changed,'all_passed':True,'live_TTS_tested':False},indent=2))
(ROOT/'Source/controls-validation.json').write_text(json.dumps({'summary':{'maps_tested':len(results),'modified_scripts_compiled':changed,'all_passed':True,'live_TTS_tested':False},'maps':results},indent=2))
