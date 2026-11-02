"""Execute the actual anchor cleanup, greenhouse glazing and controller scripts."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
source=(ROOT/'Source/test_controls.py').read_text()
exec(source[:source.index('results=[]')])
b=json.loads((ROOT/'Map-Bags/Verdant-Exchange-Uplink-Center-R1.json').read_text())['ObjectStates'][0]
control=loadbag(b)
anchor=next(d for d in b['ContainedObjects']if 'ground' in d['Tags'])
mat=G.getObjectFromGUID(anchor['GUID']);G.runScript(mat,anchor['LuaScript']);mat.env.onLoad()
shells=[d for d in b['ContainedObjects']if 'glass' in d['Tags']]
for d in shells:
 o=G.getObjectFromGUID(d['GUID']);G.runScript(o,d['LuaScript']);o.env.onLoad()
G.advance(30)
for d in shells:
 o=G.getObjectFromGUID(d['GUID']);assert abs(o.getPosition().x-d['Transform']['posX'])<1e-6
# Expose every conservatory; glazing must park, then return to its measured home.
for d in shells:
 parent=json.loads(re.search(r'local parent=(".*")',d['LuaScript'])[1])
 original=next(o for o in b['ContainedObjects']if o['GUID']==parent)
 G.destroy(parent);G.makeObject(table(original['States']['2']));G.advance(22)
 assert G.getObjectFromGUID(d['GUID']).getPosition().x==90
 G.destroy(original['States']['2']['GUID']);G.makeObject(table(original));G.advance(22)
 assert abs(G.getObjectFromGUID(d['GUID']).getPosition().x-d['Transform']['posX'])<1e-6
# Clear with alternate states selected, including parked glazing outside table bounds.
for d in b['ContainedObjects']:
 if d.get('States'):
  G.destroy(d['GUID']);G.makeObject(table(d['States'].get('3',d['States']['2'])))
G.advance(30)
sentinel=G.makeObject(table({'GUID':'998877','Nickname':'Unrelated player miniature'}))
G.destroy(anchor['GUID']);G.advance(90)
for d in b['ContainedObjects']:
 for q in [d]+list(d.get('States',{}).values()):assert G.getObjectFromGUID(q['GUID'])is None,q['Nickname']
assert G.getObjectFromGUID('998877')is not None
G.assertNoMapUI();assert G.backgroundURL=='original'
report={'status':'passed','glazing_shells_tested':len(shells),'roof_removal_and_return':'passed','alternate_state_and_parked_glazing_cleanup':'passed','unrelated_miniature_preserved':'passed','background_and_ui_cleanup':'passed','live_TTS_tested':False}
(ROOT/'Source/lifecycle-validation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
