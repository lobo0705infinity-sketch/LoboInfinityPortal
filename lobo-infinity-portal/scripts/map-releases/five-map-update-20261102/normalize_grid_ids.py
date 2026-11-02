from pathlib import Path
import json,copy,re,struct
R=Path(__file__).resolve().parent;O=R/'five-release';P=R/'five-portal/lobo-infinity-portal/public/assets/maps/approved-five-map-update-20261102-r1'
def load(p):return json.loads(p.read_text())
def write(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
def walk(o):
 yield o
 for k in ['ContainedObjects','ChildObjects']:
  for q in o.get(k,[]):yield from walk(q)
 for q in o.get('States',{}).values():yield from walk(q)
def rewrite(v,fn):
 if isinstance(v,dict):return {fn(k):rewrite(q,fn)for k,q in v.items()}
 if isinstance(v,list):return [rewrite(q,fn)for q in v]
 return fn(v)if isinstance(v,str)else v
c=load(O/'Files/Lobo-Workshop-Current-Maps-and-Rules.json');by={o['GUID']:o for o in c['ObjectStates']};pairs=load(O/'Source/new-map-pairs.json');pair=next(p for p in pairs if p['name']=='Halcyon Thermal Baths');a=by[pair['general']];oldb=by[pair['event']]
used={o['GUID']for b in c['ObjectStates']for o in walk(b)};counter=0xbe0000
def fresh():
 global counter
 while f'{counter:06x}'in used:counter+=1
 s=f'{counter:06x}';used.add(s);counter+=1;return s
seen=set();changed=[]
for o in walk(a):
 if o['GUID']in seen:
  assert o.get('Nickname')=='Horizontal grid surfaces';old=o['GUID'];o['GUID']=fresh();changed.append(dict(previous=old,new=o['GUID'],name=o['Nickname']))
 seen.add(o['GUID'])
ids={o['GUID']:fresh()for o in walk(a)};ids[a['GUID']]=oldb['GUID'];pat=re.compile(r'(?<![0-9a-fA-F])('+'|'.join(ids)+r')(?![0-9a-fA-F])')
def fn(s):
 parts=re.split(r'(https?://[^\s\"\'<>\\]+)',s)
 for i in range(0,len(parts),2):parts[i]=pat.sub(lambda m:ids[m[0]],parts[i]).replace('LoboMap:cb0601','LoboMap:cb0601Top40')
 return ''.join(parts)
b=rewrite(a,fn)
for k in ['Nickname','Description','Transform']:b[k]=oldb[k]
c['ObjectStates'][c['ObjectStates'].index(oldb)]=b;pair['guidMap']=ids
write(O/'Files/Lobo-Workshop-Current-Maps-and-Rules.json',c)
for f in ['new-map-pairs.json','map-pairs.json']:
 ps=load(O/'Source'/f);write(O/'Source'/f,[pair if p['name']=='Halcyon Thermal Baths'else p for p in ps])
for name,bag,public in [('Halcyon Thermal Baths - Outbreak',a,'outbreak-2.json'),('Lobos Top 40 Losers Round 6 Map',b,'Lobos-Top-40-Losers-Round-6-Map.json')]:
 path=O/'Saved-Objects'/(name+'.json');d=load(path);t=d['ObjectStates'][0]['Transform'];d['ObjectStates']=[copy.deepcopy(bag)];d['ObjectStates'][0]['Transform']=t;write(path,d);write(P/public,d)
pres=load(O/'Source/approved-preservation.json');pres[-1]['attachedGridSurfaceIdentitiesNormalized']=changed;write(O/'Source/approved-preservation.json',pres)
print('Normalized',len(changed),'copied grid attachment IDs; geometry and transforms unchanged.')
