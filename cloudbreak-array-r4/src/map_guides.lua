local function draw()
 local mat=obj(config.mat)
 if not mat then return end
 local lines={}

 local function boundaries(offset,kind)
  for _,x in ipairs({-offset,offset}) do
   loboInk(mat,lines,{{x,.02,24},{x,.02,-24}},kind)
  end
 end

 if state.dz>=0 then boundaries(12-state.dz,'deployment') end
 if state.exclusion then boundaries(4,'exclusion') end
 loboZoneWrite(mat,lines)
end

local function cloudMissionLink(player)
 if not player or not player.color then return end
 local color=player.color
 printToColor(config.missionUrl,color,{.58,.83,1})
 local reader=Player[color]
 if reader and reader.showInputDialog then
  reader.showInputDialog('Network Node by Lobo | Copy this link into your browser.',config.missionUrl,function() end)
 end
end
