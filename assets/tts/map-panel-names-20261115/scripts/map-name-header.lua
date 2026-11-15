-- The name belongs to the active map, not the shared drawer's first owner.
local function loboNamedDrawer(nodes)
 local name=nil
 local newest=-1
 for _,state in pairs(owners) do
  if state.mapName and state.mapName~='' and validOwner(state) and state.token>newest then
   name=state.mapName;newest=state.token
  end
 end
 if not name then return nodes end
 local function visit(n)
  local a=n.attributes or {}
  if a.id==drawerRoot..'_panel' then
   local gap=58
   a.height=tostring((tonumber(a.height) or 0)+gap)
   for _,child in ipairs(n.children or {}) do
    local c=child.attributes or {}
    local x,y=tostring(c.offsetXY or ''):match('^([%-%.%d]+)%s+([%-%.%d]+)$')
    if y and tonumber(y)<=-44 then c.offsetXY=x..' '..tostring(tonumber(y)-gap) end
   end
   n.children[#n.children+1]={tag='Text',attributes={
    id=drawerRoot..'_mapName',rectAlignment='UpperLeft',offsetXY='12 -44',
    width=tostring((tonumber(a.width) or 350)-24),height='54',fontSize='18',
    fontStyle='Bold',alignment='MiddleLeft',color='#F3D995FF',
    horizontalOverflow='Wrap',verticalOverflow='Truncate',raycastTarget='false',
    tooltip=name},value=name}
  elseif a.id==drawerRoot..'_tab' or a.id==drawerRoot..'_toggle' then
   a.text='Map Controls\n'..name
   a.width='280';a.height='64';a.fontSize='16'
   a.horizontalOverflow='Wrap';a.tooltip=name
   -- The older drawer keeps its toggle above the open panel.
   if a.id==drawerRoot..'_toggle' then
    local x,y=tostring(a.offsetXY or ''):match('^([%-%.%d]+)%s+([%-%.%d]+)$')
    if y then a.offsetXY=x..' '..tostring(tonumber(y)+45) end
   end
  end
  for _,child in ipairs(n.children or {}) do visit(child) end
 end
 for _,n in ipairs(nodes) do visit(n) end
 return nodes
end
