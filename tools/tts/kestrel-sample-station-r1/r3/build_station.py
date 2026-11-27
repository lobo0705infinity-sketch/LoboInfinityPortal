"""Assemble both native entry points from the same layout and preserve the live Table objects."""
from plan import *
from math import atan2,degrees,hypot
import sys
from copy import deepcopy
AXES=('posX','posY','posZ','rotX','rotY','rotZ')
SHIELDS={
 'e53301':('Flight apron | Shuttle exhaust shield',-15.0,-2.85,0),
 'e53302':('Core rig | Drilling spoil cells',-18.70,-22.55,0),
 'e53303':('Engineering | Transformer protection cells',7.18,-14.28,90),
 'e53304':('Rover turnaround | Vehicle protection cells',5.65,14.15,90),
}
def poses(o):return [o,*o.get('States',{}).values()]
def move(o,u,v,yaw,stretch=None):
 for s in poses(o):
  s['Transform'].update(posX=v,posZ=u,rotY=yaw)
  if stretch:s['Transform']['scaleZ']=stretch
def build(ref='LOCAL',repair=True):
 bag=source_bag();roots=bag['ContainedObjects'];old={o['GUID']:o for o in roots}
 original_cfg_ids={s['GUID'] for o in roots for s in poses(o)}
 template=old['e51009'];raw=r2.RAW+ref+'/'+PREFIX+'/'
 bag['Nickname']='SET_ITS18 Data Harvest — Kestrel Lunar Base | Station Plan R3'
 bag['Description']='Kestrel Lunar Base for ITS18 Data Harvest. A connected research and crew station with separate photovoltaic and shuttle service yards. Drop the bag on Stage.'
 roots[:]=[o for o in roots if o['GUID'] not in RETIRED|{'e5100a'}]
 by={o['GUID']:o for o in roots}
 for i in range(4):
  o=by[f'c7b00{i}'];n=f'highlands-{i+1}';o['CustomMesh'].update(MeshURL=raw+n+'.obj',ColliderURL=raw+n+'-collider.obj',DiffuseURL=raw+'station-ground.jpg')
  o['Description']='Graded lunar regolith. The crew court, photovoltaic yard, flight apron and EVA service roads are cast into this surface.'
 for k,(u,v,a) in MOVES.items():move(by[k],u,v,a)
 # The four-port expedition pressure shell has real cardinal apertures on every side.
 # Reuse it at the central biosphere's diameter and retain its glazed/open/roof-frame sequence.
 science=by['c70025']; donor=old['c7c100']; saved_name=science['Nickname']
 for state,src in zip(poses(science),poses(donor)):
  state['CustomMesh']=deepcopy(src['CustomMesh'])
  if 'ChildObjects' in src:
   children=deepcopy(src['ChildObjects'])
   for idx,child in enumerate(children):child['GUID']='e55a'+f'{idx:02x}'
   state['ChildObjects']=children
  state['Transform']['scaleX']=1.12;state['Transform']['scaleZ']=1.12
 if repair:
  for g,files in read(ROOT/'ports.json').items():
   for state in poses(by[g]):
    cm=state['CustomMesh']
    for k in ('MeshURL','ColliderURL'):
     if cm[k] in files:cm[k]=raw+files[cm[k]]
 def rename(g,old_name,new_name,description=None):
  for s in poses(by[g]):
   s['Nickname']=s['Nickname'].replace(old_name,new_name)
   if description:s['Description']=description
 rename('acd6a1','Inflatable crew habitat','Infirmary recovery berth')
 rename('c70012','Inflatable crew habitat','Crew sleeping berth')
 rename('c7002b','Four-way pressure transit node','Research transfer lock')
 rename('e51006','Cryogenics','Power plant','Sintered regolith shielding beside the power-conditioning yard.')
 rename('e51008','Navigation','Crew services','Service screen at the crew EVA yard.')
 for g in ('e51006','e51008'):by[g]['CustomMesh']['DiffuseURL']=raw+'station-hardware.jpg'
 rename('c70039','Data hub maintenance','Geology field pad')
 rename('c7004b','Observatory service bay','Crew services')
 for g in ('c70043','c70044','c70046'):
  rename(g,'Materials lab','Flight instruments' if g=='c70043' else 'Flight apron')
 ol=by['e51005'];ol['Nickname']='Geology field pad | Coring drill and winch'
 def part(g,name,stem,desc,u,v,rot=0,stretch=1,states=True):
  o=deepcopy(template if states else by['e51004'])
  for i,s in enumerate(poses(o)):
   s['GUID']=g if i==0 else 'e54'+g[3:]
   s['Nickname']=name+(' | Roof on' if i==0 else ' | Ground floor') if states else name
   s['Description']=desc+(' State 1 exposes the interior.' if states else '')
   key=stem+('-closed' if i==0 else '-open') if states else stem
   s['CustomMesh'].update(MeshURL=raw+key+'.obj',ColliderURL=raw+key+'-collider.obj',DiffuseURL=raw+'station-hardware.jpg')
   s['Transform'].update(posY=6.25,rotX=0.,rotZ=0.,scaleX=1.,scaleY=1.,scaleZ=stretch)
  move(o,u,v,rot,stretch);roots.append(o);return o
 notes={'lab':'Pressure laboratory linking the main biosphere to the culture annex. Sealed core benches flank the working aisle.',
        'plant':'The main switch and mechanical hall turns the pressure route from the labs toward the crew court. The east door serves the photovoltaic yard.',
        'clinic':'Infirmary and treatment berths between the main passage and the recovery ward.',
        'shop':'Flight instruments are inspected here before returning to the shuttle apron.',
        'dispatch':'Flight-side store for sealed sample carriers. Two hatches serve the tug and station approach.'}
 for key,(g,name,u,v,*_) in HALLS.items():part(g,name,key,notes[key],u,v)
 for g,(name,a,b) in {**LINKS,CREW_LINK[0]:CREW_LINK[1:]}.items():
  du,dv=b[0]-a[0],b[1]-a[1];dist=hypot(du,dv)
  kind,size=('collar',1.60) if dist<2.62 else ('trunk',7.40) if dist>5 else ('link',3.)
  if g=='e53204':kind,size='freight',3.0
  if g=='e53206':kind,size='crossing',7.4
  yaw=degrees(atan2(dv,du))%360
  # Two side vestibules face one another across the crew court.
  if g==CREW_LINK[0]:yaw=(yaw+180)%360
  part(g,name,kind,('Double-sided transfer lock. Opposing hatches give carts and models access across the compound.' if kind in ('freight','crossing') else 'Sealed personnel passage between adjacent pressure doors.'),(a[0]+b[0])/2,(a[1]+b[1])/2,yaw,dist/size)
 for g,(name,u,v,angle) in SHIELDS.items():part(g,name,'apron-shield','Bolted cells filled with local regolith protect this work area.',u,v,angle,states=False)
 # Prepped canisters leave the clean lab from a dedicated cold-chain stand.
 rack=deepcopy(by['e51002']);rack['GUID']='e53305';rack['Nickname']='Sample preparation | Outbound insulated core rack'
 rack['Description']='Sealed samples wait here for collection from the clean-side lab apron.'
 move(rack,.35,-14.50,90);roots.append(rack)
 o=by['c70000'];o['Description']='Kestrel Lunar Base | Station Plan R3. Data Harvest. The observatory, laboratory and crew berths share pressure galleries. The array yard and shuttle apron have separate service access.'
 lua=o['LuaScript'].replace('Continuous bedrock ridges, a sample cartway and a recessed rover service bay shape the lunar ground.','Pressure galleries, graded EVA roads, a shuttle receiving apron and a recessed rover bay connect the station.')
 pre=' local config=JSON.decode(';line=next(l for l in lua.splitlines()if l.startswith(pre));cfg=json.loads(json.loads(line[len(pre):-1]))
 records=[s for o in roots for s in poses(o)]
 for g in original_cfg_ids:cfg['guids'].pop(g,None)
 cfg['guids'].update({s['GUID']:True for s in records})
 o['LuaScript']=lua.replace(line,pre+json.dumps(json.dumps(cfg,separators=(',',':')))+')')
 bag['LuaScript']='\r\n'.join('--'+s['GUID']+','+','.join(f"{s['Transform'][k]:.9f}" for k in AXES)for s in records)+'\r\n'
 return bag
def output(ref='LOCAL'):
 b=build(ref);t=read(r2.W/'room.json');t['SaveName']=TITLE
 t['Note']='Kestrel Lunar Base | Station Plan R3. ITS18 Data Harvest. The MissionGeist link is on Map Controls.'
 t['ObjectStates']=[o for o in t['ObjectStates']if TAG not in o.get('Tags',[])]+deepcopy(b['ContainedObjects'])
 write(W/'room.json',t);write(W/'bag.json',{'ObjectStates':[b]})
if __name__=='__main__':output(sys.argv[1] if len(sys.argv)>1 else 'LOCAL')
