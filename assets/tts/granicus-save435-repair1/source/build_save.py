"""Apply only the two authorized Granicus Arrian visual repairs to save 435."""
import base64,copy,hashlib,json,re,sys
from pathlib import Path
import lz4.block
R=Path(__file__).resolve().parent
SOURCE=R.parent/'upload/TS_Save_435.json'
SOURCE_SHA='15f2bc5ae17436283389c0743dfb26ec140bf6b26570ad65b829c46aa5545b62'
commit=sys.argv[1]
assert re.fullmatch('[a-f0-9]{40}',commit)
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest()==SOURCE_SHA
original=json.loads(SOURCE.read_text());data=copy.deepcopy(original)
bag=data['ObjectStates'][3]['ContainedObjects'][0]
assert bag['GUID']=='e90100' and bag['Nickname']=='Granicus — Arrian strengths'
base=f'https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/{commit}/assets/tts/granicus-save435-repair1/'
meshes={x['original_url']:base+x['repaired_file'] for x in json.loads((R/'mesh-repair-manifest.json').read_text())}
atlases={x['original_url']:base+x['repaired_file'] for x in json.loads((R/'atlas-repair-manifest.json').read_text())}
changes=[]
for stand in bag['ContainedObjects'][1:]:
 for sid,state in [(1,stand),*[(int(k),v) for k,v in stand.get('States',{}).items()]]:
  script=state['LuaScript']
  assert script.count('self.createButton(')==1 and script.count('function ')==2 and script.startswith('function plaqueNoop() end')
  assert not state.get('LuaScriptState')
  state['LuaScript']='-- Standing label is part of the original model.\nfunction onLoad()\n self.clearButtons()\nend\n'
  entry={'guid':stand['GUID'],'state_guid':state['GUID'],'state':sid,'name':state['Nickname'],'flat_label_removed':True}
  cm=state['CustomMesh']
  if cm['MeshURL'] in meshes:cm['MeshURL']=meshes[cm['MeshURL']];entry['mesh_repaired']=True
  if cm['DiffuseURL'] in atlases:cm['DiffuseURL']=atlases[cm['DiffuseURL']];entry['atlas_repaired']=True
  changes.append(entry)
assert len(changes)==249
data['SaveName']='Clash of Empires - Save 435 - Granicus Arrian Repair 1'
# Whitelist the entire document diff, including every nested state.
diff=[]
def compare(a,b,path=()):
 if isinstance(a,dict):
  assert a.keys()==b.keys(),path
  for k in a:compare(a[k],b[k],path+(k,))
 elif isinstance(a,list):
  assert len(a)==len(b),path
  for i,(x,y) in enumerate(zip(a,b)):compare(x,y,path+(i,))
 elif a!=b:diff.append(path)
compare(original,data)
for p in diff:
 if p==('SaveName',):continue
 assert p[:5]==('ObjectStates',3,'ContainedObjects',0,'ContainedObjects'),p
 assert isinstance(p[5],int) and p[5]>0,p
 assert p[6:] in [('LuaScript',),('CustomMesh','MeshURL'),('CustomMesh','DiffuseURL')] or (p[6]=='States' and p[8:] in [('LuaScript',),('CustomMesh','MeshURL'),('CustomMesh','DiffuseURL')]),p
others=original['ObjectStates'][3]['ContainedObjects'][1:]
assert len(others)==36 and others==data['ObjectStates'][3]['ContainedObjects'][1:]
meta=json.loads(bag['GMNotes']);packed=json.loads(lz4.block.decompress(base64.b64decode(meta['r28_packed_layout']),uncompressed_size=meta['r28_layout_length']))
for o in bag['ContainedObjects']:
 slot=packed[packed['_guidSlots'][o['GUID']]]
 for key,field in [('mesh','MeshURL'),('texture','DiffuseURL'),('collider','ColliderURL')]:assert slot['assets'][key]==o['CustomMesh'][field]
assert data['LuaScript']==original['LuaScript'] and data['TabStates']==original['TabStates']
for t in (data['TabStates'].values() if isinstance(data['TabStates'],dict) else data['TabStates']):
 assert isinstance(t['color'],str) and isinstance(t['id'],int)
 assert all(isinstance(t['visibleColor'][k],(int,float)) for k in ['r','g','b'])
out=R/'installer';out.mkdir(exist_ok=True)
save=out/'Clash-of-Empires-Granicus-Arrian-435.json';save.write_text(json.dumps(data,ensure_ascii=False,indent=2))
validation={'source_file':'TS_Save_435.json','source_sha256':SOURCE_SHA,'save_sha256':hashlib.sha256(save.read_bytes()).hexdigest(),'asset_commit':commit,'battle':bag['Nickname'],'battle_guid':bag['GUID'],'stands':85,'troop_stands':79,'commanders':6,'states_checked':len(changes),'flat_label_scripts_removed':len(changes),'repaired_mesh_instances':sum(x.get('mesh_repaired',False) for x in changes),'restored_atlas_instances':sum(x.get('atlas_repaired',False) for x in changes),'unique_repaired_meshes':len(meshes),'unique_restored_atlases':len(atlases),'other_36_bags_unchanged':True,'roster_stats_deployment_and_global_rules_unchanged':True,'packed_deployment_asset_map_matches':True,'standing_label_geometry_and_pixels_preserved':True,'document_diffs_whitelisted':True,'changed_fields':len(diff),'live_TTS_tested':False,'Windows_installer_executed':False,'multiplayer_fresh_cache_tested':False}
(R/'save-validation.json').write_text(json.dumps(validation,indent=2));(R/'repaired-state-instances.json').write_text(json.dumps(changes,indent=2));print(json.dumps(validation,indent=2))
