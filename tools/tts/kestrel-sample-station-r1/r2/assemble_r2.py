from common import *
from copy import deepcopy
import sys

TAG='LoboMap:1008da'
TITLE='Kestrel Lunar Base - Sample Station R2 - Data Harvest - Play Table'
def build(ref='LOCAL'):
    b=original_r1()
    b['Nickname']='SET_ITS18 Data Harvest — Kestrel Lunar Base | Sample Station R2'
    b['Description']='Native Infinity Stage bag. Kestrel Sample Station R2. Data Harvest with three Tech-Coffins, level lunar highlands, sample cartway, thermal assay shutters, algae culture benches and a crew rover service bay.'
    b['ContainedObjects']=[o for o in b['ContainedObjects'] if o['GUID'] not in BLANKED]
    roots=b['ContainedObjects'];by={o['GUID']:o for o in roots}
    base_url=RAW+ref+'/'+RELEASE+'/'
    for i in range(4):
        guid=f'c7b00{i}';o=by[guid];name=f'highlands-{i+1}'
        o['Description']='Continuous lunar regolith with solid bedrock ridges. The sample cartway and crew service apron are part of the ground surface.'
        o['CustomMesh'].update(MeshURL=base_url+name+'.obj',ColliderURL=base_url+name+'-collider.obj',DiffuseURL=base_url+'station-ground-r2.jpg')
    rig=by['e51005'];rig['Nickname']='Western field station | Core drill and winch skid'
    rig['Description']='The field team services its core drill and retrieval winch on the western sampling pad.'
    rig['CustomMesh']['DiffuseURL']=base_url+'field-rig-finishes.jpg'
    # Park the freight and telemetry off the widened cartway.
    by['c70040']['Transform'].update(posX=6.43,posZ=-22.61,rotY=90.0)
    by['c70043']['Transform'].update(posX=20.93)
    by['c70047']['Transform'].update(posX=22.92,posZ=13.00)
    template=by['e51004']
    def model(ident,name,description,stem,child=False):
        o=deepcopy(template);o['GUID']=ident;o['Nickname']=name;o['Description']=description
        o['Transform']={k:(1.0 if k.startswith('scale') else 0.0) for k in template['Transform']}
        o['Tags']=['KestrelOrbital',TAG,'scenery','building-detail' if child else 'scatter']
        o['CustomMesh'].update(MeshURL=base_url+stem+'.obj',ColliderURL=base_url+stem+'-collider.obj',DiffuseURL=base_url+'lab-and-bay-finishes.jpg')
        if child:o['DragSelectable']=False;o['Tooltip']=False
        return o
    assay=by['c70014']
    shutters=model('e52021','Assay dome | Articulated thermal shutters','Exterior insulated shutter bank above the laboratory.','assay-shutters',True)
    assay.setdefault('ChildObjects',[]).append(shutters)
    assay['Description']+='\nThe amber thermal shutters lift away with the glazed roof.'
    old=by['c7a302'];states=old.pop('States');frame=states['2'];closed=states['3'];closed['States']={'1':old,'2':frame}
    roots[roots.index(old)]=closed
    closed['ChildObjects'][0]['CustomMesh']['DiffuseURL']=base_url+'culture-glass.png'
    closed['ChildObjects'][0]['ColorDiffuse'].update(r=.83,g=.97,b=.90,a=.20)
    for i,v in enumerate([old,frame,closed],1):
        v.setdefault('ChildObjects',[]).append(model('e5203'+str(i),'Culture lab | Algae photobioreactor rows','Two banks of green culture channels with white headers and recirculation manifolds.','algae-rows',True))
        v['Description']+='\nThe culture benches stay with the laboratory in each state.'
    bay=model('e52010','Crew quarters | Rover service bay','Ramped service pad, screw jack, wire-mesh spare and a solid outboard equipment screen. Open access is on the habitat side.','rover-service-bay')
    bay['Transform'].update(posX=22.52,posY=6.25,posZ=16.98)
    roots.append(bay)
    anchor=by['c70000']
    anchor['Description']='Kestrel Lunar Base | Sample Station R2. Data Harvest. The sample cartway leads from the shuttle to the dust lock and the shuttered assay dome. The crew service bay sits beside the habitat.'
    lua=anchor['LuaScript'].replace('Impact basins, dust-softened crater rims and connected ridgelines shape the lunar ground.','Continuous bedrock ridges, a sample cartway and a recessed rover service bay shape the lunar ground.')
    prefix=' local config=JSON.decode(';cfg=next(l for l in lua.splitlines() if l.startswith(prefix));obj=json.loads(json.loads(cfg[len(prefix):-1]))
    for guid in BLANKED:obj['guids'].pop(guid,None)
    for o in roots:
        for s in [o,*o.get('States',{}).values()]:obj['guids'][s['GUID']]=True
    anchor['LuaScript']=lua.replace(cfg,prefix+json.dumps(json.dumps(obj,separators=(',',':')))+')')
    records=[v for r in roots for v in [r,*r.get('States',{}).values()]]
    axes=('posX','posY','posZ','rotX','rotY','rotZ')
    b['LuaScript']='\r\n'.join('--'+o['GUID']+','+','.join(f"{o['Transform'][a]:.9f}" for a in axes) for o in records)+'\r\n'
    return b
def room(b):
    s=read(WORK/'room.json')
    s['ObjectStates']=[o for o in s['ObjectStates'] if TAG not in o.get('Tags',[])]+deepcopy(b['ContainedObjects'])
    s['SaveName']=TITLE;s['Note']='Kestrel Lunar Base. Sample Station R2 playtest for Data Harvest. Open Map Controls for the MissionGeist link.'
    return s
if __name__=='__main__':
    b=build(sys.argv[1] if len(sys.argv)>1 else 'LOCAL');write(W/'bag.json',{'ObjectStates':[b]});write(W/'room.json',room(b))
