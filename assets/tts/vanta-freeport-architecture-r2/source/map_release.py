"""Apply the architectural revision to both real entry points of the R1 playtest."""
import json,re,sys
from copy import deepcopy
from design import models,BY,R,W,A,D
R1=R.parent;sys.path.append(str(R1/'src'))
import yard
TITLE='Vanta Customs Yard - Freeport Architecture R2 - B-Pong - Playtest'
PREFIX='assets/tts/vanta-freeport-architecture-r2'
DESCRIPTION={
'dispatch':'Clerks allocate berths and sign freight releases beneath the copper clock roof.',
'sealworks':'Inspectors open tamper seals at the evidence bench. The rooftop sawlights serve the upstairs laboratory.',
'inspection':'Incoming wagons unload beneath the rail-side canopy. Samples are examined at the receiving bench.',
'quarantine':'Bonded reefer VX-417 is held at Q2. Paired condensers and the temperature cabinets serve the cold store.',
'customs':'Drivers present declarations at the public counter. A Freeport night-mail print hangs in the hall.',
'records':'Signed manifests are filed on numbered shelves in the bonded archive.',
'security':'The duty officer checks vehicles against a map of the port.',
'intake':'The weigh clerk checks the axle reading against the inbound manifest.',
'exit':'Signed release papers are handed to outbound drivers at the clearance desk.',
'bondstore':'Inspected goods remain strapped on the shelves until Customs releases the shipment.',
'bondloft':'A roof hoist serves the bonded loft. The ground store holds marked freight.',
'services':'Mechanics service handling equipment at the vise bench and tool rack.',
'scanner':'Two fixed scanner hoops read freight under the gantry. A service ladder reaches the instrument deck.',
'dock':'Cleared freight transfers beneath a butterfly canopy beside the electric tug.'}
def patch_building(o,d,pin):
 n=len(o.get('States',{}))+1
 for key,s in [(n,o)]+[(int(i),a)for i,a in o.get('States',{}).items()]:
  pref=yard.RAW+pin+'/'+PREFIX+'/';artifact=d['slug']+'-s'+str(key)
  label='Ground floor' if key==1 else 'Upper floor' if key<n else 'Roof'
  s['Nickname']=d['name']+(f' | State {key} · {label}'if n>1 else '')
  s['Description']=DESCRIPTION[d['slug']]+('\nRight-click the building to choose a floor or roof.'if n>1 else '')
  cm=s['CustomMesh'];cm.update(MeshURL=pref+artifact+'.obj',ColliderURL=pref+artifact+'-collider.obj',DiffuseURL=pref+'freeport-facades.jpg',NormalURL=pref+'freeport-normal.jpg',Convex=False,CastShadows=True)
  s['ColorDiffuse']={'r':1.,'g':1.,'b':1.}
def build(pin):
 bagfile=yard.load(R1/'work/Vanta-Customs-Yard.json');b=bagfile['ObjectStates'][0]
 b['Nickname']='SET_ITS18 B-Pong — Vanta Customs Yard | Freeport Architecture R2'
 b['Description']='A working customs port. Lot VX-417 travels from the weighbridge through seal inspection to Quarantine Q2. Includes the B-Pong consoles and tracking beacon.'
 for o in b['ContainedObjects']:
  if o['GUID']in BY:patch_building(o,BY[o['GUID']],pin)
 table=yard.load(R1/'work/Play-Table.json');roots={o['GUID']:o for o in b['ContainedObjects']}
 table['ObjectStates']=[deepcopy(roots[o['GUID']]) if o['GUID']in roots and yard.TAG in o.get('Tags',[]) else o for o in table['ObjectStates']]
 table['SaveName']=TITLE;table['Note']='Vanta Customs Yard | Freeport Architecture R2, B-Pong playtest. Open Map Controls for MissionGeist.'
 return bagfile,table
def write(pin):
 bag,tab=build(pin);yard.save(W/'Vanta-Customs-Yard.json',bag);yard.save(W/'Play-Table.json',tab)
if __name__=='__main__':write(sys.argv[1] if len(sys.argv)>1 else (W/'pin.txt').read_text().strip())
