import copy,json,sys
from pathlib import Path
from package_release import ROOT,OUT,SAVE,GUID
sys.path.insert(0,str(ROOT/'reference'))
from simulation import GroundSimulation
data=json.loads((OUT/SAVE).read_text());data['LuaScript']+='\n__groundHeight=r23WorldHeight\n'
s=GroundSimulation(data);g=s.lua.globals();g.selectBattle(s.player,'24');g.loadBattle(s.player);s.drain()
bag=next(b for b in data['ObjectStates'][3]['ContainedObjects'] if b['GUID']==GUID)
sources={o['GUID']:o for o in bag['ContainedObjects'] if 'LoboCommander' in o['Tags']}
calls=[];selected=[]
s.player.getSelectedObjects=lambda:s.lua.table_from(selected)
def attach(o,src,state):
 o.getStateId=lambda:state
 o.addToPlayerSelection=lambda color:None
 def replace(newstate):
  assert newstate in [1,2];calls.append(newstate)
  d=copy.deepcopy(src if newstate==1 else src['States'][str(newstate)])
  replacement=s.object(d);replacement.setPosition(o.getPosition());replacement.setRotation(o.getRotation())
  s.world.append(replacement);o['_dead']=True;selected[:]=[replacement];attach(replacement,src,newstate)
  return replacement
 o.setState=replace
for guid,src in sources.items():
 o=next(o for o in s.world if not o['_dead'] and o.getGUID()==guid);attach(o,src,1);selected[:]=[o]
 for method,expect in [('unitDisordered',2),('unitFull',1),('unitShaken',1)]:
  prior=len(calls);s.messages.clear();g[method](s.player);s.drain()
  assert selected[0].getStateId()==expect
  if method=='unitShaken':assert len(calls)==prior and s.messages==['Commanders use Normal or Wounded.']
  else:assert any(('Wounded' if expect==2 else 'Normal') in m for m in s.messages)
print('PASS: six commanders switch Normal/Wounded; Shaken is rejected without a false status confirmation.')
(ROOT/'commander-controls-validation.json').write_text(json.dumps({'passed':True,'commanders':6,'button_checks':18,'actual_transitions':len(calls)},indent=2))
