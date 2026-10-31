"""Write cloud-backed standalone save and normal Infinity mod deployment bag."""
from pathlib import Path
import json,copy,math,sys,re
ROOT=Path(__file__).resolve().parents[1]
COMMIT=sys.argv[1] if len(sys.argv)>1 else 'accade5d104b3a7c2778223b21c23487f89bacdd'
URL='https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/'+COMMIT+'/lobo-infinity-portal/public/assets/maps/old-quarter-20261031-r1/'
WORK=ROOT.parents[1]
SOURCE=WORK/'source/current'
manifest={x['name']:x for x in json.loads((ROOT/'Source/mesh-manifest.json').read_text())}
layout=json.loads((ROOT/'Source/layout.json').read_text())
height=(SOURCE/'Source/height_tooltip.lua').read_text()
ui=(ROOT/'Source/map_ui.lua').read_text()
counter=0xe90000
def guid():
 global counter
 counter+=1;return f'{counter:06x}'
def obj(p,mesh=None,state=1):
 name=mesh or p['mesh'];g=guid();m=manifest[name]
 state_label={1:'Roof on',2:'Upper floor exposed',3:'Ground floor exposed'}[state]
 title=p['title']+(' | '+state_label if p.get('states') else '')
 h=m['bounds'][1][1]-m['bounds'][0][1]
 description=f'Height (base to top): {h:.2f} in\nOld Quarter Excavation R1.\n'
 if p['kind']=='building':description+='Playable interiors and roofs. External ladders persist across states. States: 1 roof on, 2 upper floor exposed, 3 ground floor exposed.'
 else:description+='Use actual geometry for line of fire and cover.'
 movable=p['kind']=='tech'
 o=dict(GUID=g,Name='Custom_Model',Nickname=title,Description=description,GMNotes='Lobo old-quarter urban excavation R1',
 Transform=dict(posX=p['x'],posY=p['y'],posZ=p['z'],rotX=0,rotY=p.get('angle',0),rotZ=0,scaleX=1,scaleY=1,scaleZ=1),
 ColorDiffuse=dict(r=1,g=1,b=1),Locked=not movable,Grid=False,Snap=False,IgnoreFoW=False,MeasureMovement=False,DragSelectable=True,
 Autoraise=True,Sticky=False,Tooltip=True,GridProjection=p['kind']=='mat',HideWhenFaceDown=False,Hands=False,
 Tags=['LoboOldQuarterR1','LoboMap810340'],LuaScriptState='',XmlUI='',
 CustomMesh=dict(MeshURL=URL+name+'.obj',DiffuseURL=URL+'old-quarter-material-atlas.jpg',NormalURL='',ColliderURL=URL+name+'-collider.obj',Convex=not m['nonconvex'],MaterialIndex=3,TypeIndex=0,CastShadows=True,
 CustomShader=dict(SpecularColor=dict(r=.14,g=.14,b=.14),SpecularIntensity=.06,SpecularSharpness=3,FresnelStrength=.02)))
 if p['kind']=='mat':o['LuaScript']=ui
 elif movable:o['LuaScript']=''
 else:o['LuaScript']='function onLoad() self.setLock(true) end\n'+height
 return o
objects=[]
for p in layout:
 o=obj(p)
 if p.get('states'):
  kind=p['mesh'].split('-state-')[0]
  o['States']={str(s):obj(p,kind+f'-state-{s}',s) for s in [2,3]}
 objects.append(o)
for i,v in enumerate([-16/math.sqrt(2),0,16/math.sqrt(2)]):
 p=dict(mesh='mission-console-40mm',title=f'Console {i+1} — The Dig',x=v,z=v,y=4.6,angle=45,kind='console')
 objects.append(obj(p))
for i,z in enumerate([20,12,4,-4,-12,-20]):
 p=dict(mesh='hyperthermal-tech-25mm',title=f'Hyperthermal Tech {i+1} — player placed',x=30,z=z,y=4.6,angle=0,kind='tech')
 o=obj(p);o['Description']='25 mm Hyperthermal Tech token. Player placed BEFORE army deployment. Entire token must be beyond 8 inches from both corner DZs and every other Tech token. Accessible table ground only; never on or inside scenery.';objects.append(o)

base=json.loads((SOURCE/'Map-Bags/810340.json').read_text());bag=copy.deepcopy(base['ObjectStates'][0])
bag['Nickname']='SET_ITS18 The Dig — Old Quarter Excavation — URBAN EXCAVATION R1'
bag['Description']='The Dig / Old Quarter Excavation R1\n48 × 48 inches; 300 points.\nOriginal custom Lobo urban excavation terrain. Replaces the former Satellite Merovingien layout.\n24-inch-radius opposite corner DZs; centre and +/-16-inch diagonal Consoles; six reserve 25 mm Tech tokens for player placement.\nDrop this bag onto the normal Infinity mod map deployment spot.\nGeometry, legal Tech placement, collider components and script integration checked. Live TTS physics and gameplay testing pending.\nOfficial mission: https://experience.corvusbelli.com/en/game-content/16de25e7-8317-4d7c-8438-bd4284164855'
bag['ContainedObjects']=objects
# The stage loader reads root records; its Clear Table routine also reads the
# alternate GUID aliases, so changing building states cannot strand terrain.
lines=[]
for o in objects:
 for a in [o,*o.get('States',{}).values()]:
  t=a['Transform'];lines.append('--'+a['GUID']+','+','.join(f'{t[k]:.6f}' for k in ['posX','posY','posZ','rotX','rotY','rotZ']))
bag['LuaScript']='\r\n'.join(lines)+'\r\n';bag['LuaScriptState']='';bag['XmlUI']=''
(ROOT/'Map-Bags').mkdir(exist_ok=True);(ROOT/'Files').mkdir(exist_ok=True)
(ROOT/'Map-Bags/810340.json').write_text(json.dumps({'ObjectStates':[bag]},ensure_ascii=False,indent=2))
collection=json.loads((SOURCE/'Files/Lobo-Workshop-Current-Maps-and-Rules.json').read_text())
standalone={k:copy.deepcopy(v) for k,v in collection.items() if k not in ['ObjectStates','LuaScript','LuaScriptState','XmlUI']}
standalone.update(SaveName='Old Quarter Excavation R1 — The Dig',Note=bag['Description'],ObjectStates=copy.deepcopy(objects),LuaScript='',LuaScriptState='',XmlUI='')
(ROOT/'Files/Old-Quarter-Excavation-R1.json').write_text(json.dumps(standalone,ensure_ascii=False,indent=2))
# A separate collection save lets the commissioner replace exactly one bag.
for i,o in enumerate(collection['ObjectStates']):
 if o.get('GUID')=='810340':
  old=copy.deepcopy(o);collection['ObjectStates'][i]=copy.deepcopy(bag);collection['ObjectStates'][i]['Transform']=old['Transform'];break
else:raise ValueError('Old Quarter collection bag missing')
collection['SaveName']='Lobo Workshop — Old Quarter Excavation R1'
(ROOT/'Files/Lobo-Workshop-Old-Quarter-R1.json').write_text(json.dumps(collection,ensure_ascii=False,separators=(',',':')))
(ROOT/'Source/hosted-assets.json').write_text(json.dumps({'commit':COMMIT,'baseURL':URL,'assetFiles':[p.name for p in (ROOT/'Assets').glob('*') if p.suffix in ['.obj','.jpg']]},indent=2))
print(json.dumps({'root_components':len(objects),'building_state_variants':sum(len(o.get('States',{})) for o in objects),'map_bag_guid':bag['GUID'],'standalone_save':str(ROOT/'Files/Old-Quarter-Excavation-R1.json')}))
