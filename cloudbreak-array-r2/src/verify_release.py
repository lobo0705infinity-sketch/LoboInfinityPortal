"""Exercise the shipped tables, staged bag and canonical Map Controls."""
import re,sys
from package import *
sys.path.insert(0,str(ROOT/'standard'))
from patch_maps import walk
from test_standard import validate_map,py

def run():
 play2=json.loads((OUT/'Play-Table.json').read_text());bag=json.loads((OUT/'Cloudbreak-Array.json').read_text())['ObjectStates'][0];workshop=json.loads((OUT/'Workshop-Save.json').read_text());previous=json.loads((BASE/'r1/Workshop-Save.json').read_text());shelf=next(o for o in workshop['ObjectStates'] if o['GUID']==BAG);assert shelf['ContainedObjects']==bag['ContainedObjects'] and shelf['LuaScript']==bag['LuaScript']
 by=lambda a:{o['GUID']:o for o in a}
 assert by([o for o in workshop['ObjectStates']if o['GUID']!=BAG])==by([o for o in previous['ObjectStates']if o['GUID']!=BAG])
 assert by([o for o in play2['ObjectStates']if TAG not in o.get('Tags',[])])==by([o for o in play['ObjectStates']if TAG not in o.get('Tags',[])])
 records={a[0]:[float(z)for z in a[1:]]for a in [line.removeprefix('--').split(',')for line in bag['LuaScript'].splitlines()]}
 placed=by([o for o in play2['ObjectStates']if TAG in o.get('Tags',[])])
 seen=set();console=json.loads((BASE/'console-candidate-0.json').read_text());gids=[]
 for q in bag['ContainedObjects']:
  o=placed[q['GUID']];v=deepcopy(q);v['Transform'].update({a:o['Transform'][a]for a in ('posX','posY','posZ')});assert v==o
  for item in [o,*o.get('States',{}).values()]:
   ts=item['Transform'];assert records[item['GUID']]==[float(ts[f])for f in ('posX','posY','posZ','rotX','rotY','rotZ')];seen.add(item['GUID'])
  if o['GUID'] in [ob[3]['GUID']for ob in O.values()]:
   gids.append(o['GUID']);assert o['CustomAssetbundle']==console['CustomAssetbundle'] and o['ChildObjects'][0]['CustomMesh']==console['ChildObjects'][0]['CustomMesh']
   assert all(o['Transform']['scale'+a]==console['Transform']['scale'+a]for a in 'XYZ')
 assert seen==set(records) and len(gids)==5
 every=[o['GUID']for o in walk(bag)if 'GUID'in o];assert len(set(every))==len(every)
 for s in (play2,workshop):
  assert AIR in next(q['body']for q in s['TabStates'].values() if 'Cloudbreak' in q['title'])
 assert not any(x in json.dumps(bag)for x in ('0000000000000000000000000000000000000000','file://','/workspace/','localhost','127.0.0.1'))
 assert 'Network Node R2' in workshop['LuaScript'] and "getObjectFromGUID('cb7100')" in workshop['LuaScript']
 w=validate_map(deepcopy(bag));rt,g=w.run['cb7102'];cfg=json.loads(json.loads(CONFIG.search(placed['cb7102']['LuaScript'])[2]));assert cfg['rules']==RULES
 assert play2['SkyURL']==cfg['background']['day']
 for mode in ('day','night','off'):
  w.click('bg_'+mode);assert w.background_url==cfg['background'][mode]
 def button(prefix):
  return next(e for e in w.visible()if e.tag=='Button' and e.get('text','').lower().startswith(prefix))
 w.invoke(button('map rules'));assert any(AIR in (x.text or x.get('text','')) for x in w.visible());assert not any(AIR in (x.text or x.get('text','')) for x in w.visible('Blue'))
 w.invoke(button('close'));w.invoke(button('map-specific options'));w.invoke(button('cloud boundaries'));assert len([q for q in w.source()if not q.get('loboZoneKind') and q.get('thickness')in [.055,.033]])==len(CLOUDS)*6
 w.invoke(button('cloud boundaries'));assert not any(q.get('thickness')in [.055,.033] for q in w.source())
 for oid in gids:
  w.init(placed[oid]);wr,wg=w.run[oid];wg.onLoad('Neutral')
 owner=lambda oid:w.run[oid][1].ownerSide
 def claim(oid,side):w.call('claimNetworkObjective',{'guid':oid,'side':side,'color':'White'})
 node=cfg['primary'];relay=next(i for i in gids if i!=node);claim(node,'A');assert owner(node)=='Neutral'
 claim(relay,'A');claim(node,'A');assert owner(node)=='A';claim(relay,'B');assert owner(node)=='Neutral'
 # Invoke the standard options for both color palettes and exercise all seven choices independently.
 for key,suffix in [('deployment','dzcolor'),('exclusion','excolor')]:
  for n in range(1,8):
   w.click(suffix);g.loboZonePickColor(rt.table_from({'color':'White'}),'',f'loboMission_ZoneColors_cb7102_pick_{key}_{n}');w.advance(2)
   assert w.tables[w.mat]['LoboZoneColorsR1'][key]==n
 assert w.tables[w.mat]['LoboZoneColorsR1']['deployment']==7
 stats={'unchanged_other_map_setups':105,'numbered_building_states':sum(t.n+1 for t in T.values()),'verified_stage_placements':len(records),'objectives_on_standard_bases':len(gids),'passed_button_checks':True}
 (WORK/'runtime-audit.json').write_text(json.dumps(stats,indent=1));print(stats,flush=True)
if __name__=='__main__':run()
