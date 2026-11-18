from test_standard import *
from test_zones import PALETTE
(ROOT/'audit').mkdir(exist_ok=True)
D=json.loads((ROOT/'output/Workshop-Save.json').read_text());report=[]
for index in [1,3,6,8,44,47,105]:
 b=list(bags(D))[index-1];w=RealWorld(b);w.load();w.click('dz_4');w.click('turn');w.click('grid')
 root='loboMission_ZoneColors_'+w.primary['GUID'];player={'color':'White'}
 for kind in ['deployment','exclusion']:
  for n in range(1,8):
   old=copy.deepcopy(w.source());w.call('loboZonePickColor',player,'',root+'_pick_'+kind+'_'+str(n));w.advance(3)
   assert w.tables[w.mat]['LoboZoneColorsR1'][kind]==n
   assert w.source()==old,'Color changed zone geometry'
   check_render(w)
 transforms={k:copy.deepcopy(o['Transform'])for k,o in w.items.items()};saved={k:g.onSave()if g.onSave else''for k,(rt,g)in w.run.items()}
 w2=RealWorld(b)
 for k,t in transforms.items():w2.items[k]['Transform'].update(t)
 w2.load(saved)
 assert py(w2.call('loboStandardState'))['flipped']is True
 assert w2.tables[w2.mat]['LoboZoneColorsR1']=={'deployment':7,'exclusion':7}
 w2.click('dz_8');check_render(w2)
 # Closing one player's panel must leave another player's controls visible.
 rt,g=w2.run['broker'];g.loboDrawerClose(rt.table_from({'color':'White'}));w2.advance(1)
 assert 'White'not in w2.panel().get('visibility','').split('|')
 assert 'Blue'in w2.panel().get('visibility','').split('|')
 g.loboDrawerToggle(rt.table_from({'color':'White'}));w2.advance(1)
 # Unrelated player pieces rotate with the board but survive Clear Table.
 probe={'GUID':'probe1','Name':'Figurine','Transform':{'posX':5,'posY':5,'posZ':3,'rotX':0,'rotY':15,'rotZ':0},'Locked':False}
 w2.items['probe1']=probe
 w2.click('turn');assert probe['Transform']['posX']==-5 and probe['Transform']['posZ']==-3
 assert not probe['Locked']
 w2.click('clear',expected=False);assert 'probe1'not in w2.dead and w2.mat in w2.dead
 report.append({'map':b['GUID'],'passed':True});print(index,'PASS',flush=True)
(ROOT/'audit/persistence.json').write_text(json.dumps({'passed':True,'checks':['all seven colors independently','geometry unchanged by colors','rotated save/reload','per-player panel visibility','player-piece rotation and lock restoration','clear preserves player pieces'],'maps':report},indent=2))
