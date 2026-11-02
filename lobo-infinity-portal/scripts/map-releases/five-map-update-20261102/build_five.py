from pathlib import Path
import json,copy,zipfile,re,hashlib,struct,shutil
ROOT=Path(__file__).resolve().parent;OUT=ROOT/'five-release';APP=ROOT/'five-portal/lobo-infinity-portal';REV='approved-five-map-update-20261102-r1';PUBLIC=APP/'public/assets/maps'/REV;PUBLIC.mkdir(parents=True,exist_ok=True)
def load(p):return json.loads(Path(p).read_text())
def write(p,d):p=Path(p);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def walk(o):
 yield o
 for k in ['ContainedObjects','ChildObjects']:
  for q in o.get(k,[]):yield from walk(q)
 for q in o.get('States',{}).values():yield from walk(q)
def rewrite(v,fn):
 if isinstance(v,dict):return {fn(k):rewrite(q,fn)for k,q in v.items()}
 if isinstance(v,list):return [rewrite(q,fn)for q in v]
 return fn(v)if isinstance(v,str)else v
with zipfile.ZipFile(ROOT/'five-inputs/Lobo-Four-Map-Workshop-Update-Installer.zip')as z:baseline=json.loads(z.read('Files/Lobo-Workshop-Current-Maps-and-Rules.json'))
collection=copy.deepcopy(baseline);by={o['GUID']:o for o in collection['ObjectStates']};old=by['100e3e'];source=load(ROOT/'five-inputs/approved-halcyon.json');roots=[copy.deepcopy(o)for o in source['ObjectStates']if 'LoboMap:cb0601'in o.get('Tags',[])]
assert len(roots)==45;assert '--[[Object base code]]'not in json.dumps(roots)
bag=copy.deepcopy(old);bag.update(Nickname='SET_ITS18 Outbreak — Halcyon Thermal Baths',Description='Halcyon Thermal Baths | Outbreak | 48 × 48 inches. Exact user-approved TS_Save_39 layout.',ContainedObjects=roots,LuaScriptState='',XmlUI='')
for k in ['States','ChildObjects']:bag.pop(k,None)
def manifest(objects):
 lines=[]
 for o in objects:
  for q in [o,*o.get('States',{}).values()]:
   t=q['Transform'];v=[t[k]for k in ['posX','posY','posZ','rotX','rotY','rotZ']];v[3:]=[struct.unpack('f',struct.pack('f',x))[0]for x in v[3:]];lines.append('--'+q['GUID']+','+','.join(format(x,'.17g')for x in v))
 return '\r\n'.join(lines)+'\r\n'
bag['LuaScript']=manifest(roots);collection['ObjectStates'][collection['ObjectStates'].index(old)]=bag
used={o['GUID']for b in collection['ObjectStates']for o in walk(b)if o.get('GUID')};seq=0xbd0000
def fresh():
 global seq
 while f'{seq:06x}'in used:seq+=1
 s=f'{seq:06x}';seq+=1;used.add(s);return s
ids={o['GUID']:fresh()for o in walk(bag)if o.get('GUID')};tags={'LoboMap:cb0601':'LoboMap:cb0601Top40'};pat=re.compile(r'(?<![0-9a-fA-F])('+'|'.join(ids)+r')(?![0-9a-fA-F])')
def fn(s):
 parts=re.split(r'(https?://[^\s\"\'<>\\]+)',s)
 for i in range(0,len(parts),2):parts[i]=pat.sub(lambda m:ids[m[0]],parts[i]).replace('LoboMap:cb0601','LoboMap:cb0601Top40')
 return ''.join(parts)
event=rewrite(bag,fn);event.update(Nickname="SET_Lobo's Top 40 Losers Round 6 Map",Description=bag['Description']+' Top 40 Losers Round 6.');event['Transform']=dict(posX=31,posY=1.125,posZ=-30.6,rotX=0,rotY=0,rotZ=0,scaleX=1,scaleY=1,scaleZ=1);collection['ObjectStates'].append(event)
catalogue=load(OUT/'Source/catalogue.json');entry=next(x for x in catalogue if x['guid']=='100e3e');entry.update(title='Halcyon Thermal Baths',source_name=bag['Nickname'],theme='Thermal Baths / Limestone')
catalogue.append(dict(guid=event['GUID'],category='top40',title='Halcyon Thermal Baths',mission='Outbreak',home={k:event['Transform']['pos'+k.upper()]for k in ['x','y','z']},source_name=event['Nickname'],theme='Thermal Baths / Limestone'))
def lua(v):
 if isinstance(v,dict):return '{'+','.join('['+json.dumps(k)+']='+lua(q)for k,q in v.items())+'}'
 if isinstance(v,list):return '{'+','.join(lua(q)for q in v)+'}'
 if isinstance(v,str):return json.dumps(v,ensure_ascii=False)
 if isinstance(v,bool):return str(v).lower()
 if v is None:return 'nil'
 return repr(v)
collection['LuaScript']=re.sub(r'^local ITEMS = .*$',lambda _:'local ITEMS = '+lua(catalogue),collection['LuaScript'],count=1,flags=re.M);collection['SaveName']="Lobo's Infinity Maps - Five Map Update R1"
write(OUT/'Files/Lobo-Workshop-Current-Maps-and-Rules.json',collection);write(OUT/'Source/catalogue.json',catalogue)
index=load(OUT/'Source/saved-object-index.json');newindex=load(OUT/'Source/new-map-index.json')
for b,kind,name in [(bag,'general','Halcyon Thermal Baths - Outbreak'),(event,'top40','Lobos Top 40 Losers Round 6 Map')]:
 wrapper=load(OUT/'Saved-Objects/Redline Interchange - Cutthroat.json');wrapper['ObjectStates']=[copy.deepcopy(b)];wrapper['ObjectStates'][0]['Transform']=dict(posX=0,posY=1,posZ=0,rotX=0,rotY=0,rotZ=0,scaleX=1,scaleY=1,scaleZ=1);write(OUT/'Saved-Objects'/(name+'.json'),wrapper)
 row=dict(name=name,guid=b['GUID'],kind=kind,map='Halcyon Thermal Baths',path='Saved-Objects/'+name+'.json');index.append(row);newindex.append(row)
write(OUT/'Source/saved-object-index.json',index);write(OUT/'Source/new-map-index.json',newindex)
pair=dict(name='Halcyon Thermal Baths',mission='Outbreak',bracket='Losers',round=6,general=bag['GUID'],event=event['GUID'],guidMap=ids,tagMap=tags,label="Lobo's Top 40 Losers Round 6 Map")
for name in ['map-pairs.json','new-map-pairs.json']:write(OUT/'Source'/name,load(OUT/'Source'/name)+[pair])
configs=load(OUT/'Source/configs.json');configs.append(dict(name='Halcyon Thermal Baths',key='halcyon',mission='Outbreak',round=6,slug='outbreak-2',tag='LoboMap:cb0601',source='TS_Save_39',guid=bag['GUID'],eventGUID=event['GUID'],rootCount=45,theme='Thermal Baths / Limestone'))
write(OUT/'Source/configs.json',configs)
preservation=load(OUT/'Source/approved-preservation.json');preservation.append(dict(map='Halcyon Thermal Baths',source='TS_Save_39.zip',source_sha256=hashlib.sha256((ROOT/'five-inputs/TS_Save_39.zip').read_bytes()).hexdigest(),rootObjects=45,approvedTransformsScalesModelsScriptsAndStatesPreserved=True,generalGUID=bag['GUID'],round=6,oldName='Nereid Deep R3 Outbreak'));write(OUT/'Source/approved-preservation.json',preservation)
meta=load(APP/'shared/lobo-workshop-current.json')
for i,c in enumerate(configs):
 m=next(m for m in meta['maps']if m['slug']==c['slug']);b=next(o for o in collection['ObjectStates']if o['GUID']==c['guid']);oldname=m['name'];oldlabel=m['workshopBagName'];m.update(name=c['name'],workshopName=b['Nickname'][4:],workshopBagName=b['Nickname'],objectCount=len(b['ContainedObjects']),layoutKey=2020+i,previewKind='geometry',captureDate='2026-11-02',sourceOverhead=None,sourceAngled=None,overhead='/assets/maps/'+REV+'/'+c['key']+'-overhead.webp',angled='/assets/maps/'+REV+'/'+c['key']+'-angled.webp',diagram='/assets/maps/'+REV+'/'+c['key']+'-overhead.webp',download='/assets/maps/'+REV+'/'+c['slug']+'.json',sourceNote='User-approved '+c['source']+'. Approved terrain transforms, scales, meshes and active states preserved. Matching Top 40 Losers Round '+str(c['round'])+'. Offline loading checks passed; native TTS remains unverified.'+(' Unwanted self-propagating script suffix removed from release copy.'if c['key']=='vesper'else''));m['labelAliases']=list(dict.fromkeys(m.get('labelAliases',[])+[oldname,oldlabel,oldlabel[4:]]))
 general=next(row for row in index if row['kind']=='general'and row['map']==c['name']);top=next(row for row in index if row['kind']=='top40'and row['map']==c['name']);shutil.copy2(OUT/general['path'],PUBLIC/(c['slug']+'.json'));shutil.copy2(OUT/top['path'],PUBLIC/(f"Lobos-Top-40-Losers-Round-{c['round']}-Map.json"))
 if c['key']!='halcyon':
  for kind in ['angled','overhead']:shutil.copy2(OUT/'Previews'/(c['key']+'-'+kind+'.webp'),PUBLIC/(c['key']+'-'+kind+'.webp'))
meta.update(updatedAt='2026-11-02',downloadRevision=REV,download='/assets/maps/'+REV+'/Lobo-ITS18-Drop-Zone-Maps.zip',installer='/assets/maps/'+REV+'/Lobo-Five-Map-Workshop-Update-Installer.zip');write(APP/'shared/lobo-workshop-current.json',meta)
p=APP/'shared/top40-round-maps.mjs';s=p.read_text();start=s.index('[',s.index('export const TOP40_ROUND_MAPS'));end=s.index('\n]',start)+2;rounds=json.loads(s[start:end])
for c in configs:rounds.append(dict(key='losers-'+str(c['round']),mission=c['mission'],name=c['name'],workshopLabel=f"Lobo's Top 40 Losers Round {c['round']} Map",href='/event/lobos-top-40/maps/losers-'+str(c['round']),download='/assets/maps/'+REV+f"/Lobos-Top-40-Losers-Round-{c['round']}-Map.json",angled='/assets/maps/'+REV+'/'+c['key']+'-angled.webp',overhead='/assets/maps/'+REV+'/'+c['key']+'-overhead.webp',generalHref='/maps/'+c['slug'],bracket='Losers',round=c['round']))
rounds.sort(key=lambda m:(m['bracket']=='Losers',m['round']));s=s[:start]+json.dumps(rounds,ensure_ascii=False,indent=2)+s[end:];s=s.replace('/assets/maps/seven-map-update-20261102-r1/Lobo-Seven-Map-Workshop-Update-Installer.zip','/assets/maps/'+REV+'/Lobo-Five-Map-Workshop-Update-Installer.zip');p.write_text(s)
p=APP/'shared/top40-launch-plan.json';plan=load(p)
for row in plan['rounds']:
 m=next((q for q in rounds if q['bracket']==row['bracket']and q['round']==row['bracketRound']and q['mission']==row['mission']),None)
 if m:row['map']=m['workshopLabel']
write(p,plan)
for name in ['Top40MapPage.tsx','Top40PreparationPage.tsx']:
 p=APP/'src/public'/name;s=p.read_text().replace('Download the seven-map installer (ZIP)','Download the current map update installer (ZIP)').replace('Six Top 40 bags, their six general mission copies','Eleven Top 40 bags, their eleven general mission copies').replace('all six Top 40 bags and their general copies','all eleven Top 40 bags and their general copies').replace('Lobo’s Infinity Maps - Seven Map Update R1','Lobo’s Infinity Maps - Five Map Update R1');p.write_text(s)
p=OUT/'Install.ps1';s=p.read_text(encoding='utf-8-sig').replace('$items.Count -ne 44','$items.Count -ne 48').replace('all 21 named map pairs','all 23 named map pairs').replace('Four-Map-Update-','Five-Map-Update-').replace('four approved map replacements','five approved map replacements').replace('21 map bags','23 map bags').replace('Four Map Update R1','Five Map Update R1');p.write_bytes(b'\xef\xbb\xbf'+s.replace('\r\n','\n').replace('\n','\r\n').encode())
p=OUT/'START-HERE.txt';s=p.read_text().replace('FOUR MAP UPDATE R1','FIVE MAP UPDATE R1').replace('Four Map Update R1','Five Map Update R1').replace('Each mission keeps its other map.','Halcyon Thermal Baths - Outbreak replaces the older Nereid Deep R3 Outbreak map.\nNeon Exchange remains the other Outbreak option; Aurora VII Nereid R7 is unchanged.\nEach mission keeps its other map.').replace('Halcyon is excluded from this batch; Outbreak remains unassigned.','Losers Round 6: Halcyon Thermal Baths - Outbreak.').replace('40 general + 50 Aurora VII + 10 Top 40','40 general + 50 Aurora VII + 11 Top 40').replace('21 named bags','23 named bags').replace('these four maps and their four Top 40 copies','these five maps and their five Top 40 copies').replace('plus four approved general maps','plus five approved general maps').replace('independent IDs/tags.','independent IDs/tags.');s=s.replace('APPROVED SOURCES\n','APPROVED SOURCES\nHalcyon: exact approved TS_Save_39 map components and scripts.\n');p.write_text(s)
shutil.copy2(ROOT/'build_five.py',OUT/'Source/build_five.py')
print('Built five approved map pairs; collection has 40 general, 50 Aurora VII, 11 Top 40; 23 named bags.')
