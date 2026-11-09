import pathlib,json,copy,re,shutil,io,zipfile,hashlib,os
from PIL import Image
R=pathlib.Path(__file__).parent;D=R/'verdant-r5-preserved';P=R/'Verdant-Exchange-Detailed-Campus-R5-Installer';P.mkdir(exist_ok=True);(P/'Source').mkdir(exist_ok=True)
general=json.load(open(D/'Verdant-Exchange-R5.json'))['ObjectStates'][0]
mapping={general['GUID']:'03c892'}
def visit(o):
 mapping[o['GUID']]=f'{int(o["GUID"],16)+0x10000:06x}'
 for x in o.get('States',{}).values():visit(x)
for o in general['ContainedObjects']:visit(o)
rx=re.compile(r'(?<![0-9a-f])(?:'+('|'.join(mapping))+r')(?![0-9a-f])')
def transform(x):
 if isinstance(x,dict):return {k:transform(v) for k,v in x.items()}
 if isinstance(x,list):return [transform(v) for v in x]
 if isinstance(x,str):return rx.sub(lambda m:mapping[m[0]],x).replace('VerdantExchangeR1GeneralFinal','VerdantExchangeR1Top40Final')
 return x
tournament=transform(general)
oldtop=next(o for o in json.load(open(R/'live-decoded.json'))['ObjectStates'] if o['GUID']=='03c892')
for key in ['Transform','ColorDiffuse','Tags','GMNotes']:
 if key in oldtop:tournament[key]=copy.deepcopy(oldtop[key])
tournament['Nickname']="SET_Lobo's Top 40 Winners Round 3 Map";tournament['Description']+='\nTop 40 Winners Round 3 | Uplink Center'
for filename,bag in [('Verdant-Exchange-R5-General.json',general),('Verdant-Exchange-R5-Top40.json',tournament)]:json.dump({'ObjectStates':[bag]},open(P/filename,'w'),indent=2)
assert not set(mapping.keys()).intersection(mapping.values())
allids=[]
for bag in [general,tournament]:
 ps={}
 for l in bag['LuaScript'].splitlines():
  m=re.match('--([a-f0-9]{6}),(.+)',l)
  if m:ps[m[1]]=[float(v) for v in m[2].split(',')]
 guids=[]
 def check(o):
  guids.append(o['GUID']);assert o['GUID'] in ps
  for st in o.get('States',{}).values():check(st)
 for o in bag['ContainedObjects']:check(o)
 assert len(guids)==len(set(guids));allids.append(set(guids))
 assert len(bag['ContainedObjects'])==81
 text=json.dumps(bag);assert 'REVISION' not in text and 'file:///' not in text
 assert not any(n in text for n in ['campus-facade.obj','campus-art.obj','cover-2-0.obj','cover-2-1.obj'])
assert not allids[0].intersection(allids[1])
places=json.load(open(D/'design-manifest.json'))['placements'];objs=copy.deepcopy(general['ContainedObjects'])
def deploy(o):
 p=places[o['GUID']];o['Transform'].update(dict(zip(['posX','posY','posZ','rotX','rotY','rotZ'],p)))
 for st in o.get('States',{}).values():deploy(st)
for o in objs:deploy(o)
title='Verdant Exchange - Detailed Campus R5 Review';collectiontitle="Lobo's Infinity Maps - Verdant Detailed Campus R5 Review"
review={'SaveName':title,'Date':'11/8/2026','VersionNumber':'v14.2.2','GameMode':'Verdant Exchange | Uplink Center','Gravity':.5,'PlayArea':.5,'Table':'Table_None','Sky':'Sky_Field','LuaScript':'','LuaScriptState':'','XmlUI':'','ObjectStates':objs}
json.dump(review,open(P/'Map-Review.json','w'),indent=2)
collection=json.load(open(R/'live-decoded.json'));before=copy.deepcopy(collection)
for i,o in enumerate(collection['ObjectStates']):
 if o['GUID']==general['GUID']:collection['ObjectStates'][i]=copy.deepcopy(general)
 elif o['GUID']==tournament['GUID']:collection['ObjectStates'][i]=copy.deepcopy(tournament)
collection['SaveName']=collectiontitle
assert all(a==b for a,b in zip(before['ObjectStates'],collection['ObjectStates']) if a['GUID'] not in ['1010b1','03c892'])
json.dump(collection,open(P/'Collection-Review.json','w'),separators=(',',':'))

# Use the corrected installer which patches two bag spans and preserves other maps.
old=R/'Verdant-Exchange-Living-Collections-R2-Installer'
cs=(old/'Source/CollectionPatch.cs').read_text().replace('VerdantJsonR3','VerdantJsonR5').replace('VerdantSpanR3','VerdantSpanR5');(P/'Source/CollectionPatch.cs').write_text(cs)
ps=(old/'Install.ps1').read_text().replace('VerdantJsonR3','VerdantJsonR5').replace('LoboBackups\\Verdant-R3','LoboBackups\\Verdant-R5').replace('Verdant-Exchange-Living-Collections-R2.json','Verdant-Exchange-R5-General.json').replace('Lobos-Top-40-Winners-Round-3-R2.json','Verdant-Exchange-R5-Top40.json')
ps=ps.replace("$mapTitle = 'Verdant Exchange - Asymmetric R3 Review'","$mapTitle = '"+title+"'")
ps=ps.replace('$collectionTitle = "Lobo\'s Infinity Maps - Verdant Asymmetric R3 Review"','$collectionTitle = "'+collectiontitle+'"')
ps=ps.replace("@($mapTitle,'Verdant Exchange - Living Collections R2 Review')","@($mapTitle,'Verdant Exchange - Living Collections R2 Review','Verdant Exchange - Asymmetric R3 Review','Verdant Exchange - Campus Rebuild R4 Review')")
ps=ps.replace('@($collectionTitle,"Lobo\'s Infinity Maps - Verdant Living Collections R2 Review")','@($collectionTitle,"Lobo\'s Infinity Maps - Verdant Living Collections R2 Review","Lobo\'s Infinity Maps - Verdant Asymmetric R3 Review","Lobo\'s Infinity Maps - Verdant Campus Rebuild R4 Review")')
ps=ps.replace("@('Verdant-Exchange-Living-Collections-R2','Lobos-Top-40-Winners-Round-3-R2')","@('Verdant-Exchange-R5-General','Verdant-Exchange-R5-Top40')").replace('Load > Verdant Exchange - Asymmetric R3 Review','Load > '+title)
ps=ps.replace("Write-Host ''\nWrite-Host 'Updated", """# Retire only the exact older saved-object files installed by the previous packages.
foreach ($legacy in @('Verdant-Exchange-Living-Collections-R2','Lobos-Top-40-Winners-Round-3-R2','Verdant-Exchange-R4-General','Verdant-Exchange-R4-Top40')) {
 $file = Join-Path $objects ($legacy + '.json')
 if (Test-Path -LiteralPath $file) {
  $dir = Join-Path $backup 'LegacyObjects'; New-Item -ItemType Directory -Force -Path $dir | Out-Null
  Copy-Item -LiteralPath $file -Destination (Join-Path $dir ($legacy + '.json'))
  Remove-Item -LiteralPath $file
  $png = [IO.Path]::ChangeExtension($file,'.png'); if (Test-Path -LiteralPath $png) { Move-Item -LiteralPath $png -Destination (Join-Path $dir ($legacy + '.png')) }
 }
}
Write-Host ''
Write-Host 'Updated""".replace('\n+','\n'))
(P/'Install.ps1').write_text(ps);(P/'Install.cmd').write_text('@echo off\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install.ps1"\r\npause\r\n')
for n in ['Verdant-R5-Overview.jpg','Verdant-R5-Overhead.jpg','Verdant-R5-Interiors.jpg']:shutil.copy(D/n,P/n)
thumb=Image.open(D/'Verdant-R5-Overview.jpg');thumb.thumbnail((640,640));thumb.save(P/'Preview.png',optimize=True)
for n in ['rebuild_verdant_r5.py','validate_verdant_r5.py','render_verdant_r5.py','package_verdant_r5.py']:shutil.copy(R/n,P/'Source'/n)
for n in ['design-manifest.json','validation.json','public-asset-verification.json']:shutil.copy(D/n,P/n)
(P/'START-HERE.txt').write_text('''VERDANT EXCHANGE - DETAILED CAMPUS R5 - ORIGINAL MAT RESTORED

Extract this ZIP, then run Install.cmd.
TTS > Games > Save & Load > Verdant Exchange - Detailed Campus R5 Review
The map opens already deployed, with roofs on. Right-click a building and choose
States to expose its ground floor or upper floor. Roof access is modeled inside.

The original approved mat and detailed building assets are preserved, including
all meshes, textures, colliders, interior detail and floor/roof states. The two
DZs have different layouts, populated edges and additional functional cover. The western DZ
contains the seed library, research court, propagation rooms and botanical clinic.
The eastern DZ contains biosecurity receiving, cold-chain dispatch and water
recovery. The compact living conservatory sits outside the deployment zones.

Both general Verdant and Top 40 Winners Round 3 are included. The three Uplink
Center objectives retain their mission positions. The installed collection
candidate patches only those two map bags into your newest eligible local Lobo
collection. Other maps are preserved. If no eligible local collection exists,
the bundled November 8 snapshot is used as a fallback.

The installer replaces matching older R2/R3/R4/R5 review saves. Previous files are
backed up outside the TTS Saves folder. New R5 saved-object bags replace the exact
older saved-object filenames installed by our earlier Verdant packages.

Fifteen detailed campus buildings use the approved original assets. The two long
bridges and two peripheral open propagation houses are removed. Equipment and
planting form protected approaches and fill edge/corner spaces. Department signs
are flush-mounted; small botanical plaques are integrated into planting beds.
There are 43 functional equipment and planting groups, plus specimen trees.
The oversized entrance frames and freestanding rusty display panels are absent.

Geometry checks: 1-inch base routes connect both DZs to all objectives, both DZs
have multiple clear exits, no mirrored building centres, and no sampled high roof
position sees all three objectives. Maximum sampled distance to cover: 4.08 inches.
These are geometry checks; live TTS loading and gameplay testing remain unverified.

All model assets use public HTTPS URLs; new assets are revision-pinned. No local
asset installation is required. Steam Workshop has not been updated. After review,
load the full collection candidate and use Update Workshop for item 3719263238.
''')
zipfile_path=R/'Verdant-Exchange-Detailed-Campus-R5-Installer.zip'
stream=io.BytesIO()
with zipfile.ZipFile(stream,'w',zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=False) as z:
 for p in sorted(P.rglob('*')):
  if p.is_file():
   raw=p.read_bytes()
   if p.suffix=='.json':json.loads(raw)
   z.writestr(str(p.relative_to(P)),raw)
data=stream.getvalue();tmp=zipfile_path.with_suffix('.complete');tmp.write_bytes(data);os.replace(tmp,zipfile_path)
with zipfile.ZipFile(zipfile_path) as z:
 assert z.testzip() is None
 for n in z.namelist():
  if n.endswith('.json'):json.loads(z.read(n))
verification={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'entries':len(z.infolist()),'zip_directory_present':data.rfind(b'PK\x05\x06')>=0}
json.dump(verification,open(D/'archive-verification.json','w'),indent=2);print(json.dumps(verification))
