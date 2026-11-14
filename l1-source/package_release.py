from pathlib import Path
import base64,copy,hashlib,json,math,re,shutil,sys
import lz4.block
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from build_assets import terrain,canal_x
ROOT=Path(__file__).resolve().parent;BASE=ROOT.parent/'collection';OUT=ROOT.parent/'lagash-package';A=ROOT/'assets'
SAVE='Clash-of-Empires-Workshop-Release.json';GUID='fe0002'
TITLE='Clash of Empires - Full Collection R8 - Lagash vs Umma R1'
def compact(x):return json.dumps(x,ensure_ascii=False,separators=(',',':'))
def block(s,name):
 m=re.search(r'local '+name+r'=(?:JSON\.decode\()?\[(=*)\[(.*?)\]\1\]',s,re.S);assert m,name;return m,m[2]
def replace(s,name,v):
 m,_=block(s,name);return s[:m.start(2)]+compact(v)+s[m.end(2):]
def cachekey(url):return re.sub('[^A-Za-z0-9]','',url.rsplit('.',1)[0])+'.'+url.rsplit('.',1)[1]

BRIEF='''LAGASH VS UMMA - c. 2450 BC

SETTING
The dispute over the Gu'edena borderland brought the Sumerian cities of Lagash and Umma into conflict. Eannatum's victory is commemorated on the Stele of the Vultures. The relief shows helmeted spearmen with shields and the ruler both on foot and in a cart. The Standard of Ur provides a contemporary comparison for four-wheeled battle carts and equid teams.

THIS RECONSTRUCTION
This is an interpretive tabletop field, not a surveyed ancient battlefield. Canals, levees, cultivated margins and peripheral date palms suggest the irrigated landscape. Exact deployments, strengths, spear lengths, uniform colours and command wings are scenario design. Eannatum and Ush identify the army-command stands; the four wing officers have no invented personal names.

FORCES
Lagash: 10 Spear Guard, 6 Levy Spearmen, 4 Early Battle Carts, 3 command bases.
Umma: 12 Spearmen, 4 Slingers, 4 Early Battle Carts, 3 command bases.
46 independent stands: 40 combat stands and 6 commanders. Heavy infantry use twelve figures in three ranks of four, slingers four figures. Each cart stand has ONE complete cart and team. Army commanders have three foot figures, wing commanders two, on two-inch circular bases. No anachronistic mounted horse commanders.

STATES AND LABELS
Troops and carts: 1 Full, 2 Disordered, 3 Shaken. Cart damage is shown on the single cart's crew and vehicle.
Commanders: 1 Normal, 2 Wounded. The commander remains standing with visible bandages in Wounded; escorts remain present.
Rear plaques use faction colours and the Bannockburn hierarchy. Commanders show AC/WC, name or wing designation, and role. Ordinary unit panels show quality, type and CV/CB/MD. Cart +1 C applies in open ground. Existing combat ratings and stand strengths are preserved; one cart model is a visual representation, not a reduction in represented force.

TERRAIN AND MOVEMENT
The 96 by 72 inch central field is Good Ground. Two modeled irrigation canals run along the flanks near x=-31 and x=31. Four pale dry causeway crossings are centered at z=-8 and z=8. Each crossing is over five inches wide, giving a three-inch stand a clear path. Canal banks are Broken Ground; cross the canal only at the visible causeways under the scenario restriction. Cropped peripheral fields are visual ground cover. Date palms are scenic; their trunks are individually seated and do not obstruct stand placement.
Figures use base-only collision and controlled terrain seating. The long spears remain fully modeled without a height cap. Ground contact is recalculated on loading, drops, group movement and state changes. Gravity remains disabled, matching Bannockburn, so stands keep formation and do not topple.

PLAY
Use the existing Clash of Empires combat and morale rules. Deployment X/Z positions, stand count and combat ratings are retained. Both armies seek to defeat the opposing field force and hold the disputed farmland; agree a turn limit and rout threshold before play. This is a visual/technical update, not a balance revision.

HISTORICAL REFERENCES
Louvre, Stele of the Vultures: https://collections.louvre.fr/en/ark:/53355/cl010121794
British Museum, Standard of Ur: https://www.britishmuseum.org/collection/object/W_1928-1010-3
University of Chicago, Sculpture of the Third Millennium B.C. from Tell Asmar and Khafajah (OIP 60): https://isac.uchicago.edu/sites/default/files/uploads/shared/docs/oip60.pdf

VALIDATION
This is a release candidate. Offline mesh/texture, ground-contact, Lua loader, state-change and public URL checks are included. Live TTS import, fresh-cache two-player loading and Windows installer execution have not been tested in this environment.
'''

def deployment(bag):
 im=Image.new('RGB',(1800,1550),(28,32,29));d=ImageDraw.Draw(im)
 field=Image.open(A/'field.jpg').resize((1632,1224));im.paste(field,(84,145));d=ImageDraw.Draw(im)
 font=lambda n:ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',n)
 d.text((84,27),'LAGASH vs UMMA  |  c. 2450 BC',font=font(44),fill='white')
 d.text((84,88),'96 × 72 inches · Exact starting positions · Interpretive Gu’edena battlefield',font=font(25),fill=(217,208,183))
 xy=lambda x,z:(84+(x+48)*17,145+(36-z)*17)
 for o in bag['ContainedObjects']:
  if not any(t in o.get('Tags',[]) for t in ['LoboUnit','LoboCommander']):continue
  n=json.loads(o['GMNotes']);t=o['Transform'];x,y=xy(t['posX'],t['posZ']);cmd='LoboCommander' in o['Tags'];r=17 if cmd else 25.5
  c=(35,75,154) if n['army']=='Lagash' else (159,42,33)
  if cmd:d.ellipse((x-r,y-r,x+r,y+r),fill=c,outline='white',width=2)
  else:d.rectangle((x-r,y-r,x+r,y+r),fill=c,outline='white',width=2)
  letter='C' if cmd else 'W' if n.get('cart_models_per_base') else 'S' if 'Sling' in o['Nickname'] else 'L' if 'Levy' in o['Nickname'] else 'G'
  d.text((x,y),letter,font=font(18),anchor='mm',fill='white')
 for side in [-1,1]:
  for z in [-8,8]:
   x,y=xy(float(canal_x(z,side)),z);d.rounded_rectangle((x-70,y-14,x+70,y+14),radius=5,fill=(43,45,33));d.text((x,y),'CAUSEWAY',font=font(17),anchor='mm',fill='white')
 d.text((84,1400),'BLUE: LAGASH     RED: UMMA     G Spear guard/foot    L Levy    S Sling    W Cart    C Command',font=font(24),fill='white')
 d.text((84,1450),'One cart per base · Commanders: Normal / Wounded · Troops: Full / Disordered / Shaken',font=font(24),fill=(217,208,183))
 im.save(A/'fe0002-deployment.jpg',quality=95)

def main():
 commit=sys.argv[1] if len(sys.argv)>1 else 'PENDING'
 url=f'https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/{commit}/l1/'
 data=json.loads((BASE/SAVE).read_text());bag=next(b for b in data['ObjectStates'][3]['ContainedObjects'] if b['GUID']==GUID)
 manifest=json.loads((ROOT/'figure-manifest.json').read_text());grid=json.loads((ROOT/'surface-grid.json').read_text())
 names={'field.obj','field.jpg','palms.obj','stand-square.obj','stand-round.obj'};counter=0xfc1000
 for o in bag['ContainedObjects']:
  n=json.loads(o.get('GMNotes') or '{}');t=o['Transform']
  if 'LoboGroundMesh' in o['Tags']:
   cm=o['CustomMesh'];cm.update(MeshURL=url+'field.obj',ColliderURL=url+'field.obj',DiffuseURL=url+'field.jpg',CastShadows=False)
   n.update(ground_key='lagash-r1',r23Surface=grid,terrain_revision='Lagash R1 - registered relief, causeways and grounding');o['GMNotes']=compact(n)
   o['Description']='Gu’edena interpretive irrigation field. Canals, levees, four clear causeway crossings and an open central battlefield.'
   continue
  side=n['army'];cmd='LoboCommander' in o['Tags'];cart='Battle Cart' in o['Nickname']
  if cmd:
   variant='army' if n['role']=='Army Commander' else 'left' if 'Left' in o['Nickname'] else 'right'
   key=side.lower()+'-command-'+variant
   name=('Eannatum' if side=='Lagash' else 'Ush') if variant=='army' else side+' '+variant.title()+' Wing'
  elif cart:
   num=int(re.search(r'(\d+) \| Full',o['Nickname'])[1]);key=side.lower()+f'-cart-{(num-1)%3}';name=o['Nickname'].rsplit(' | ',1)[0].replace('Battle Carts','Battle Cart')
  else:
   key='lagash-guard' if 'Spear Guard' in o['Nickname'] else 'lagash-levy' if 'Levy' in o['Nickname'] else 'umma-slingers' if 'Slinger' in o['Nickname'] else 'umma-spears';name=o['Nickname'].rsplit(' | ',1)[0]
  spec=manifest[key];count=spec['figures'];original=copy.deepcopy(o);states=[]
  radius=1 if cmd else 1.5
  t['posY']=round(max(float(terrain(t['posX']+x,t['posZ']+z)) for x in np.linspace(-radius,radius,9) for z in np.linspace(-radius,radius,9) if not cmd or x*x+z*z<=1)+.012,7)
  for i in range(2 if cmd else 3):
   st=copy.deepcopy(original if i==0 else original.get('States',{}).get(str(i+1),original));st.pop('States',None)
   if i:counter+=1;st['GUID']=f'{counter:06x}'
   st['Transform']=copy.deepcopy(t);status=(['Normal','Wounded'] if cmd else ['Full','Disordered','Shaken'])[i]
   st['Nickname']=name+' | '+status;sn=copy.deepcopy(n)
   sn.update(name=name,unit_state=i+1,status_state=i+1,status=status,unit_condition=status,unit_condition_label=status,full_figures=count,figures=count,
    standing_figures=count if cmd or cart else count-(0 if i==0 else max(1,round(count*[0,.25,.5][i]))),
    casualty_percent=0 if cmd else [0,25,50][i],art_revision='Lagash R1 original long-spear artwork',grounding_revision='Bannockburn R3 terrain contact',label_revision='Bannockburn format, Lagash R1',scenario='Lagash vs Umma',base_material_revision='Lagash alluvial soil')
   sn['army_label_color']='#234B9A' if side=='Lagash' else '#9F2A21'
   if cmd:
    sn.update(mounted=False,wounded=i==1,commander_name=name,profile='Sumerian Foot Command',strength_percent=100,commander_states=['Normal','Wounded'])
    desc=name+'\n'+sn['role']+'\n'+status
   elif cart:
    sn.update(cart_models_per_base=1,crew_per_cart=2,team_animals=4,profile='Early Sumerian Battle Cart',model_count=1,strength_percent=[100,75,50][i])
    desc=name+'\nOne complete cart and team\nCV Foot 3 / Mounted 2 | CB +1 C in open ground | MD 0'
   else:desc=n.get('unit_hover',name)
   sn['unit_hover']=desc;sn['label_identity'].update(name=name,state=i+1,commander=cmd)
   st['Description']=desc;st['GMNotes']=compact(sn);st['Tooltip']=False;st['Gravity']=False;st['Autoraise']=False;st['Locked']=False
   st['Rigidbody']={'Mass':1,'Drag':10,'AngularDrag':1000,'UseGravity':False}
   st['Tags']=[x for x in st['Tags'] if x not in ['GranicusUnit','Lobo_Granicus_Battle_R3','Lobo_Hydaspes_Battle_R1']]
   st['Tags']=list(dict.fromkeys(st['Tags']+['LoboTerrainGrounding']))
   cm=st['CustomMesh'];mesh=spec['meshes'][i];tex=spec['textures'][i];names.update([mesh,tex]);cm.update(MeshURL=url+mesh,DiffuseURL=url+tex,ColliderURL=url+('stand-round.obj' if cmd else 'stand-square.obj'),Convex=True,CastShadows=False)
   states.append(st)
  o.clear();o.update(states[0]);o['States']={str(i+2):v for i,v in enumerate(states[1:])}
 # One scenic object, with each of its 20 roots registered to the field mesh.
 field=bag['ContainedObjects'][0];palms=copy.deepcopy(field);palms['GUID']='fc1100';palms['Nickname']='Gu’edena | Peripheral date palms';palms['Tags']=['LoboAncients','LoboBattle','LoboTerrain','LoboNativeManaged']
 palms['Description']='Scenic cultivated margins. Tree roots match the modeled field; the central battle and causeways remain clear.'
 collider=next(v['CustomMesh']['ColliderURL'] for b in data['ObjectStates'][3]['ContainedObjects'] if b['GUID']=='fe07a5' for v in b['ContainedObjects'] if v['GUID']=='bb109e')
 palms['CustomMesh'].update(MeshURL=url+'palms.obj',DiffuseURL=url+'lagash-guard.png',ColliderURL=collider,Convex=True,CastShadows=False)
 names.add('lagash-guard.png');palms['GMNotes']=compact({'loboNativeSlot':GUID+':048','scenic_only':True});palms['Memo']='LoboSlot:'+GUID+':048';bag['ContainedObjects'].append(palms)
 layout={'_guidSlots':{},'_order':[]}
 for i,o in enumerate(bag['ContainedObjects']):
  slot=GUID+':%03d'%(i+1);t=o['Transform'];cm=o['CustomMesh'];layout['_guidSlots'][o['GUID']]=slot;layout['_order'].append(slot)
  pose={'name':o['Nickname'],'position':[t['posX'],t['posY'],t['posZ']],'rotation':[t['rotX'],t['rotY'],t['rotZ']],'scale':[t['scaleX'],t['scaleY'],t['scaleZ']],'locked':o.get('Locked',False),'assets':{'mesh':cm['MeshURL'],'texture':cm['DiffuseURL'],'collider':cm['ColliderURL']}}
  if i==0:pose['groundBounds']={'minX':-48,'maxX':48,'minZ':-36,'maxZ':36}
  layout[slot]=pose
 raw=compact(layout).encode();bag['GMNotes']=compact({'r28_master_guid':GUID,'r28_packed_layout':base64.b64encode(lz4.block.compress(raw,store_size=False)).decode(),'r28_layout_length':len(raw)})
 bag['Description']='Lagash R1: original long-spear figures, one cart per base, Normal/Wounded commanders, relief and grounding to the Bannockburn standard.'
 s=data['LuaScript'].replace("if o.hasTag('LoboBannockburnGrounding') and r32Seat", "if (o.hasTag('LoboBannockburnGrounding') or o.hasTag('LoboTerrainGrounding')) and r32Seat",1)
 s=s.replace('Commanders use Full Strength or Wounded.','Commanders use Normal or Wounded.')
 s=s.replace('local units=selectedUnits(p);local changed=0','local units=selectedUnits(p);local changed=0;local commanders=0',1)
 s=s.replace('local current=o.getStateId()','local current=o.getStateId()\n  if o.hasTag("LoboCommander") then commanders=commanders+1 end',1)
 old_notice="if #units>0 then tell(p,'Set selected units to '..({'Full Strength','Disordered / Wounded','Shaken'})[state]..'.');refresh() end"
 new_notice="""if #units>0 then
  if not (state==3 and commanders==#units) then
   local label=({'Full Strength / Normal','Disordered / Wounded','Shaken'})[state]
   if commanders==#units then label=state==1 and 'Normal' or 'Wounded' end
   tell(p,'Selected bases: '..label..'.')
  end
  refresh()
 end"""
 assert old_notice in s;s=s.replace(old_notice,new_notice,1)
 meta=json.loads(block(s,'battleMetadata')[1])
 row=next(v for v in meta['battles'] if v['bag']==GUID);row['terrainGuide']=BRIEF[BRIEF.index('TERRAIN AND MOVEMENT'):BRIEF.index('\nPLAY\n')];row['zoneLines']=[[[x,round(float(terrain(x,z))+.04,5),z] for z in range(-36,37)] for x in [-16,16]];s=replace(s,'battleMetadata',meta)
 brief=json.loads(block(s,'briefingData')[1]);brief[GUID]=BRIEF;s=replace(s,'briefingData',brief)
 old_map=re.search(r'https://raw\.githubusercontent\.com/[^"\s]+/fe0002-deployment\.jpg',s)
 if not old_map:old_map=re.search(r'https://raw\.githubusercontent\.com/[^"\s]+/fe0002[^"\s]*\.jpg',s)
 assert old_map,'deployment URL missing';s=s.replace(old_map[0],url+'fe0002-deployment.jpg')
 s=s.replace('onClick="unitFull">Full Strength</Button>','onClick="unitFull">Full / Normal</Button>')
 data['XmlUI']=data['XmlUI'].replace('onClick="unitFull">Full Strength</Button>','onClick="unitFull">Full / Normal</Button>')
 data['LuaScript']=s;data['SaveName']=TITLE;data['Description']=bag['Description']+' Full 37-battle collection. Release candidate; live TTS validation pending.'
 tid=max(map(int,data['TabStates']))+1;data['TabStates'][str(tid)]={'title':'Lagash R1 - Guide','body':BRIEF,'color':'Grey','visibleColor':{'r':.5,'g':.5,'b':.5},'id':tid}
 deployment(bag);names.add('fe0002-deployment.jpg')
 shutil.copytree(BASE,OUT,dirs_exist_ok=True);(OUT/SAVE).write_text(compact(data));(ROOT/'global.lua').write_text(s);(ROOT/'battle-bag.json').write_text(compact(bag));(ROOT/'briefing.txt').write_text(BRIEF)
 entries=json.loads((BASE/'Expansion-Visual-Cache.json').read_text());host=[]
 for filename in sorted(names):
  path=A/filename;sha=hashlib.sha256(path.read_bytes()).hexdigest();dest='l1-'+filename;shutil.copy2(path,OUT/'ExpansionVisuals'/dest)
  entries.append({'file':dest,'cache':cachekey(url+filename),'sha256':sha});host.append({'file':filename,'url':url+filename,'sha256':sha,'bytes':path.stat().st_size})
 (OUT/'Expansion-Visual-Cache.json').write_text(json.dumps(entries,indent=2));(ROOT/'hosted-assets.json').write_text(json.dumps(host,indent=2))
 ps=(BASE/'Install-Clash-of-Empires.ps1').read_text(encoding='utf-8-sig').replace('Clash of Empires - Full Collection R7 - Bannockburn R3',TITLE)
 (OUT/'Install-Clash-of-Empires.ps1').write_bytes(b'\xef\xbb\xbf'+ps.replace('\r\n','\n').replace('\n','\r\n').encode())
 (OUT/'README-FIRST.txt').write_text('''CLASH OF EMPIRES - FULL COLLECTION R8 - LAGASH VS UMMA R1

1. Close Tabletop Simulator. Extract the entire ZIP.
2. Run Install-Clash-of-Empires.cmd.
3. Open Games > Save & Load > Clash of Empires - Full Collection R8 - Lagash vs Umma R1.
4. Choose Lagash vs. Umma - c. 2450 BC, then Load Battle.

Open the NEW R8 save. Existing deployed battles and older saves retain their old figures.
This cumulative installer keeps all 37 battles, including Bannockburn R3 and Stirling Bridge R3.
It creates a new save slot and preserves your existing saves. It does not publish to Steam.

'''+BRIEF)
 print(TITLE,'stands',46,'states',132,'assets',len(host))

if __name__=='__main__':main()
