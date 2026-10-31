-- Old Quarter Excavation R1: shared board overlays, individual rules panels.
local root='oq810340_'..self.getGUID()
local colors={'White','Brown','Red','Orange','Yellow','Green','Teal','Blue','Purple','Pink','Grey','Black'}
local deployed=false
local showDeployment=true
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
local rules=[[OLD QUARTER EXCAVATION — THE DIG
48 × 48 inches · 300 points · ITS18 revision 24 September 2026

DEPLOYMENT
Use the two opposite 24-inch-radius corner zones shown by the blue and orange arcs. Consoles lie at the centre and 16 inches away along the other diagonal. Do not deploy in contact with a Console or Tech.

HYPERTHERMAL TECH
Before armies deploy, each player places three 25 mm Tech tokens; the Deployment player places theirs first. Every token must be wholly beyond 8 inches from BOTH deployment zones and every other Tech token. Place on accessible table ground, never on or inside scenery. The six tokens start beside the table, ready for player placement.

The optional Tech Guide shows one checked legal arrangement, not six compulsory objective positions. Hide it once players choose their actual placements.

TERRAIN & ACCESS
Use the actual geometry for line of fire and cover. Excavations have two access ramps. Buildings have open doors/windows and usable floor states: 1 roof on, 2 upper floor exposed, 3 ground floor exposed. External roof ladders remain in all states. Roofs and interiors are playable. Rubble does not introduce an automatic special terrain rule.

MISSION
Specialists analyze via Consoles; the opponent selects an unanalysed Tech for the active player, subject to the mission's three-Tech restriction. Any trooper may neutralize a Tech analysed for their own player. Refer to the linked official mission for the full scoring, Operational Learning and Classified rules.

Scoring reminder: up to 6 OP for analysed Tech neutralizations; 1 OP for neutralizing in all three rounds; 1 OP for more player-marked Consoles; two Classifieds worth 1 OP each.]]
function redrawOverlays()
 local lines={}
 if showDeployment then
  for _,v in ipairs({{24,-24,{.2,.65,1}},{-24,24,{1,.4,.15}}}) do
   local pts={}
   for i=0,96 do
    local a=i*math.pi/192
    pts[#pts+1]={v[1]-(v[1]>0 and 1 or -1)*24*math.cos(a),.025,v[2]-(v[2]>0 and 1 or -1)*24*math.sin(a)}
   end
   lines[#lines+1]={points=pts,color=v[3],thickness=.065}
  end
 end
 if showTech then
  for _,p in ipairs({{-20,-20},{-20,-10},{-6,-6},{6,6},{20,10},{20,20}}) do
   local pts={}
   for i=0,48 do local a=i*math.pi/24;pts[#pts+1]={p[1]+25/25.4/2*math.cos(a),.03,p[2]+25/25.4/2*math.sin(a)} end
   lines[#lines+1]={points=pts,color={.2,1,.5},thickness=.045}
  end
 end
 self.setVectorLines(lines)
end
function toggleDeployment() showDeployment=not showDeployment;redrawOverlays() end
function toggleTechGuide() showTech=not showTech;redrawOverlays() end
function openRules(player) if player then UI.setAttribute(root..'_'..player.color,'active','true') end end
function closeRules(player) if player then UI.setAttribute(root..'_'..player.color,'active','false') end end
local function attachUI()
 if UI.loading then Wait.frames(attachUI,5);return end
 local callback=self.getGUID()..'/'
 local children={}
 for _,b in ipairs({{'Map Rules','openRules',0},{'Deployment','toggleDeployment',-185},{'Tech Guide','toggleTechGuide',185}}) do
  table.insert(children,node('Button',{text=b[1],onClick=callback..b[2],rectAlignment='UpperCenter',offsetXY=b[3]..' -70',width='170',height='40',fontSize='20',color='#263E4D',textColor='#FFFFFF'}))
 end
 for _,color in ipairs(colors) do
  table.insert(children,node('Panel',{id=root..'_'..color,visibility=color,active='false',rectAlignment='MiddleCenter',width='760',height='730',color='#152027FA',allowDragging='true'}, {
   node('Text',{text='OLD QUARTER EXCAVATION | MAP RULES',fontSize='22',rectAlignment='UpperCenter',offsetXY='0 -14',width='710',height='42',color='#FFFFFF'}),
   node('VerticalScrollView',{rectAlignment='UpperCenter',offsetXY='0 -65',width='710',height='590',scrollSensitivity='25',color='#192831'}, {
    node('Text',{text=rules,width='670',height='1520',preferredHeight='1520',fontSize='19',alignment='UpperLeft',color='#EDF2F5'})}),
   node('Button',{text='Close',onClick=callback..'closeRules',rectAlignment='LowerCenter',offsetXY='0 16',width='180',height='42',fontSize='20',color='#365564',textColor='#FFFFFF'})}))
 end
 local current={}
 for _,n in ipairs(UI.getXmlTable() or {}) do if not n.attributes or n.attributes.id~=root then table.insert(current,n) end end
 table.insert(current,node('Panel',{id=root,width='100%',height='100%',color='#00000000',raycastTarget='false'},children))
 setUI(current);deployed=true
end
function onLoad()
 self.setLock(true)
 Wait.frames(function() redrawOverlays();attachUI() end,5)
end
function onDestroy() if deployed then removeUI() end end
