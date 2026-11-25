"""Install the same R4 district into the immediate table, stage bag and Workshop shelf."""
import re
from copy import deepcopy
from hashlib import sha256
from rooftops import *

BASE_URL='https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/'
CONFIG=re.compile(r'^(\s*local config=JSON\.decode\()(.*)(\)\s*)$',re.M)
POS=('posX','posY','posZ','rotX','rotY','rotZ')
MAP_RULES = (
    'Open air between buildings is impassable. Only Troopers with Terrain (Zero-G) or '
    'Terrain (Total) may move through it. All Troopers may use the bridges.\n\n'
    'Each cloud bank is a Zero Visibility Zone.'
)


def compact(obj):return json.dumps(obj,ensure_ascii=True,separators=(',',':'))


def level_description(interiors):
    if not interiors:return 'Roof-only tower. Reach the rooftop from its skybridges.'
    if interiors==1:return 'State 1 opens the furnished interior. State 2 shows the roof. An internal ladder connects them.'
    return 'States 1 and 2 open their furnished interiors. State 3 shows the roof. Yellow ladders connect the levels.'


def photo_child(parent,key,state,url):
    guid=sha256(f'Cloudbreak R4 lab {key} {state}'.encode()).hexdigest()[:6]
    mesh=deepcopy(parent['CustomMesh'])
    mesh.update(MeshURL=url+f'lab-window-{key}.obj',DiffuseURL=url+'calibration-lab.jpg',ColliderURL=url+'lab-window-proxy-col.obj',Convex=True)
    return {'GUID':guid,'Name':'Custom_Model','Nickname':T[key].name+' | weather instrument lab','Transform':xform(0,0,0),
        'Description':'Upper-tower meteorology lab behind the window mullions.','GMNotes':'CloudbreakArrayR4 integrated glazing',
        'ColorDiffuse':{'r':1,'g':1,'b':1},'Tags':['weather-lab-glazing'],'Locked':True,'DragSelectable':False,'Grid':False,
        'Snap':False,'Hands':False,'Tooltip':False,'Autoraise':False,'Sticky':True,'CustomMesh':mesh,'LuaScript':'','LuaScriptState':'','XmlUI':''}


def revise_tower(o,k,url,windows):
    t=T[k];interiors=t.n-1
    former=o.pop('States')
    new_states={}
    for index in range(1,t.n+1):
        roof=index==t.n
        state=o if roof else former[str(index+1)]
        state['Nickname']=t.name+(' | Roof' if roof else f' | Level {index} interior')
        state['Description']=level_description(interiors)
        if roof and greenhouse(k):state['Description']+=' The glasshouse has three open lanes through both ends.'
        if roof and t.n==1:state['Description']+=' The service hatch is sealed.'
        state['GMNotes']=state['GMNotes'].replace('CloudbreakArrayR3','CloudbreakArrayR4')
        model=tower_name(k,index)
        state['CustomMesh'].update(MeshURL=url+model+'.obj',ColliderURL=url+model+'-col.obj')
        for child in state.get('ChildObjects',[]):
            child['Transform']['posY']=round(child['Transform']['posY']-PITCH,5)
            child['GMNotes']=child['GMNotes'].replace('CloudbreakArrayR3','CloudbreakArrayR4')
        if windows[k]:state.setdefault('ChildObjects',[]).append(photo_child(state,k,index,url))
        if not roof:new_states[str(index)]=state
    if new_states:o['States']=new_states


def patch_controls(owner,obsolete):
    oldrules=None
    def sub(m):
        nonlocal oldrules
        cfg=json.loads(json.loads(m[2]))
        if 'rules' in cfg:
            oldrules=cfg['rules']
            assert oldrules.startswith(MAP_RULES)
            cfg['rules']=MAP_RULES
            cfg['missionUrl']=MISSION_URL
            cfg['supports']={g:{s:b for s,b in states.items() if s not in obsolete} for g,states in cfg['supports'].items()}
        else:
            cfg['guids']={g:value for g,value in cfg['guids'].items() if g not in obsolete}
        return m[1]+compact(compact(cfg))+m[3]
    script=CONFIG.sub(sub,owner['LuaScript'])
    start=script.index('local function draw()\n')
    end=script.index('local function refresh()\n',start)
    script=script[:start]+(ROOT/'src/map_guides.lua').read_text()+'\n'+script[end:]
    replacements={
        'function loboStandardMissionOpen(player)if player then missionReaders[player.color]=true;missionPanel()end end':
            'function loboStandardMissionOpen(player) cloudMissionLink(player) end',
        "width='660',height='540',color='#10212AFB'":"width='660',height='202',color='#10212AFB'",
        "width='620',height='448',fontSize='16'":"width='620',height='125',fontSize='16'",
    }
    for previous,updated in replacements.items():
        assert script.count(previous)==1,previous
        script=script.replace(previous,updated)
    owner['LuaScript']=script
    return oldrules


def deploy(sha):
    url=BASE_URL+sha+'/cloudbreak-array-r4/assets/'
    windows=json.loads((WORK/'windows.json').read_text())
    table=deepcopy(R3_TABLE)
    collection=json.loads((R3/'out/Workshop-Save.json').read_text())
    saved=json.loads((R3/'out/Cloudbreak-Array.json').read_text());bag=saved['ObjectStates'][0]
    obsolete=RETIRED|{o['States']['1']['GUID'] for o in ROOFS.values()}
    table['ObjectStates']=[o for o in table['ObjectStates'] if o.get('GUID') not in RETIRED]
    owned=[o for o in table['ObjectStates'] if TAG in o.get('Tags',[])]
    for o in owned:
        m=slug(o);tr=o['Transform'];o['GMNotes']=o.get('GMNotes','').replace('CloudbreakArrayR3','CloudbreakArrayR4')
        if m.startswith('tower-'):revise_tower(o,m.split('-')[1],url,windows)
        elif m.startswith('bridge-'):
            if o['GUID'] not in RELAND:tr['posY']=round(tr['posY']-PITCH,5)
            lev=1+round((tr['posY']-BASE_Y)/PITCH)
            o['Description']=re.sub(r'Level \d+ walking deck',f'Level {lev} walking deck',o['Description'])
        elif 'CloudbreakEditableCloud' in o.get('Tags',[]):
            original=tr['posY'];base=max(MAT_Y+.11,original-PITCH);top=original-PITCH+tr['scaleY']
            tr.update(posY=round(base,5),scaleY=round(top-base,5))
        elif m.startswith(('aerostat-','moored-')) or 'mission' in o.get('Tags',[]):
            tr['posY']=round(tr['posY']-PITCH,6)
        elif o['GUID']=='cb7101':
            o['CustomMesh']['DiffuseURL']=url+'city-shafts.jpg'
            o['Description']='A view down the tower facades to the streets and lower roofs of Harmony City. The printed city and thin mist are scenery.'
    before=patch_controls(next(o for o in owned if o['GUID']=='cb7102'),obsolete)
    oldname=bag['Nickname'];newname=oldname.removesuffix('R3')+RELEASE
    def stage(b):
        b.update(Nickname=newname,Description='Network Node | Harmony City. 16 towers, 13 enterable floors, 26 skybridges, 23 editable cloud banks and five airships.',GMNotes='CloudbreakArrayR4')
        b['ContainedObjects']=deepcopy(owned)
        records=[]
        for o in b['ContainedObjects']:
            for st in [o,*o.get('States',{}).values()]:
                records.append('--'+st['GUID']+','+','.join(str(st['Transform'][k]) for k in POS))
            o['Transform'].update(posX=70,posY=100,posZ=70)
        b['LuaScript']='\r\n'.join(records)+'\r\n'
    stage(bag);stage(next(o for o in collection['ObjectStates'] if o['GUID']==BAG))
    for doc in (table,collection):
        doc['SaveName']=doc['SaveName'].replace(' R3',' '+RELEASE)
        doc['LuaScript']=doc['LuaScript'].replace(oldname,newname)
        tab=next(t for t in doc['TabStates'].values() if t['title']=='Cloudbreak Array | Network Node')
        assert before in tab['body']
        tab['body']=tab['body'].replace(before,MAP_RULES)
    for name,doc in [('Play-Table',table),('Workshop-Save',collection),('Cloudbreak-Array',saved)]:
        (OUT/(name+'.json')).write_text(compact(doc))


if __name__=='__main__':deploy(sys.argv[1])
