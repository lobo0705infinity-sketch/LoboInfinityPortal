from pathlib import Path
import json,copy,struct
R=Path(__file__).resolve().parent;O=R/'five-release';P=R/'five-portal/lobo-infinity-portal/public/assets/maps/approved-five-map-update-20261102-r1'
def load(p):return json.loads(p.read_text())
def write(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
c=load(O/'Files/Lobo-Workshop-Current-Maps-and-Rules.json');pairs=load(O/'Source/new-map-pairs.json');pair=next(p for p in pairs if p['name']=='Halcyon Thermal Baths');bags={o['GUID']:o for o in c['ObjectStates']};a,b=bags[pair['general']],bags[pair['event']]
original=next(o for o in a['ContainedObjects']if o['GUID']=='bde668');alternate=original['States']['2'];assert alternate['GUID']=='3f0565';alternate['GUID']='bdf000'
eventOriginal=next(o for o in b['ContainedObjects']if o['GUID']==pair['guidMap']['bde668']);assert eventOriginal['States']['2']['GUID']==pair['guidMap']['3f0565'];eventOriginal['States']['2']['GUID']='bdf001'
pair['guidMap']['bdf000']='bdf001'
def manifest(roots):
 lines=[]
 for o in roots:
  for q in [o,*o.get('States',{}).values()]:
   t=q['Transform'];v=[t[k]for k in ['posX','posY','posZ','rotX','rotY','rotZ']];v[3:]=[struct.unpack('f',struct.pack('f',x))[0]for x in v[3:]];lines.append('--'+q['GUID']+','+','.join(format(x,'.17g')for x in v))
 return '\r\n'.join(lines)+'\r\n'
for bag in [a,b]:bag['LuaScript']=manifest(bag['ContainedObjects'])
write(O/'Files/Lobo-Workshop-Current-Maps-and-Rules.json',c)
for f in ['new-map-pairs.json','map-pairs.json']:
 ps=load(O/'Source'/f);ps=[pair if p['name']=='Halcyon Thermal Baths'else p for p in ps];write(O/'Source'/f,ps)
for name,bag,public in [('Halcyon Thermal Baths - Outbreak',a,'outbreak-2.json'),('Lobos Top 40 Losers Round 6 Map',b,'Lobos-Top-40-Losers-Round-6-Map.json')]:
 path=O/'Saved-Objects'/(name+'.json');d=load(path);transform=d['ObjectStates'][0]['Transform'];d['ObjectStates']=[copy.deepcopy(bag)];d['ObjectStates'][0]['Transform']=transform;write(path,d);write(P/public,d)
ps=load(O/'Source/approved-preservation.json');row=ps[-1];row.pop('approvedTransformsScalesModelsScriptsAndStatesPreserved',None);row.update(approvedTransformsScalesModelsScriptsAndActiveStatesPreserved=True,alternateStateIdentityNormalization={'bde668/States/2':'3f0565 -> bdf000'},reason='Copied active building used the same GUID as another building alternate state; both instances require separate identities.');write(O/'Source/approved-preservation.json',ps)
print('Normalized one colliding alternate-state ID in each Halcyon copy.')
