"""Attach corrected render meshes and the porter lodge in all normal Azure Palace entry points."""
from copy import deepcopy
import hashlib
import importlib.util
import sys
from common import *
from import_meshes import PARTS

R6=release(6)
TAG='LoboMap:87b699'
BAG='87b699'
OUTPUT=ROOT/'Release'
def walk(node):
    yield node
    for child in [*node.get('States',{}).values(),*node.get('ChildObjects',[]),*node.get('ContainedObjects',[])]:
        yield from walk(child)

def build(base):
    assets=base.rstrip('/')+'/'
    play=read(R6/'Release/Play-Table.json')
    collection=read(R6/'Release/Workshop-Save.json')
    taken={node.get('GUID') for save in (play,collection) for root in save['ObjectStates'] for node in walk(root)}
    def child_guid(owner,file):
        attempt=0
        while True:
            key=f'azure-palace-r7:{owner}:{file}:{attempt}'.encode()
            guid=hashlib.sha256(key).hexdigest()[:6]
            if guid not in taken:
                taken.add(guid);return guid
            attempt+=1
    def apply_mesh(node,file):
        node['CustomMesh']['MeshURL']=assets+file+'.obj'
        node['CustomMesh']['ColliderURL']=assets+file+'-col.obj'
        node['GMNotes']=TAG+' Azure Palace R7'
    scene=[o for o in play['ObjectStates']if TAG in o.get('Tags',[])]
    scene[0]['CustomMesh']['DiffuseURL']=assets+'palace-arrivals.jpg'
    for slug,building in zip(poses,scene[1:13],strict=True):
        if slug not in PARTS and slug!='reception':continue
        for obj in [building,*building.get('States',{}).values()]:
            original,=obj['ChildObjects']
            extra=deepcopy(original)
            if slug=='reception':
                file='reception-porter-lodge';extra['Nickname']="Resort Reception | Porter's lodge"
                extra['Description']='Hotel luggage lockers, bell desk and covered arrivals bench.'
            else:
                first,file=PARTS[slug][2]
                apply_mesh(original,first)
                extra['Nickname']='East Guest Villa | Private garden' if slug=='east-villa' else 'Azure Spa | Garden court'
            apply_mesh(extra,file)
            extra['GUID']=child_guid(obj['GUID'],file)
            obj['ChildObjects'].append(extra)
    spec=importlib.util.spec_from_file_location('azure_controls',release(5)/'Source/package.py')
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
    mod.controls(scene[-1],scene)
    play['SaveName']=play['SaveName'].replace('Azure Palace R6','Azure Palace R7')
    write(OUTPUT/'Play-Table.json',play)

    saved=read(R6/'Release/Azure-Palace.json');bag=saved['ObjectStates'][0]
    bag['Nickname']=bag['Nickname'].replace('R6','R7')
    bag['Description']=bag['Description'].replace('R6','R7')
    for i,old in enumerate(bag['ContainedObjects']):
        assert old['GUID']==scene[i]['GUID']
        member=deepcopy(scene[i]);member['Transform']=old['Transform']
        bag['ContainedObjects'][i]=member
    write(OUTPUT/'Azure-Palace.json',saved)
    extra=read(R6/'Release/Azure-Palace-Scatter.json')
    extra['ObjectStates'][0]['Nickname']=extra['ObjectStates'][0]['Nickname'].replace('R6','R7')
    write(OUTPUT/'Azure-Palace-Scatter.json',extra)
    i=next(i for i,o in enumerate(collection['ObjectStates']) if o['GUID']==BAG)
    member=deepcopy(bag);member['Transform']=collection['ObjectStates'][i]['Transform']
    collection['ObjectStates'][i]=member
    for key in ['SaveName','LuaScript']:collection[key]=collection[key].replace('Azure Palace R6','Azure Palace R7')
    write(OUTPUT/'Workshop-Save.json',collection)
    print(play['SaveName'],sum(len(n.get('ChildObjects',[]))for k in scene for n in [k,*k.get('States',{}).values()]),'state-specific child attachments.',flush=True)

if __name__=='__main__':build(sys.argv[1])
