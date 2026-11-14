from pathlib import Path
import base64,copy,hashlib,json,re,shutil,sys
import lz4.block
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from build_assets import terrain
ROOT=Path(__file__).resolve().parent
BASE=ROOT.parent/'r8'
OUT=ROOT.parent/'r9'
A=ROOT/'assets'
SAVE='Clash-of-Empires-Workshop-Release.json'
GUID='fe0092'
TITLE='Clash of Empires - Full Collection R9 - Megiddo R1'
BRIEF=(ROOT/'briefing.txt').read_text()
def compact(x):return json.dumps(x,ensure_ascii=False,separators=(',',':'))
def block(s,name):
    m=re.search(r'local '+name+r'=(?:JSON\.decode\()?\[(=*)\[(.*?)\]\1\]',s,re.S)
    assert m,name
    return m,m[2]
def replace(s,name,v):
    m,_=block(s,name)
    return s[:m.start(2)]+compact(v)+s[m.end(2):]
def cachekey(url):return re.sub('[^A-Za-z0-9]','',url.rsplit('.',1)[0])+'.'+url.rsplit('.',1)[1]

def deployment(bag):
    im=Image.new('RGB',(1660,1430),(32,34,28))
    im.paste(Image.open(A/'field.jpg').resize((1536,1152)),(62,130))
    d=ImageDraw.Draw(im)
    def font(n):return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',n)
    d.text((62,26),'MEGIDDO  |  15th century BC',font=font(43),fill='white')
    d.text((62,84),'Aruna exit, plain and coalition camp · 96 × 72 inches',font=font(26),fill='#e3d3b2')
    xy=lambda x,z:(62+16*(x+48),130+16*(36-z))
    for x,z,title in [(0,15,'ARUNA EXIT · 1 VP'),(8,0,'PLAIN JUNCTION · 2 VP'),(22,-27,'CAMP · 3 VP')]:
        a,b=xy(x,z)
        d.ellipse((a-64,b-64,a+64,b+64),outline='#ffde8d',width=4)
        d.text((a,b),title,fill='white',stroke_width=2,stroke_fill='#33281c',font=font(18),anchor='mm')
    for o in bag['ContainedObjects']:
        if not o.get('States'):continue
        t=o['Transform'];a,b=xy(t['posX'],t['posZ'])
        n=json.loads(o['GMNotes'])
        cmd='LoboCommander' in o['Tags'];r=16 if cmd else 23
        color='#234b9a' if n['army']=='Egypt' else '#9f2a21'
        shape=d.ellipse if cmd else d.rectangle
        shape((a-r,b-r,a+r,b+r),fill=color,outline='white',width=2)
        sym='C' if cmd else 'W' if 'Chariot' in n['name'] else 'B' if 'Archers' in n['name'] or 'Skirmishers' in n['name'] else 'S'
        d.text((a,b),sym,fill='white',font=font(21),anchor='mm')
    d.text((62,1314),'BLUE  Egypt     RED  Coalition     S Spear     B Bow     W Chariot     C Commander',font=font(23),fill='white')
    d.text((62,1360),'Egyptian stands behind the exit form the staged column. See Full Briefing for entry and scoring.',font=font(22),fill='#e3d3b2')
    im.save(A/'fe0092-deployment.jpg',quality=86)

def main(commit):
    url=f'https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/{commit}/m1/'
    data=json.loads((BASE/SAVE).read_text())
    bags=data['ObjectStates'][3]['ContainedObjects']
    bag=next(b for b in bags if b['GUID']==GUID)
    manifest=json.loads((ROOT/'figure-manifest.json').read_text())
    grid=json.loads((ROOT/'surface-grid.json').read_text())
    counter=0xfd1000
    sideidx={'Egypt':0,'Canaanite Coalition':0}
    stage=[(x,z) for z in [17,20.18,23.36,26.54,29.72,32.9] for x in [-3.3,0,3.3]]
    advance=[(x,z) for z in [7,10.4] for x in [-10.2,-6.8,-3.4,0]]
    for i,o in enumerate(bag['ContainedObjects']):
        n=json.loads(o['GMNotes'])
        t=o['Transform']
        if i==0:
            o['CustomMesh'].update(MeshURL=url+'field.obj',ColliderURL=url+'field.obj',DiffuseURL=url+'field.jpg',CastShadows=False)
            n.update(ground_key='megiddo-r1',r23Surface=grid,terrain_revision='Megiddo R1')
            o['GMNotes']=compact(n)
            o['Description']='Aruna Pass, open plain and coalition camp. Sculpted terrain with exact surface grid.'
            continue
        cmd='LoboCommander' in o['Tags']
        ch='Bow Chariots' in o['Nickname']
        eq=n['army']=='Egypt';army='egypt' if eq else 'coalition'
        role=('command-army' if n['role']=='Army Commander' else 'command-left' if 'Left' in o['Nickname'] else 'command-right') if cmd else 'chariot' if ch else 'spears' if 'Spearmen' in o['Nickname'] else 'bows'
        spec=manifest[army+'-'+role]
        count=spec['figures']
        name=spec['title'] if cmd else o['Nickname'].rsplit(' | ',1)[0]
        if eq:
            j=sideidx[n['army']]
            if cmd:
                x,z={'command-army':(-4,4),'command-left':(-5.95,19),'command-right':(5.95,22)}[role]
            else:
                x,z=(advance+stage)[j];sideidx[n['army']]+=1
            t['posX'],t['posZ']=x,z
        if not eq and cmd and role=='command-right':
            t['posX']=7.5
        t['posY']=float(terrain(t['posX'],t['posZ']))+.012
        original=copy.deepcopy(o)
        states=[]
        for j in range(2 if cmd else 3):
            st=copy.deepcopy(original if j==0 else original.get('States',{}).get(str(j+1),original))
            st.pop('States',None)
            if j:
                counter+=1;st['GUID']=f'{counter:06x}'
            status=(['Normal','Wounded'] if cmd else ['Full','Disordered','Shaken'])[j]
            sn=copy.deepcopy(n)
            sn.update(name=name,scenario='Megiddo',art_revision='Megiddo R1',label_revision='Megiddo R1',full_figures=count,figures=count,
                      standing_figures=count if cmd or ch or not j else count-max(1,round(count*[0,.25,.5][j])),
                      unit_state=j+1,status_state=j+1,status=status,unit_condition=status,unit_condition_label=status,
                      casualty_percent=0 if cmd else [0,25,50][j],strength_percent=100 if cmd else [100,75,50][j],
                      army_label_color='#234B9A' if eq else '#9F2A21')
            sn['label_identity'].update(name=name,state=j+1,commander=cmd)
            if cmd:
                sn.update(mounted=False,commander_name=name,wounded=j==1,commander_states=['Normal','Wounded'])
                desc=f"{name}\n{n['role']}\n{status}"
            else:
                desc=f"{name}\n{n['label_identity']['type']}\nCV Foot {n['cv_foot']} / Mounted {n['cv_mounted']} | CB {n['combat_bonus'] or '—'} | MD {n['missile_defense']}"
                if ch:
                    sn.update(model_count=1,cart_models_per_base=1,crew_per_cart=2,team_animals=2,profile='Missile Chariot')
                    desc+='\nOne complete chariot and team | 4-inch bow'
            sn['unit_hover']=desc
            st.update(Transform=copy.deepcopy(t),Nickname=name+' | '+status,Description=desc,GMNotes=compact(sn),
                      Tooltip=False,Gravity=False,Autoraise=False,Locked=False,Rigidbody={'Mass':1,'Drag':10,'AngularDrag':1000,'UseGravity':False})
            st['Tags']=[x for x in st['Tags'] if x not in ['GranicusUnit','Lobo_Granicus_Battle_R3','Lobo_Hydaspes_Battle_R1']]+['LoboTerrainGrounding']
            st['CustomMesh'].update(MeshURL=url+spec['meshes'][j],DiffuseURL=url+spec['textures'][j],
                                    ColliderURL=url+('stand-round.obj' if cmd else 'stand-square.obj'),Convex=True,CastShadows=False)
            states.append(st)
        o.clear();o.update(states[0]);o['States']={str(j+2):st for j,st in enumerate(states[1:])}
    scenery=copy.deepcopy(bag['ContainedObjects'][0])
    scenery.update(GUID='fd1100',Nickname='Megiddo | Woodland and camp',Tags=['LoboAncients','LoboBattle','LoboTerrain','LoboNativeManaged'],
                   GMNotes=compact({'loboNativeSlot':GUID+':050','scenic_only':True}),Memo='LoboSlot:'+GUID+':050')
    collider=next(v['CustomMesh']['ColliderURL'] for b in bags if b['GUID']=='fe0002' for v in b['ContainedObjects'] if 'Peripheral date palms' in v['Nickname'])
    scenery['CustomMesh'].update(MeshURL=url+'palms.obj',DiffuseURL=url+'egypt-spears.jpg',ColliderURL=collider,Convex=True,CastShadows=False)
    bag['ContainedObjects'].append(scenery)
    layout={'_guidSlots':{},'_order':[]}
    for i,o in enumerate(bag['ContainedObjects']):
        slot=f'{GUID}:{i+1:03}'
        t=o['Transform'];cm=o['CustomMesh']
        layout['_guidSlots'][o['GUID']]=slot;layout['_order'].append(slot)
        pose={'name':o['Nickname'],'position':[t['posX'],t['posY'],t['posZ']],'rotation':[t['rotX'],t['rotY'],t['rotZ']],
              'scale':[t['scaleX'],t['scaleY'],t['scaleZ']],'locked':o.get('Locked',False),
              'assets':{'mesh':cm['MeshURL'],'texture':cm['DiffuseURL'],'collider':cm['ColliderURL']}}
        if i==0:pose['groundBounds']={'minX':-48,'maxX':48,'minZ':-36,'maxZ':36}
        layout[slot]=pose
    raw=compact(layout).encode()
    bag['GMNotes']=compact({'r28_master_guid':GUID,'r28_packed_layout':base64.b64encode(lz4.block.compress(raw,store_size=False)).decode(),'r28_layout_length':len(raw)})
    bag['Description']='Megiddo R1. Original Egyptian and Canaanite figures, 12 chariot stands and a sculpted Aruna exit.'
    s=data['LuaScript']
    meta=json.loads(block(s,'battleMetadata')[1])
    row=next(v for v in meta['battles'] if v['bag']==GUID)
    row['terrainGuide']=BRIEF.split('TERRAIN AND OBJECTIVES\n')[1].split('\nHISTORICAL')[0]
    row['zoneLines']=[[[x,round(float(terrain(x,z))+.04,5),z] for x in range(-48,49)] for z in [-12,15]]
    s=replace(s,'battleMetadata',meta)
    briefs=json.loads(block(s,'briefingData')[1]);briefs[GUID]=BRIEF;s=replace(s,'briefingData',briefs)
    s,n=re.subn(r"(?<=\['fe0092'\]=')[^']+",url+'fe0092-deployment.jpg',s);assert n==1
    data.update(LuaScript=s,SaveName=TITLE,Description=bag['Description']+' Full collection, 37 battles.')
    tid=max(map(int,data['TabStates']))+1
    data['TabStates'][str(tid)]={'title':'Megiddo R1 - Guide','body':BRIEF,'color':'Grey','visibleColor':{'r':.5,'g':.5,'b':.5},'id':tid}
    deployment(bag)
    if commit=='PENDING':return
    shutil.copytree(BASE,OUT,dirs_exist_ok=True)
    (OUT/SAVE).write_text(compact(data))
    entries=json.loads((BASE/'Expansion-Visual-Cache.json').read_text());host=[]
    for path in sorted(A.iterdir()):
        sha=hashlib.sha256(path.read_bytes()).hexdigest();dest='m1-'+path.name
        shutil.copy2(path,OUT/'ExpansionVisuals'/dest)
        entries.append({'file':dest,'cache':cachekey(url+path.name),'sha256':sha})
        host.append({'file':path.name,'url':url+path.name,'sha256':sha,'bytes':path.stat().st_size})
    (OUT/'Expansion-Visual-Cache.json').write_text(json.dumps(entries,indent=2))
    (ROOT/'hosted-assets.json').write_text(json.dumps(host,indent=2))
    ps=(BASE/'Install-Clash-of-Empires.ps1').read_text(encoding='utf-8-sig').replace('Clash of Empires - Full Collection R8 - Lagash vs Umma R1',TITLE)
    assert TITLE in ps
    (OUT/'Install-Clash-of-Empires.ps1').write_bytes(b'\xef\xbb\xbf'+ps.replace('\r\n','\n').replace('\n','\r\n').encode())
    (OUT/'README-FIRST.txt').write_text(f'{TITLE}\n\n1. Close Tabletop Simulator and extract the entire ZIP.\n2. Run Install-Clash-of-Empires.cmd.\n3. Open Games > Save & Load > {TITLE}.\n4. Select Megiddo, then Load Battle.\n\n'+BRIEF)
if __name__=='__main__':
    main(sys.argv[1] if len(sys.argv)>1 else 'PENDING')
