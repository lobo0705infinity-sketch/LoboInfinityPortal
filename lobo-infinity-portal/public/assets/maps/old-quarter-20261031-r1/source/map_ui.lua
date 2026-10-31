-- Old Quarter Excavation: shared measurement overlays, individual mission panels.
local root='oq810340_'..self.getGUID()
local colors={'White','Brown','Red','Orange','Yellow','Green','Teal','Blue','Purple','Pink','Grey','Black'}
local deployed=false
local deploymentRadii={[24]=true,[28]=false,[32]=false}
local showTech=false
local function node(tag,attributes,children) return {tag=tag,attributes=attributes or {},children=children or {}} end
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

The Deployment menu can show 24-, 28- and 32-inch corner arcs independently. The 24-inch arcs define the actual Deployment Zones. The 28-/32-inch arcs are +4-/+8-inch measuring aids; displaying them does not enlarge the mission's Deployment Zones or change Tech-placement restrictions. Apply the relevant troop's deployment rules normally.

HYPERTHERMAL DIG — BEFORE ARMY DEPLOYMENT
Each player places three Hyperthermal Tech tokens. The player who kept Deployment places their three first.

Use 25 mm diameter Tech tokens or equivalent scenery. The WHOLE token must be more than 8 inches from BOTH players' Deployment Zones and from every other Tech token. It must be on accessible table ground, never on top of or inside scenery or a building. In a 150-point game these two spacing requirements are 4 inches instead.

The six Tech tokens begin beside the table for player placement. Tech Guide displays one verified legal arrangement for this map's 24-inch zones. The guide rings are examples, not compulsory objectives; hide them after choosing your own placements.

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
Use the modeled geometry for line of fire and cover. The three open excavation pockets are about 1¼ inches below street level and have two ramps apiece; there is no tunnel network. Buildings have usable interiors and roofs. Taller buildings: state 1 roof on, state 2 upper floor exposed, state 3 ground floor exposed. Single-storey buildings: state 1 roof on, state 2 ground floor exposed. External roof ladders persist in all states. Rubble has no automatic special terrain effect.

SOURCE
Mission Geist: https://infinitygeist.com/mission/s18_the_dig
Official ITS mission: https://experience.corvusbelli.com/en/game-content/16de25e7-8317-4d7c-8438-bd4284164855]]
local function textHeight(text,width,size)
 local chars=math.floor(width/(size*.54))
 local lines=0
 for line in (text..'\n'):gmatch('(.-)\n') do lines=lines+math.max(1,math.ceil(#line/chars)) end
 return math.max(590,lines*(size+7)+30)
end
function redrawOverlays()
 local lines={}
 for _,radius in ipairs({24,28,32}) do if deploymentRadii[radius] then
  for _,v in ipairs({{24,-24,{.2,.65,1}},{-24,24,{1,.4,.15}}}) do
   local pts={}
   for i=0,96 do
    local a=i*math.pi/192
    pts[#pts+1]={v[1]-(v[1]>0 and 1 or -1)*radius*math.cos(a),.025+(radius-24)*.001,v[2]-(v[2]>0 and 1 or -1)*radius*math.sin(a)}
   end
   local c=v[3];local fade=(radius-24)/20
   lines[#lines+1]={points=pts,color={c[1]+(1-c[1])*fade,c[2]+(1-c[2])*fade,c[3]+(1-c[3])*fade},thickness=radius==24 and .065 or .045}
  end
 end end
 if showTech then
  for _,p in ipairs({{-20,-20},{-20,-10},{-6,-6},{6,6},{20,10},{20,20}}) do
   local pts={}
   for i=0,48 do local a=i*math.pi/24;pts[#pts+1]={p[1]+25/25.4/2*math.cos(a),.03,p[2]+25/25.4/2*math.sin(a)} end
   lines[#lines+1]={points=pts,color={.2,1,.5},thickness=.045}
  end
 end
 self.setVectorLines(lines)
end
function toggleDeployment(player) if player then UI.setAttribute(root..'_deploy_'..player.color,'active','true') end end
function closeDeployment(player) if player then UI.setAttribute(root..'_deploy_'..player.color,'active','false') end end
local function setRadius(radius,value)
 local on=value==true or tostring(value):lower()=='true'
 if deploymentRadii[radius]==on then return end
 deploymentRadii[radius]=on
 for _,color in ipairs(colors) do UI.setAttribute(root..'_deploy_'..color..'_'..radius,'isOn',tostring(on)) end
 redrawOverlays()
end
function setDeployment24(player,value) setRadius(24,value) end
function setDeployment28(player,value) setRadius(28,value) end
function setDeployment32(player,value) setRadius(32,value) end
function toggleTechGuide() showTech=not showTech;redrawOverlays() end
function openRules(player) if player then UI.setAttribute(root..'_'..player.color,'active','true') end end
function closeRules(player) if player then UI.setAttribute(root..'_'..player.color,'active','false') end end
function sourceLink(player) if player then printToColor('Mission Geist — The Dig: https://infinitygeist.com/mission/s18_the_dig',player.color,{.6,.85,1}) end end
local function attachUI()
 if UI.loading then Wait.frames(attachUI,5);return end
 local callback=self.getGUID()..'/'
 local children={}
 for _,b in ipairs({{'Mission','openRules',0},{'Deployment','toggleDeployment',-185},{'Tech Guide','toggleTechGuide',185}}) do
  table.insert(children,node('Button',{text=b[1],onClick=callback..b[2],rectAlignment='UpperCenter',offsetXY=b[3]..' -70',width='170',height='40',fontSize='20',color='#263E4D',textColor='#FFFFFF'}))
 end
 for _,color in ipairs(colors) do
  table.insert(children,node('Panel',{id=root..'_'..color,visibility=color,active='false',rectAlignment='MiddleCenter',width='840',height='750',color='#152027FA',allowDragging='true'}, {
   node('Text',{text='OLD QUARTER EXCAVATION | MISSION',fontSize='22',rectAlignment='UpperCenter',offsetXY='0 -14',width='790',height='42',color='#FFFFFF'}),
   node('VerticalScrollView',{rectAlignment='UpperCenter',offsetXY='0 -65',width='790',height='610',scrollSensitivity='25',color='#192831'}, {
    node('Text',{text=rules,width='750',height=tostring(textHeight(rules,750,19)),preferredHeight=tostring(textHeight(rules,750,19)),fontSize='19',alignment='UpperLeft',color='#EDF2F5'})}),
   node('Button',{text='Mission Geist link',onClick=callback..'sourceLink',rectAlignment='LowerLeft',offsetXY='25 16',width='220',height='42',fontSize='19',color='#365564',textColor='#FFFFFF'}),
   node('Button',{text='Close',onClick=callback..'closeRules',rectAlignment='LowerRight',offsetXY='-25 16',width='150',height='42',fontSize='20',color='#365564',textColor='#FFFFFF'})}))
  local toggles={node('Text',{text='CORNER DISTANCE OVERLAYS',rectAlignment='UpperCenter',offsetXY='0 -12',width='310',height='30',fontSize='19',color='#FFFFFF'})}
  for i,radius in ipairs({24,28,32}) do
   local labels={[24]='24″ — Deployment',[28]='28″ — +4″ measuring aid',[32]='32″ — +8″ measuring aid'}
   table.insert(toggles,node('Toggle',{id=root..'_deploy_'..color..'_'..radius,text=labels[radius],isOn=tostring(deploymentRadii[radius]),onValueChanged=callback..'setDeployment'..radius,rectAlignment='UpperCenter',offsetXY='0 '..(-45-(i-1)*38),width='300',height='34',toggleWidth='24',toggleHeight='24',fontSize='19',textColor='#FFFFFF',textAlignment='MiddleLeft'}))
  end
  table.insert(toggles,node('Text',{text='Tick any combination. Blue / orange mark the two corners.',rectAlignment='UpperCenter',offsetXY='0 -162',width='300',height='40',fontSize='15',color='#BBD6E4'}))
  table.insert(toggles,node('Button',{text='Close',onClick=callback..'closeDeployment',rectAlignment='LowerCenter',offsetXY='0 10',width='120',height='32',fontSize='18',color='#365564',textColor='#FFFFFF'}))
  table.insert(children,node('Panel',{id=root..'_deploy_'..color,visibility=color,active='false',rectAlignment='UpperCenter',offsetXY='-185 -118',width='340',height='248',color='#152027FA'},toggles))
 end
 local current={}
 for _,n in ipairs(UI.getXmlTable() or {}) do if not n.attributes or n.attributes.id~=root then table.insert(current,n) end end
 table.insert(current,node('Panel',{id=root,width='100%',height='100%',color='#00000000',raycastTarget='false'},children))
 setUI(current);deployed=true
end
function onSave() return JSON.encode({radii={["24"]=deploymentRadii[24],["28"]=deploymentRadii[28],["32"]=deploymentRadii[32]},tech=showTech}) end
function onLoad(saved)
 if saved and saved~='' then
  local ok,s=pcall(JSON.decode,saved)
  if ok and type(s)=='table' then
   for _,r in ipairs({24,28,32}) do if s.radii then local v=s.radii[tostring(r)];if v==nil then v=s.radii[r] end;if v~=nil then deploymentRadii[r]=v==true end end end
   showTech=s.tech==true
  end
 end
 self.setLock(true)
 Wait.frames(function() redrawOverlays();attachUI() end,5)
end
function onDestroy() if deployed then removeUI() end end
