from pathlib import Path
import json,subprocess,sys,re,copy
R=Path(__file__).resolve().parents[2];sys.path.insert(0,str(R/'tts-map-controls-standard'))
from test_standard import RealWorld,validate_map
from validate_release import validate
broker=R/'tts-map-controls-standard/standard-broker.lua';newbroker=broker.read_text();oldbroker=subprocess.check_output(['git','show','HEAD:tts-map-controls-standard/standard-broker.lua'],cwd=R,text=True)
reports=[]
for n in ['810340','8a1c29']:
 p=R/f'lobo-infinity-portal/public/assets/maps/standard-controls-20261118/{n}.json';old=json.loads(subprocess.check_output(['git','show','HEAD:'+str(p.relative_to(R))],cwd=R));new=json.loads(p.read_text());a=old['ObjectStates'][0];b=new['ObjectStates'][0]
 # Exact rendered button/property comparison, with the original broker as baseline.
 try:
  broker.write_text(oldbroker);w=RealWorld(a);w.load();before=[dict(x.attrib)for x in w.panel().iter('Button')]
 finally:broker.write_text(newbroker)
 w=RealWorld(b);w.load();after=[dict(x.attrib)for x in w.panel().iter('Button')];assert before==after,'Control button drift'
 assert 'Old Quarter Excavation - The Dig'in w.xml
 # No geometry, scripts, state, or placement changes to unrelated objects.
 changed=[]
 for x,y in zip(a['ContainedObjects'],b['ContainedObjects']):
  assert x['GUID']==y['GUID'];assert x['Transform']==y['Transform']
  name=x.get('Nickname','').split(' |')[0]
  if name in ['Research Annex East','Central Survey Annex','Civic Corner West','Tenement South','Central Ruined Block']:
   changed.append(name)
   for sx,sy in [(x,y)]+[(x['States'][k],y['States'][k])for k in x.get('States',{})]:
    assert sx['Transform']==sy['Transform'];assert sx.get('LuaScript')==sy.get('LuaScript');assert sx['CustomMesh']['DiffuseURL']==sy['CustomMesh']['DiffuseURL']
  else:
   xx=copy.deepcopy(x);yy=copy.deepcopy(y)
   if xx.get('LuaScript')!=yy.get('LuaScript'):
    assert 'loboLifeBrokerData='in xx.get('LuaScript','')or'function loboStandardState()'in xx.get('LuaScript','')
    xx.pop('LuaScript',None);yy.pop('LuaScript',None)
   assert xx==yy, name
 validate(p);validate_map(b)
 reports.append({'map':n,'changed_buildings':changed,'rendered_buttons_identical':True,'map_name_visible':True,'unrelated_objects_unchanged':True,'runtime_controls_passed':True})
(R/'map-fixes/dig-20261124/validation.json').write_text(json.dumps(reports,indent=2));print(json.dumps(reports))
