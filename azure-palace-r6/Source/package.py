"""Build the R6 play table, standalone bag and Workshop collection from the released R5 save."""
import hashlib, re, sys
from copy import deepcopy
from common import *

R5=release(5)
TAG='LoboMap:87b699'
BAG='87b699'
RELEASE=ROOT/'Release'

def build(base):
    base=base.rstrip('/')+'/'
    old_assets=R5/'Assets'
    changed={}
    cache={}
    def update(mesh,field,file):
        if file not in cache:
            payload=(OUT/file).read_bytes()
            cache[file]=None if payload==(old_assets/file).read_bytes() else changed.setdefault(hashlib.sha256(payload).hexdigest(),file)
        if cache[file]:mesh[field]=base+cache[file]
    play=read(R5/'Release/Play-Table.json')
    scene=[o for o in play['ObjectStates'] if TAG in o.get('Tags',[])]
    update(scene[0]['CustomMesh'],'DiffuseURL','palace-courts.jpg')
    for building,slug in zip(scene[1:13],poses,strict=True):
        for state,index in [(building,1)]+[(v,int(i)+1)for i,v in building['States'].items()]:
            stem=f'{slug}-{index}'
            for field,suffix in [('MeshURL','.obj'),('ColliderURL','-col.obj')]:
                update(state['CustomMesh'],field,stem+suffix)
                child,=state['ChildObjects']
                update(child['CustomMesh'],field,slug+'-court'+suffix)
            if slug in ('east-villa','laundry'):
                child['Description']='Private walled guest garden and planting.' if slug=='east-villa' else 'Screened service delivery yard with linen lockers and trolley.'
                child['GMNotes']=child['GMNotes'].replace('Azure Palace R5','Azure Palace R6')
    play['SaveName']=play['SaveName'].replace('Azure Palace R5','Azure Palace R6')
    write(RELEASE/'Play-Table.json',play)

    saved=read(R5/'Release/Azure-Palace.json')
    bag=saved['ObjectStates'][0]
    bag['Nickname']=bag['Nickname'].replace('R5','R6')
    bag['Description']=bag['Description'].replace('R5','R6')
    for i,old_packed in enumerate(bag['ContainedObjects']):
        assert old_packed['GUID']==scene[i]['GUID']
        packed=deepcopy(scene[i])
        packed['Transform']=old_packed['Transform']
        bag['ContainedObjects'][i]=packed
    write(RELEASE/'Azure-Palace.json',saved)

    extra=read(R5/'Release/Azure-Palace-Scatter.json')
    extra['ObjectStates'][0]['Nickname']=extra['ObjectStates'][0]['Nickname'].replace('R5','R6')
    write(RELEASE/'Azure-Palace-Scatter.json',extra)
    collection=read(R5/'Release/Workshop-Save.json')
    i=next(i for i,o in enumerate(collection['ObjectStates'])if o['GUID']==BAG)
    item=deepcopy(bag);item['Transform']=collection['ObjectStates'][i]['Transform']
    collection['ObjectStates'][i]=item
    for k in ['SaveName','LuaScript']:collection[k]=collection[k].replace('Azure Palace R5','Azure Palace R6')
    write(RELEASE/'Workshop-Save.json',collection)
    write(ROOT/'Review/url-names.json',sorted(changed.values()))
    print(len(changed),'revised asset downloads;',len(scene),'deployed map objects.',flush=True)

if __name__=='__main__':build(sys.argv[1])
