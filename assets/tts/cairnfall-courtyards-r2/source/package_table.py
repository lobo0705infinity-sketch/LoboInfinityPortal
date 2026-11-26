from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
from copy import deepcopy
import json,re,sys
from courts import SITES,REFIT
BASE=Path(__file__).resolve().parents[1]
PREFIX='assets/tts/cairnfall-courtyards-r2/'
REPO='https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/'
TITLE='Cairnfall Sanctuary - Courtyards R2 - Battleground - Play Table'
NAMES=['Cairnfall-Sanctuary.json','Cairnfall-Top40-Losers-R4.json']
FIELDS=('posX','posY','posZ','rotX','rotY','rotZ')
POSE=re.compile(r'^--([a-f0-9]{6}),([0-9eE+.,\-]+)\r?$',re.M)
def compact(o):return json.dumps(o,ensure_ascii=False,separators=(',',':'))
def load(p):return json.loads(p.read_bytes())
def get_owner(objs):return next(o for o in objs if 'LOBO_STANDARD_VERSION=1' in o.get('LuaScript',''))
def visit(o):
    yield o
    for v in o.get('States',{}).values():yield from visit(v)
def build(sha):
    assert re.fullmatch('[0-9a-f]{40}',sha)
    def url(name):
        assert (BASE/'assets'/name).exists(),name
        return REPO+sha+'/'+PREFIX+name
    def models(o,slug):
        o['CustomMesh'].update(MeshURL=url(slug+'.obj'),ColliderURL=url(slug+'-col.obj'))
    now=datetime.now(ZoneInfo('America/New_York'))
    times=dict(EpochTime=int(now.timestamp()),Date=now.strftime('%m/%d/%Y %I:%M:%S %p'))
    maps=[]
    for name,start in zip(NAMES,[0xcfa210,0xcfa230]):
        save=load(BASE/'base'/name);b=save['ObjectStates'][0];oo=b['ContainedObjects']
        assert len(oo)==78
        oo[1]['CustomMesh']['DiffuseURL']=url('sanctuary-courts-ground.jpg')
        oo[1]['Description']=oo[1]['Description'].replace('Cairnfall Sanctuary R1','Cairnfall Sanctuary | Courtyards R2')
        for idx,slug in [(60,'cloister-roof'),(64,'clinic-roof'),(70,'archive-roof')]:models(oo[idx],slug)
        models(oo[70]['States']['2'],'archive-upper')
        for item in visit(oo[70]):
            item['Description']=item['Description'].replace('Ladders remain with their building.','The stone stair serves the upper terrace. The rooftop planter belongs to the roof state.')
        for item in visit(oo[60]):
            item['Description']=item['Description'].replace('Ladders remain with their building.','The rooftop planter belongs to the roof state.')
        for obj,slug in [(oo[60],'cloister-roof'),(oo[70],'archive-roof'),(oo[70]['States']['2'],'archive-upper')]:
            heights=[float(line.split()[2]) for line in (BASE/'assets'/(slug+'.obj')).read_text().splitlines() if line.startswith('v ')]
            obj['Description']=re.sub(r'(Height \(base to top\): )[\d.]+( in)',lambda m:m[1]+f'{max(heights)-min(heights):.2f}'+m[2],obj['Description'])
        gone={oo[i]['GUID'] for i in (69,71)};owner=get_owner(oo)
        m=re.search(r'^ local config=JSON.decode\((.+)\)$',owner['LuaScript'],re.M)
        cfg=json.loads(json.loads(m[1]));assert gone<=cfg['guids'].keys()
        for guid in gone:del cfg['guids'][guid]
        terrain=[o for o in oo if o['GUID'] not in gone]
        lines=[line for line in b['LuaScript'].splitlines() if not (line.startswith('--') and line[2:8] in gone and line[8:9]==',')]
        eol='\r\n' if '\r\n' in b['LuaScript'] else '\n'
        reposition={}
        for idx,(x,y,z,yaw,label) in REFIT.items():
            for state in visit(oo[idx]):
                pose=(x,y,z,0.,yaw,0.)
                state['Transform'].update(zip(FIELDS,pose));reposition[state['GUID']]=pose
                if label:state['Nickname']=label
        for i,line in enumerate(lines):
            if line.startswith('--') and line[8:9]==',' and line[2:8] in reposition:
                lines[i]='--'+line[2:8]+','+','.join(format(v,'.10g') for v in reposition[line[2:8]])
        for n,(slug,label,desc,(x,z),yaw) in enumerate(SITES):
            guid=f'{start+n:06x}';assert guid not in cfg['guids']
            site=deepcopy(oo[76]);site.update(GUID=guid,Nickname=label,Description=desc)
            transform=(x,4.,z,0.,yaw,0.)
            site['Transform'].update(zip(FIELDS,transform));models(site,slug)
            site['CustomMesh'].update(DiffuseURL=url('courtyard-materials.jpg'),NormalURL=url('courtyard-relief.png'),Convex=False)
            terrain.append(site);cfg['guids'][guid]=True
            lines.append('--'+guid+','+','.join(format(v,'.10g') for v in transform))
        owner['LuaScript']=owner['LuaScript'][:m.start(1)]+json.dumps(compact(cfg))+owner['LuaScript'][m.end(1):]
        b.update(ContainedObjects=terrain,LuaScript=eol.join(lines)+eol,Description='Cairnfall Sanctuary | Courtyards R2. Drop this Battleground map bag on the Infinity Stage to deploy.')
        save.update(times);(BASE/'release'/name).write_text(compact(save));maps.append(b)
    room=load(BASE/'base/Play-Table.json');room.update(times,SaveName=TITLE)
    old=load(BASE/'base'/NAMES[0])['ObjectStates'][0]['ContainedObjects']
    prior={o['GUID']for o in old}
    assert len(prior.intersection(o['GUID']for o in room['ObjectStates']))==len(prior)
    room['ObjectStates']=[o for o in room['ObjectStates'] if o['GUID'] not in prior]
    b=maps[0];pose={m[1]:[float(v)for v in m[2].split(',')]for m in POSE.finditer(b['LuaScript'])}
    for o in deepcopy(b['ContainedObjects']):
        for state in visit(o):
            if state['GUID'] in pose:state['Transform'].update(zip(FIELDS,pose[state['GUID']]))
        room['ObjectStates'].append(o)
    (BASE/'release/Play-Table.json').write_text(compact(room))
if __name__=='__main__':build(sys.argv[1])
