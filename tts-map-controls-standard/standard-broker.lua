-- One persistent UI writer for map-owned screen controls. No Global script edits.
LOBO_UI_BROKER_VERSION=4
LOBO_UI_STANDARD_REVISION='lobo-standard-20261118-v1'
local owners={}
local nextToken=0
local dirty=true
local timer=nil
local releaseEnvironment=function() end
local hiddenColors={'White','Brown','Red','Orange','Yellow','Green','Teal','Blue','Purple','Pink','Grey','Black'}
local function copy(t)
 if type(t)~='table' then return t end
 local out={};for k,v in pairs(t) do out[k]=copy(v) end;return out
end
local function knownRoot(n)
 local id=n.attributes and n.attributes.id or ''
 return id=='loboMapDrawerV1' or id:match('^loboBackground_') or id:match('^loboSwitchback') or id:sub(1,12)=='loboMission_' or id:sub(1,13)=='loboMapRules_' or id:match('^oq%x%x%x%x%x%x_') or id:sub(1,20)=='loboTop40MapControls'
end
local function objectAlive(guid)
 local o=getObjectFromGUID(guid)
 return o and not o.isDestroyed() and o or nil
end
local function validOwner(state)
 if state.retired then return false end
 local o=objectAlive(state.owner)
 if not o then return false end
 local p=o.getPosition();local deployed=math.abs(p.x)<=44 and math.abs(p.z)<=26 and math.abs(p.y)<=80
 local anchor=state.anchor and objectAlive(state.anchor) or nil
 if deployed and (not state.anchor or anchor) then state.wasPlaced=true end
 if state.wasPlaced and state.anchor and not anchor then state.retired=true;return false end
 return deployed and (not state.anchor or anchor)
end
local function prune()
 for guid,state in pairs(owners) do
  if not objectAlive(guid) or (state.wasPlaced and not validOwner(state)) then releaseEnvironment(guid);owners[guid]=nil;dirty=true end
 end
end
local function view()
 local roots={}
 for _,n in ipairs(UI.getXmlTable() or {}) do if not knownRoot(n) then roots[#roots+1]=copy(n) end end
 for _,state in pairs(owners) do
  if validOwner(state) then for _,n in ipairs(state.roots) do roots[#roots+1]=copy(n) end end
 end
 return roots
end
-- Canonical layout, approved 2026-11-18. Keep button order and ASCII labels.
local drawerOpen,optionsOpen,speedReaders={},{},{}
local drawerHadControls=false
local drawerActions={}
local drawerRoot='loboMapDrawerV1'
local palette={Red='#FF0000FF',Orange='#FF7300FF',Yellow='#FFFF00FF',Green='#00FF00FF',Blue='#1A59FFFF',Indigo='#8033FFFF',Violet='#E614FFFF'}
local function playerColor(p)return p and p.color end
function loboDrawerToggle(p)local c=playerColor(p);if c then drawerOpen[c]=true;dirty=true end end
function loboDrawerClose(p)local c=playerColor(p);if c then drawerOpen[c]=nil;optionsOpen[c]=nil;speedReaders[c]=nil;dirty=true end end
function loboStandardOptions(p)local c=playerColor(p);if c then optionsOpen[c]=not optionsOpen[c];dirty=true end end
function loboV1Speedball(p,value,id)local c=playerColor(p);if c then speedReaders[c]=id:match('_reference_(%w+)$');dirty=true end end
function loboDrawerResolve(p)
 local route=drawerActions[p.id];local state=route and owners[route.owner]
 if not route or route.owner~=p.owner or not state or not validOwner(state)then return nil end
 return{callback=route.callback}
end
function loboStandardClick(p,value,id)
 local route=drawerActions[id];local state=route and owners[route.owner]
 if not route or not state or not validOwner(state)or route.noop then return end
 local object=objectAlive(route.owner)
 if object then object.call('loboStandardInvoke',{callback=route.callback,color=playerColor(p),value=value,id=route.originalId})end
 dirty=true
end
local function v1Node(tag,attrs,children,value)return{tag=tag,attributes=attrs or{},children=children or{},value=value}end
local function v1Text(text,x,y,w,size,height)
 return v1Node('Text',{rectAlignment='UpperLeft',offsetXY=x..' '..y,width=tostring(w),height=tostring(height or 28),fontSize=tostring(size or 16),alignment='MiddleLeft',color='#EDF3F8FF',horizontalOverflow='Wrap'},nil,text)
end
local function v1Button(id,label,callback,x,y,w)
 return v1Node('Button',{id=drawerRoot..'_'..id,text=label,onClick=self.getGUID()..'/'..callback,rectAlignment='UpperLeft',offsetXY=x..' '..y,width=tostring(w),height='34',fontSize='16',color='#294351FF',textColor='#FFFFFFFF'})
end
local function v1Visibility(test)
 local result={};for _,c in ipairs(hiddenColors)do if test(c)then result[#result+1]=c end end
 return table.concat(result,'|'),#result>0 and 'true'or'false'
end
local function v1Dock(n)
 local a=n.attributes or{};a.rectAlignment='MiddleRight';a.offsetXY='-12 0';a.allowDragging='false';n.attributes=a
 return n
end
local function forbidden(fn,label)
 return fn=='meridianviewmenu'or fn=='meridianmyview'or fn=='meridianphysical'or fn=='neonground'or fn=='neonsecond'or fn=='neonthird'or fn=='neonroofed'
  or label:find('my view',1,true)or label:find('shared interiors',1,true)or label:find('floor view',1,true)or label:find('building floors',1,true)
  or label:find('full rooftops',1,true)or label:find('building roofs',1,true)
end
local function category(fn,label)
 if fn=='lobostandardmissionopen'then return'fallbackmission'end
 if fn=='lobozonedzcolor'then return'dzcolor'end
 if fn=='lobozoneexclusioncolor'then return'excolor'end
 if fn=='loborotatemap180'then return'rotate'end
 if fn=='lobostandardclear'then return'clear'end
 if fn=='lobostandardgrid'then return'grid'end
 if fn=='lobostandardscoring'then return'fallbackscoring'end
 if fn:find('clear')then return'drop'end
 if fn=='lobochoosebackground'then return'background'end
 if fn:find('booty')or fn:find('metachemistry')then return'drop'end
 if fn:find('lobouniversaldeployment',1,true)then return'deployment'end
 if fn:find('deployment')or fn=='meridiandztoggle'then return'drop'end
 if fn:find('exclusion')or label:find('exclusion')then return'exclusion'end
 if fn:find('quadrant')or fn:find('scoring')or label:find('endgame sectors')or label:find('neutralization areas')then return'scoring'end
 if fn:find('grid')then return'drop'end
 if label=='mission'or(label:find('briefing')and not label:find('map'))or(fn:find('mission')and not fn:find('guide'))or fn=='lobosaltwickbriefing'then return'mission'end
 if fn:find('rules')then return'rules'end
 return'extras'
end
local function drawerRender(logical)
 drawerActions={}
 local groups={mission={},fallbackmission={},rules={},rotate={},deployment={},dzcolor={},excolor={},exclusion={},scoring={},fallbackscoring={},grid={},background={},extras={},clear={}}
 local rendered,detail,seen={},{},{}
 local function extract(n)
  n=copy(n);local a=n.attributes or{}
  if n.tag=='Panel'and(a.allowDragging=='true'or(a.rectAlignment=='MiddleCenter'and(tonumber(a.width)or 0)>=500))then
   if tostring(a.id):find('_chart_',1,true)then return nil end
   if a.active~='false'then for c in tostring(a.visibility or''):gmatch('[^|]+')do detail[c]=true end end
   return v1Dock(n)
  end
  if n.tag=='Button'and a.onClick then
   local owner,callback=a.onClick:match('^([a-f0-9]+)/([%w_]+)$')
   if owner and owners[owner]and validOwner(owners[owner])then
    a.id=a.id or('legacy_'..owner..'_'..callback)
    local fn=callback:lower();local label=tostring(a.text or n.value or''):lower()
    if forbidden(fn,label)then return nil end
    local group=category(fn,label)
    if group=='drop'then return nil end
    local k=owner..'/'..callback..'/'..tostring(a.text or n.value or'')
    if not seen[k]then groups[group][#groups[group]+1]={owner=owner,callback=callback,originalId=a.id,label=a.text or n.value or'',attributes=a};seen[k]=true end
    -- Retain legacy resolver compatibility for callers outside the new panel.
    drawerActions[a.id]={owner=owner,callback=callback,originalId=a.id}
    return nil
   end
  end
  local children={};for _,child in ipairs(n.children or{})do local keep=extract(child);if keep then children[#children+1]=keep end end;n.children=children
  return n
 end
 for _,n in ipairs(logical)do if knownRoot(n)then local keep=extract(n);if keep then rendered[#rendered+1]=keep end else rendered[#rendered+1]=copy(n)end end
 if not next(drawerActions)then drawerOpen={};optionsOpen={};speedReaders={};drawerHadControls=false;return rendered end
 if not drawerHadControls then for _,c in ipairs(hiddenColors)do drawerOpen[c]=true end;drawerHadControls=true end
 for _,group in pairs(groups)do table.sort(group,function(a,b)if (a.label=='Mission')~=(b.label=='Mission')then return a.label=='Mission'end;return a.originalId<b.originalId end)end
 local primary=groups.rotate[1]and objectAlive(groups.rotate[1].owner)
 local state=primary and primary.call('loboStandardState')or{}
 local roots={}
 local function renderPanel(expanded)
  local kind=expanded and'expanded'or'compact';local children={}
  local function text(s,x,y,w,size,height)children[#children+1]=v1Text(s,x,y,w,size,height)end
  local function localButton(name,label,fn,x,y,w)
   local b=v1Button(kind..'_'..name,label,fn,x,y,w);children[#children+1]=b;return b
  end
  local function action(name,label,route,x,y,w,on)
   local b=localButton(name,label,'loboStandardClick',x,y,w)
   if route then drawerActions[b.attributes.id]=route else b.attributes.interactable='false';b.attributes.color='#1E303AFF';b.attributes.textColor='#9BAFB8FF'end
   if on then b.attributes.color='#82BCCDFF';b.attributes.textColor='#10212AFF'end
   return b
  end
  local function line(y)children[#children+1]=v1Node('Panel',{rectAlignment='UpperLeft',offsetXY='12 '..y,width='326',height='1',color='#304A58FF',raycastTarget='false'})end
  text('LOBO',12,-7,180,12,20);text('Map Controls',12,-27,220,22,30)
  localButton('close','Close','loboDrawerClose',273,-14,65)
  local y=-67
  if #groups.rules>0 then action('mission','Mission',(groups.mission[1]or groups.fallbackmission[1]),12,y,159);action('rules','Map Rules',groups.rules[1],179,y,159)
  else action('mission','Mission',(groups.mission[1]or groups.fallbackmission[1]),12,y,326)end
  y=y-42
  local turn=action('turn','Turn 180     '..(state.flipped and'180 deg'or'0 deg'),groups.rotate[1],12,y,326,true)
  turn.attributes.tooltip='Rotate the battlefield and all pieces on it. Click again to return.'
  y=y-46;line(y);y=y-12;text('BATTLEFIELD GUIDES',12,y,326,12,22);y=y-24
  text('Deployment Zones',12,y,326,16,26);y=y-28
  local offsets={};local active=nil
  for _,r in ipairs(groups.deployment)do local n=tonumber(r.callback:match('(%d+)$'));if n then offsets[n]=r;if r.label:find(': ON',1,true)then active=n end end end
  local off=active and copy(offsets[active])or copy(offsets[0]);if off and active==nil then off.noop=true end
  action('dz_off','Off',off,12,y,77,active==nil)
  for i,n in ipairs({0,4,8})do local r=offsets[n]and copy(offsets[n]);if r and active==n then r.noop=true end;action('dz_'..n,n==0 and'Normal'or('+'..n..' in'),r,12+i*83,y,77,active==n)end
  y=y-43
  for i,key in ipairs({'dzcolor','excolor'})do
   local r=groups[key][1];local color=r and r.label:match(': (.+)$')or(key=='dzcolor'and'Red'or'Yellow')
   local label=key=='dzcolor'and'DZ Color'or'Exclusion Color'
   local b=action(key,label..': '..color,r,12+(i-1)*167,y,159);b.attributes.fontSize='14'
   children[#children+1]=v1Node('Panel',{rectAlignment='UpperLeft',offsetXY=tostring(16+(i-1)*167)..' '..(y-4),width='3',height='26',color=palette[color]or'#FFFFFFFF',raycastTarget='false'})
  end
  y=y-43
  local function toggle(name,label,route,known)
   text(label,12,y,238,16,34)
   local caption='N/A'
   if route then
    if known~=nil then caption=known and'On'or'Off'
    elseif route.label:upper():find('OFF',1,true)then caption='Off'
    elseif route.label:upper():find('ON',1,true)then caption='On'
    else caption='Toggle'end
   end
   action(name,caption,route,264,y,74,caption=='On');y=y-38
  end
  toggle('exclusion','Exclusion Zone',groups.exclusion[1])
  toggle('grid','Grid',groups.grid[1],state.grid==true)
  local scoring=groups.scoring[1]or groups.fallbackscoring[1]
  local scoringKnown=nil;if #groups.scoring==0 then scoringKnown=state.scoring==true end
  toggle('scoring',#groups.scoring>0 and'Quadrants / Scoring Zones'or'Quadrants',scoring,scoringKnown)
  y=y-4;line(y);y=y-12;text('Background',12,y,326,16,26);y=y-28
  local bg={};local mode='day'
  for _,r in ipairs(groups.background)do local m=r.originalId:match('_([^_]+)$');bg[m]=r;if owners[r.owner].backgroundMode then mode=owners[r.owner].backgroundMode end end
  for i,m in ipairs({'day','night','off'})do action('bg_'..m,m:sub(1,1):upper()..m:sub(2),bg[m],12+(i-1)*111,y,104,mode==m)end
  y=y-44
  if #groups.extras>0 then
   localButton('options',expanded and'Map-specific options   -'or'Map-specific options   +','loboStandardOptions',12,y,326);y=y-40
   if expanded then
    for i,r in ipairs(groups.extras)do
     local label=r.label
     if r.callback:lower():find('trees')or label:lower():find('foliage')then label=label:gsub('Trees: leaves on/off','Tree Foliage'):gsub('Trees leaf on / off','Tree Foliage')end
     local b=action('extra_'..i,label,r,12,y,326);b.attributes.fontSize='15';y=y-38
    end
   end
  end
  line(y);y=y-12;text('REFERENCE TABLES',12,y,326,12,22);y=y-25
  localButton('reference_booty','Booty','loboV1Speedball',12,y,90)
  localButton('reference_meta','Metachemistry','loboV1Speedball',108,y,132)
  localButton('reference_speed','Speedball','loboV1Speedball',246,y,92)
  y=y-44
  local clear=action('clear','Clear Table',groups.clear[1],12,y,326);clear.attributes.color='#563630FF';clear.attributes.textColor='#FFE0D8FF'
  local vis,act=v1Visibility(function(c)return drawerOpen[c]and not speedReaders[c]and not detail[c]and(optionsOpen[c]==true)==expanded end)
  -- A bounded scroll view keeps options accessible on short displays.
  local fullHeight=-y+46;local visibleHeight=math.min(fullHeight,740)
  local content=v1Node('Panel',{width='350',rectAlignment='UpperLeft',height=tostring(fullHeight),preferredHeight=tostring(fullHeight),flexibleHeight='0'},children)
  local scroll=v1Node('VerticalScrollView',{width='350',height=tostring(visibleHeight),verticalScrollbarVisibility='AutoHide',scrollSensitivity='28',color='#10212AFF'}, {content})
  roots[#roots+1]=v1Node('Panel',{id=drawerRoot..'_'..kind,rectAlignment='MiddleRight',offsetXY='-12 0',width='350',height=tostring(visibleHeight),active=act,visibility=vis,color='#10212AFF'}, {scroll})
 end
 renderPanel(false);renderPanel(true)
 local vis,act=v1Visibility(function(c)return not drawerOpen[c]and not speedReaders[c]and not detail[c]end)
 local tab=v1Button('tab','Map Controls','loboDrawerToggle',0,0,154);tab.attributes.rectAlignment='MiddleRight';tab.attributes.offsetXY='-12 0';tab.attributes.visibility=vis;tab.attributes.active=act;roots[#roots+1]=tab
 local tables={
  {key='speed',title='Speedball',rows={{'1-3','VitaPack'},{'4-6','AutoRepairS'},{'7-10','Switch On'},{'11-13','Jetpack (S:2)'},{'14-16','Overkill'},{'17-20','NanoShield'}}},
  {key="booty",title="Booty",rows={{"1-2","ARM +1"},{"3-4","Light Flamethrower"},{"5-6","Grenades"},{"7-8","DA CC Weapon"},{"9","Multispectral Visor L1"},{"10","EXP CC Weapon"},{"11","Adhesive Launcher Rifle"},{"12","TAG: Immunity (AP) | Other: ARM +2"},{"13","Panzerfaust"},{"14","Monofilament CC Weapon"},{"15","MOV 8-4"},{"16","TAG: BS Attack (Shock) | Other: MULTI Rifle"},{"17","MULTI Sniper Rifle"},{"18","TAG: Immunity (ARM) | Other: ARM +4"},{"19","Mimetism (-6)"},{"20","TAG: BS Attack (+1 B) | Other: HMG"}}},
  {key="meta",title="Metachemistry",rows={{"1-3","PH +3"},{"4-5","Super-Jump"},{"6-7","Regeneration"},{"8-10","Climbing Plus"},{"11-12","MOV 8-4"},{"13-14","BTS +6"},{"15","No Wound Incapacitation"},{"16","ARM +1 and Immunity (ARM)"},{"17","Dogged and Immunity (Enhanced)"},{"18","MOV 6-4 and Super-Jump"},{"19","MOV 8-4 and Climbing Plus"},{"20","PH +3 and Regeneration"}}},
 }

 for _,chart in ipairs(tables)do
  local visibility,active=v1Visibility(function(c)return speedReaders[c]==chart.key end)
  local body={v1Text(chart.title,12,-8,300,23),v1Button('return_'..chart.key,'Close','loboV1Speedball',350,-8,72),v1Text('D20',12,-48,66,16),v1Text('Result',82,-48,330,16)}
  for i,row in ipairs(chart.rows)do local y=-78-(i-1)*29;body[#body+1]=v1Text(row[1],12,y,66,15,29);local n=v1Text(row[2],82,y,340,15,29);n.attributes.tooltip=row[2];body[#body+1]=n end
  roots[#roots+1]=v1Node('Panel',{id=drawerRoot..'_reference_'..chart.key,rectAlignment='MiddleRight',offsetXY='-12 0',width='434',height=tostring(91+#chart.rows*29),active=active,visibility=visibility,color='#10212AFF'},body)
 end
 rendered[#rendered+1]=v1Node('Panel',{id=drawerRoot,width='100%',height='100%',color='#00000000',raycastTarget='false'},roots)
 return rendered
end
local function escape(value)
 return tostring(value or ''):gsub('&','&amp;'):gsub('<','&lt;'):gsub('>','&gt;'):gsub('"','&quot;'):gsub("'",'&apos;'):gsub('\r','&#13;'):gsub('\n','&#10;'):gsub('\t','&#9;')
end
local function xml(n)
 local out={'<'..n.tag}
 for k,v in pairs(n.attributes or {}) do out[#out+1]=' '..k..'="'..escape(v)..'"' end
 out[#out+1]='>'..escape(n.value)
 for _,child in ipairs(n.children or {}) do out[#out+1]=xml(child) end
 out[#out+1]='</'..n.tag..'>';return table.concat(out)
end
local function signature(nodes) return JSON.encode(nodes) end
local function owns(n,guid)
 for k,v in pairs(n.attributes or {}) do
  if type(v)=='string' and k:sub(1,2)=='on' and v:sub(1,#guid+1)==guid..'/' then return true end
 end
 for _,child in ipairs(n.children or {}) do if owns(child,guid) then return true end end
 return false
end
local function stateFor(p)
 local s=owners[p.owner]
 if s and s.token==p.token and not s.retired then return s end
end
-- Background state belongs to the shared UI service, so anchor-first cleanup
-- restores the environment even when the map's controller is destroyed later.
local backgroundOwner=nil
local backgroundOriginal=nil
local lightKeys={'ambient_intensity','ambient_type','light_intensity','reflection_intensity','lut_contribution','lut_index','lut_url'}
local function captureEnvironment()
 local state={name=Backgrounds.getBackground(),url=Backgrounds.getCustomURL(),lighting={}}
 for _,key in ipairs(lightKeys) do state.lighting[key]=Lighting[key] end
 state.lighting.sky=copy(Lighting.getAmbientSkyColor())
 state.lighting.equator=copy(Lighting.getAmbientEquatorColor())
 state.lighting.ground=copy(Lighting.getAmbientGroundColor())
 state.lighting.light=copy(Lighting.getLightColor())
 return state
end
local function restoreEnvironment()
 if not backgroundOriginal then backgroundOwner=nil;return end
 local state=backgroundOriginal
 if state.url and state.url~='' then Backgrounds.setCustomURL(state.url)
 elseif state.name and state.name~='' then Backgrounds.setBackground(state.name) end
 local light=state.lighting or {}
 for _,key in ipairs(lightKeys) do if light[key]~=nil then Lighting[key]=light[key] end end
 if light.sky then Lighting.setAmbientSkyColor(light.sky) end
 if light.equator then Lighting.setAmbientEquatorColor(light.equator) end
 if light.ground then Lighting.setAmbientGroundColor(light.ground) end
 if light.light then Lighting.setLightColor(light.light) end
 Lighting.apply()
 backgroundOwner=nil;backgroundOriginal=nil
end
releaseEnvironment=function(owner)
 if backgroundOwner==owner then restoreEnvironment() end
end
function loboBackgroundActivate(p)
 local state=stateFor(p)
 if not state or not validOwner(state) then return nil end
 if not backgroundOriginal then backgroundOriginal=copy(p.original or captureEnvironment()) end
 local config=p.config or state.background
 if not config then return nil end
 local mode=p.mode or 'day'
 if mode~='day' and mode~='night' and mode~='off' then return nil end
 local url=config[mode]
 if not url or url=='' then return nil end
 state.background=copy(config);state.backgroundMode=mode;backgroundOwner=p.owner
 Backgrounds.setCustomURL(url)
 -- Keep the tabletop neutral and readable in all three panorama modes.
 -- Using a gradient decouples miniature colors from the selected sky image.
 local prior=backgroundOriginal.lighting or {}
 Lighting.ambient_type=2
 Lighting.light_intensity=math.max(tonumber(prior.light_intensity) or 1,.9)
 Lighting.ambient_intensity=math.max(tonumber(prior.ambient_intensity) or 1,.9)
 Lighting.reflection_intensity=math.min(tonumber(prior.reflection_intensity) or .2,.25)
 Lighting.setLightColor({1,1,1})
 Lighting.setAmbientSkyColor({.72,.75,.78})
 Lighting.setAmbientEquatorColor({.58,.6,.62})
 Lighting.setAmbientGroundColor({.42,.43,.44})
 Lighting.apply()
 return {mode=mode,original=copy(backgroundOriginal)}
end
function loboBackgroundState(p)
 local state=stateFor(p)
 if not state then return nil end
 return {mode=state.backgroundMode,original=copy(backgroundOriginal)}
end

local function hide(state)
 local ids={};for _,n in ipairs(state.roots) do if n.attributes and n.attributes.id then ids[n.attributes.id]=true end end
 for _,n in ipairs(UI.getXmlTable() or {}) do
  local id=n.attributes and n.attributes.id
  if id and ids[id] then UI.setAttribute(id,'active','false') end
 end
end
function loboUIRegister(p)
 local sameMap=false
 for _,state in pairs(owners) do
  if not state.retired and state.anchor==p.anchor and objectAlive(state.owner) then sameMap=true;break end
 end
 if not sameMap then drawerOpen={};optionsOpen={};speedReaders={};drawerHadControls=false end
 nextToken=nextToken+1
 owners[p.owner]={owner=p.owner,anchor=p.anchor,token=nextToken,roots={},wasPlaced=false,retired=false}
 dirty=true;return nextToken
end
function loboUIRead(p)
 prune();return view()
end
function loboUIWrite(p)
 local state=stateFor(p);if not state then return end
 local nodes={}
 for _,n in ipairs(p.nodes or {}) do if knownRoot(n) and owns(n,p.owner) then nodes[#nodes+1]=copy(n) end end
 if signature(nodes)~=signature(state.roots) then state.roots=nodes;dirty=true end
end
local function find(nodes,id)
 for _,n in ipairs(nodes) do
  if n.attributes and n.attributes.id==id then return n end
  local result=find(n.children or {},id);if result then return result end
 end
end
function loboUISetAttribute(p)
 local state=stateFor(p);if not state then return end
 local n=find(state.roots,p.id);if not n then return end
 if n.attributes[p.attribute]~=p.value then n.attributes[p.attribute]=p.value;dirty=true end
end
function loboUIRelease(p)
 local state=stateFor(p);if not state then return end
 releaseEnvironment(p.owner);hide(state);owners[p.owner]=nil;dirty=true
end
function loboUIStandardDirty()dirty=true end
function loboUIFlush()
 prune()
 if not dirty or UI.loading then return end
 local nodes=drawerRender(view());local text={}
 for _,n in ipairs(nodes) do text[#text+1]=xml(n) end
 dirty=false;UI.setXml(table.concat(text),UI.getCustomAssets())
end
function onObjectDestroy(object)
 local guid=object.getGUID()
 for owner,state in pairs(owners) do
  if guid==owner or guid==state.anchor then releaseEnvironment(owner);hide(state);state.retired=true;state.roots={};owners[owner]=nil;dirty=true end
 end
 loboUIFlush()
end
function onLoad()
 Global.setVar('LoboMapUIBrokerV4',self.getGUID())
 self.setLock(true);self.interactable=false;self.setInvisibleTo(hiddenColors)
 if timer then Wait.stop(timer) end
 timer=Wait.time(loboUIFlush,.1,-1)
end
function onDestroy()
 restoreEnvironment()
 if timer then Wait.stop(timer) end
 if Global.getVar('LoboMapUIBrokerV4')==self.getGUID() then Global.setVar('LoboMapUIBrokerV4',nil) end
end
