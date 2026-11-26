"""Assemble the R8 play table, Stage map, Workshop shelf and optional loose props from the approved R7 save."""
from copy import deepcopy
from pathlib import Path
import json,math,re,sys
BASE=Path(__file__).resolve().parents[1]
def revision(n):
    return next(p for p in [BASE.parent/f'azure{n}',BASE.parent/f'azure-palace-r{n}'] if p.is_dir())
PRIOR=revision(7)/'Release';OUTPUT=BASE/'Release'
TAG='LoboMap:87b699';BAG='87b699';CONSOLES=('adb046','16bc4c')
def read(path):return json.loads(path.read_bytes())
def write(path,item):path.write_text(json.dumps(item,ensure_ascii=False,separators=(',',':')))
def objects(node):
    yield node
    for child in [*node.get('States',{}).values(),*node.get('ChildObjects',[]),*node.get('ContainedObjects',[])]:yield from objects(child)
def register(controller,scene):
    ids=[n['GUID']for o in scene for n in objects(o)]
    assert len(ids)==len(set(ids))
    script=controller['LuaScript']
    m=re.search(r'local config=JSON.decode\(\[==\[(.*?)\]==\]\)',script,re.S)
    cfg=json.loads(m[1]);cfg['owned']=ids
    script=script[:m.start(1)]+json.dumps(cfg,ensure_ascii=False,separators=(',',':'))+script[m.end(1):]
    head,tail=script.split('-- BEGIN LOBO STANDARD MAP CONTROLS V1',1)
    m=re.search(r'local config=JSON.decode\(("[^\n]*")\)',tail)
    cfg=json.loads(json.loads(m[1]));cfg['guids']=dict.fromkeys(ids,True)
    controller['LuaScript']=head+'-- BEGIN LOBO STANDARD MAP CONTROLS V1'+tail[:m.start(1)]+json.dumps(json.dumps(cfg,separators=(',',':')))+tail[m.end(1):]
def stage(bag,scene):
    keys=['posX','posY','posZ','rotX','rotY','rotZ'];rows=[]
    for root in scene:
        for obj in [root,*root.get('States',{}).values()]:
            rows.append('--'+obj['GUID']+','+','.join(format(obj['Transform'][k],'.10g')for k in keys))
    bag['LuaScript']='\r\n'.join(rows)+'\r\n';bag['ContainedObjects']=deepcopy(scene)
    for o in bag['ContainedObjects']:o['Transform'].update(posX=70,posY=100,posZ=70)
def make(url):
    rooturl=url.rstrip('/')+'/'
    play=read(PRIOR/'Play-Table.json');collection=read(PRIOR/'Workshop-Save.json')
    packed=read(PRIOR/'Azure-Palace.json');bag=packed['ObjectStates'][0]
    shelf=read(PRIOR/'Azure-Palace-Scatter.json');loose=shelf['ObjectStates'][0]
    scene=[o for o in play['ObjectStates'] if TAG in o.get('Tags',[])]
    ground=scene[0]['Transform']['posY']; template=deepcopy(next(o for o in scene if o['GUID'] in CONSOLES))
    donor=next(o for b in collection['ObjectStates'] if 'Ironveil' in b.get('Nickname','') for o in b.get('ContainedObjects',[]) if 'DAF1E5' in o.get('CustomAssetbundle',{}).get('AssetbundleURL',''))
    data=read(BASE/'Review/cache/console-bounds.json');x,z=data['center']
    for o in scene:
        if o['GUID'] in CONSOLES:
            o['Name']=donor['Name'];o['CustomAssetbundle']=deepcopy(donor['CustomAssetbundle']);del o['CustomMesh']
            o['Nickname']+=' | Standard 40 mm Console'
            o['Description']='Crossing Lines communication antenna. Use a player token to mark control.\n40 mm console by Micro Art Studio, painted by MiG.'
            # At 270 degrees, a local (x,z) point is (-z,x) in world space.
            t=o['Transform'];t.update(posX=round(t['posX']+z,7),posZ=round(t['posZ']-x,7),posY=round(ground-data['bottom'],7),rotY=270)
    taken={o.get('GUID') for root in [*collection['ObjectStates'],*play['ObjectStates'],loose] for o in objects(root)}
    config=read(BASE/'Source/scatter.json')
    for spec in config:
        slug=spec['slug'];x,z,angle=spec['pose']
        assert spec['guid'] not in taken and spec['copy'] not in taken
        taken.update((spec['guid'],spec['copy']))
        obj=deepcopy(template);obj.update(GUID=spec['guid'],Nickname=spec['name'],Description=spec['description'],GMNotes=TAG+' Azure Palace R8',Tags=[TAG,'AzurePalaceScatter'],Locked=True,LuaScript='')
        obj['Transform'].update(posX=x,posY=ground,posZ=z,rotY=angle)
        obj['CustomMesh'].update(MeshURL=rooturl+slug+'.obj',ColliderURL=rooturl+slug+'-col.obj',DiffuseURL=rooturl+slug+'-diffuse.jpg',NormalURL='',Convex=False)
        scene.insert(-1,obj)
        copy=deepcopy(obj);copy.update(GUID=spec['copy'],GMNotes='Azure Palace R8 optional resort furniture',Tags=['AzurePalaceScatter'],Locked=False)
        copy['Transform'].update(posX=0,posY=2,posZ=0,rotY=0);loose['ContainedObjects'].append(copy)
    register(scene[-1],scene)
    play['ObjectStates']=[o for o in play['ObjectStates']if TAG not in o.get('Tags',[])]+scene
    play['SaveName']=play['SaveName'].replace('Azure Palace R7','Azure Palace R8')
    for key in ('Nickname','Description'):bag[key]=bag[key].replace('R7','R8')
    stage(bag,scene)
    loose['Nickname']=loose['Nickname'].replace('R7','R8')
    loose['Description']='Includes the baggage buggy, pool loungers, banquet-table dolly and housekeeping cart, along with the sixteen earlier pieces.'
    i=next(i for i,o in enumerate(collection['ObjectStates'])if o['GUID']==BAG)
    member=deepcopy(bag);member['Transform']=collection['ObjectStates'][i]['Transform'];collection['ObjectStates'][i]=member
    for key in ('SaveName','LuaScript'):collection[key]=collection[key].replace('Azure Palace R7','Azure Palace R8')
    for name,item in [('Play-Table.json',play),('Azure-Palace.json',packed),('Workshop-Save.json',collection),('Azure-Palace-Scatter.json',shelf)]:write(OUTPUT/name,item)
    print(len(scene),'map objects;',len(loose['ContainedObjects']),'optional pieces')
if __name__=='__main__':make(sys.argv[1])
