-- Old Quarter Excavation: shared measurement overlays, individual mission panels.
local root='oq810340_'..self.getGUID()
local colors={'White','Brown','Red','Orange','Yellow','Green','Teal','Blue','Purple','Pink','Grey','Black'}
local deployed=false
local watcher=nil
local overlayReady=false
local uiDirty=true
local deploymentSides={A=true,B=true}
local attachUI
local missionRequested,missionOpen,deploymentRequested,deploymentOpen={},{},{},{}
local matGUID='e90001'
local deploymentRadii={[24]=true,[28]=false,[32]=false}
local showTech=false
local function node(tag,attributes,children,value) return {tag=tag,attributes=attributes or {},children=children or {},value=value} end
local function escape(s)
 s=tostring(s or ''):gsub('&','&amp;'):gsub('<','&lt;'):gsub('>','&gt;'):gsub('"','&quot;'):gsub("'",'&apos;'):gsub('\n','&#10;')
 return s
end
local function xml(n)
 local s='<'..n.tag
 for k,v in pairs(n.attributes or {}) do s=s..' '..k..'="'..escape(v)..'"' end
 s=s..'>'..escape(n.value)
 for _,c in ipairs(n.children or {}) do s=s..xml(c) end
 return s..'</'..n.tag..'>'
end
local function setUI(nodes)
 local s=''
 for _,n in ipairs(nodes) do s=s..xml(n) end
 UI.setXml(s,UI.getCustomAssets())
end
local function removeUI()
 local kept={}
 for _,n in ipairs(UI.getXmlTable() or {}) do if not n.attributes or n.attributes.id~=root then table.insert(kept,n) end end
 setUI(kept);deployed=false
end
-- Full mission facts cross-checked against Mission Geist, retrieved 31 Oct 2026,
-- and the official September 24 ITS18 mission. Reference wording is original.
local rules=[[THE DIG — ITS SEASON 18
Mission reference: Infinity Mission Geist
https://infinitygeist.com/mission/s18_the_dig
Scenario based on Robert Shepherd's The Monday Signal mission.

MISSION OVERVIEW
Reinforcements-compatible. Retreat! applies. Each player uses one HVT and two Classified Objectives. Each completed Classified is worth 1 OP.

SCORING — MAXIMUM 10 OP
• Neutralize an already-analysed Hyperthermal Tech: 2 OP per Tech, up to three Techs / 6 OP.
• At game end, if you neutralized at least one Tech in every Game Round: 1 OP.
• At game end, if more Consoles carry your Player Token than the opponent's: 1 OP.
• Two Classified Objectives: 1 OP each.

DEPLOYMENT AND CONSOLES — THIS MAP
This is the 48 × 48 inch, 300-point setup. Players deploy in opposite corner zones, each measured as a 24-inch radius from its corner. Neither player may deploy a trooper in Silhouette contact with a Console or Hyperthermal Tech.

There are three Consoles on the other diagonal: one at table centre, and one 16 inches in each direction from centre. Use Console A tokens or 40 mm diameter objective scenery. The familiar consoles supplied with this map have 40 mm mission footprints.

The Deployment menu can show 24-, 28- and 32-inch corner arcs independently. Side A (blue) and Side B (orange) can be selected separately, together, or hidden. The 24-inch arcs define the actual Deployment Zones. The 28-/32-inch arcs are +4-/+8-inch measuring aids; displaying them does not enlarge the mission's Deployment Zones or change Tech-placement restrictions. Apply the relevant troop's deployment rules normally.

HYPERTHERMAL DIG — BEFORE ARMY DEPLOYMENT
Each player places three Hyperthermal Tech tokens. The player who kept Deployment places their three first.

Use 25 mm diameter Tech tokens or equivalent scenery. The WHOLE token must be more than 8 inches from BOTH players' Deployment Zones and from every other Tech token. It must be on accessible table ground, never on top of or inside scenery or a building. In a 150-point game these two spacing requirements are 4 inches instead.

Use the normal Infinity mod Hyperthermal Tech markers for player placement; this map creates no Tech models. Tech Guide displays one verified legal arrangement for this map's 24-inch zones. The guide rings are examples, not compulsory objectives; hide them after choosing your own placements.

ANALYZE HYPERTHERMAL TECH
Short Skill. Labels: Attack, Scenario.

Who and where:
• A Specialist Troop must be in Silhouette contact with a Console that does not already have that player's own Player Token.

Resolution:
• Make a Normal WIP Roll. After failure, another attempt is allowed by spending another Short Skill.
• On success, remove the opponent's Player Token beside that Console and mark it for the active player.
• If the active player's total of analysed or neutralized Tech is still below three, the opponent chooses ANY currently unanalysed Tech token on the board to become analysed for the active player.
• Use distinguishable Player A/B tokens to show which player owns the Console and the analysed Tech. The choice of Tech belongs to the opponent, not to the Specialist's owner.

NEUTRALIZE HYPERTHERMAL TECH
Short Skill. Labels: Attack, Scenario.

Any trooper may perform this task, provided it is in Silhouette contact with an analysed Tech bearing its OWN player's token. No roll is required. Remove that Tech token from the table after neutralization.

SPECIALIST TROOPS
For this mission: Hackers, Doctors, Engineers, Forward Observers, Paramedics, and troops with Chain of Command or Specialist Operative.

Repeaters and Peripheral (Servant) models cannot be used by Hackers, Doctors or Engineers to carry out tasks that require a Specialist Troop.

OPERATIONAL LEARNING
After a Specialist fails a WIP Roll for a Scenario-labelled Skill, continuing the SAME task in consecutive Orders gives:
• Second consecutive Order: +3 WIP.
• Third consecutive Order and later consecutive Orders: +3 WIP and +1SD.
These bonuses combine with other applicable Scenario-skill MODs.

The same Specialist must keep using the same Scenario Skill against the same target, without interruption. A successful roll, using a different Skill, changing target, or spending an Order on another trooper resets the sequence. Only one sequence may apply to a trooper for a given Scenario Skill at a time.

END OF THE MISSION
Play ends after the third Game Round. If a player begins their Active Turn in Retreat!, the game finishes at the end of that turn.

OTHER POINT LEVELS IN MISSION GEIST
• 300 / 350 / 400 points: 48 × 48 table; 24-inch corner zones.
• 200 / 250 points: 32 × 48 table; 20-inch corner zones.
• 150 points: 24 × 32 table; 12-inch corner zones; 4-inch Tech spacing.
This terrain remains the 48 × 48 setup; overlay selections do not resize it.

CURRENT WORDING
The task previously called Activate Console is Analyze Hyperthermal Tech. Console ownership and neutralization use Player Tokens; neutralization requires a Tech analysed for your own player. The small-game spacing exception applies at 150 points.

TERRAIN & ACCESS
Use the modeled geometry for line of fire and cover. The three open excavation pockets are 2.5 inches below street level and have two ramps apiece; there is no tunnel network. Buildings have usable interiors and roofs. Taller buildings: state 1 roof on, state 2 upper floor exposed, state 3 ground floor exposed. Single-storey buildings: state 1 roof on, state 2 ground floor exposed. External roof ladders persist in all states. Rubble has no automatic special terrain effect.

SOURCE
Mission Geist: https://infinitygeist.com/mission/s18_the_dig
Official ITS mission: https://experience.corvusbelli.com/en/game-content/16de25e7-8317-4d7c-8438-bd4284164855]]
local function textHeight(text,width,size)
 -- TTS rejects the former long-string gmatch pattern ("pattern too complex").
 -- Only literal searches are used here, as in the working campaign controls.
 local chars=math.floor(width/(size*.54));local lines=0;local first=1
 while true do
  local last=string.find(text,'\n',first,true)
  local count=(last or (#text+1))-first
  lines=lines+math.max(1,math.ceil(count/chars))
  if not last then break end
  first=last+1
 end
 return math.max(590,lines*(size+7)+30)
end
local function sideLabel(side)
 local label=side=='A' and 'SIDE A - BLUE' or 'SIDE B - ORANGE'
 if not deploymentSides[side] then return label..': hidden' end
 local distances={}
 for _,r in ipairs({24,28,32}) do if deploymentRadii[r] then distances[#distances+1]=r..'"' end end
 return label..': '..(#distances>0 and table.concat(distances,' / ') or 'none selected')
end
local function syncLegend()
 UI.setAttribute(root..'_legendA','text',sideLabel('A'));UI.setAttribute(root..'_legendB','text',sideLabel('B'))
end
function redrawOverlays()
 local lines={}
 for _,radius in ipairs({24,28,32}) do if deploymentRadii[radius] then
  for _,v in ipairs({{24,-24,{.2,.65,1},'A'},{-24,24,{1,.4,.15},'B'}}) do if deploymentSides[v[4]] then
   local pts={}
   for i=0,96 do
    local a=i*math.pi/192
    pts[#pts+1]={v[1]-(v[1]>0 and 1 or -1)*radius*math.cos(a),.025+(radius-24)*.001,v[2]-(v[2]>0 and 1 or -1)*radius*math.sin(a)}
   end
   local c=v[3];local fade=(radius-24)/20
   lines[#lines+1]={points=pts,color={c[1]+(1-c[1])*fade,c[2]+(1-c[2])*fade,c[3]+(1-c[3])*fade},thickness=radius==24 and .065 or .045}
  end end
 end end
 if showTech then
  for _,p in ipairs({{-20,-20},{-20,-10},{-6,-6},{6,6},{20,10},{20,20}}) do
   local pts={}
   for i=0,48 do local a=i*math.pi/24;pts[#pts+1]={p[1]+25/25.4/2*math.cos(a),.03,p[2]+25/25.4/2*math.sin(a)} end
   lines[#lines+1]={points=pts,color={.2,1,.5},thickness=.045}
  end
 end
 local mat=getObjectFromGUID(matGUID)
 overlayReady=mat and pcall(function() mat.setVectorLines(lines) end) or false
end
function toggleDeployment(player) if player then deploymentRequested[player.color]=true;deploymentOpen[player.color]=true;uiDirty=true;attachUI() end end
function closeDeployment(player) if player then deploymentOpen[player.color]=false;UI.setAttribute(root..'_deploy_'..player.color,'active','false') end end
local function setRadius(radius,value)
 local on=value==true or tostring(value):lower()=='true'
 if deploymentRadii[radius]==on then return end
 deploymentRadii[radius]=on
 for _,color in ipairs(colors) do if deploymentRequested[color] then UI.setAttribute(root..'_deploy_'..color..'_'..radius,'isOn',tostring(on)) end end
 redrawOverlays();syncLegend()
end
function setDeployment24(player,value) setRadius(24,value) end
function setDeployment28(player,value) setRadius(28,value) end
function setDeployment32(player,value) setRadius(32,value) end
local function setSide(side,value)
 local on=value==true or tostring(value):lower()=='true'
 deploymentSides[side]=on
 for _,color in ipairs(colors) do if deploymentRequested[color] then UI.setAttribute(root..'_deploy_'..color..'_side'..side,'isOn',tostring(on)) end end
 redrawOverlays();syncLegend()
end
function setDeploymentSideA(player,value) setSide('A',value) end
function setDeploymentSideB(player,value) setSide('B',value) end
function toggleTechGuide() showTech=not showTech;redrawOverlays() end
function openRules(player) if player then missionRequested[player.color]=true;missionOpen[player.color]=true;uiDirty=true;attachUI() end end
function closeRules(player) if player then missionOpen[player.color]=false;UI.setAttribute(root..'_'..player.color,'active','false') end end
function sourceLink(player) if player then printToColor('Mission Geist — The Dig: https://infinitygeist.com/mission/s18_the_dig',player.color,{.6,.85,1}) end end
attachUI=function()
 if UI.loading then return end
 local callback=self.getGUID()..'/'
 local children={}
 for _,b in ipairs({{'Mission','openRules',0},{'Deployment','toggleDeployment',-185},{'Tech Guide','toggleTechGuide',185}}) do
  table.insert(children,node('Button',{id=root..'_button_'..b[2],text=b[1],onClick=callback..b[2],rectAlignment='UpperCenter',offsetXY=b[3]..' -70',width='170',height='40',fontSize='20',color='#263E4D',textColor='#FFFFFF'}))
 end
 for _,color in ipairs(colors) do
  if missionRequested[color] then
  table.insert(children,node('Panel',{id=root..'_'..color,visibility=color,active=tostring(missionOpen[color]==true),rectAlignment='MiddleCenter',width='840',height='750',color='#152027FA',allowDragging='true'}, {
   node('Text',{text='OLD QUARTER EXCAVATION | MISSION',fontSize='22',rectAlignment='UpperCenter',offsetXY='0 -14',width='790',height='42',color='#FFFFFF'}),
   node('VerticalScrollView',{rectAlignment='UpperCenter',offsetXY='0 -65',width='790',height='610',scrollSensitivity='25',color='#192831',verticalScrollbarVisibility='AutoHide'}, {
    node('VerticalLayout',{padding='8 12 8 8',childForceExpandHeight='false',childForceExpandWidth='true',height=tostring(textHeight(rules,750,19)+16),preferredHeight=tostring(textHeight(rules,750,19)+16)}, {node('Text',{id=root..'_'..color..'_missionText',text=rules,width='750',height=tostring(textHeight(rules,750,19)),preferredHeight=tostring(textHeight(rules,750,19)),flexibleHeight='0',fontSize='19',alignment='UpperLeft',color='#EDF2F5'})})}),
   node('Button',{text='Mission Geist link',onClick=callback..'sourceLink',rectAlignment='LowerLeft',offsetXY='25 16',width='220',height='42',fontSize='19',color='#365564',textColor='#FFFFFF'}),
   node('Button',{text='Close',onClick=callback..'closeRules',rectAlignment='LowerRight',offsetXY='-25 16',width='150',height='42',fontSize='20',color='#365564',textColor='#FFFFFF'})}))
  end
  if deploymentRequested[color] then
  local toggles={node('Text',{text='DEPLOYMENT OVERLAYS',rectAlignment='UpperCenter',offsetXY='0 -12',width='360',height='30',fontSize='20',color='#FFFFFF'})}
  -- Separate Text elements keep labels visible on TTS versions that omit Toggle text.
  local function row(id,label,y,isOn,callbackName,tint)
   toggles[#toggles+1]=node('Toggle',{id=id,isOn=tostring(isOn),onValueChanged=callback..callbackName,rectAlignment='UpperLeft',offsetXY='18 '..y,width='32',height='30',toggleWidth='25',toggleHeight='25'})
   toggles[#toggles+1]=node('Text',{id=id..'_label',text=label,rectAlignment='UpperLeft',offsetXY='58 '..y,width='305',height='30',fontSize='19',alignment='MiddleLeft',color=tint or '#FFFFFF',raycastTarget='false'})
  end
  row(root..'_deploy_'..color..'_sideA','Side A - blue corner',-50,deploymentSides.A,'setDeploymentSideA','#69B9FF')
  row(root..'_deploy_'..color..'_sideB','Side B - orange corner',-88,deploymentSides.B,'setDeploymentSideB','#FFB076')
  toggles[#toggles+1]=node('Text',{text='Distances for the selected side(s)',rectAlignment='UpperLeft',offsetXY='18 -134',width='350',height='27',fontSize='16',alignment='MiddleLeft',color='#BBD6E4'})
  local labels={[24]='24" - mission Deployment Zone',[28]='28" - +4" measuring aid',[32]='32" - +8" measuring aid'}
  for i,radius in ipairs({24,28,32}) do row(root..'_deploy_'..color..'_'..radius,labels[radius],-168-(i-1)*38,deploymentRadii[radius],'setDeployment'..radius) end
  toggles[#toggles+1]=node('Text',{text='Select either side, both, or neither. Only 24" defines the mission zones.',rectAlignment='UpperCenter',offsetXY='0 -288',width='350',height='45',fontSize='15',color='#BBD6E4'})
  toggles[#toggles+1]=node('Button',{text='Close',onClick=callback..'closeDeployment',rectAlignment='LowerCenter',offsetXY='0 12',width='120',height='32',fontSize='18',color='#365564',textColor='#FFFFFF'})
  children[#children+1]=node('Panel',{id=root..'_deploy_'..color,visibility=color,active=tostring(deploymentOpen[color]==true),rectAlignment='UpperCenter',offsetXY='-185 -118',width='390',height='388',color='#152027FA'},toggles)

  end
 end
 children[#children+1]=node('Panel',{rectAlignment='LowerLeft',offsetXY='18 18',width='350',height='72',color='#152027DF',raycastTarget='false'}, {
  node('Text',{id=root..'_legendA',text=sideLabel('A'),rectAlignment='UpperLeft',offsetXY='10 -8',width='330',height='28',fontSize='16',alignment='MiddleLeft',color='#69B9FF',raycastTarget='false'}),
  node('Text',{id=root..'_legendB',text=sideLabel('B'),rectAlignment='UpperLeft',offsetXY='10 -36',width='330',height='28',fontSize='16',alignment='MiddleLeft',color='#FFB076',raycastTarget='false'})})
 local current={}
 for _,n in ipairs(UI.getXmlTable() or {}) do if not n.attributes or n.attributes.id~=root then table.insert(current,n) end end
 table.insert(current,node('Panel',{id=root,active='true',width='100%',height='100%',color='#00000000',raycastTarget='false'},children))
 setUI(current);deployed=true;uiDirty=false
end
-- Custom_Model download and the Infinity mod can both complete after onLoad.
-- Keep the HUD attached after the map is placed; recover if another script
-- rebuilds Global UI. Overlay failure must never prevent the controls mounting.
function checkDeployment()
 local p=self.getPosition();local mat=getObjectFromGUID(matGUID)
 local placed=mat and math.abs(p.x)<=44 and math.abs(p.z)<=26 and math.abs(p.y)<=26
 if not placed then if deployed then removeUI() end;return end
 if UI.loading then return end
 local found=false
 for _,n in ipairs(UI.getXmlTable() or {}) do if n.attributes and n.attributes.id==root then found=true end end
 if not found or uiDirty then
  local ok,err=pcall(attachUI)
  if not ok then print('Old Quarter controls are waiting to initialize: '..tostring(err));return end
 end
 if not overlayReady then redrawOverlays() end
end
function onSave() return JSON.encode({radii={["24"]=deploymentRadii[24],["28"]=deploymentRadii[28],["32"]=deploymentRadii[32]},sides={A=deploymentSides.A,B=deploymentSides.B},tech=showTech}) end
function onLoad(saved)
 if saved and saved~='' then
  local ok,s=pcall(JSON.decode,saved)
  if ok and type(s)=='table' then
   for _,r in ipairs({24,28,32}) do if s.radii then local v=s.radii[tostring(r)];if v==nil then v=s.radii[r] end;if v~=nil then deploymentRadii[r]=v==true end end end
   if s.sides then for _,side in ipairs({'A','B'}) do if s.sides[side]~=nil then deploymentSides[side]=s.sides[side]==true end end end
   showTech=s.tech==true
  end
 end
 overlayReady=false;uiDirty=true
 self.setLock(true);self.setInvisibleTo(colors)
 if watcher then Wait.stop(watcher) end
 watcher=Wait.time(checkDeployment,.5,-1)
 Wait.frames(checkDeployment,5)
end
function onDestroy()
 if watcher then Wait.stop(watcher) end
 if deployed then removeUI() end
end
