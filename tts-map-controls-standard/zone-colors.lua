-- BEGIN LOBO INDEPENDENT ZONE COLORS R1
LOBO_ZONE_COLOR_VERSION=1
local loboColorMatGUID=__MAT_GUID__
local loboColorState={deployment=1,exclusion=3}
local loboColorReaders={}
local loboColorRoot='loboMission_ZoneColors_'..self.getGUID()
local function loboColorMat()return getObjectFromGUID(loboColorMatGUID)end
local function loboColorNode(tag,a,children)return{tag=tag,attributes=a or {},children=children or {}}end
local function loboColorRefresh()
 if not loboLifeToken then return end
 local roots={}
 for _,n in ipairs(UI.getXmlTable() or {})do if not n.attributes or n.attributes.id~=loboColorRoot then roots[#roots+1]=n end end
 local function button(id,label,callback)
  return loboColorNode('Button',{id=loboColorRoot..id,text=label,onClick=self.getGUID()..'/'..callback,
   width='226',height='34',fontSize='17',color='#294351FF',textColor='#FFFFFFFF'})
 end
 local children={button('_dz','DZ Color: '..loboZonePalette[loboColorState.deployment].name,'loboZoneDZColor'),
  button('_ex','Exclusion Color: '..loboZonePalette[loboColorState.exclusion].name,'loboZoneExclusionColor')}
 for color,kind in pairs(loboColorReaders)do
  local body={loboColorNode('Text',{text=kind=='deployment' and 'DZ line color' or 'Exclusion line color',height='40',fontSize='23',color='#FFFFFFFF'})}
  for i,palette in ipairs(loboZonePalette)do
   local b=button('_pick_'..kind..'_'..i,palette.name..(loboColorState[kind]==i and '  •' or ''),'loboZonePickColor')
   b.attributes.color=palette.hex;b.attributes.textColor='#000000FF';b.attributes.height='38';b.attributes.fontStyle='Bold'
   body[#body+1]=b
  end
  body[#body+1]=button('_close_'..color,'Close','loboZoneCloseColor')
  children[#children+1]=loboColorNode('Panel',{id=loboColorRoot..'_palette_'..color,rectAlignment='MiddleCenter',width='330',height='425',
   color='#10212AFF',visibility=color,active='true',allowDragging='true'},
   {loboColorNode('VerticalLayout',{padding='18 18 14 14',spacing='5',childForceExpandHeight='false',childForceExpandWidth='true'},body)})
 end
 roots[#roots+1]=loboColorNode('Panel',{id=loboColorRoot,width='100%',height='100%',color='#00000000',raycastTarget='false'},children)
 UI.setXmlTable(roots)
end
local function loboColorApply()
 local mat=loboColorMat();if not mat or mat.isDestroyed() then return end
 mat.setTable('LoboZoneColorsR1',loboColorState)
 loboZoneWrite(mat,mat.getTable('LoboZoneSourceR1') or {})
end
function loboZoneDZColor(p)if p and p.color then loboColorReaders[p.color]='deployment';loboColorRefresh()end end
function loboZoneExclusionColor(p)if p and p.color then loboColorReaders[p.color]='exclusion';loboColorRefresh()end end
function loboZoneCloseColor(p)if p and p.color then loboColorReaders[p.color]=nil;loboColorRefresh()end end
function loboZonePickColor(p,value,id)
 if not p or not p.color or not id then return end
 local kind,n=id:match('_pick_(%a+)_(%d+)$');n=tonumber(n)
 if not n or (kind~='deployment' and kind~='exclusion') or n<1 or n>7 then return end
 loboColorState[kind]=n;loboColorReaders[p.color]=nil;loboColorApply();loboColorRefresh()
end
local loboColorActions={loboZoneDZColor=loboZoneDZColor,loboZoneExclusionColor=loboZoneExclusionColor,
 loboZoneCloseColor=loboZoneCloseColor,loboZonePickColor=loboZonePickColor}
local loboColorOldDrawer=loboDrawerAction
function loboDrawerAction(p,value,id)
 local route=loboLifeCall('loboDrawerResolve',{id=id,color=p and p.color})
 local fn=route and loboColorActions[route.callback]
 if fn then fn(p,value,id)elseif loboColorOldDrawer then loboColorOldDrawer(p,value,id)end
end
local loboColorOldLoad=onLoad
function onLoad(saved)
 local original=saved
 if saved and saved~=''then
  local ok,data=pcall(JSON.decode,saved)
  if ok and type(data)=='table' and type(data.__loboZoneColorsR1)=='table' then
   local s=data.__loboZoneColorsR1
   loboColorState={deployment=loboZoneIndex(s.deployment,1),exclusion=loboZoneIndex(s.exclusion,3)}
   original=type(data.original)=='string' and data.original or ''
  end
 end
 local mat=loboColorMat();if mat then mat.setTable('LoboZoneColorsR1',loboColorState)end
 if loboColorOldLoad then loboColorOldLoad(original)end
 __NORMALIZE_DZ__
 local function ready()
  local m=loboColorMat()
  return m and not m.isDestroyed() and loboLifeToken~=nil
 end
 Wait.condition(function()loboColorApply();loboColorRefresh()end,ready,60)
end
local loboColorOldSave=onSave
function onSave()
 return JSON.encode({__loboZoneColorsR1=loboColorState,original=loboColorOldSave and loboColorOldSave() or ''})
end
-- END LOBO INDEPENDENT ZONE COLORS R1
