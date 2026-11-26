-- Only clicking a player's physical button can start a full spawner download.
local rawRoot = "https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/"
local assetRoot = "/lobo-infinity-portal/public/assets/maps/"
local manifestURL = rawRoot.."main"..assetRoot.."army-spawner-current/release.json"
local fallback = {revision=2026112501, commit="55a153b7e62bd341692cbdcbd3e2a6f244c4484b",
    directory="army-spawner-20261125", sizes={2846401,2846395,2846394,2979614}}
local lastGood = fallback
local side = self.hasTag("LoboArmyLauncherRed") and "Red" or "Blue"
local sign = side == "Blue" and 1 or -1
local position = {36.91*sign, 1.11, 1.85*sign}
local rotation = {0, side == "Blue" and 89.99 or 269.99, 0}
local scale = {5, 0.30, 6}
local sideTag = "LoboArmySpawner"..side
local leaseKey = "LoboArmyDownloadR6"
local idle = "Load Army Spawner"
local current, loadedGuid
local serial = 0
LOBO_ARMY_LAUNCHER_REVISION = 10

local function say(color, message)
    printToColor(message, color, {0.77, 0.91, 1})
end

local function label(value)
    self.editButton({index=0, label=value})
end

local function existing(requiredRevision)
    local older
    local function inspect(o)
        if o and not o.isDestroyed() and not o.hasTag("LoboArmyLauncher") then
            local revision=tonumber(o.getVar("LOBO_ARMY_DATA_REVISION")) or 0
            if revision<100000000 then revision=revision*100 end
            if revision>=requiredRevision then return o end
            older=older or o
        end
    end
    for _,o in ipairs(getObjectsWithTag(sideTag) or {}) do
        local currentObject=inspect(o)
        if currentObject then return currentObject end
    end
    for _,o in ipairs(getObjects()) do
        if not o.isDestroyed() and o.type=="Block" and not o.hasTag("LoboArmyLauncher")
            and not o.hasTag("LoboArmySpawnerBlue") and not o.hasTag("LoboArmySpawnerRed")
            and (o.hasTag("LoboArmySpawner") or (o.getName() or ""):lower():find("infinity army spawner",1,true))
            and (o.getPosition().x>=0)==(side=="Blue") then
            local currentObject=inspect(o)
            if currentObject then return currentObject end
        end
    end
    return nil,older
end

local function reveal(o, color, recover)
    o.addTag(sideTag)
    loadedGuid = o.getGUID()
    if recover then
        if o.held_by_color and o.held_by_color~="" then
            label("Show Army Spawner")
            say(color, side.."'s Army Spawner is being held. Release it and click again to bring it back.")
            return
        end
        o.setVelocity({0,0,0})
        o.setAngularVelocity({0,0,0})
        o.setRotation(rotation)
        o.setScale(scale)
        o.setPosition(position)
    end
    label("Show Army Spawner")
    o.highlightOn(side=="Blue" and {0.18,0.72,1} or {1,0.3,0.22}, 3)
    local seat = Player[color]
    if seat and seat.pingTable then seat.pingTable(position) end
end

local function owns(job)
    if current ~= job then return false end
    local lease = Global.getTable(leaseKey)
    return lease and lease.owner==self.getGUID() and lease.id==job.id
end

local function finish(job, object, message, recover)
    if current ~= job then return end
    if owns(job) then Global.setTable(leaseKey, {}) end
    if job.timer then Wait.stop(job.timer) end
    current = nil
    job.parts = nil
    if object then
        reveal(object,job.color,recover)
        say(job.color,object.getName().." is ready.")
    else label(idle) end
    if message then say(job.color, message) end
end

local function deadline(job)
    if job.timer then Wait.stop(job.timer) end
    Global.setTable(leaseKey, {owner=self.getGUID(), id=job.id, expires=os.time()+95})
    job.timer = Wait.time(function()
        job.timer=nil
        if job.pending and not job.pending.isDestroyed() then
            finish(job,job.pending)
        else
            finish(job,nil,"Army Spawner timed out. Click to retry.")
        end
    end,90)
end

local function unpackSpawner(job)
    if not owns(job) then return end
    local already,older = existing(job.release.revision)
    if already then finish(job,already,nil,true);return end
    -- Give the new object its seat before it exists in the room. Keep the saved-object script and settings intact.
    local suffix = '"LoboArmySpawner"]}'
    local last = job.parts[#job.release.sizes]
    if last:sub(-#suffix) ~= suffix then finish(job,nil,"Invalid Army Spawner data. Click to retry.");return end
    job.parts[#job.release.sizes] = last:sub(1,-#suffix-1)..'"LoboArmySpawner","'..sideTag..'"]}'
    local save=table.concat(job.parts)
    job.parts=nil
    local marker="LOBO_ARMY_DATA_REVISION = "..string.format("%.0f",job.release.revision)
    if not save:find(marker..'\\n',1,true) then
        finish(job,nil,"Army Spawner has the wrong data revision. Click to retry.");return
    end
    if older then
        if older.held_by_color and older.held_by_color~="" then
            finish(job,nil,"Release the spawner and click again to update it.");return
        end
        for _,button in ipairs(older.getButtons() or {}) do
            if button.label=="Spawning..." then
                finish(job,nil,"Wait for this army to finish spawning, then click again.");return
            end
        end
        local ok,updated=pcall(function()
            local data=JSON.decode(save)
            assert(type(data.LuaScript)=="string" and data.LuaScript:find(marker.."\n",1,true))
            local savedOK,state=pcall(function() return older.call("onSave") end)
            if savedOK and type(state)=="string" then older.script_state=state end
            older.setName(data.Nickname)
            older.setDescription(data.Description)
            older.addTag(sideTag)
            older.setLuaScript(data.LuaScript)
            return older.reload()
        end)
        if ok and updated then finish(job,updated,nil,true)
        else finish(job,nil,"Could not update the existing spawner. Click to retry.") end
        return
    end
    local ok,spawned=pcall(spawnObjectJSON,{
        json=save, position=position, rotation=rotation, scale=scale,
        callback_function=function(ready) if owns(job) then finish(job,ready) end end
    })
    if current ~= job then return end
    if ok and spawned then job.pending=spawned
    else finish(job,nil,"TTS could not open the Army Spawner. Click to retry.") end
end

local function requestPart(job,index)
    if not owns(job) then return end
    deadline(job)
    label("Loading "..index.."/"..#job.release.sizes)
    local ok=pcall(WebRequest.get,job.base..index..".txt",function(response)
        if not owns(job) or job.index~=index then return end
        if not response or response.is_error or response.response_code~=200 or type(response.text)~="string"
            or #response.text~=job.release.sizes[index] then
            finish(job,nil,"Army Spawner download interrupted. Click to retry.");return
        end
        job.parts[index]=response.text
        job.index=index+1
        if index<#job.release.sizes then requestPart(job,index+1) else
            label("Opening spawner")
            Wait.frames(function() unpackSpawner(job) end,2)
        end
    end)
    if not ok then finish(job,nil,"Army Spawner download could not start. Click to retry.") end
end

local function readRelease(text)
    if type(text)~="string" or #text>4096 then return nil end
    local ok,r=pcall(JSON.decode,text)
    if not ok or type(r)~="table" or type(r.revision)~="number"
        or r.revision%1~=0 or r.revision<fallback.revision or r.revision>9999999999
        or type(r.commit)~="string" or #r.commit~=40 or not r.commit:match("^%x+$")
        or type(r.directory)~="string" or #r.directory>80 or not r.directory:match("^army%-spawner%-%w[%w%-]*$")
        or type(r.sizes)~="table" or #r.sizes~=4 then return nil end
    for _,size in ipairs(r.sizes) do
        if type(size)~="number" or size%1~=0 or size<1 or size>8000000 then return nil end
    end
    return r
end

local function selectRelease(job,received)
    if not owns(job) or not job.checking then return end
    job.checking=false
    if job.timer then Wait.stop(job.timer);job.timer=nil end
    if received and received.revision>=lastGood.revision then lastGood=received end
    job.release=lastGood
    job.base=rawRoot..lastGood.commit..assetRoot..lastGood.directory.."/army-spawner-"
    local ready=existing(lastGood.revision)
    if ready then finish(job,ready,nil,true);return end
    requestPart(job,1)
end

local function startWhenFree(job)
    if current~=job then return end
    job.timer=nil
    local lease=Global.getTable(leaseKey) or {}
    if lease.expires and lease.expires>os.time() and getObjectFromGUID(lease.owner) then
        label("In queue")
        job.timer=Wait.time(function() startWhenFree(job) end,0.6)
        return
    end
    Global.setTable(leaseKey,{owner=self.getGUID(),id=job.id,expires=os.time()+95})
    job.checking=true
    label("Checking spawner")
    job.timer=Wait.time(function() selectRelease(job,nil) end,6)
    local ok=pcall(WebRequest.get,manifestURL,function(response)
        local manifest
        if response and not response.is_error and response.response_code==200 then
            manifest=readRelease(response.text)
        end
        selectRelease(job,manifest)
    end)
    if not ok then selectRelease(job,nil) end
end

function loboLoadArmySpawner(_,color)
    if current then say(color,side.."'s Army Spawner is already loading.");return end
    serial=serial+1
    current={id=serial,color=color,parts={},index=1}
    startWhenFree(current)
end

function onSave()
    return JSON.encode(lastGood)
end

function onLoad(saved)
    lastGood=readRelease(saved) or fallback
    self.clearButtons()
    self.createButton({click_function="loboLoadArmySpawner",function_owner=self,label=idle,
        position={0,0.55,0},width=1140,height=335,font_size=98,scale={0.39,1,0.90},
        color=side=="Blue" and {0.10,0.27,0.34} or {0.47,0.12,0.12},font_color={1,1,1},
        tooltip="Check the current Army release and load or show "..side.."'s spawner."})
end

function onObjectDestroy(o)
    if loadedGuid and o.getGUID()==loadedGuid then loadedGuid=nil;label(idle) end
end

function onDestroy()
    if current then
        if owns(current) then Global.setTable(leaseKey,{}) end
        if current.timer then Wait.stop(current.timer) end
        current=nil
    end
end
