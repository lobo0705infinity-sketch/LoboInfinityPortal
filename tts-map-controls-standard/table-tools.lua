 -- Shared table tools live outside the battlefield and survive map changes.
 local toolBase="https://lobo-infinity-portal.vercel.app/assets/maps/table-tools-20261125-r3/"
 local tableTools={
  {key="orders",tag="LoboInfinityOrderPanel",files={"order-panel.json"},position={34,1.45,-37}},
  {key="army",tag="LoboArmySpawner",files={"army-spawner-1.txt","army-spawner-2.txt","army-spawner-3.txt","army-spawner-4.txt"},position={40.55,1.4,-36.69}}
 }
 local function currentTool(spec)
  local oldPanel
  local function inspect(o)
   if not o or o.isDestroyed() then return end
   local name=o.getName() or ""
   if spec.key=="army" then
    if o.hasTag(spec.tag) or (o.type=="Block" and name:lower():find("infinity army spawner",1,true)) then return o end
   elseif o.hasTag(spec.tag) or name:find("Lobo Infinity Order Panel",1,true)==1 then
    if (tonumber(o.getVar("LOBO_ORDER_PANEL_REVISION")) or 0)>=3 or name=="Lobo Infinity Order Panel R3" then return o end
    oldPanel=o
   end
  end
  for _,o in ipairs(getObjectsWithTag(spec.tag)) do local match=inspect(o);if match then return match end end
  if spec.key=="army" then local match=inspect(getObjectFromGUID("056963"));if match then return match end end
  for _,o in ipairs(getObjects()) do local match=inspect(o);if match then return match end end
  return nil,oldPanel
 end
 local function ensureTool(spec,now)
  if spec.done or now<(spec.nextCheck or 0) then return end
  local leaseKey="LoboMapToolLease_"..spec.key
  local lease=Global.getTable(leaseKey) or {}
  if lease.untilTime and lease.untilTime>now and getObjectFromGUID(lease.owner) then
   spec.nextCheck=now+2;return
  end
  if currentTool(spec) then spec.done=true;return end
  spec.attempt=(spec.attempt or 0)+1
  local token=self.getGUID().."/"..spec.attempt.."/"..now
  local untilTime=now+60
  Global.setTable(leaseKey,{owner=self.getGUID(),token=token,untilTime=untilTime})
  spec.nextCheck=untilTime
  local parts,remaining={},#spec.files
  local function holds()
   local current=Global.getTable(leaseKey) or {}
   return current.token==token
  end
  local function release()
   Global.setTable(leaseKey,{})
   spec.nextCheck=0
  end
  local function retry()
   release();spec.nextCheck=os.time()+math.min(60,spec.attempt*8)
   if spec.attempt==1 then print("Lobo table tools: retrying the "..spec.key.." download.") end
  end
  for i,file in ipairs(spec.files) do
   local index=i
   WebRequest.get(toolBase..file,function(response)
    if not holds() then return end
    if not deployed() then release();return end
    if response.is_error or (response.response_code and response.response_code~=200) or not response.text or response.text=="" then retry();return end
    parts[index]=response.text;remaining=remaining-1
    if remaining~=0 then return end
    local ok,data=pcall(JSON.decode,table.concat(parts))
    local signature=spec.key=="orders" and "LOBO_ORDER_PANEL_REVISION = 3" or "__lobo_zoc_hotkey_provider_r6"
    if not ok or type(data)~="table" or data.Name~="BlockSquare" or type(data.LuaScript)~="string" or not data.LuaScript:find(signature,1,true) then retry();return end
    local existing,older=currentTool(spec)
    if existing then spec.done=true;release();return end
    local installed=pcall(function()
     if older then
      older.setName(data.Nickname);older.setLuaScript(data.LuaScript);older.addTag("LoboTableTool");older.reload()
     else
      local o=spawnObjectData({data=data,position=spec.position,rotation={0,180,0}})
      assert(o,"TTS did not spawn the table tool")
     end
    end)
    if not installed then retry();return end
    spec.done=true;release()
   end)
  end
 end
 local function ensureTableTools()
  if not WebRequest or (tableTools[1].done and tableTools[2].done) then return end
  local now=os.time()
  for _,spec in ipairs(tableTools) do ensureTool(spec,now) end
 end
