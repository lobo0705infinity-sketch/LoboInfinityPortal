from yard import *
import re
# Native tabletop coordinates. Public models, objective anchors and player tables are inherited.
CLONES={
 'd95301':('intake-weighbridge','Gate Intake | Axle weighbridge',-20.60,-.27,90,'A flush weigh deck leads from the gate to the scan pavilion. The manifest display has flagged lot VX-417 for inspection.'),
 'd95302':('refrigerated-consignment','Quarantine Q2 | Refrigerated lot VX-417',6.92,-17.06,0,'The reefer is plugged into shore power. Its red customs hold placard matches the seal record at inspection.'),
 'd95303':('seal-inspection-bench','Inspection Hall | Seal verification bench',-17.9,-9.34,0,'The open witness case and the red seal on the clipboard belong to lot VX-417. The weighbridge logged the same consignment.'),
 '3286b9':('yard-forklift','Quarantine Warehouse | Electric lift Q-12',16.18,-10.40,270,'A short-mast electric lift is unloading a tagged case from VX-417 at the quarantine receiving bay.'),
 '3a497e':('release-tractor','Covered Transfer Dock | Cleared freight tractor D-03',8.52,-4.05,0,'This low electric tractor and its two roller pallets serve the outbound transfer dock.'),
 'bd2aa7':('gate-release-counter','Exit Gate | Goods release counter',22.40,-.82,0,'The driver presents the signed release here before leaving the bonded yard.'),
}
# x, z, yaw. Raised boxes keep the exact supporting ISO corner positions.
MOVES={
 'aa351b':(-13.54,-5.80,90,4.003),'7cb2f9':(-16.10,-5.80,90,4.003),'d57af6':(-16.10,-5.80,90,6.453),
 '199816':(-15.35,-21.30,0,4.003),'1f9074':(-12.78,-21.30,0,4.003),
 '02061c':(-13.45,8.12,90,4.003),'0a26eb':(10.65,-11.38,0,4.003),
 '9692a0':(.20,-21.70,90,4.003),'4b05f4':(2.50,21.70,90,4.003),
 'ef390d':(-20.76,-9.00,0,4.003),'bedc95':(-9.23,-11.18,0,4.003),
 '1164bf':(18.60,-11.63,0,4.003),'240206':(9.73,1.55,0,4.003),
 '78cd6e':(-8.62,11.91,0,4.003),'1936e0':(-10.31,17.30,90,4.003),
 '542f08':(2.90,17.75,0,4.003),'c12f5a':(20.75,-10.55,0,4.003),
 '6f117e':(-10.83,4.13,90,4.003),'252614':(-18.42,1.97,0,4.003),
 '4852ed':(.27,21.68,90,4.003),'a32026':(-8.81,-9.26,90,4.003),
}
SHARED=['posX','posY','posZ','rotX','rotY','rotZ']
def pack(t):return ','.join(format(t[k],'.7f').rstrip('0').rstrip('.') or '0' for k in SHARED)
def build(pin='PREVIEW'):
 b=originals();objs=b['ContainedObjects'];idx={o['GUID']:o for o in objs}
 for guid,(x,z,yaw,y) in MOVES.items():at(idx[guid],x,z,yaw,y)
 def add(guid,rec):
  name,title,x,z,yaw,desc=rec
  ref=(RAW+pin+'/'+PREFIX+'/')
  o=deepcopy(idx['bedc95']);o['GUID']=guid;o['Nickname']=title;o['Description']=desc
  o['GMNotes']='';o['LuaScript']='';o['LuaScriptState']='';o['Tags']=[TAG];o['Locked']=True
  o['CustomMesh'].update(MeshURL=ref+name+'.obj',ColliderURL=ref+name+'-collider.obj',DiffuseURL=ref+'yard-machinery.jpg',NormalURL=ref+'yard-machinery-normal.png',Convex=False,MaterialIndex=3,TypeIndex=0,CastShadows=True)
  at(o,x,z,yaw);return o
 for g,rec in CLONES.items():
  o=add(g,rec)
  if g in idx:objs[objs.index(idx[g])]=o
  else:objs.append(o)
  idx[g]=o
 ground=idx['810008']
 ground['CustomMesh']['DiffuseURL']=RAW+pin+'/'+PREFIX+'/freeport-ground.jpg'
 ground['Description']='Vanta Freeport. Incoming cargo passes the axle scale and scan pavilion. Blue-green marks lead to dispatch. Amber Q2 markings identify the quarantine receiving bay.'
 # Keep the actual published Stage record order and every native building state.
 script=b['LuaScript'];lines=script.splitlines();lineids={l[2:8]for l in lines if re.match(r'^--[a-f0-9]{6},',l)}
 new=[]
 for l in lines:
  g=l[2:8]
  if re.match(r'^--[a-f0-9]{6},',l) and (g in MOVES or g in CLONES):l='--'+g+','+pack(idx[g]['Transform'])
  new.append(l)
 firstblank=next(i for i,l in enumerate(new)if not l.strip())
 new[firstblank:firstblank]=['--'+g+','+pack(idx[g]['Transform'])for g in CLONES if g not in lineids]
 b['LuaScript']='\n'.join(new)+('\n' if script.endswith('\n')else '')
 controller=idx['51838e'];lines=controller['LuaScript'].splitlines();prefix=' local config=JSON.decode('
 n=next(i for i,l in enumerate(lines) if l.startswith(prefix))
 cfg=json.loads(json.loads(lines[n][len(prefix):-1]));cfg['guids'].update({g:True for g in CLONES})
 lines[n]=prefix+json.dumps(json.dumps(cfg,separators=(',',':')),ensure_ascii=False)+')'
 controller['LuaScript']='\n'.join(lines)+('\n' if controller['LuaScript'].endswith('\n') else '')
 # A ready-to-play save starts deployed, with no Stage bag (bb). In that case the
 # controller's native owned-object cleanup must run. A bag deployed on Stage still uses btnTrash.
 target="if stage then stage.call('btnTrash');return end"
 assert controller['LuaScript'].count(target)==1
 controller['LuaScript']=controller['LuaScript'].replace(target,"local bagGuid=stage and stage.getVar('bb')\n  if bagGuid and getObjectFromGUID(bagGuid) then stage.call('btnTrash');return end")
 b['Nickname']='SET_ITS18 B-Pong — Vanta Customs Yard | Held Consignment'
 b['Description']='Working freeport playtest. Follow lot VX-417 from the intake reader to the quarantine bay. Includes the approved B-Pong consoles, tracking beacon and native building states.'
 return b
def publish(pin):
 b=build(pin);save(W/'Vanta-Customs-Yard.json',{'ObjectStates':[b]})
 previous=ROOT/'kestrel/r4/work/Play-Table.json'
 if not previous.exists():
  from zipfile import ZipFile
  from io import BytesIO
  previous=W/'table-template.json'
  if not previous.exists():
   url=RAW+'a00b90984810e64ae25bdccc1f79c580d3734ab4/assets/tts/kestrel-station-plan-final/workshop/Lobo-Kestrel-Lunar-Base-Final-Workshop-Installer.zip'
   archive=get(url);assert hashlib.sha256(archive).hexdigest()=='d217b348d2203d33e0843150e89d78b0c41d106f9949447d4ae5eed6a1e2de15'
   with ZipFile(BytesIO(archive)) as outer,ZipFile(BytesIO(outer.read('Files/payload.zip')))as inner:previous.write_bytes(inner.read('Play-Table.json'))
 room=load(previous)
 room['SaveName']=TITLE;room['Note']='Vanta Customs Yard | B-Pong playtest. Open Map Controls for MissionGeist.'
 persistent=[o for o in room['ObjectStates']if not any(t.startswith('LoboMap:') for t in o.get('Tags',[]))]
 assert len(persistent)==138
 room['ObjectStates']=persistent+b['ContainedObjects']
 # Set the correct scene before the controller starts, including on clients which load textures late.
 ctrl=next(o for o in b['ContainedObjects'] if o['GUID']=='51838e')
 prefix='local backgroundConfig=JSON.decode('
 config=next(l for l in ctrl['LuaScript'].splitlines() if l.startswith(prefix))
 room['SkyURL']=json.loads(json.loads(config[len(prefix):-1]))['day']
 save(W/'Play-Table.json',room)
if __name__=='__main__':publish(sys.argv[1])
