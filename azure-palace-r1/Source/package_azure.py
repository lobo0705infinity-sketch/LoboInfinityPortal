from pathlib import Path
import json,re,sys,copy,hashlib
R=Path(__file__).resolve().parents[1];ROOT=R.parent;OUT=R/'Release';OUT.mkdir(exist_ok=True)
HOST=sys.argv[1].rstrip('/')
BASE=Path('/workspace/scratch/aea066a92a75/base-release')
bag0=json.loads(Path('/workspace/scratch/aea066a92a75/base-veyra.json').read_text())
records=json.loads((R/'Source/geometry-manifest.json').read_text());by={r['slug']:r for r in records};layout=json.loads((R/'Source/layout.json').read_text())
BAG='810108';TAG='LoboMap:'+BAG
def gid(key):return hashlib.sha256(('AzurePalaceR1:'+key).encode()).hexdigest()[:6]
MAT=gid('ground');CONTROL=gid('controller')
def tf(x=0,y=3.9,z=0,rot=0):return {'posX':x,'posY':y,'posZ':z,'rotX':0,'rotY':rot,'rotZ':0,'scaleX':1,'scaleY':1,'scaleZ':1}
def mesh(name,g,st,t,texture='azure-material-atlas.png',locked=True):
 return {'GUID':g,'Name':'Custom_Model','Nickname':name,'Description':'Azure Palace R1 - Crossing Lines. Original 3D resort terrain.','GMNotes':'AzurePalaceR1 '+TAG,'Tags':[TAG,'terrain'],'Transform':t,'ColorDiffuse':{'r':1,'g':1,'b':1},'Locked':locked,'Grid':False,'Snap':False,'Hands':False,'Tooltip':True,'GridProjection':True,'DragSelectable':True,'Autoraise':False,'Sticky':True,'LuaScript':'function onLoad() self.setLock('+str(locked).lower()+') end','LuaScriptState':'','XmlUI':'','CustomMesh':{'MeshURL':HOST+'/'+st['mesh'],'DiffuseURL':HOST+'/'+texture,'ColliderURL':HOST+'/'+st['collider'],'NormalURL':'','Convex':True,'MaterialIndex':3,'TypeIndex':0,'CastShadows':True,'CustomShader':{'SpecularColor':{'r':.1,'g':.1,'b':.1},'SpecularIntensity':.12,'SpecularSharpness':3,'FresnelStrength':.03}}}
def terrain(it,key):
 rec=by[it['slug']];states=[]
 for n,st in enumerate(rec['states'],1):
  t=tf(it['x'],it.get('y',3.9),it['z'],it['rot']);g=MAT if rec['kind']=='ground'else gid(key+':'+str(n))
  o=mesh(rec['name'],g,st,t);o['Description']=st['label']+'\n'+('States: 1 Full rooftop; 2 Ground floor'+('; 3 Second floor'if len(rec['states'])>2 else'')+('; 4 Third floor'if len(rec['states'])>3 else'')if len(rec['states'])>1 else'Solid visible geometry. Fine decorative gaps remain open.')
  if rec.get('sign'):
   sign=mesh(rec['name']+' sign',gid(key+':sign:'+str(n)),rec['sign'],tf(y=0),rec['sign']['texture']);sign['LuaScript']='';sign['GridProjection']=False;o['ChildObjects']=[sign]
  states.append(o)
 root=states[0]
 if len(states)>1:root['States']={str(i):o for i,o in enumerate(states[1:],2)}
 return root
objects=[terrain(it,'placed:'+str(i))for i,it in enumerate(layout)]
for i,z in enumerate([-12,12],1):
 old=next(o for o in bag0['ContainedObjects']if o['GUID']==('4e0053'if i==1 else'4e0054'));o=copy.deepcopy(old);o['GUID']=gid('antenna'+str(i));o['Transform']=tf(0,3.9,z);o['Nickname']='Crossing Lines - Antenna '+str(i);o['Tags']=[TAG,'mission'];o['LuaScript']='';o['LuaScriptState']='';objects.append(o)
def walk(o):
 yield o
 for q in o.get('ContainedObjects',[])+o.get('ChildObjects',[]):yield from walk(q)
 for q in o.get('States',{}).values():yield from walk(q)
owned=[o['GUID']for root in objects for o in walk(root)]+[CONTROL]
controller=copy.deepcopy(next(o for o in bag0['ContainedObjects']if 'LOBO_STANDARD_VERSION=1'in o.get('LuaScript','')))
script=controller['LuaScript'].replace('4e0001',MAT).replace('4e0002',CONTROL).replace('Veyra Gate','Azure Palace').replace('VEYRA GATE','AZURE PALACE').replace('LOBO_VEYRA','LOBO_AZURE')
m=re.search(r'local config=JSON.decode\(\[==\[(.*?)\]==\]\)',script,re.S);cfg=json.loads(m[1]);cfg.update(mat=MAT,buildings=[],buildingControls={},privateProxies={},buildingLightOffsets={},lights=[],owned=owned)
cfg['background'].update(category='azure-palace',day=HOST+'/azure-day.png',night=HOST+'/azure-night.png')
script=script[:m.start(1)]+json.dumps(cfg,separators=(',',':'))+script[m.end(1):]
# Canonical rotation ownership: all new states and attached signs, unchanged exclusions.
m=re.search(r'(-- BEGIN LOBO STANDARD MAP CONTROLS V1.*?local config=JSON.decode\()(".*")(\))',script,re.S)
# Match just the one-line JSON, rather than consuming later Lua strings.
start=script.index('-- BEGIN LOBO STANDARD MAP CONTROLS V1');tail=script[start:];q=re.search(r'local config=JSON.decode\(("[^\n]*")\)',tail);rot=json.loads(json.loads(q[1]));rot.update(anchor=MAT,guids={g:True for g in owned},tags=[TAG]);tail=tail[:q.start(1)]+json.dumps(json.dumps(rot,separators=(',',':')))+tail[q.end(1):];script=script[:start]+tail
controller.update(GUID=CONTROL,Nickname='Azure Palace - Standard Map Controls',Transform=tf(0,3.9,0),Tags=[TAG,'controller'],LuaScript=script,LuaScriptState='',XmlUI='');controller['Transform'].update(scaleX=.01,scaleY=.01,scaleZ=.01);objects.append(controller)
manifest=[]
for o in objects:
 for variant in [o]+list(o.get('States',{}).values()):
  t=variant['Transform'];manifest.append('--'+','.join([variant['GUID']]+[str(t[k])for k in ['posX','posY','posZ','rotX','rotY','rotZ']]))
bag=copy.deepcopy(bag0);bag.update(Nickname='SET_ITS18 Crossing Lines - Azure Palace R1',Description='Azure Palace R1 - review build. 48 x 48 inches on a 3-inch raised platform. Twelve furnished buildings, a recessed dry pool, and all eight approved scatter designs. Public assets. Standard controls retained. Live TTS visual/physics checks remain pending.',LuaScript='\r\n'.join(manifest)+'\r\n',LuaScriptState='',ContainedObjects=copy.deepcopy(objects))
for o in bag['ContainedObjects']:o['Transform'].update(posX=70,posY=100,posZ=70)
(OUT/'Azure-Palace.json').write_text(json.dumps({'ObjectStates':[bag]},ensure_ascii=True,separators=(',',':')))
scatter=[]
for i,r in enumerate(x for x in records if x['kind']=='scatter'):
 o=terrain({'slug':r['slug'],'x':0,'z':0,'rot':0,'y':2},'spare:'+str(i));o['Locked']=False;o['LuaScript']='function onLoad() self.setLock(false) end';o['Tags']=['AzurePalaceScatter'];scatter.append(o)
sb={'GUID':gid('scatter-bag'),'Name':'Bag','Nickname':'Azure Palace - Approved Scatter (8 designs)','Description':'One copy of each approved resort scatter design. Optional saved-object bag; not deployed automatically.','Transform':tf(0,2,0),'ColorDiffuse':{'r':.04,'g':.35,'b':.38},'ContainedObjects':scatter,'LuaScript':'','LuaScriptState':''}
(OUT/'Azure-Palace-Scatter.json').write_text(json.dumps({'ObjectStates':[sb]},separators=(',',':')))
scene=json.loads((BASE/'Play-Table.json').read_text());scene['SaveName']='Azure Palace R1 - Crossing Lines Review';scene['Date']='2026-11-18'
scene['ObjectStates']=[o for o in scene['ObjectStates']if 'LoboMap:af0667'not in o.get('Tags',[])and 'LoboMapUIBrokerV4'not in o.get('Tags',[])]
scene['ObjectStates']+=copy.deepcopy(objects)
(OUT/'Play-Table.json').write_text(json.dumps(scene,ensure_ascii=True,separators=(',',':')))
work=json.loads((BASE/'Workshop-Save.json').read_text());work['SaveName']='Lobo Maps - Azure Palace Workshop Review R1';work['Date']='2026-11-18';found=0
for i,o in enumerate(work['ObjectStates']):
 if o.get('GUID')==BAG:
  bag['Transform']=copy.deepcopy(o['Transform']);work['ObjectStates'][i]=copy.deepcopy(bag);found+=1
assert found==1
work['LuaScript']=work.get('LuaScript','').replace('Veyra Gate','Azure Palace')
# Existing stage validates the manifest and runs its normal deployment path.
work['LuaScript']+='''\n-- Azure Palace R1 automatic first deployment.\ndo\n local prior=onLoad\n function onLoad(saved)\n  if prior then prior(saved)end\n  Wait.condition(function()\n   if getObjectFromGUID("'''+MAT+'''")then return end\n   local stage=getObjectFromGUID('2d647a');local bag=getObjectFromGUID('810108')\n   if stage and bag then stage.call('onCollisionEnter',{collision_object=bag})end\n  end,function()\n   local stage=getObjectFromGUID('2d647a')\n   return stage and not stage.getVar('cb')and(Global.getVar('hld')or 0)==0\n  end,60)\n end\nend\n'''
(OUT/'Workshop-Save.json').write_text(json.dumps(work,ensure_ascii=True,separators=(',',':')))
(R/'Source/asset-base.txt').write_text(HOST+'\n')
(R/'Source/package-summary.json').write_text(json.dumps({'root_terrain_objects':len(objects),'building_count':12,'scatter_designs':8,'scatter_placements':sum(by[i['slug']]['kind']=='scatter'for i in layout),'surface':3.9,'mat_guid':MAT,'controller_guid':CONTROL,'bag_guid':BAG,'live_tts_tested':False},indent=2))
print('Packaged',len(objects),'map objects; full collection retains 105 setups')
