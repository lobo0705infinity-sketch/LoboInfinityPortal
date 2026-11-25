"""Cloud selection colliders and local guides, independent of the authored position."""
from district import *
from airframes import bake_collider
from scipy.spatial import ConvexHull
TAG_CLOUD='CloudbreakEditableCloud'
BANK_LUA="""function onLoad()
 self.interactable=true
 self.drag_selectable=true
 self.gizmo_selectable=true
 self.use_gravity=false
 self.auto_raise=false
 self.use_snap_points=false
 self.use_grid=false
 self.sticky=false
 local function sync()
  local owner=getObjectFromGUID('cb7102')
  if owner and owner.getVar('CLOUDBREAK_CLOUD_VERSION')==3 then owner.call('cloudRefreshOne',{guid=self.getGUID()}) end
 end
 Wait.frames(sync,2)
end
function onDrop()
 self.setVelocity({0,0,0})
 self.setAngularVelocity({0,0,0})
end"""
GUIDE_LUA="""CLOUDBREAK_CLOUD_VERSION=3
local cloudTag='CloudbreakEditableCloud'
local function paintCloud(bank)
 if not bank or bank.isDestroyed() or not bank.hasTag(cloudTag) or not bank.hasTag(config.tag) then return end
 local lines={}
 if state.clouds then
  local scale=bank.getScale()
  local unit=math.max(.1,math.abs(scale.x),math.abs(scale.y),math.abs(scale.z))
  local function trace(points,width)
   lines[#lines+1]={points=points,color={.25,.9,1},thickness=width/unit}
  end
  for _,height in ipairs({0,1})do
   local ring={}
   for n=0,48 do
    local angle=math.pi*2*n/48
    ring[#ring+1]={math.cos(angle),height,math.sin(angle)}
   end
   trace(ring,.055)
  end
  for n=0,3 do
   local angle=math.pi*n/2
   local x,z=math.cos(angle),math.sin(angle)
   trace({{x,0,z},{x,1,z}},.033)
  end
 end
 bank.setVectorLines(lines)
end
local function paintClouds()
 for _,bank in pairs(getObjectsWithTag(cloudTag) or {})do paintCloud(bank)end
end
function cloudRefreshOne(args)
 if args and args.guid then paintCloud(getObjectFromGUID(args.guid))end
end
"""
def colliders():
 # An opaque object's end-on silhouette must have an equally reachable pointer target.
 for name in ['vapour-0','vapour-1','vapour-2','alto-0','alto-1','alto-2']:
  v,_=geometry(name);q=np.asarray(ConvexHull(v).vertices);out=v[q];u=out.copy();u[:,1]=(u[:,1]-.5)*2
  # Select support vertices on a Fibonacci sphere and on the six principal axes.
  directions=[]
  for i in range(118):
   y=1-2*(i+.5)/118;r=math.sqrt(1-y*y);az=i*math.pi*(3-math.sqrt(5));directions.append([r*math.cos(az),y,r*math.sin(az)])
  directions.extend(np.eye(3));directions.extend(-np.eye(3))
  ids=np.unique((u@np.array(directions).T).argmax(axis=0));bake_collider(name if name.startswith('alto') else name+'-pick',[out[ids]])
if __name__=='__main__':colliders()
