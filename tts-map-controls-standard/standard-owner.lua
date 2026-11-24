-- BEGIN LOBO STANDARD MAP CONTROLS V1
LOBO_STANDARD_VERSION=1
LOBO_STANDARD_META=JSON.decode(__META__)
do
 local config=JSON.decode(__ROTATION_CONFIG__)
 local nativeWait=loboNativeWait or Wait
 local busy=false
 local pending={}
 local missionReaders={}
 local grid=false
 local scoring=false
 local oldLoad,oldSave,oldDestroy=onLoad,onSave,onDestroy
 LOBO_MAP_ROTATION_FLIPPED=false
 local function deployed()
  local mat=getObjectFromGUID(config.anchor)
  if not mat or mat.isDestroyed()then return false end
  local p=mat.getPosition()
  return math.abs(p.x)<45 and math.abs(p.z)<27 and p.y>-10 and p.y<45
 end
 local function tell(color,message)
  if color then broadcastToColor(message,color,{1,.8,.35})else broadcastToAll(message,{1,.8,.35})end
 end
 local function owned(o)
  if config.guids[o.getGUID()]then return true end
  for _,tag in ipairs(config.tags)do if o.hasTag(tag)then return true end end
  return false
 end
 local function eligible(o)
  if o.isDestroyed() or o.tag=='Hand' or o.type=='Hand' or o.tag=='HandTrigger' or o.type=='HandTrigger' or (config.exclude and config.exclude[o.getGUID()])then return false end
  local p=o.getPosition()
  if p.y < -10 or p.y>80 then return false end
  if owned(o)then return math.abs(p.x)<=120 and math.abs(p.z)<=120 end
  if nereidDeckLifted==true then
   local deckX=LOBO_MAP_ROTATION_FLIPPED and -58 or 58
   if math.abs(p.x-deckX)<=24.25 and math.abs(p.z)<=24.25 then return true end
  end
  return math.abs(p.x)<=24.25 and math.abs(p.z)<=24.25
 end
 local function restoreLocks()
  for _,s in ipairs(pending)do
   if not s.o.isDestroyed()then pcall(function()s.o.setVelocity({0,0,0});s.o.setAngularVelocity({0,0,0});s.o.setLock(s.locked)end)end
  end
  pending={};busy=false
 end
 local function notify()
  loboLifeCall('loboUIStandardDirty',{})
 end
 local function drawGuides()
  local mat=getObjectFromGUID(config.anchor)
  if not mat or mat.isDestroyed()then return end
  local lines={}
  if scoring then
   for _,axis in ipairs({'x','z'})do
    local points={}
    for _,v in ipairs({-24,24})do
     local p=lmr.positionToLocal(mat,axis=='x'and Vector(v,0,0)or Vector(0,0,v))
     points[#points+1]={p.x,p.y,p.z}
    end
    loboInk(mat,lines,points,'scoring')
   end
  end
  for _,line in ipairs(lines)do line.loboStandardGuide=true end
  mat.setTable('LoboStandardGuides',lines)
  loboZoneWrite(mat,mat.getTable('LoboZoneSourceR1')or{})
 end
 function loboStandardState()
  return{flipped=LOBO_MAP_ROTATION_FLIPPED,grid=Grid and Grid.show_lines==true,scoring=scoring,busy=busy}
 end
 function loboStandardGrid()
  grid=not(Grid and Grid.show_lines==true)
  if Grid then Grid.show_lines=grid end
  notify()
 end
 function loboStandardScoring()
  scoring=not scoring;drawGuides();notify()
 end
 function loboStandardClear(player)
  if busy then restoreLocks()end
  local stage=getObjectFromGUID('2d647a')
  if (Global.getVar('hld')or 0)~=0 or (stage and stage.getVar('cb'))then
   tell(player and player.color,'Wait for the map to finish loading before clearing it.');return
  end
  if stage then stage.call('btnTrash');return end
  local snapshot={}
  for _,o in ipairs(getAllObjects())do
   if not(config.exclude and config.exclude[o.getGUID()])and owned(o)then snapshot[#snapshot+1]=o end
  end
  for _,o in ipairs(snapshot)do if not o.isDestroyed()then o.destruct()end end
 end
 function loboRotateMap180(player)
  local color=type(player)=='string'and player or(player and player.color)
  if busy then return end
  local stage=getObjectFromGUID('2d647a')
  if not deployed()or(Global.getVar('hld')or 0)~=0 or(stage and stage.getVar('cb'))then
   tell(color,'Wait for the map to finish loading, then rotate it.');return
  end
  local snapshot={}
  for _,o in ipairs(getAllObjects())do
   if eligible(o)then
    if o.held_by_color and o.held_by_color~=''then tell(color,'Release all battlefield pieces before rotating the map.');return end
    if o.loading_custom or o.spawning then tell(color,'Wait for the battlefield objects to finish loading.');return end
    snapshot[#snapshot+1]={o=o,p=o.getPosition(),r=o.getRotation(),locked=o.getLock()}
   end
  end
  if #snapshot==0 then return end
  busy=true;pending=snapshot
  local wasFlipped=LOBO_MAP_ROTATION_FLIPPED
  local ok,err=pcall(function()
   for _,s in ipairs(snapshot)do s.o.setLock(true);s.o.setVelocity({0,0,0});s.o.setAngularVelocity({0,0,0})end
   for _,s in ipairs(snapshot)do s.o.setRotation({s.r.x,(s.r.y+180)%360,s.r.z});s.o.setPosition({-s.p.x,s.p.y,-s.p.z})end
   LOBO_MAP_ROTATION_FLIPPED=not wasFlipped
  end)
  if not ok then
   LOBO_MAP_ROTATION_FLIPPED=wasFlipped
   for _,s in ipairs(snapshot)do if not s.o.isDestroyed()then pcall(function()s.o.setRotation(s.r);s.o.setPosition(s.p)end)end end
   restoreLocks();tell(color,'Map rotation could not finish; original positions restored.');print(tostring(err));return
  end
  local mat=getObjectFromGUID(config.anchor)
  if mat then loboZoneWrite(mat,mat.getTable('LoboZoneSourceR1')or{})end
  nativeWait.frames(function()if pending==snapshot then restoreLocks();notify()end end,2)
 end
 local function missionPanel()
  local id='loboMission_'..self.getGUID()..'_standardBriefing'
  local roots=UI.getXmlTable()or{}
  for i=#roots,1,-1 do if (roots[i].attributes or{}).id==id then table.remove(roots,i)end end
  local colors={};for c,on in pairs(missionReaders)do if on then colors[#colors+1]=c end end
  if #colors>0 then
   local body=LOBO_STANDARD_META.missionText or''
   local lines,start=0,1
   while true do
    local stop=string.find(body,'\n',start,true)
    local length=(stop or (#body+1))-start
    lines=lines+math.max(1,math.ceil(length/75))
    if not stop then break end
    start=stop+1
   end
   local height=math.max(440,lines*24+40)
   roots[#roots+1]={tag='Panel',attributes={id=id,rectAlignment='MiddleCenter',width='760',height='620',allowDragging='true',color='#10212AFF',active='true',visibility=table.concat(colors,'|')},children={
    {tag='Text',attributes={rectAlignment='UpperLeft',offsetXY='22 -12',width='580',height='38',fontSize='24',color='#FFFFFFFF',alignment='MiddleLeft'},value=LOBO_STANDARD_META.mission..' - Mission'},
    {tag='Button',attributes={id=id..'_close',text='Close',onClick=self.getGUID()..'/loboStandardMissionClose',rectAlignment='UpperRight',offsetXY='-20 -14',width='100',height='34',fontSize='18',color='#35566AFF'}},
    {tag='VerticalScrollView',attributes={rectAlignment='UpperLeft',offsetXY='20 -65',width='720',height='530',verticalScrollbarVisibility='AutoHide'},children={
     {tag='Panel',attributes={width='700',height=tostring(height),preferredHeight=tostring(height)},children={
      {tag='Text',attributes={rectAlignment='UpperLeft',offsetXY='10 -8',width='680',height=tostring(height-16),fontSize='18',color='#EDF3F8FF',alignment='UpperLeft',horizontalOverflow='Wrap'},value=body}
     }}
    }}
   }}
  end
  UI.setXmlTable(roots)
 end
 function loboStandardMissionOpen(player)if player then missionReaders[player.color]=true;missionPanel()end end
 function loboStandardMissionClose(player)if player then missionReaders[player.color]=nil;missionPanel()end end
 local function mount()
  if not deployed()or not loboLifeToken or not loboLifeAlive()then return end
  local roots=UI.getXmlTable()or{}
  local id='loboMission_'..self.getGUID()..'_standard'
  for _,n in ipairs(roots)do if n.attributes and n.attributes.id==id then return end end
  local children={}
  for _,item in ipairs({{'mission','Mission','loboStandardMissionOpen'},{'rotate','Turn 180','loboRotateMap180'},{'grid','Grid','loboStandardGrid'},
   {'scoring','Quadrants','loboStandardScoring'},{'clear','Clear Table','loboStandardClear'}})do
   children[#children+1]={tag='Button',attributes={id=id..'_'..item[1],text=item[2],onClick=self.getGUID()..'/'..item[3],width='326',height='34'}}
  end
  roots[#roots+1]={tag='Panel',attributes={id=id},children=children}
  UI.setXmlTable(roots)
 end
 function onLoad(saved)
  LOBO_MAP_ROTATION_FLIPPED=false
  if saved and saved~=''then
   local ok,state=pcall(JSON.decode,saved)
   if ok and type(state)=='table'and state.__loboStandard==1 then
    grid=state.grid==true;scoring=state.scoring==true
    LOBO_MAP_ROTATION_FLIPPED=state.flipped==true;saved=state.original or''
   end
  end
  -- Recover old two-map rotation envelopes nested inside color saves.
  local function unwrapRotation(text)
   if type(text)~='string'or text==''then return text end
   local ok,state=pcall(JSON.decode,text)
   if not ok or type(state)~='table'then return text end
   if state.__loboMapRotation==1 then
    LOBO_MAP_ROTATION_FLIPPED=state.flipped==true;return unwrapRotation(state.original or'')
   end
   if type(state.original)=='string'then state.original=unwrapRotation(state.original);return JSON.encode(state)end
   return text
  end
  if oldLoad then oldLoad(unwrapRotation(saved))end
  Wait.condition(function()if Grid then Grid.show_lines=grid end;drawGuides();mount();notify()end,
   function()return deployed()and loboLifeToken~=nil end,60)
  Wait.time(mount,1,-1)
 end
 function onSave()
  if busy then restoreLocks()end
  return JSON.encode({__loboStandard=1,flipped=LOBO_MAP_ROTATION_FLIPPED,grid=Grid and Grid.show_lines==true,scoring=scoring,original=oldSave and oldSave()or''})
 end
 function onDestroy()
  if busy then restoreLocks()end
  if oldDestroy then oldDestroy()end
 end
end
-- END LOBO STANDARD MAP CONTROLS V1
