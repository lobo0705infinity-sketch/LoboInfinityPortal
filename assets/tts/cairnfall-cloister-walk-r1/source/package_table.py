import copy,json,re,sys
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
from layout import MOVES
from materials import ROOT,OUT
PREFIX='assets/tts/cairnfall-cloister-walk-r1/'
REPO='https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/'
NEW=[('patient-receiving','Apse Field Clinic | Receiving gallery','The covered entrance serves the clinic stairs and ramp. The linen trolley and folded stretcher are kept in the equipment bay.',(17,4,-6.4)),
 ('well-court-fountain','East Gate | Pilgrims’ drinking fountain','Spring water feeds the trough on the sheltered face of the Guesthouse windbreak.',(15.72,4,7.28)),
 ('physic-herb-rack','Cloister physic garden | Herb drying rack','The gardeners hang cut herbs in the shade against the west garden wall.',(-5.89,4,-4.20))]
def compact(o):return json.dumps(o,ensure_ascii=False,separators=(',',':'))
def load(p):return json.loads(p.read_bytes())
def get_owner(objs):return next(o for o in objs if 'LOBO_STANDARD_VERSION=1' in o.get('LuaScript',''))
fields=('posX','posY','posZ','rotX','rotY','rotZ')
def replace_poses(bag,updates):
    src=bag['LuaScript'];eol='\r\n' if '\r\n' in src else '\n';found=set();lines=[]
    for line in src.splitlines():
        if re.match(r'^--[0-9a-f]{6},',line) and line[2:8] in updates:
            key=line[2:8];line='--'+key+','+','.join(format(n,'.10g') for n in updates[key]);found.add(key)
        lines.append(line)
    for key,p in updates.items():
        if key not in found:lines.append('--'+key+','+','.join(format(n,'.10g') for n in p))
    bag['LuaScript']=eol.join(lines)+eol
def visit(obj):
    yield obj
    for s in (obj.get('States') or {}).values():yield from visit(s)
def build(sha):
    assert re.fullmatch('[a-f0-9]{40}',sha)
    def url(name):
        assert (OUT/name).is_file(),name
        return REPO+sha+'/'+PREFIX+name
    stages={};now=datetime.now(ZoneInfo('America/New_York'));date=now.strftime('%m/%d/%Y %I:%M:%S %p')
    for g,baseid in [('100326',int('cfac10',16)),('bc00b7',int('cfac20',16))]:
        save=load(ROOT/'base'/(g+'.json'));b=save['ObjectStates'][0];objs=b['ContainedObjects']
        assert len(objs)==75
        objs[1]['CustomMesh']['DiffuseURL']=url('cloister-walk-ground.jpg')
        objs[2]['CustomMesh'].update(MeshURL=url('clinic-landing.obj'),ColliderURL=url('clinic-landing-col.obj'))
        objs[64]['CustomMesh'].update(MeshURL=url('clinic-roof-porch.obj'),ColliderURL=url('clinic-roof-porch-col.obj'),DiffuseURL=url('clinic-and-porch.jpg'))
        updates={};owner=get_owner(objs);script=owner['LuaScript'];cfgmatch=re.search(r'^ local config=JSON.decode\((.+)\)$',script,re.M);cfg=json.loads(json.loads(cfgmatch[1]))
        for i,(x,y,z,yaw,name) in MOVES.items():
            o=objs[i];pose=(x,y,z,0.,yaw,0.)
            for alt in visit(o):
                alt['Transform'].update(dict(zip(fields,pose,strict=True)))
                if i==74:alt['Nickname']='Autumn tree 5 | Physic garden maple | '+('Leaves off' if alt is not o else 'Leaves on')
                else:alt['Nickname']=name
                updates[alt['GUID']]=pose
        # Stage defines only stored active roots and whichever alternate poses the original bag already defines.
        active={o['GUID'] for o in objs};old_placements={m[1]for m in re.finditer(r'^--([0-9a-f]{6}),',b['LuaScript'],re.M)}
        updates={k:v for k,v in updates.items() if k in active or k in old_placements}
        for j,(slug,name,desc,p) in enumerate(NEW):
            guid=f'{baseid+j:06x}';assert guid not in cfg['guids'];o=copy.deepcopy(objs[19]);pose=(*p,0.,0.,0.)
            o.update(GUID=guid,Nickname=name,Description=desc,LuaScript='',LuaScriptState='',GMNotes=' '.join(cfg['tags']),Tags=list(dict.fromkeys([*cfg['tags'],'scenery'])),Locked=True)
            o['Transform'].update(dict(zip(fields,pose,strict=True)),scaleX=1.,scaleY=1.,scaleZ=1.)
            o['CustomMesh'].update(MeshURL=url(slug+'.obj'),ColliderURL=url(slug+'-col.obj'),DiffuseURL=url('sanctuary-craft.jpg'),NormalURL=url('sanctuary-craft-normal.png'),Convex=False)
            objs.append(o);updates[guid]=pose;cfg['guids'][guid]=True
        owner['LuaScript']=script[:cfgmatch.start(1)]+json.dumps(compact(cfg))+script[cfgmatch.end(1):]
        replace_poses(b,updates)
        # Keep the shelf names and map IDs so mission resolution and tournament labels still work.
        b['Description']='Cloister Walk R1. Cairnfall Sanctuary for Battleground. Drop the bag on the Infinity Stage to deploy the revised sanctuary.'
        save.update(Date=date,EpochTime=int(now.timestamp()));stages[g]=save
        fname='Cairnfall-Sanctuary.json' if g=='100326' else 'Cairnfall-Top40-Losers-R4.json'
        (ROOT/'release'/fname).write_text(compact(save))
    # The active release's clean play room supplies the same sideboards, order panel and table controls.
    room=load(ROOT/'base/Play-Room.json');room['SaveName']='Cairnfall Sanctuary - Cloister Walk R1 - Battleground - Play Table'
    room['ObjectStates']=[o for o in room['ObjectStates'] if 'LoboMap:1002d9' not in o.get('Tags',[])]
    b=stages['100326']['ObjectStates'][0];position={m[1]:[float(v) for v in m[2].split(',')] for m in re.finditer(r'^--([a-f0-9]{6}),([0-9eE+.,\-]+)\r?$',b['LuaScript'],re.M)}
    for obj in copy.deepcopy(b['ContainedObjects']):
        for alt in visit(obj):
            if alt['GUID'] in position:alt['Transform'].update(dict(zip(fields,position[alt['GUID']],strict=True)))
        room['ObjectStates'].append(obj)
    owner=get_owner(room['ObjectStates']);sky=json.loads(json.loads(re.search(r'^local backgroundConfig=JSON.decode\((.+)\)$',owner['LuaScript'],re.M)[1]))
    room.update(Date=date,EpochTime=int(now.timestamp()),SkyURL=sky['day'])
    comp=room.get('ComponentTags',{}).get('labels',[]);exists={e['normalized'] for e in comp}
    for obj in b['ContainedObjects']:
        for alt in visit(obj):
            for tag in alt.get('Tags',[]):
                if tag.lower() not in exists:comp.append({'displayed':tag,'normalized':tag.lower()});exists.add(tag.lower())
    (ROOT/'release/Play-Table.json').write_text(compact(room))
if __name__=='__main__':build(sys.argv[1])
