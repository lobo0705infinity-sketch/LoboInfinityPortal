from pathlib import Path
import json,subprocess,tempfile,hashlib,zipfile,io
R=Path(__file__).resolve().parents[2];D=R/'map-fixes/dig-20261124';payload=D/'package/Files/payload.zip';baseline=Path('/workspace/scratch/0474749e36c3/r14-payload/Workshop-Save.json');src=json.loads(baseline.read_text())
def maps(o):
 if isinstance(o,dict):
  if o.get('Name')=='Bag'and o.get('Nickname','').startswith('SET_'):yield o
  for c in o.get('ContainedObjects',[]):yield from maps(c)
def index(d):return {o['GUID']:o for root in d['ObjectStates']for o in maps(root)}
results=[]
for existing in [False,True]:
 with tempfile.TemporaryDirectory()as td:
  root=Path(td);sd=root/'Saves';sd.mkdir();original=json.loads(baseline.read_text())
  if existing:
   original['Description']='Preserve personal collection metadata';index(original)['af0667']['Description']='Preserve approved newer map'
   (sd/'TS_Save_1.json').write_text(json.dumps(original));saved=(sd/'TS_Save_1.json').read_bytes()
  r=subprocess.run([str(D/'installer-test-bin'),'--tts-root',str(root),'--payload',str(payload),'--no-browser','--no-pause'],capture_output=True,text=True);assert r.returncode==0,(r.stdout,r.stderr)
  out=sd/('TS_Save_2.json'if existing else'TS_Save_1.json');d=json.loads(out.read_text());before=index(original);after=index(d);assert len(after)==105
  for k in before:
   if k not in ['810340','8a1c29']:assert before[k]==after[k],k
  if existing:assert (sd/'TS_Save_1.json').read_bytes()==saved;assert d['Description']==original['Description']
  for k in ['810340','8a1c29']:assert 'dig-access-20261124'in json.dumps(after[k]);assert 'Old Quarter Excavation - The Dig'in json.dumps(after[k])
  results.append({'existing_collection':existing,'maps':len(after),'other_103_maps_preserved':True,'new_save_created':True})
(D/'installer-validation.json').write_text(json.dumps(results,indent=2));print(json.dumps(results))
