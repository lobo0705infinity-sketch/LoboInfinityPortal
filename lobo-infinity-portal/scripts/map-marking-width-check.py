"""Execute exported mat Lua to catch object-space drawing-width regressions."""
import json
from pathlib import Path
from lupa import LuaRuntime

root = Path(__file__).resolve().parents[1]
catalog = json.loads((root / 'shared/lobo-workshop-current.json').read_text())
strokes = 0
for entry in catalog['maps']:
    save = json.loads((root / ('public' + entry['download'])).read_text())
    surfaces = [obj for obj in save['ObjectStates'][0]['ContainedObjects']
                if 'LOBO_MISSION_LINES' in obj.get('LuaScript', '')]
    assert len(surfaces) == 1
    obj = surfaces[0]
    assert obj['Transform']['scaleX'] == obj['Transform']['scaleZ'] == 24
    lua = LuaRuntime(unpack_returned_tuples=True)
    lua.globals().decode = lambda text: lua.table_from(json.loads(text), recursive=True)
    lua.execute('''
JSON={decode=decode};queue={};drawn={};self={setLock=function()end,
 getScale=function()return {x=24,y=1,z=24}end,
 positionToLocal=function(p)return {x=p[1]/24,y=p[2],z=p[3]/24}end,
 setVectorLines=function(lines)drawn=lines end}
Wait={frames=function(fn,n)table.insert(queue,fn)end}
''')
    lua.execute(obj['LuaScript'])
    lua.execute("onLoad('');while #queue>0 do table.remove(queue,1)() end")
    for index in range(1, len(lua.globals().drawn)+1):
        line = lua.globals().drawn[index]
        assert abs(line['thickness'] * 24 - .045) < 1e-9
        assert not all(abs(line['color'][i] - .6) < 1e-9 for i in (1, 2, 3))
        strokes += 1
assert strokes == 70
print('40 complete mat Lua scripts passed: no gray perimeter; 70 thin mission strokes; original mat scale.')
