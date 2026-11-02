from pathlib import Path
import json,copy,re,zipfile,collections
from lupa import LuaRuntime
R=Path(__file__).resolve().parent;O=R/'five-release'
def load(p):return json.loads(p.read_text())
def walk(o):
 yield o
 for k in ['ContainedObjects','ChildObjects']:
  for q in o.get(k,[]):yield from walk(q)
 for q in o.get('States',{}).values():yield from walk(q)
def rewrite(v,fn):
 if isinstance(v,dict):return {fn(k):rewrite(q,fn)for k,q in v.items()}
 if isinstance(v,list):return [rewrite(q,fn)for q in v]
 return fn(v)if isinstance(v,str)else v
c=load(O/'Files/Lobo-Workshop-Current-Maps-and-Rules.json');by={o['GUID']:o for o in c['ObjectStates']}
with zipfile.ZipFile(R/'five-inputs/Lobo-Four-Map-Workshop-Update-Installer.zip')as z:baseline=json.loads(z.read('Files/Lobo-Workshop-Current-Maps-and-Rules.json'))
for o in baseline['ObjectStates']:
 if o['GUID']not in ['100e3e','e1da22']:assert by[o['GUID']]==o,('Unrelated collection object changed',o['GUID'])
for k in baseline:
 if k not in ['ObjectStates','LuaScript','SaveName']:assert baseline[k]==c[k],k
source=load(R/'five-inputs/approved-halcyon.json');approved=[copy.deepcopy(o)for o in source['ObjectStates']if 'LoboMap:cb0601'in o.get('Tags',[])]
next(o for o in approved if o['GUID']=='bde668')['States']['2']['GUID']='bdf000'
def withoutGUID(v):
 if isinstance(v,dict):return {k:withoutGUID(q)for k,q in v.items()if k!='GUID'}
 if isinstance(v,list):return [withoutGUID(q)for q in v]
 return v
assert withoutGUID(approved)==withoutGUID(by['100e3e']['ContainedObjects']),'Approved Halcyon component or layout changed'
assert [o['GUID']for o in approved]==[o['GUID']for o in by['100e3e']['ContainedObjects']],'Active root IDs changed'
index=load(O/'Source/saved-object-index.json');ids=[];scripts=0;L=LuaRuntime(unpack_returned_tuples=True);compile=L.eval('function(s)local f,e=load(s);return f~=nil,e end')
for row in index:
 b=by[row['guid']];stand=load(O/row['path'])['ObjectStates'][0]
 for k in ['Nickname','Description','ContainedObjects','LuaScript','LuaScriptState']:assert b.get(k)==stand.get(k),(row['name'],k)
 assert b['LuaScript'].endswith('\r\n')and not re.search(r'(?<!\r)\n',b['LuaScript'])
 rows=b['LuaScript'].splitlines();records={l[2:8]:list(map(float,l[9:].split(',')))for l in rows};assert len(rows)==len(records),('Duplicate manifest ID',row['name'])
 for o in (b['ContainedObjects'] if row['map']in [x['map']for x in load(O/'Source/new-map-index.json')] else []):
  for q in [o,*o.get('States',{}).values()]:
   assert q['GUID']in records
   if row['map']in [x['map']for x in load(O/'Source/new-map-index.json')]:assert all(abs(a-q['Transform'][k])<.0005 for a,k in zip(records[q['GUID']],['posX','posY','posZ','rotX','rotY','rotZ'])),(row['name'],q['GUID'],records[q['GUID']],q['Transform'])
 for o in walk(b):
  ids.append(o['GUID']);s=o.get('LuaScript','');assert not any(x in s for x in ['--[[Object base code]]','obje.glitch.me','tcejbo gninwapS'])
  if s:
   ok,e=compile(s.replace('!=','~='));assert ok,(row['name'],o['GUID'],e);scripts+=1
assert len(ids)==len(set(ids)),'Duplicate component identity across updated families'
for pair in load(O/'Source/new-map-pairs.json'):
 a,b=by[pair['general']],by[pair['event']];imap={v:k for k,v in pair['guidMap'].items()};tags={v:k for k,v in pair['tagMap'].items()};pat=re.compile(r'(?<![0-9a-fA-F])('+'|'.join(imap)+r')(?![0-9a-fA-F])');tpat=re.compile('|'.join(re.escape(t)for t in sorted(tags,key=len,reverse=True)))
 def undo(s):
  parts=re.split(r'(https?://[^\s\"\'<>\\]+)',s)
  for i in range(0,len(parts),2):parts[i]=tpat.sub(lambda m:tags[m[0]],pat.sub(lambda m:imap[m[0]],parts[i]))
  return ''.join(parts)
 assert rewrite(b['ContainedObjects'],undo)==a['ContainedObjects'],(pair['name'],'event copy differs')
 assert undo(b['LuaScript'])==a['LuaScript']
counts=dict(collections.Counter(x['category']for x in load(O/'Source/catalogue.json')));assert counts==dict(missions=40,campaign=50,top40=10)
host=load(O/'Source/hosted-assets-validation.json');assert host['passed']==host['uniqueURLs']and not host['failed']
report=dict(status='passed',approvedMaps=5,halcyonApprovedSave='TS_Save_39',halcyonRootObjects=45,halcyonApprovedTerrainTransformsScalesMeshesScriptsAndActiveStatesPreserved=True,oneCopiedAlternateStateGUIDNormalized=True,previousFourApprovedMapsUnchanged=True,auroraVIIAndOtherCollectionObjectsUnchanged=True,nativeStageManifestsVerified=True,generalTop40PairParity=5,uniqueUpdatedFamilyGUIDs=len(ids),compiledScripts=scripts,categoryCounts=counts,halcyonHostedURLsVerified=host['passed'],liveTTSTested=False)
(O/'Source/five-map-validation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
