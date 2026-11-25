-- Lobo Infinity Order Panel. The table's public tray tiles are the source of truth.
LOBO_ORDER_PANEL_REVISION = 3
local ROOT = "loboInfinityOrdersV1"
local OWNER = "loboInfinityOrdersOwnerV1"
local PANEL_TAG = "LoboInfinityOrderPanel"
local timer, tickNumber = nil, 0
local indexed = {}
local mounted, lastValues = false, {}
local alive = true

local trayImage = "DB9191D67AD1DC5EBC425FCFE35E90E9053BEE5C"
local traySeats = {c89ab5="Red", db24bf="Blue"}
local flags = {["19419e"]=true, b1ba66=true}
local flagImages = {
    ["01E9B5CF0B94D869273E67AA51238CA757F0832F"]=true,
    ["816EC90F198E7417C1E54E8439BCB5B23990DBBA"]=true,
}
local orderImages = {
    ["145E60BBEDFA90884F06A7862F4A08D70846A387"]="lieutenant",
    ["868174B56A47C3F72774B8C14B0BA1DBD57A6696"]="impetuous",
    ["9AEE960695E8F72760534504DF98D43AA2FA72B1"]="tactical",
    ["F015AEAC2E7EBB5440082216435B949BC64E588E"]="regular",
    ["801CEE15A2E63A4950F10D476850D3A5CD99038E"]="irregular",
}
local orderNames = {
    ["lieutenant order"]="lieutenant", ["lieutenant orders"]="lieutenant",
    ["lt order"]="lieutenant", ["lt orders"]="lieutenant",
    ["special lieutenant order"]="lieutenant", ["lieutenant special order"]="lieutenant",
    ["impetuous"]="impetuous", ["impetuous order"]="impetuous",
    ["impetuous orders"]="impetuous", ["tactical order"]="tactical",
    ["tactical orders"]="tactical", ["tactical awareness"]="tactical",
    ["tactical awareness order"]="tactical", ["tac aware"]="tactical",
    ["tac aware order"]="tactical", ["tactical aware"]="tactical",
    ["regular order"]="regular", ["regular orders"]="regular", ["regular"]="regular",
    ["irregular order"]="irregular", ["irregular orders"]="irregular", ["irregular"]="irregular",
}
local columns = {
    {key="impetuous", label="Impetuous", width=88, color="#FFAAA3"},
    {key="tactical", label="Tac Aware", width=84, color="#E3AEFF"},
    {key="regular", label="Regular", width=68, color="#99EBAB"},
    {key="irregular", label="Irregular", width=76, color="#FFDC80"},
    {key="lieutenant", label="LT", width=38, color="#8FD9FF"},
}
local turnColors = {Red="#FFAAA3", Blue="#93D2FF"}
local pieceTypes = {Tile=true, TileStack=true, Token=true, Chip=true, ChipStack=true,
    Custom_Tile=true, Custom_Token=true}

local function assetId(url)
    if type(url) ~= "string" or #url < 40 then return nil end
    local query = url:find("?",1,true) or #url+1
    local fragment = url:find("#",1,true) or #url+1
    local last = math.min(query,fragment)-1
    while last > 0 and url:byte(last) == 47 do last = last-1 end
    local first = last-39
    if first < 1 or (first > 1 and url:byte(first-1) ~= 47) then return nil end
    return url:sub(first,last):upper()
end

local function orderByName(nickname)
    if type(nickname) ~= "string" then return nil end
    local name = nickname:lower()
    if orderNames[name] then return orderNames[name] end
    -- MoonSharp's pattern matcher can exhaust its budget on ordinary Workshop names.
    -- Walk the name once, skipping TTS color tags and collapsing word separators.
    local letters, space, i = {}, false, 1
    while i <= #name do
        local b = name:byte(i)
        if b == 91 then
            i = name:find("]",i+1,true)
            if not i then return nil end
        elseif b == 32 or b == 45 or b == 95 or (b >= 9 and b <= 13) then
            space = #letters > 0
        elseif b >= 97 and b <= 122 then
            if space then letters[#letters+1] = " "; space = false end
            letters[#letters+1] = string.char(b)
        else
            return nil
        end
        i = i+1
    end
    return orderNames[table.concat(letters)]
end

local function classify(obj,guid)
    if flags[guid] then return "flag" end
    if traySeats[guid] then return "tray" end
    if not pieceTypes[obj.type] then return nil end
    local config = obj.getCustomObject()
    local image = assetId(config and config.image)
    if image == trayImage then return "tray" end
    if flagImages[image] then return "flag" end
    if orderImages[image] then return orderImages[image] end
    return orderByName(obj.getName())
end

local function readEntry(obj)
    if not obj or obj.isDestroyed() then return end
    local guid = obj.getGUID()
    local kind = classify(obj,guid)
    return guid, kind and {obj=obj,kind=kind} or nil
end

local function indexInto(target,obj)
    -- An object can disappear or be mid-reload while TTS enumerates the room.
    local ok,guid,entry = pcall(readEntry,obj)
    if ok and guid then target[guid] = entry end
end

local function indexObject(obj)
    indexInto(indexed,obj)
end

local function reindex()
    local found = {}
    for _,obj in ipairs(getObjects()) do indexInto(found,obj) end
    indexed = found
end

local function hand(color)
    local p = Player[color]
    if p and p.getHandCount() > 0 then return p.getHandTransform(1).position end
end

local function distanceSquared(a,b)
    return (a.x-b.x)^2 + (a.z-b.z)^2
end

local function seatForTray(obj, guid, redHand, blueHand)
    if traySeats[guid] then return traySeats[guid] end
    -- Identical copies of the trays inherit their side from the seats in the room.
    if redHand and blueHand then
        local p = obj.getPosition()
        local r, b = distanceSquared(p,redHand), distanceSquared(p,blueHand)
        if r ~= b then return r < b and "Red" or "Blue" end
    end
end

local function liveFixture(guid)
    local obj = getObjectFromGUID(guid)
    if obj and not obj.isDestroyed() then return obj end
end

local function turnMarker()
    local stock = liveFixture("19419e") or liveFixture("b1ba66")
    if stock then return stock end
    local marker
    for guid,entry in pairs(indexed) do
        if entry.kind == "flag" and not entry.obj.isDestroyed() then
            if not marker or guid < marker.getGUID() then marker = entry.obj end
        end
    end
    return marker
end

local function activeSeatAndTray()
    local marker = turnMarker()
    local seat
    if marker then
        -- In both first-player states, the physical tile's front is red and its back blue.
        seat = marker.is_face_down and "Blue" or "Red"
    elseif Turns.enable and turnColors[Turns.turn_color] then
        seat = Turns.turn_color
    end
    if not seat then return nil, nil end

    local standardGuid = seat == "Red" and "c89ab5" or "db24bf"
    local standard = liveFixture(standardGuid)
    if standard then return seat,standard end
    local redHand, blueHand = hand("Red"), hand("Blue")
    local ownHand = seat == "Red" and redHand or blueHand
    local nearest, best = nil, math.huge
    for guid,entry in pairs(indexed) do
        local obj = entry.obj
        if entry.kind == "tray" and not obj.isDestroyed()
            and seatForTray(obj,guid,redHand,blueHand) == seat and ownHand then
            local d = distanceSquared(obj.getPosition(),ownHand)
            if d < best or (d == best and guid < nearest.getGUID()) then nearest,best = obj,d end
        end
    end
    return seat,nearest
end

local function onPublicTray(obj, tray, kind)
    if obj.is_face_down then return nil end
    local p = tray.positionToLocal(obj.getPosition())
    -- The stock square is two local units wide. Its artwork faces local -Z upward;
    -- the numbered 1 is on local +X. The same rule holds on the opposite seat.
    if math.abs(p.x) > 1 or math.abs(p.z) > 1 or p.y < 0 or p.y > 1.75 then return nil end
    for _,zone in ipairs(obj.getZones()) do
        if zone.type == "Hand" or zone.type == "Fog" or zone.type == "FogOfWar" then return nil end
    end
    -- All three native LT snaps straddle the divider at z=-0.494.
    if kind == "lieutenant" and (math.abs(p.x) < 0.0001 or
        (math.abs(p.x) <= 0.18 and math.abs(p.z+0.494) <= 0.09)) then return 3 end
    if math.abs(p.x) < 0.0001 then return nil end
    return p.x > 0 and 1 or 2
end

local function readTray(tray)
    local groups = {{},{},{}}
    for _,entry in pairs(indexed) do
        local obj = entry.obj
        if entry.kind ~= "tray" and entry.kind ~= "flag" and not obj.isDestroyed() then
            local group = onPublicTray(obj,tray,entry.kind)
            if group then
                local n = math.max(1,obj.getQuantity())
                local counts = groups[group]
                counts[entry.kind] = (counts[entry.kind] or 0) + n
            end
        end
    end
    return groups
end

local function cellKey(row, key) return "r"..row.."_"..key end

local function snapshot()
    local seat,tray = activeSeatAndTray()
    local groups = tray and readTray(tray) or {{},{},{}}
    local values = {title=seat and seat:upper().." TURN" or "ORDERS"}
    local centerLT = groups[3].lieutenant or 0
    values.centerLT = centerLT > 0 and (centerLT.." LT in center") or ""
    local total = 0
    for _,col in ipairs(columns) do
        local a,b = groups[1][col.key] or 0, groups[2][col.key] or 0
        local sum = a + b + (groups[3][col.key] or 0)
        total = total + sum
        values[cellKey(1,col.key)] = tray and tostring(a) or "-"
        values[cellKey(2,col.key)] = tray and tostring(b) or "-"
        values[cellKey(3,col.key)] = tray and tostring(sum) or "-"
    end
    if tray then
        values.count = total == 1 and "1 order left" or total.." orders left"
    elseif seat then
        values.count = "Waiting for "..seat.." order tray"
    else
        values.count = "Waiting for turn marker"
    end
    return values,turnColors[seat] or "#F1F4F7"
end

local function textNode(key,value,x,y,w,h,fontSize,color,align,bold)
    local a = {rectAlignment="UpperLeft", offsetXY=x.." "..-y, width=tostring(w),
        height=tostring(h), fontSize=tostring(fontSize), color=color, alignment=align,
        fontStyle=bold and "Bold" or "Normal", raycastTarget="false"}
    if key then a.id = ROOT.."_"..key end
    return {tag="Text",attributes=a,value=value}
end

local function makeHUD(values,titleColor)
    local children = {
        textNode("title",values.title,12,4,106,24,17,titleColor,"MiddleLeft",true),
        textNode("centerLT",values.centerLT,116,4,108,24,13,"#8FD9FF","MiddleCenter",false),
        textNode("count",values.count,224,4,204,24,15,"#FFFFFF","MiddleRight",true),
    }
    local labels = {"Group 1","Group 2","Total"}
    for row,label in ipairs(labels) do
        children[#children+1] = textNode(nil,label,12,50+24*(row-1),66,23,15,
            row == 3 and "#FFFFFF" or "#DCE5EA","MiddleLeft",row == 3)
    end
    local x = 77
    for _,col in ipairs(columns) do
        children[#children+1] = textNode(nil,col.label,x,29,col.width,20,13,col.color,"MiddleCenter",true)
        for row=1,3 do
            local key = cellKey(row,col.key)
            children[#children+1] = textNode(key,values[key],x,50+24*(row-1),col.width,23,17,
                row == 3 and "#FFFFFF" or "#E4EBEE","MiddleCenter",row == 3)
        end
        x = x + col.width
    end
    for _,y in ipairs({29,99}) do
        children[#children+1] = {tag="Panel",attributes={rectAlignment="UpperLeft",
            offsetXY="10 "..-y,width="424",height="1",color="#40505D",raycastTarget="false"}}
    end
    return {tag="Panel",attributes={id=ROOT,rectAlignment="UpperRight",offsetXY="-16 -96",
        width="444",height="126",color="#14212AF5",raycastTarget="false"},children=children}
end

local function findHUD(roots)
    for i,node in ipairs(roots) do
        if node.attributes and node.attributes.id == ROOT then return i end
    end
end

local function display(values, titleColor, check)
    if UI.loading then return end
    if check or not mounted then
        local roots = UI.getXmlTable() or {}
        local index = findHUD(roots)
        local current = false
        for _,child in ipairs(index and roots[index].children or {}) do
            if child.attributes and child.attributes.id == ROOT.."_centerLT" then current = true; break end
        end
        if not current then
            roots[index or #roots+1] = makeHUD(values,titleColor)
            UI.setXmlTable(roots,UI.getCustomAssets())
            mounted = true
            lastValues = values
            lastValues.titleColor = titleColor
            return
        end
        mounted = true
    end
    for key,value in pairs(values) do
        local id = ROOT.."_"..key
        if lastValues[key] ~= value or (check and UI.getValue(id) ~= value) then
            UI.setValue(id,value)
        end
    end
    if lastValues.titleColor ~= titleColor or check then
        UI.setAttribute(ROOT.."_title","color",titleColor)
    end
    lastValues = values
    lastValues.titleColor = titleColor
end

local function ownsHUD()
    local owner = Global.getVar(OWNER)
    if owner == self.getGUID() then return true end
    local other = owner and getObjectFromGUID(owner)
    if other and not other.isDestroyed() and other.hasTag(PANEL_TAG) then
        local revision = tonumber(other.getVar("LOBO_ORDER_PANEL_REVISION")) or 1
        if revision >= LOBO_ORDER_PANEL_REVISION then return false end
    end
    Global.setVar(OWNER,self.getGUID())
    mounted, lastValues = false, {}
    return true
end

local function refresh()
    if not alive or not ownsHUD() then return end
    tickNumber = tickNumber + 1
    -- Discover restored objects, renamed substitutes and custom objects that finished loading.
    if tickNumber % 40 == 1 then reindex() end
    local values,titleColor = snapshot()
    display(values,titleColor,tickNumber % 10 == 1)
end

function onLoad()
    alive, tickNumber, mounted, lastValues = true, 0, false, {}
    self.addTag(PANEL_TAG)
    self.clearButtons()
    self.createButton({label="ORDERS",click_function="orderPanelLabel",function_owner=self,
        position={0,0.51,0},rotation={0,0,0},width=0,height=0,font_size=88,
        scale={0.65,1,1},font_color={0.9,0.96,1}})
    if timer then Wait.stop(timer) end
    timer = Wait.time(refresh,0.4,-1)
    Wait.frames(refresh,2)
end

function orderPanelLabel() end
function onObjectSpawn(obj) indexObject(obj) end
function onObjectDrop(_,obj) indexObject(obj) end
function onObjectStateChange(obj,oldGuid)
    indexed[oldGuid] = nil
    indexObject(obj)
end
function onObjectLeaveContainer(_,obj) indexObject(obj) end
function onObjectEnterContainer(_,obj)
    indexed[obj.getGUID()] = nil
    if obj == self then onDestroy() end
end
function onObjectDestroy(obj) indexed[obj.getGUID()] = nil end

function onDestroy()
    alive = false
    if timer then Wait.stop(timer); timer = nil end
    if Global.getVar(OWNER) ~= self.getGUID() then return end
    Global.setVar(OWNER,nil)
    local roots = UI.getXmlTable() or {}
    local index = findHUD(roots)
    if index then
        table.remove(roots,index)
        UI.setXmlTable(roots,UI.getCustomAssets())
    end
end
