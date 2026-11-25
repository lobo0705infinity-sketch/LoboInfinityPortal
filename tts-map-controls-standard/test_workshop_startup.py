"""Run the installed collection's Global script through startup, reload and pickup."""
import json
from xml.etree import ElementTree

from lupa.lua52 import LuaRuntime


CATALOGUE_ROOM = """
local objects, byGuid, pending = {}, {}, {}
attributes, actions = {}, {}
local function record(action) actions[#actions+1] = action end
UI = {setAttribute=function(id, key, value) attributes[id..'.'..key] = value end}
Wait = {
  frames=function(fn) pending[#pending+1]=fn end,
  condition=function(fn, ready) pending[#pending+1]=function() if ready() then fn() end end end
}
Backgrounds = {setCustomURL=function() end}
Global = {getVar=function() return nil end}
function addHotkey() end
function broadcastToAll() end
function getAllObjects() return objects end
function getObjectFromGUID(guid) return byGuid[guid] end
function drainWaits()
  local count=0
  while #pending > 0 do
    count=count+1
    assert(count<=1000, 'Startup callbacks did not settle')
    table.remove(pending, 1)()
  end
end
function spawnObjectData() record('spawn') end
function addRoomObject(guid, name, kind, description, x, y, z)
  local o={type=kind}
  local position={x=x,y=y,z=z}
  o.getName=function() return name end
  o.getGUID=function() return guid end
  o.getDescription=function() return description end
  o.getPosition=function() return position end
  o.getVar=function() return nil end
  o.getData=function() return {GUID=guid,Description=description} end
  o.call=function(method) record('call '..name..'.'..method) end
  o.setPosition=function(p) record('move '..guid); position=p end
  o.destruct=function() record('destroy '..guid) end
  o.clone=function(parameters)
    record('clone '..guid)
    pickupPosition=parameters.position
    return {
      getGUID=function() return 'pickup' end,
      setLock=function(locked) pickupLocked=locked end,
      setDescription=function(text) pickupDescription=text end
    }
  end
  objects[#objects+1]=o
  byGuid[guid]=o
end
"""


def check_workshop_startup(collection):
    xml = ElementTree.fromstring('<UI>'+collection['XmlUI']+'</UI>')
    assert xml.find(".//*[@id='loboLibrary']") is not None
    assert any(o.get('Nickname') == 'Stage' for o in collection['ObjectStates'])
    for obj in collection['ObjectStates']:
        if obj['Name'] == 'Bag':
            continue
        assert not any(tag.startswith('LoboMap:') for tag in obj.get('Tags', [])), obj['GUID']
        assert 'LOBO_STANDARD_VERSION=1' not in obj.get('LuaScript', ''), obj['GUID']

    saved = collection.get('LuaScriptState', '')
    for _ in range(2):
        runtime = LuaRuntime(unpack_returned_tuples=True)
        runtime.execute(CATALOGUE_ROOM)
        env = runtime.globals()
        env.JSON = runtime.table(decode=lambda s: runtime.table_from(json.loads(s), recursive=True))
        for obj in collection['ObjectStates']:
            t = obj['Transform']
            env.addRoomObject(obj['GUID'], obj.get('Nickname', ''), obj['Name'],
                              obj.get('Description', ''), t['posX'], t['posY'], t['posZ'])
        runtime.execute(collection['LuaScript'])
        env.onLoad(saved)
        env.drainWaits()
        assert len(env.actions) == 0, f"Workshop startup changed the table: {list(env.actions.values())}"
        assert 'results' in env.attributes['loboCount.text']
        if env.onSave:
            saved = env.onSave()

    env.loboCategory(None, 'campaign')
    env.loboSearch(None, 'Cloudbreak Array')
    assert env.attributes['loboName1.text'] == 'Cloudbreak Array'
    env.loboSelect(None, '1')
    assert env.attributes['loboSelected.text'] == 'Cloudbreak Array\nNetwork Node'
    assert len(env.actions) == 0
    env.loboPickup(None)
    env.drainWaits()
    assert list(env.actions.values()) == ['clone cb7100']
    assert [env.pickupPosition[k] for k in ('x', 'y', 'z')] == [8, 2.2, -37]
    assert env.pickupLocked is False and 'PICKUP COPY:' in env.pickupDescription


def check_play_saves(payload, collection):
    from patch_maps import bags
    variants = json.loads(payload.read('release-extras.json'))['Setups']
    contents = {bag['GUID']: bag for bag in bags(collection)}
    for guid, variant in variants.items():
        play = json.loads(payload.read(variant['PlayFile']))
        roots = play['ObjectStates']
        assert play['Table'] == 'Table_Custom' and 'loboLibrary' not in play['XmlUI'], guid
        assert play['SaveName'].startswith(variant['Name']+' - Play Table'), guid
        assert not any(o.get('Nickname','').startswith('SET_') for o in roots), guid
        owners = [o for o in roots if 'LOBO_STANDARD_VERSION=1' in o.get('LuaScript','')]
        assert len(owners) == 1, guid
        map_objects = {o['GUID'] for o in roots if 'LoboMap:'+guid in o.get('Tags', [])}
        assert map_objects == {o['GUID'] for o in contents[guid]['ContainedObjects']}, guid
        assert payload.read(variant['PlayThumbnail']).startswith(b'\x89PNG'), guid
