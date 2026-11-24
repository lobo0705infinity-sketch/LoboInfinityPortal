from pathlib import Path
import json,subprocess,tempfile,zipfile
R=Path(__file__).resolve().parents[2];D=R/'map-fixes/dig-20261124'
payload=D/'package/Files/payload.zip'
with zipfile.ZipFile(payload)as z:expected=json.loads(z.read('Workshop-Save.json'))
# The baseline contains collection furniture/tools and bagged maps only.
allowed={'100001','100002','100003','100004','100005','100006','100007','100008','056963','004b99','2522fc','2d647a','6c5d2b','81d168'}|{f'f000{i:02x}'for i in range(16)}
for o in expected['ObjectStates']:
 assert o['Name']=='Bag'or o['GUID']in allowed,(o['GUID'],o.get('Nickname'))
 assert 'LoboMapUIBroker'not in str(o.get('Tags',[]))
 assert not(o.get('Name')!='Bag' and 'function loboStandardState()'in o.get('LuaScript',''))
results=[]
for contaminated in [False,True]:
 with tempfile.TemporaryDirectory()as td:
  root=Path(td);sd=root/'Saves';sd.mkdir()
  if contaminated:
   bad=json.loads(json.dumps(expected));bad['ObjectStates'].append({'GUID':'bad001','Name':'Custom_Model','Nickname':'Already deployed unrelated map','LuaScript':'function onLoad() end'})
   bad['ObjectStates'].append({'GUID':'bad002','Name':'BlockSquare','Tags':['LoboMapUIBrokerV4'],'Nickname':'Stale map controls'})
   bad['XmlUI']='<Panel id="unrelatedMapControls" />';bad['LuaScriptState']='stale active map'
   old=sd/'TS_Save_1.json';old.write_text(json.dumps(bad));original=old.read_bytes()
  r=subprocess.run([str(D/'installer-test-bin'),'--tts-root',str(root),'--payload',str(payload),'--no-browser','--no-pause'],capture_output=True,text=True)
  assert r.returncode==0,(r.stdout,r.stderr)
  out=sd/('TS_Save_2.json'if contaminated else'TS_Save_1.json');actual=json.loads(out.read_text());assert actual==expected,'Imported local session state'
  if contaminated:assert old.read_bytes()==original,'Overwrote existing save'
  results.append({'contaminated_local_save':contaminated,'output_matches_clean_collection':True,'active_map_not_imported':True,'existing_save_preserved':True})
(D/'clean-installer-validation.json').write_text(json.dumps(results,indent=2));print(json.dumps(results))
