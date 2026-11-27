"""Construct the Kestrel final from the verified R3 save and the current Workshop catalogue."""
from pathlib import Path
from copy import deepcopy
import json,sys
R=Path(__file__).resolve().parent
sys.path.insert(0,str(R.parent/'r3'))
import plan as r3
from plan import read,write
A=R/'assets';W=R/'work';D=R/'dist'
for folder in (W,A,D):folder.mkdir(exist_ok=True)
PREFIX='assets/tts/kestrel-station-plan-final'
MAP='1008da';SHIELD='e53301';STEAM_ID='3719263238'
PLAY='Kestrel Lunar Base - Station Plan Final - Data Harvest - Play Table'
COLLECTION='Lobo Maps - Kestrel Lunar Base Final - Workshop Collection'
FILENAME='Lobo-Kestrel-Lunar-Base-Final-Workshop-Installer.zip'
DESC='Kestrel Lunar Base | Station Plan Final. ITS18 Data Harvest. The shuttle apron has an L-shaped regolith blast shield beside the flight-side Tech-Coffin.'
def resource(url):
 if '/'+PREFIX+'/' in url:return A/url.rsplit('/',1)[-1]
 return r3.resource(url)
def final_bag(pin):
 bag=read(r3.W/'bag.json')['ObjectStates'][0]
 bag['Description']=DESC;bag['Nickname']='SET_ITS18 Data Harvest — Kestrel Lunar Base'
 index={o['GUID']:o for o in bag['ContainedObjects']}
 obj=index[SHIELD]
 root=r3.r2.RAW+pin+'/'+PREFIX+'/shuttle-blast-shield'
 obj['CustomMesh'].update(MeshURL=root+'.obj',ColliderURL=root+'-collider.obj')
 obj['Nickname']='Flight apron | L-shaped shuttle blast shield'
 obj['Description']='Regolith-filled exhaust cells with a four-inch return beside the flight-side Tech-Coffin.'
 index['c70000']['Description']=DESC
 return bag
def find_map(root):
 matches=[]
 def visit(o):
  if o.get('GUID')==MAP and o.get('ContainedObjects'):matches.append(o)
  for c in o.get('ContainedObjects',[]):visit(c)
 for o in root['ObjectStates']:visit(o)
 assert len(matches)==1,('catalogue must have a single Kestrel entry',len(matches))
 return matches[0]
def install_in_catalogue(catalogue,bag):
 target=find_map(catalogue)
 # The existing shell belongs to the physical catalogue and retains its identifying metadata and position.
 target['ContainedObjects']=deepcopy(bag['ContainedObjects'])
 target['LuaScript']=bag['LuaScript'];target['Description']=bag['Description']
 catalogue['SaveName']=COLLECTION
 return catalogue
def published_template():
 path=W/'live-collection.json'
 if not path.exists():
  import hashlib
  from bson import BSON
  from base import get
  data=get('https://cdn.steamusercontent.com/ugc/12336095962282772549/22203F7410936B54D809BDB4387E8442E38DD07F/')
  assert hashlib.sha256(data).hexdigest()=='6a12036a899e121365130439c5d1ff16034c4a9f812439fbf9734953ddddfa95'
  write(path,BSON(data).decode())
 return read(path)
def build(pin):
 b=final_bag(pin)
 room=read(r3.W/'room.json');room['SaveName']=PLAY;room['Note']='Kestrel Lunar Base | Station Plan Final. Data Harvest. Open Map Controls for MissionGeist.'
 owned={o['GUID']:o for o in b['ContainedObjects']}
 room['ObjectStates']=[deepcopy(owned[o['GUID']]) if r3.TAG in o.get('Tags',[]) else o for o in room['ObjectStates']]
 write(W/'Play-Table.json',room);write(W/'Kestrel-Lunar-Base.json',{'ObjectStates':[b]})
 write(W/'Workshop-Save.json',install_in_catalogue(published_template(),b))
if __name__=='__main__':build(sys.argv[1])
