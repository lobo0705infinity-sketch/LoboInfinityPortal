"""Apply the airspace revision to the deployed, staged and shelf versions of the same map."""
from district import *
from airframes import BYKEY
from editable_clouds import BANK_LUA,GUIDE_LUA,TAG_CLOUD
from copy import deepcopy
import re
CONFIG=re.compile(r'^(\s*local config=JSON\.decode\()(.*)(\)\s*)$',re.M)
DESIGN=json.loads((WORK3/'airspace.json').read_text())
BANKS=LOW+DESIGN['high']
R2URL=OLD_MOOR['CustomMesh']['DiffuseURL'].rsplit('/',1)[0]+'/'
SIGNED='https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/'
AIR='Open air between buildings is impassable. Only Troopers with Terrain (Zero-G) or Terrain (Total) may move through it. All Troopers may use the bridges.'
RULES=AIR+f"\n\nEach cloud bank is a Zero Visibility Zone. Enable Cloud boundaries in Map Controls to see each bank's current limits. Unlock a bank to move or delete it. Use the Gizmo to set altitude. The distant cloud deck is scenery. Apply the normal Visibility and equipment rules.\n\nThe five airships are solid scenery. Their hulls and gondolas block Line of Fire and provide cover. Greenhouse glass allows Line of Fire. Each end has three open entrances.\n\nEach tower's States menu opens its floors. State 1 is the lowest and the highest state shows the roof. Use the yellow ladders. Lift figures before hiding their supporting floor.\n\nRelay A is on Cable Drum, B is inside Transit Arcade on level 2, C is on Aerostat Pier and D is on the Isobar Observatory level 3 terrace. The Primary Node is on Switching House."
def compact(d):return json.dumps(d,ensure_ascii=True,separators=(',',':'))
def walk(o):
 yield o
 for x in [*o.get('ContainedObjects',[]),*o.get('ChildObjects',[]),*o.get('States',{}).values()]:yield from walk(x)
def patch_controller(o,extra,oldrules):
 def upd(m):
  d=json.loads(json.loads(m[2]))
  if 'rules' in d:
   assert d['rules']==oldrules
   d['rules']=RULES;d.pop('clouds',None)
  else:d['guids'].update({v['GUID']:True for v in extra})
  return m[1]+compact(compact(d))+m[3]
 s=CONFIG.sub(upd,o['LuaScript'])
 start=s.index(' if state.clouds then\n  for _,c in ipairs(config.clouds)')
 end=s.index(' loboZoneWrite(mat,lines)',start)
 s=s[:start]+s[end:]
 s=s.replace('local function draw()\n',GUIDE_LUA+'local function draw()\n',1)
 old="function cloudBoundaries()state.clouds=not state.clouds;draw();refresh()end"
 assert s.count(old)==1;s=s.replace(old,"function cloudBoundaries()state.clouds=not state.clouds;paintClouds();refresh()end")
 assert s.count('draw();refresh();restoreTerminals()')==1
 o['LuaScript']=s.replace('draw();refresh();restoreTerminals()','draw();refresh();restoreTerminals();paintClouds()')
def attach_glazing(parent,t,k,template,url):
 x,z,a=greenhouse(k);tf=xform(x,t.n*PITCH+.01,z,a)
 def child(kind,mesh,tex):
  q=deepcopy(template);q.update(GUID=gid(k+'/'+kind),Nickname=t.name+' | greenhouse '+kind,Tags=['greenhouse-'+kind],Transform=tf.copy(),GMNotes='CloudbreakArrayR3 integrated greenhouse '+kind,LuaScript='',LuaScriptState='',Description='Rooftop assembly. Three open entrances at each end.')
  props=q['CustomMesh'];props.update(MeshURL=url+mesh+'.obj',ColliderURL=url+mesh+'-col.obj',DiffuseURL=tex,Convex=False)
  return q
 glass=child('glass','greenhouse-glazing',url+'horticultural-glass.png')
 glass['ColorDiffuse'].update(r=.82,g=.93,b=.98,a=.37);glass['CustomMesh']['CustomShader'].update(SpecularIntensity=.53,SpecularSharpness=7,FresnelStrength=.48);glass['CustomMesh']['CastShadows']=False
 hardware=child('door fittings','greenhouse-door-hardware',R2URL+'civic-r2.jpg');hardware['ColorDiffuse']={'r':1,'g':1,'b':1};hardware['CustomMesh'].update(MaterialIndex=2,CastShadows=True);hardware['CustomMesh']['CustomShader']=deepcopy(OLD_MOOR['CustomMesh']['CustomShader'])
 parent.setdefault('ChildObjects',[]).extend([glass,hardware]);parent['Description']+=' The glasshouse has three open lanes through both ends.'
def build(pin):
 url=SIGNED+pin+'/cloudbreak-array-r3/assets/';single=deepcopy(R2TABLE);catalog=json.loads((PREVIOUS/'out/Workshop-Save.json').read_text());saved=json.loads((PREVIOUS/'out/Cloudbreak-Array.json').read_text());base_bag=saved['ObjectStates'][0]
 glass=next(o for top in catalog['ObjectStates']for o in walk(top) if o.get('Nickname')=='Command observatory | integrated glazing')
 cloud_template=next(o for o in PIECES if slug(o).startswith('vapour-'));extra=[]
 for s in DESIGN['ships']:
  meta=BYKEY[s['key']];o=deepcopy(OLD_MOOR);name='aerostat-'+s['key'];o.update(GUID=gid(name),Nickname=meta['name']+' | '+meta['reg'],Description=meta['job']+' Solid hull and gondola block Line of Fire.',Transform=s['transform'].copy(),GMNotes='CloudbreakArrayR3 '+TAG)
  o['CustomMesh'].update(MeshURL=url+name+'.obj',ColliderURL=url+name+'-col.obj',DiffuseURL=url+'airship-liveries.jpg',Convex=False);extra.append(o)
 for c in DESIGN['high']:
  o=deepcopy(cloud_template);name='alto-'+str(c['variant']);o.update(GUID=gid('cloud/'+c['name']),Nickname=c['name']+' | upper Zero Visibility Zone',Description=f"Zero Visibility Zone, {c['lo']-MAT_Y:.2f} to {c['hi']-MAT_Y:.2f} in above the city mat. See Map Rules.",GMNotes='CloudbreakArrayR3 '+TAG,Transform=xform(c['x'],c['lo'],c['z'],c['angle'],c['rx'],round(c['hi']-c['lo'],3),c['rz']))
  o['CustomMesh'].update(MeshURL=url+name+'.obj',ColliderURL=url+name+'-col.obj',DiffuseURL=R2URL+'cloudlight.jpg');extra.append(o)
 owned=[o for o in single['ObjectStates'] if TAG in o.get('Tags',[])];controller=next(o for o in owned if o['GUID']=='cb7102');oldrules=json.loads(json.loads(CONFIG.search(controller['LuaScript'])[2]))['rules'];patch_controller(controller,extra,oldrules)
 for o in owned:
  name=slug(o)
  if name.startswith('tower-'):
   k=name.split('-')[1]
   if greenhouse(k):attach_glazing(o,T[k],k,glass,url)
  for piece in walk(o):piece['GMNotes']=piece.get('GMNotes','').replace('CloudbreakArrayR2','CloudbreakArrayR3')
 owned.extend(extra);single['ObjectStates'].extend(extra)
 for o in owned:
  n=slug(o)
  if not n.startswith(('vapour-','alto-')):continue
  # Use real body-sized colliders so right-click, box selection and the Gizmo all work.
  o['CustomMesh']['ColliderURL']=url+(n+'-pick-col.obj' if n.startswith('vapour-') else n+'-col.obj')
  o['CustomMesh']['Convex']=True
  if TAG_CLOUD not in o['Tags']:o['Tags'].append(TAG_CLOUD)
  o.update(Locked=True,DragSelectable=True,Tooltip=True,Autoraise=False,Sticky=False,Grid=False,Snap=False,Hands=False,
           Rigidbody={'Mass':1.0,'Drag':3.0,'AngularDrag':8.0,'UseGravity':False},LuaScript=BANK_LUA,LuaScriptState='',
           Description='Zero Visibility Zone. Unlock to move or delete. Use the Gizmo for altitude. The visibility boundary follows this piece.')
 oldtitle=base_bag['Nickname'];newtitle=oldtitle.removesuffix('R2')+'R3'
 def stage(q):
  q.update(Nickname=newtitle,GMNotes='CloudbreakArrayR3',Description=f'Harmony City, Harmony Province | Network Node. 16 enterable towers, {len(BANKS)} cloud banks and five civilian airships.')
  q['ContainedObjects']=deepcopy(owned);manifest=[]
  for obj in q['ContainedObjects']:
   for state in [obj,*obj.get('States',{}).values()]:
    t=state['Transform'];manifest.append('--'+state['GUID']+','+','.join(str(t[k])for k in ('posX','posY','posZ','rotX','rotY','rotZ')))
   obj['Transform'].update(posX=70,posY=100,posZ=70)
  q['LuaScript']='\r\n'.join(manifest)+'\r\n'
 shelf=next(o for o in catalog['ObjectStates']if o['GUID']==BAG);stage(shelf);stage(base_bag)
 for s in (single,catalog):
  s['SaveName']=s['SaveName'].replace(' R2',' R3');s['LuaScript']=s['LuaScript'].replace(oldtitle,newtitle)
  tab=next(t for t in s['TabStates'].values()if t['title']=='Cloudbreak Array | Network Node');assert oldrules in tab['body'];tab['body']=tab['body'].replace(oldrules,RULES)
 for name,data in [('Play-Table',single),('Workshop-Save',catalog),('Cloudbreak-Array',saved)]: (OUT3/(name+'.json')).write_text(compact(data))
if __name__=='__main__':build(sys.argv[1])
