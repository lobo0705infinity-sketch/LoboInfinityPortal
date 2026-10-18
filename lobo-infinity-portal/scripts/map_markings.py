"""Keep mission overlay strokes thin in world space and expose the whole mat.

Object-attached drawing widths scale with their parent. Coordinates were
converted to local space, but widths were not, creating a 1.08-inch gray frame.
"""
import json,re
from pathlib import Path
PATTERN=re.compile(r'local LOBO_MISSION_LINES=JSON.decode\(("(?:\\.|[^"\\])*")\)')
def repair_markings(obj):
 script=obj.get('LuaScript','');match=PATTERN.search(script)
 if not match:return False
 if 'thickness=line.thickness/lineScale' in script:return False
 lines=json.loads(json.loads(match[1]))
 def boundary(line):
  pts=line['points']
  return len(pts)==5 and pts[0]==pts[-1] and all(abs(abs(p[0])-24)<.001 and abs(abs(p[2])-24)<.001 for p in pts) and line['color']==[.6,.6,.6]
 outlines=[line for line in lines if boundary(line)]
 assert len(outlines)==1
 lines=[line for line in lines if not boundary(line)]
 # This reverses R2's unnecessary size increase; preserve original primitive.
 if obj['Name']=='Custom_Tile':
  assert 23.99<obj['Transform']['scaleX']<24.52
  obj['Transform']['scaleX']=24.;obj['Transform']['scaleZ']=24.
 literal=json.dumps(json.dumps(lines,separators=(',',':')))
 script=script[:match.start()]+f'local LOBO_MISSION_LINES=JSON.decode({literal})'+script[match.end():]
 assert script.count('thickness=line.thickness')==1
 script=script.replace('  local localLines={}', '  local localLines={}\n  local scale=self.getScale()\n  local lineScale=math.max(math.abs(scale.x),math.abs(scale.z),0.000001)')
 script=script.replace('thickness=line.thickness}', 'thickness=line.thickness/lineScale}')
 obj['LuaScript']=script;obj['LuaScriptState']=''
 return True

def install_markings(bag, records):
    """Carry global markings from old button loaders into a native bag's mat."""
    if any('LOBO_MISSION_LINES' in obj.get('LuaScript', '') for obj in bag.get('ContainedObjects', [])):
        return
    match = re.search(r'local LINES=JSON.decode\(("(?:\\.|[^"\\])*")\)', bag.get('LuaScript', ''))
    if not match:
        return
    surfaces = [obj for obj in bag.get('ContainedObjects', [])
                if obj.get('Name') in ('Custom_Tile', 'Custom_Model')
                and 23.99 < obj.get('Transform', {}).get('scaleX', 0) < 24.52
                and 23.99 < obj.get('Transform', {}).get('scaleZ', 0) < 24.52
                and abs(records[obj['GUID']][0]) < .1 and abs(records[obj['GUID']][2]) < .1]
    assert len(surfaces) == 1, bag.get('Nickname')
    surface = surfaces[0]
    surface['LuaScript'] = surface.get('LuaScript', '') + '''
-- Mission markings retained from the map bag loader.
local LOBO_MISSION_LINES=JSON.decode(''' + match[1] + ''')
local loboSurfaceOnLoad=onLoad
function onLoad(saved)
 if loboSurfaceOnLoad then loboSurfaceOnLoad(saved) end
 Wait.frames(function()
  local localLines={}
  for _,line in ipairs(LOBO_MISSION_LINES) do
   local points={}
   for _,point in ipairs(line.points) do
    local p=self.positionToLocal(point)
    points[#points+1]={p.x,p.y,p.z}
   end
   localLines[#localLines+1]={points=points,color=line.color,thickness=line.thickness}
  end
  self.setVectorLines(localLines)
 end,2)
end
'''
