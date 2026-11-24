from pathlib import Path
import json,sys,subprocess,math
from lupa.lua52 import LuaRuntime
from fix_mission_panel import OLD,NEW
R=Path(__file__).resolve().parents[2];sys.path.insert(0,str(R/'tts-map-controls-standard'))
from test_standard import validate_map
from validate_release import validate
# Verify identical line-height results, including empty/trailing lines and long paragraphs.
rt=LuaRuntime();old=rt.eval('function(body) '+OLD+';return lines end');new=rt.eval('function(body) '+NEW+';return lines end')
for body in ['', 'x', 'x\n', '\n\n', 'a'*74, 'a'*75, 'a'*76,'a'*4000+'\n'+'b'*3000]:assert old(body)==new(body)
rt.execute('string.gmatch=function() error("pattern matcher must not be used") end')
for body in ['x'*1000000,('paragraph\n'*10000),'%[.*-]+\r\n']:
 assert new(body)==sum(max(1,math.ceil(len(s)/75))for s in body.split('\n'))
results=[]
for n in ['810340','8a1c29']:
 p=R/f'lobo-infinity-portal/public/assets/maps/standard-controls-20261118/{n}.json';d=json.loads(p.read_text());before=json.loads(subprocess.check_output(['git','show','HEAD:'+str(p.relative_to(R))],cwd=R))
 def undo(o):
  if isinstance(o,dict):
   if 'LuaScript'in o:o['LuaScript']=o['LuaScript'].replace(NEW,OLD)
   for v in o.values():
    if isinstance(v,(dict,list)):undo(v)
  elif isinstance(o,list):
   for v in o:undo(v)
 clone=json.loads(json.dumps(d));undo(clone);assert clone==before,'Unrelated map changes'
 validate(p);validate_map(d['ObjectStates'][0]);results.append({'map':n,'mission_open_close_and_controls_pass':True,'only_text_measurement_changed':True})
results.append({'long_text_without_pattern_matching':True,'line_heights_unchanged':True})
(R/'map-fixes/dig-20261124/mission-validation.json').write_text(json.dumps(results,indent=2));print(json.dumps(results))
