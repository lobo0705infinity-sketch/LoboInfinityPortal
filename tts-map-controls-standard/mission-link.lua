 function loboStandardMissionOpen(player)
  local color=type(player)=='string' and player or (player and player.color)
  if not color then return end
  local url=LOBO_STANDARD_META.missionUrl
  printToColor(url,color,{.58,.83,1})
  local seat=Player[color]
  if seat and seat.showInputDialog then
   seat.showInputDialog('MissionGeist | Copy this link into your browser.',url,function() end)
  end
 end
