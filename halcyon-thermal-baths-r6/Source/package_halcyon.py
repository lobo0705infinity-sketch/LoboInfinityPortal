from pathlib import Path
import sys,json,copy,re,hashlib,shutil,math
from PIL import Image
from build_halcyon import Mesh,ROOT,A,polyrect

BAG='cb0601';MAT='cb0602';CONTROL='cb0603';TAG='LoboMap:'+BAG
HOST=sys.argv[1]if len(sys.argv)>1 else (ROOT/'Source/asset-base.txt').read_text().strip().rstrip('/')
used={BAG,MAT,CONTROL}
def guid(key):
 g=hashlib.sha256(key.encode()).hexdigest()[:6]
 assert g not in used,(key,g)
 used.add(g);return g
def tf(x=0,y=2.25,z=0,scale=1):return dict(posX=x,posY=y,posZ=z,rotX=0,rotY=0,rotZ=0,scaleX=scale,scaleY=scale,scaleZ=scale)
def base(name,g,transform=None,locked=True):
 return {'GUID':g,'Name':'Custom_Model','Transform':transform or tf(),'Nickname':name,'Description':'','GMNotes':'Halcyon Thermal Baths R5 | '+TAG,'ColorDiffuse':{'r':1,'g':1,'b':1},'Tags':[TAG,'terrain'],'Locked':locked,'Grid':False,'Snap':False,'IgnoreFoW':False,'MeasureMovement':False,'DragSelectable':True,'Autoraise':False,'Sticky':True,'Tooltip':True,'GridProjection':False,'Hands':False,'LuaScript':'function onLoad() self.setLock('+('true'if locked else'false')+') end','LuaScriptState':'','XmlUI':''}
def mesh_object(name,g,file,col,diff='halcyon-material-atlas.png',transform=None,locked=True):
 o=base(name,g,transform,locked)
 o['CustomMesh']={'MeshURL':HOST+'/'+file,'DiffuseURL':HOST+'/'+diff,'NormalURL':'','ColliderURL':HOST+'/'+col,'Convex':not locked,'MaterialIndex':3,'TypeIndex':0,'CastShadows':True,'CustomShader':{'SpecularColor':{'r':0,'g':0,'b':0},'SpecularIntensity':0,'SpecularSharpness':2,'FresnelStrength':0}}
 return o

SECTIONS=[
 ('Mission','OUTBREAK · 300 POINTS\n\nScan up to three Infected: 1 OP each.\nStabilize more than the opponent: 2 OP.\nCivEvac more stabilized Infected: 2 OP.\nCivEvac the stabilized Alpha: 2 OP.\nSecure at least one Infected: 1 OP.\n\nNo Classified deck or HVT setup. The Alpha starts at the center. The other four Infected are player-placed. No stabilization-zone pieces are included.'),
 ('Setup','48 × 48 inches. Opposite-corner deployment measured 24 inches from each chosen corner. DZ +4 and DZ +8 are optional deployment guides, used only when a rule permits.\n\nBefore deployment, each player places two Infected entirely in the opponent’s half, at least 4 inches outside that opponent’s DZ and 8 inches from every other Infected. They must be accessible on the table, outside buildings and scenery. The player keeping Deployment places first.\n\nAfter that, each player places one circular stabilization template wholly inside their own DZ, on a surface large enough for it. The player keeping Deployment places first. No trooper starts in contact with an Infected.'),
 ('Scan','SCAN INFECTED\n\nDoctor, Paramedic or Specialist Operative only. Short Skill; Attack, Scenario. Target must be within LoF and Zone of Control. Make a Normal WIP Roll. Failures may be retried with another skill expenditure.\n\nEach player can scan each Infected once, including one already stabilized or being CivEvaced. Both players may scan the same Infected.\n\nDoctors and Paramedics receive +1SD on the WIP Rolls to Scan, Stabilize and CivEvac an Infected.'),
 ('Stabilize','STABILIZE INFECTED\n\nDoctor, Paramedic or Specialist Operative only. Short Skill; Attack, Scenario. Be in contact with the Infected or an allied trooper CivEvacing it, then pass a Normal WIP Roll. A failure may be retried by spending another skill. Mark which player stabilized it. The other player cannot stabilize it again.\n\nAt the end of a Player Turn, a CivEvaced Infected also stabilizes if both it and its escort are entirely inside a stabilization zone.'),
 ('Evacuate','CivEvac follows the current civilian rules. An escort may CivEvac only ONE Infected in this mission.\n\nFor the final Secure objective, the Infected must be stabilized by you or CivEvaced by your trooper, and have no non-Null enemy trooper in its Zone of Control.\n\nThe hot spring water interiors are impassable scenery. The stone coping, terraces and paths use normal movement. No toxic or visibility rules are added. Natural outcrops, walls and furniture use their actual visible geometry. Sloping domes and vaults are not advertised standing terraces.'),
 ('End & source','The mission normally ends after Game Round 3. If a player begins an Active Turn in Retreat!, it ends after that turn.\n\nRules checked against the official ITS18 document, version 2026.09.11, pages 83–87, downloaded 2 November 2026. This panel is a paraphrased quick reference; use the current official text for full rules and any later changes.\n\nOfficial scenario:\nhttps://experience.corvusbelli.com/en/game-content/5f071262-e950-41d8-acef-09ee3536fcae\n\nR5 REVIEW DRAFT\nLive TTS collision, states, grids, independent loading and side-swapped play remain unverified.')]

def controller():
 s=(ROOT/'Source'/'approved-control-template.lua').read_text()
 s=s.replace('100e32',MAT).replace('100daf',BAG).replace('b5b2f9',CONTROL)
 # Replace the whole JSON config, keeping the approved current N5 charts and compositor.
 m=re.search(r'local backgroundConfig=JSON.decode\(("(?:\\.|[^"\\])*")\)',s)
 bc={'day':HOST+'/halcyon-day.jpg','night':HOST+'/halcyon-night.jpg','off':HOST+'/halcyon-background-off.jpg','category':'halcyon-thermal-baths'}
 s=s[:m.start(1)]+json.dumps(json.dumps(bc))+s[m.end(1):]
 # Fix this map to Outbreak's 300-point opposite-corner deployment.
 um=re.search(r'local universalConfig=JSON.decode\(("(?:\\.|[^"\\])*")\)',s)
 uc=json.loads(json.loads(um.group(1)));uc.update(shape='corner',depth=24,surface=2.25)
 s=s[:um.start(1)]+json.dumps(json.dumps(uc))+s[um.end(1):]
 s=s.replace('local universalEnabled={[0]=false,[4]=false,[8]=false}','local universalEnabled={[0]=true,[4]=false,[8]=false}')
 # Fresh map imports apply Day; saved Day/Night/Off choices are restored.
 p=s.index(" local result=loboLifeCall('loboBackgroundActivate'",s.index('local function backgroundTick()'))
 q=s.index('\nend\nfunction onLoad(saved)',p)
 s=s[:p]+" if Grid then Grid.show_lines=false;Grid.snapping=1 end\n if backgroundMode~='inherit' then local result=loboLifeCall('loboBackgroundActivate',{config=backgroundConfig,mode=backgroundMode,original=backgroundBaseline});if result then backgroundBaseline=result.original end end\n backgroundStarted=true;backgroundMount()"+s[q:]
 # Automatic lifecycle cleanup retains restoration of the prior environment.
 # All deployment marks are drawn onto current visible horizontal geometry by ray sampling.
 s=s.replace("children[#children+1]=universalButton('_booty'","children[#children+1]=universalButton('_mission','Outbreak mission','loboHalcyonMission')\n children[#children+1]=universalButton('_booty'")
 s=s.replace("local mat=universalMat();loboUniversalSetBase({guid=universalConfig.mat,lines=mat.getVectorLines() or{}})","local mat=universalMat();universalBase={};mat.setVectorLines({}) -- Outbreak has no fixed scoring-area lines; rebuild owned DZ guides after reload.")
 s=s.replace("if ok and type(state)=='table' and type(state.loboUniversal)=='table'then","if ok and type(state)=='table' and type(state.loboUniversal)=='table'then\n   ")
 s+='\nfunction loboHalcyonRefreshDeployment()if universalStarted then universalBuild()end end\n'
 sections=json.dumps(SECTIONS,ensure_ascii=True)
 s+='\n-- Halcyon six-section, per-player mission reference.\nlocal halcyonSections=JSON.decode('+json.dumps(sections)+')\n'
 s+=(ROOT/'Source'/'mission-panel.lua').read_text()
 return s

def main():
 records=json.loads((ROOT/'Source'/'geometry-manifest.json').read_text())
 all_objects=[];deploy=[]
 def add(o,pos=None):
  all_objects.append(o);deploy.append((o['GUID'],pos or copy.deepcopy(o['Transform'])))
 # Ground is a real matte mesh, with photo-derived paths fitted around the final buildings.
 from spa_details import ground as recessed_ground
 ground=recessed_ground(Mesh);gi=ground.export('halcyon-ground')
 # Whole-board UVs on the top and underside. The other faces use the quiet ground edge.
 p=A/'halcyon-ground.obj';lines=p.read_text().splitlines();vs=[list(map(float,l.split()[1:]))for l in lines if l.startswith('v ')];vi=0;out=[]
 for line in lines:
  if line.startswith('vt '):
   x,y,z=vs[vi];vi+=1;line='vt %.6f %.6f'%((-x+24)/48,(z+24)/48)
  out.append(line)
 p.write_text('\n'.join(out)+'\n')
 mat=mesh_object('Halcyon Thermal Baths · Ground',MAT,gi['file'],gi['collider'],'halcyon-ground.jpg');mat['GridProjection']=True
 mat['LuaScript']="""function onLoad()self.setLock(true)end
function onDestroy()
 local key='HalcyonR5Clearing';if Global.getVar(key)then return end
 Global.setVar(key,true);local doomed={}
 for _,o in ipairs(getAllObjects())do if o~=self and o.hasTag('"""+TAG+"""')then doomed[#doomed+1]=o end end
 for _,o in ipairs(doomed)do o.destruct()end
 Global.setVar(key,false)
end"""
 add(mat)
 for rec in records:
  state_objects=[]
  for i,st in enumerate(rec['states'],1):
   g=guid(rec['slug']+'-state-'+str(i));o=mesh_object(rec['name']+(' · Multi-state'if len(rec['states'])>1 else''),g,st['file'],st['collider'])
   o['Description']='Height (base to top): %.2f in\n%s\n%s'%(st['height'],st['label'],rec['role'])
   if len(rec['states'])>1:o['Description']+='\nHover and press a state number, or right-click > State.\n'+'\n'.join(s['label']for s in rec['states'])
   else:o['Tooltip']=False
   o['GridProjection']=False
   if len(rec['states'])>1:
    o['LuaScript']="function onLoad()self.setLock(true);Wait.frames(function()local c=getObjectFromGUID('"+CONTROL+"');if c then c.call('loboHalcyonRefreshDeployment')end end,8)end"
   # Split horizontal grid receivers are attached to each state. Their non-convex collision
   # consists only of those surfaces, with no invisible hull across doors or rooms.
   import trimesh,numpy as np
   m=trimesh.load(A/st['file'],force='mesh',process=False)
   normals=m.face_normals;centers=m.triangles_center
   levels=rec.get('levels',[.25]).copy()
   if rec['slug']=='intake-clinic'and i>=2:levels +=[3.75,4.0]
   if i==len(rec['states'])and len(rec['states'])>1 and 'scenery'not in rec['role']:levels +=[max(v[1]for v in m.vertices)-.75]
   mask=(normals[:,1]>.95)&np.any(np.isclose(centers[:,1,None],np.array(levels)[None,:],atol=.015),axis=1)
   faces=m.faces[mask]
   if len(faces):
    gm=trimesh.Trimesh(m.vertices.copy(),faces,process=False);gm.vertices[:,1]+=.0125
    gridfile=rec['slug']+'-'+str(i)+'-grid.obj';(A/gridfile).write_text(trimesh.exchange.obj.export_obj(gm,include_normals=True,include_texture=False))
    # Neutral black only appears as the TTS projected grid; the receiver's diffuse
    # uses the same atlas coordinates as its matching parent faces.
    # Export with original UVs and same face indexing, so the support skin is visually identical.
    raw=(A/st['file']).read_text().splitlines();header=[l for l in raw if not l.startswith('f ')and not l.startswith('g ')]
    vlines=[]
    for l in header:
     if l.startswith('v '):
      v=list(map(float,l.split()[1:]));v[1]+=.0125;l='v %.5f %.5f %.5f'%tuple(v)
     vlines.append(l)
    face_lines=[l for l in raw if l.startswith('f ')];vlines.extend(l for l,keep in zip(face_lines,mask)if keep)
    (A/gridfile).write_text('\n'.join(vlines)+'\n')
    receiver=mesh_object('Horizontal grid surfaces',guid(rec['slug']+'-grid-'+str(i)),gridfile,gridfile,transform=tf(y=0));receiver['GridProjection']=True;receiver['Tooltip']=False;receiver['DragSelectable']=False;receiver['LuaScript']=''
    receiver['Tags']+=["HalcyonGridSurface"]
    o['ChildObjects']=[receiver]
   state_objects.append(o)
  active=state_objects[0]
  if len(state_objects)>1:active['States']={str(i+1):o for i,o in enumerate(state_objects[1:],1)}
  add(active)
 # Use existing collection civilian/HVT models with original scales and attribution.
 hvt_source=json.loads((ROOT/'Source/hvt-models.json').read_text())
 for i in range(5):
  o=copy.deepcopy(hvt_source['models'][i%4]);o['GUID']=guid('existing-hvt-'+str(i))
  o['Nickname']='Alpha Infected · HVT model'if i==0 else'Infected '+str(i)+' · HVT model'
  o['Tags']=[TAG,'mission','Infected'];o['Locked']=False;o['GridProjection']=False
  def own_children(parent,key):
   for j,child in enumerate(parent.get('ChildObjects',[])):
    child['GUID']=guid(key+'-child-'+str(j));child['Tags']=[TAG,'mission','Infected'];child['Locked']=False
    own_children(child,key+'-'+str(j))
  own_children(o,'hvt-'+str(i))
  o['LuaScript']='';o['LuaScriptState']='';o['XmlUI']='';o['GMNotes']='Existing collection HVT model; native bundle and original scale preserved. Halcyon R5.'
  o['Transform'].update(posX=0 if i==0 else 27.5,posY=2.26,posZ=0 if i==0 else(i-2.5)*2.6,rotX=0,rotZ=0)
  o['Description']='Existing civilian/HVT model. '+('Alpha starts at table center.'if i==0 else'Player-placed mission figure; the off-board holding position is not a legal mission placement.')
  add(o)
 c=base('Halcyon · Map, mission and background controls',CONTROL,tf(0,-20,0, .01));c['Name']='BlockSquare';c['DragSelectable']=False;c['Tags']=[TAG,'controller','LoboBackgroundController'];c['Tooltip']=False;c['LuaScript']=controller();add(c)
 # Native SET manifest format. Alternate states keep the same world transform and ownership.
 manifest=[]
 for g,t in deploy:
  owner=next(o for o in all_objects if o['GUID']==g)
  for variant in [owner]+list(owner.get('States',{}).values()):
   manifest.append('--'+','.join([variant['GUID']]+[str(t[k])for k in ['posX','posY','posZ','rotX','rotY','rotZ']]))
 bag=base('SET_ITS18 Outbreak — Halcyon Thermal Baths R5',BAG,tf(0,2,0));bag['Name']='Bag';bag.pop('Tags');bag['Tags']=['LoboStoredMap'];bag['LuaScript']='\r\n'.join(manifest)+'\r\n';bag['Description']='R5 REVIEW DRAFT · Outbreak · 48 × 48 inches · 300 points.\nDrop this bag onto STAGE > DROP BAGS HERE in the Lobo Infinity table. Native stage deployment positions are embedded. Lowest floor is state 1; higher floors and roofs follow.\nThe four non-Alpha HVT models start in an off-board holding area. No stabilization-zone pieces are supplied; players use their normal templates.\nUse Map Controls on the right. Day applies automatically when the map loads. Night/Off remain selectable. Clear Table restores prior ambience.\nLive TTS checks, independent loading and side-swapped play remain unverified. This standalone bag does not publish or update Workshop.'
 if HOST=='__LOCAL_REVIEW_UNUSED__':
  bag['Nickname']+=' · LOCAL REVIEW'
  bag['Description']+='\nLOCAL REVIEW INSTALLER: bundled assets are installed on this computer. Public asset publication is pending explicit approval; remote players cannot load these local paths.'
 bag['ContainedObjects']=copy.deepcopy(all_objects)
 for o in bag['ContainedObjects']:
  o['Transform'].update(posX=70,posY=100,posZ=70)
 # Stage consumes the comment manifest; stored alternate states stay aligned with their parent.
 stored={'SaveName':"Halcyon Thermal Baths R5 — Outbreak Review",'VersionNumber':'v13.2.2','ObjectStates':[bag]}
 (ROOT/'SavedObjects').mkdir(exist_ok=True);(ROOT/'PreviewSave').mkdir(exist_ok=True)
 fn='Lobo-Top-40-L6-Halcyon-Thermal-Baths-R5'
 (ROOT/'SavedObjects'/(fn+'.json')).write_text(json.dumps(stored,ensure_ascii=False,indent=2))
 scene={'SaveName':'Halcyon Thermal Baths R5 — Standalone Review Scene','GameMode':'None','Date':'2026-11-02','VersionNumber':'v13.2.2','ObjectStates':all_objects,'Grid':{'Type':1,'Lines':False,'Color':{'r':.35,'g':.35,'b':.35},'Opacity':.5,'ThickLines':False,'Snapping':1,'Offset':False,'BothSnapping':False,'xSize':1,'ySize':1,'PosOffset':{'x':0,'y':0,'z':0}}}
 (ROOT/'PreviewSave'/'TS_Save_Halcyon_Thermal_Baths_R5_Review.json').write_text(json.dumps(scene,ensure_ascii=False,indent=2))
 if(ROOT/'Review'/'Halcyon-Overview.png').exists():Image.open(ROOT/'Review'/'Halcyon-Overview.png').resize((512,400)).save(ROOT/'SavedObjects'/(fn+'.png'))
 (ROOT/'Source'/'asset-base.txt').write_text(HOST+'\n')
 print('Packaged',len(all_objects),'root objects; all assets',HOST)
if __name__=='__main__':main()
