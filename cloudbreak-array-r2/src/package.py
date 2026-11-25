"""Apply Cloudbreak R2 to its shipped play table, setup bag, and Workshop collection."""
from copy import deepcopy
import re,sys
from project import *
CLOUDS=json.loads((WORK/'clouds.json').read_text())
AIR='Open air between buildings is impassable. Only Troopers with Terrain (Zero-G) or Terrain (Total) may move through it. All Troopers may use the bridges.'
RULES=AIR+'\n\nThe city and distant mist below the table are scenery. The '+str(len(CLOUDS))+' named cloud banks are Zero Visibility Zones. Map-specific options > Cloud boundaries shows each footprint and its vertical limits. Apply the normal Visibility and equipment rules. Parapets, rooftop equipment and the aerostat gondola provide ordinary scenery cover.\n\nUse each tower\'s States menu to enter it. State 1 opens its lowest floor. The highest state shows the roof. Yellow internal ladders connect the levels. Lift figures before hiding their supporting floor.\n\nRelay A is on Cable Drum, B is inside Transit Arcade on level 2, C is on Aerostat Pier, and D is on Isobar Observatory\'s level 3 terrace. The Primary Node is on the Switching House roof.'
SIGNED='https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/'
shared=next(v for vals in json.loads((WORK/'sky-candidates.json').read_text()).values() for v in vals if v.endswith('/background-off.jpg'))
CONFIG=re.compile(r'^(\s*local config=JSON\.decode\()(.*)(\)\s*)$',re.M)
def dumps(v):return json.dumps(v,ensure_ascii=True,separators=(',',':'))
def gid(v):return hashlib.sha1(('Cloudbreak R2 '+v).encode()).hexdigest()[:6]
def modes(prefix):return {'day':prefix+'sky-day.jpg','night':prefix+'sky-night.jpg','off':shared}
def patch_controller(script,cloudguids,prefix):
 def cfg(m):
  v=json.loads(json.loads(m[2]))
  if 'rules'in v:
   v.update(rules=RULES,clouds=[[c['x'],c['z'],c['rx'],c['rz'],round(c['lo']-MAT_Y,3),round(c['hi']-MAT_Y,3)] for c in CLOUDS],background=modes(prefix))
  else:v['guids'].update({g:True for g in cloudguids})
  return m[1]+dumps(dumps(v))+m[3]
 return CONFIG.sub(cfg,script)
def author(pin):
 prefix=SIGNED+pin+'/cloudbreak-array-r2/assets/';items=[];bank=[o for o in world if slug(o)=='cloud-bank'];cloudids=[bank[i]['GUID'] if i<len(bank) else gid(c['name']) for i,c in enumerate(CLOUDS)]
 def retexture(o,model,tex):
  mesh=o['CustomMesh'];mesh.update(MeshURL=prefix+model+'.obj',ColliderURL=prefix+model+'-col.obj',DiffuseURL=prefix+tex)
 def revise(o):
  m=slug(o);o['GMNotes']=o.get('GMNotes','').replace('CloudbreakArrayR1','CloudbreakArrayR2')
  if m.startswith(('tower-','bridge-')) or m=='moored-aerostat':retexture(o,m,MATERIAL)
  if m.startswith('tower-'):
   count=T[m.split('-')[1]].n
   history={1:'State 1 opens the interior.',2:'States 1 and 2 open their respective floors.',3:'States 1, 2 and 3 open their respective floors.'}
   o['Description']=history[count]+f' State {count+1} shows the roof. Yellow ladders connect the levels. The lit windows below Level 1 show the tower continuing into the clouds.'
  if m=='moored-aerostat':o['Description']='Moored cargo aerostat. The framed cockpit and enclosed freight gondola provide scenery cover.'
  if m in ('bridge-open','bridge-service'):o['Description']+=' with solid side panels. Both landings are open.'
  for s in o.get('States',{}).values():revise(s)
 for src in world:
  o=deepcopy(src);m=slug(o)
  if m=='cloud-bank':
   if src is not bank[0]:continue
   for i,c in enumerate(CLOUDS):
    q=deepcopy(o);q.update(GUID=cloudids[i],Nickname=c['name']+' | Zero Visibility',Description=f"Zero Visibility Zone. Ellipse {2*c['rx']:.2f} x {2*c['rz']:.2f} in. See Map Rules.")
    q['Transform'].update(posX=c['x'],posY=c['lo'],posZ=c['z'],scaleX=c['rx'],scaleY=round(c['hi']-c['lo'],4),scaleZ=c['rz'])
    retexture(q,'vapour-'+str(c['variant']),'cloudlight.jpg');revise(q);items.append(q)
   continue
  if o['GUID']=='cb7102':o['LuaScript']=patch_controller(o['LuaScript'],cloudids,prefix)
  if 'mission'in o.get('Tags',[]):
   donor=json.loads((BASE/'console-candidate-0.json').read_text());t=o['Transform'];o.pop('CustomMesh');o.update(Name=donor['Name'],CustomAssetbundle=deepcopy(donor['CustomAssetbundle']),ChildObjects=deepcopy(donor['ChildObjects']))
   for a in 'XYZ':t['scale'+a]=donor['Transform']['scale'+a]
   for i,ch in enumerate(o['ChildObjects']):ch['GUID']=gid(o['GUID']+' console base '+str(i))
   t['rotY']=donor['Transform']['rotY'];t['posY']=round(t['posY']-t['scaleY']*o['ChildObjects'][0]['Transform']['posY'],6)
  revise(o);items.append(o)
 # Place the same authored transforms into all three normal entry points to the map.
 saved=json.loads((BASE/'r1/Cloudbreak-Array.json').read_text());old=saved['ObjectStates'][0];oldtitle=old['Nickname'];oldrules=json.loads(json.loads(CONFIG.search(next(o['LuaScript'] for o in world if o['GUID']=='cb7102'))[2]))['rules']
 def stage(b):
  b['Nickname']=oldtitle[:-2]+'R2';b['GMNotes']='CloudbreakArrayR2';b['Description']=f'Harmony City, Harmony Province | Network Node. 16 enterable towers and {len(CLOUDS)} bounded cloud banks.'
  b['ContainedObjects']=deepcopy(items);records=[]
  for o in b['ContainedObjects']:
   for x in [o,*o.get('States',{}).values()]:
    t=x['Transform'];records.append('--'+x['GUID']+','+','.join(str(t[k])for k in ('posX','posY','posZ','rotX','rotY','rotZ')))
   o['Transform'].update(posX=70,posY=100,posZ=70)
  b['LuaScript']='\r\n'.join(records)+'\r\n'
 def notes(s):
  s['SaveName']=s['SaveName'].replace(' R1',' R2')
  s['LuaScript']=s['LuaScript'].replace(oldtitle,oldtitle[:-2]+'R2')
  for tab in s['TabStates'].values():
   if tab['title']=='Cloudbreak Array | Network Node':
    assert oldrules in tab['body'];tab['body']=tab['body'].replace(oldrules,RULES)
 OUT.mkdir(exist_ok=True)
 def write(n,data):(OUT/(n+'.json')).write_text(dumps(data))
 stage(old);write('Cloudbreak-Array',saved)
 single=deepcopy(play);notes(single);single['SkyURL']=modes(prefix)['day'];single['ObjectStates']=[o for o in single['ObjectStates'] if TAG not in o.get('Tags',[])]+items;write('Play-Table',single)
 book=json.loads((BASE/'r1/Workshop-Save.json').read_text());notes(book);shelf=next(o for o in book['ObjectStates'] if o['GUID']==BAG);stage(shelf);write('Workshop-Save',book)
 return items
if __name__=='__main__':author(sys.argv[1])
