from base import *
from station import MOVES,SITES
from copy import deepcopy
import re
REV='Kestrel Lunar Base - Sample Station R1 - Data Harvest'
DAY=RAW+PIN+'/lobo-infinity-portal/public/assets/maps/kestrel-lunar-20261102-r13/kestrel-day.jpg'
FILETAG='LoboMap:1008da'
def setpos(o,x,z,angle):
    o['Transform'].update(posX=x,posY=GRADE,posZ=z,rotX=0.,rotY=angle,rotZ=0.)
def setstatepos(o):
    t=o['Transform']
    for s in o.get('States',{}).values():
        # Preserve the mesh scale set for each physical state and carry its placed pose.
        for k in ('posX','posY','posZ','rotX','rotY','rotZ'):s['Transform'][k]=t[k]
def pins(o):
    for k,v in o.get('CustomMesh',{}).items():
        if isinstance(v,str) and v.startswith(RAW+'main/'):o['CustomMesh'][k]=v.replace(RAW+'main/',RAW+PIN+'/')
def build_bag(ref='LOCAL'):
    b=deepcopy(ORIGINAL); roots=b['ContainedObjects']; template=next(o for o in roots if o['GUID']=='c70043')
    u=RAW+ref+'/'+PREFIX+'/'
    for o in roots:
        g=o['GUID']
        if g in MOVES:setpos(o,*MOVES[g])
        if g in ('c70014','c7c100','c70025','c7002d','c70022'):
            # Square the modular feet with the station pads. TTS saved small settling angles.
            o['Transform'].update(posY=GRADE,rotX=0,rotZ=0)
        setstatepos(o)
        for v in walk(o):
            pins(v)
            if g in ('c70033','c70022','c70014','c70025','c7c000') and v.get('CustomMesh',{}).get('DiffuseURL','').endswith('7ecedd45edfac3d7bb.jpg'):
                zone='flight' if g in ('c70033','c70022') else 'laboratory'
                v['CustomMesh']['DiffuseURL']=u+zone+'-hull.jpg'
            cm=v.get('CustomMesh',{})
            if g=='c70030' and cm.get('MeshURL','').endswith('/c70030-crew-commons-dome-roof-on.obj'):
                cm.update(MeshURL=u+'commons-door.obj',ColliderURL=u+'commons-door-collider.obj')
            if 'glass' in v.get('Tags',[]) and g in ('c70014','c70025','c7c000','c70030'):
                color=(.67,.88,.88) if g!='c70030' else (.94,.84,.67)
                v['ColorDiffuse'].update(r=color[0],g=color[1],b=color[2])
            if g.startswith('c7b') and v.get('CustomMesh'):
                v['CustomMesh']['DiffuseURL']=u+'station-regolith.jpg'
        if g=='c70000':
            o['Description']='Kestrel Lunar Base | Sample Station R1. Data Harvest. Follow sealed cores from the shuttle through sample intake to the materials lab. The western drill, solar field and crew quarters have their own service approaches.'
        if g=='c70043':o['Nickname']='Materials lab | Cold-store telemetry cabinet'
        if g=='c70045':o['Nickname']='Materials lab | Sample-seal locker'
    for guid,key,title,x,z,angle,desc in SITES:
        o=deepcopy(template);o['GUID']=guid;o['Nickname']=title;o['Description']=desc;o['LuaScript']='';o['LuaScriptState']='';o['XmlUI']='';o['Locked']=True
        o['ColorDiffuse']={'r':1,'g':1,'b':1,'a':1};o['Tags']=['KestrelOrbital',FILETAG,'scenery','building' if key in ('intake','passage','transfer') else 'scatter']
        if key.endswith('lip'):
            o['Tags']=['KestrelOrbital',FILETAG,'scenery','crater-rim']
        label=key+'-closed' if key in ('intake','passage','transfer') else key
        cm=o['CustomMesh'];cm.update(MeshURL=u+label+'.obj',ColliderURL=u+label+'-collider.obj',DiffuseURL=u+'station-finishes.jpg',NormalURL='',Convex=False,MaterialIndex=0,TypeIndex=0,CastShadows=True)
        cm['CustomShader']={'SpecularColor':{'r':.6,'g':.64,'b':.68},'SpecularIntensity':.12,'SpecularSharpness':2.0,'FresnelStrength':.03}
        setpos(o,x,z,angle)
        if key in ('intake','passage','transfer'):
            o['Nickname']=title+' | Roof on';s=deepcopy(o);s['GUID']={'intake':'e51101','passage':'e51109','transfer':'e5110a'}[key];s['Nickname']=title+' | Ground floor';s['CustomMesh'].update(MeshURL=u+key+'-open.obj',ColliderURL=u+key+'-open-collider.obj');s['Tags']=['KestrelOrbital',FILETAG,'building-state','scenery'];o['States']={'1':s}
        roots.append(o)
    b['Nickname']='SET_ITS18 Data Harvest — Kestrel Lunar Base | Sample Station R1'
    b['Description']='Native Infinity Stage bag. Kestrel Sample Station R1 is a Data Harvest playtest on the current raised table, with three Tech-Coffins, private floors and the standard map controls.'
    objects=[s for o in roots for s in [o,*o.get('States',{}).values()]]
    owner=next(o for o in roots if o['GUID']=='c70000')
    marker=' local config=JSON.decode('
    original_line=next(line for line in owner['LuaScript'].splitlines() if line.startswith(marker))
    config=json.loads(json.loads(original_line[len(marker):-1]))
    for s in objects:config['guids'][s['GUID']]=True
    owner['LuaScript']=owner['LuaScript'].replace(original_line,marker+json.dumps(json.dumps(config,separators=(',',':')))+')')
    # Stage takes the active bag members. The records for other states also support clearing on older tables.
    b['LuaScript']='\r\n'.join('--'+o['GUID']+','+','.join('%.9f'%o['Transform'][k] for k in ('posX','posY','posZ','rotX','rotY','rotZ')) for o in objects)+'\r\n'
    return b
def room(b):
    s=json.loads((DATA/'table.json').read_bytes());rs=s['ObjectStates']
    old=[o for o in rs if any(t.startswith('LoboMap:') for t in o.get('Tags',[]))]
    assert len(old)==87,len(old)
    rs[:]=[o for o in rs if o not in old]
    for o in rs:
        if o['Nickname']=='Stage':
            sfile=WORK/'stage.lua';sfile.write_text(o['LuaScript'])
    rs.extend(deepcopy(b['ContainedObjects']))
    s['SaveName']=REV+' - Play Table';s['SkyURL']=DAY;s['Note']='Data Harvest. Kestrel Sample Station R1 playtest. Open Map Controls for the Mission Geist link.'
    return s
if __name__=='__main__':
    import sys
    b=build_bag(sys.argv[1] if len(sys.argv)>1 else 'LOCAL')
    dump(WORK/'bag.json',{'ObjectStates':[b]});dump(WORK/'room.json',room(b))
