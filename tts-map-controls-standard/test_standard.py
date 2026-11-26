from pathlib import Path
import json,copy,re,sys,xml.etree.ElementTree as ET,math
from test_zones import World,py,check_render
from patch_maps import bags,ROOT
from mission_links import assignment

class RealWorld(World):
 def __init__(self,bag):
  self.real_broker=True
  super().__init__(bag)
  for key,o in list(self.items.items()):
   if key not in self.run and 'local loboLifeBrokerData='in o.get('LuaScript',''):self.init(o)
  sources = set()
  for item in self.items.values():
   match = re.search(r'^local loboLifeBrokerData=(".*")$', item.get('LuaScript', ''), re.M)
   if match:
    sources.add(json.loads(json.loads(match[1]))['LuaScript'])
  assert len(sources) == 1, 'A setup must ship one UI broker implementation'
  broker_script, = sources
  o={'GUID':'broker','Name':'BlockSquare','Transform':{'posX':90,'posY':-50,'posZ':90,'rotX':0,'rotY':0,'rotZ':0,'scaleX':.1,'scaleY':.1,'scaleZ':.1},'Tags':['NoSave','LoboMapUIBrokerV4'],'LuaScript':broker_script}
  self.items['broker']=o;self.init(o)
 def invoke(self,button,color='White'):
  guid,fn=button.get('onClick').split('/')
  rt,g=self.run[guid];g[fn](rt.table_from({'color':color}),'',button.get('id'));self.advance(3)
 def visible(self,color='White'):
  result=[]
  def visit(n,active=True):
   active=active and n.get('active')!='false' and (not n.get('visibility')or color in n.get('visibility').split('|'))
   if active:result.append(n)
   for c in n:visit(c,active)
  visit(self.xml_root());return result
 def xml_root(self):
  self.run['broker'][1].loboUIFlush()
  return self.ui_root
 def panel(self,color='White'):
  root=self.xml_root()
  legacy=root.find(".//*[@id='loboMapDrawerV1_compact']")
  if legacy is not None:return legacy
  seat=color if color in ('Blue','Red') else 'Other'
  return root.find(".//*[@id='loboMapDrawerV1_"+seat+"_compact']")
 def button(self,suffix,color='White'):
  panel=self.panel(color)
  return panel.find(".//*[@id='"+panel.get('id')+'_'+suffix+"']")
 def click(self,suffix,color='White',expected=True):
  button=self.button(suffix,color)
  assert button is not None,suffix
  assert button.get('interactable')!='false',(suffix,'disabled')
  rt,g=self.run['broker'];g.loboStandardClick(rt.table_from({'color':color}),'',button.get('id'));self.advance(3)
  if expected:assert self.panel() is not None

def validate_map(bag):
 w=RealWorld(bag);w.load();p=w.panel();assert p is not None
 labels=[b.get('text','')for b in p.iter('Button')]
 for suffix in ['mission','turn','dz_off','dz_0','dz_4','dz_8','dzcolor','excolor','grid','scoring','bg_day','bg_night','bg_off','clear']:
  b=w.button(suffix);assert b is not None,suffix
  assert b.get('interactable')!='false',(bag['Nickname'],suffix,'disabled')
 assert all(x.isascii()for x in labels),labels
 assert not any(any(word in x.lower()for word in ['floor view','my view','shared interiors','full rooftops','building floors'])for x in labels)
 # Both seats can request a mission without writing to the other player's chat or UI.
 _,url=assignment(bag)
 events=[]
 for _,runtime in w.run.values():
  runtime.printToColor=lambda message,seat,*args:events.append(('chat',seat,message))
  for seat in ('White','Blue'):
   runtime.Player[seat].showInputDialog=lambda title,value,done,c=seat:events.append(('dialog',c,value))
 before_xml=[(n.tag,n.get('id')) for n in w.visible()]
 for seat in ('Blue','White','Red'):
  events.clear();w.click('mission',seat)
  expected=[('chat',seat,url)]
  if seat!='Red':expected.append(('dialog',seat,url))
  assert events==expected,(bag['GUID'],seat,events,expected)
  assert [(n.tag,n.get('id')) for n in w.visible()]==before_xml,'Mission opened an additional panel'
 assert w.panel().get('active')=='true','Main panel did not return'
 for mode in ['day','night','off']:
  w.click('bg_'+mode);button=w.button('bg_'+mode)
  assert button.get('color')=='#82BCCDFF',('background did not select',mode)
  assert w.background_url.startswith('https://'),'Background URL missing'
 w.click('dz_0');w.click('dz_4');w.click('dz_8');w.click('dz_off')
 assert not any(x.get('loboZoneKind')=='deployment'for x in w.source()),'DZ off failed'
 w.click('dz_0');check_render(w)
 w.click('grid');assert py(w.call('loboStandardState'))['grid']is True
 w.click('grid');assert py(w.call('loboStandardState'))['grid']is False
 before={k:copy.deepcopy(v['Transform'])for k,v in w.items.items()}
 w.click('turn');assert py(w.call('loboStandardState'))['flipped']is True
 w.click('dz_4');check_render(w)
 w.click('dzcolor');g=w.run[w.primary['GUID']][1];rt=w.run[w.primary['GUID']][0]
 g.loboZonePickColor(rt.table_from({'color':'White'}),'','loboMission_ZoneColors_'+w.primary['GUID']+'_pick_deployment_4');w.advance(3)
 assert w.tables[w.mat]['LoboZoneColorsR1']['deployment']==4
 assert w.tables[w.mat]['LoboZoneColorsR1']['exclusion']==3
 w.click('turn');assert py(w.call('loboStandardState'))['flipped']is False
 for k,t in before.items():
  current=w.items[k]['Transform']
  for field in ['posX','posY','posZ']:
   assert abs(current[field]-t[field])<.00001,(bag['Nickname'],k,field,current[field],t[field])
  assert abs((current.get('rotY',0)-t.get('rotY',0)+180)%360-180)<.00001,(k,'rotation restore')
 return w

if __name__=='__main__':
 (ROOT/'audit').mkdir(exist_ok=True)
 data=json.loads((ROOT/'output/Workshop-Save.json').read_text());report=[]
 for i,bag in enumerate(bags(data)):
  if len(sys.argv)>1 and str(i+1)not in sys.argv[1:]:continue
  try:
   w=validate_map(bag);print(i+1,bag['GUID'],'PASS',flush=True)
   report.append({'index':i+1,'map':bag['GUID'],'name':bag['Nickname'],'passed':True})
   if i==0:(ROOT/'audit/panel-vanta.xml').write_text(w.xml)
  except Exception as e:
   print('FAILED',i+1,bag['Nickname'],repr(e),flush=True)
   report.append({'index':i+1,'map':bag['GUID'],'name':bag['Nickname'],'passed':False,'error':repr(e)})
 (ROOT/('audit/subset-runtime.json'if len(sys.argv)>1 else'audit/standard-runtime.json')).write_text(json.dumps(report,indent=2))
 if any(not row['passed']for row in report):raise SystemExit(1)
