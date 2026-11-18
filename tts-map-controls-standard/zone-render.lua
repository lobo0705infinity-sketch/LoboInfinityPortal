-- BEGIN LOBO BRIGHT ZONES R1
-- Coordinates and line widths are measured in tabletop inches.
local loboZonePalette={
 {name='Red',rgb={1,0,0},hex='#FF0000FF'},
 {name='Orange',rgb={1,.45,0},hex='#FF7300FF'},
 {name='Yellow',rgb={1,1,0},hex='#FFFF00FF'},
 {name='Green',rgb={0,1,0},hex='#00FF00FF'},
 {name='Blue',rgb={.10,.35,1},hex='#1A59FFFF'},
 {name='Indigo',rgb={.50,.20,1},hex='#8033FFFF'},
 {name='Violet',rgb={.90,.08,1},hex='#E614FFFF'}
}
local function loboZoneIndex(n,default)
 return type(n)=='number' and n==math.floor(n) and n>=1 and n<=7 and n or default
end
local function loboZoneVector(p)return Vector(p.x or p[1],p.y or p[2],p.z or p[3])end
local function loboInk(target,out,points,kind)
 if not target or target.isDestroyed() or #points<2 then return end
 kind=kind or 'deployment'
 local scale=target.getScale();local width=math.max(math.abs(scale.x),math.abs(scale.z),.000001)
 local function stroke(path)
  out[#out+1]={points=path,color={.015,.015,.015},thickness=.15/width,loboZoneKind=kind,loboZoneEdge=true}
  out[#out+1]={points=path,color={1,0,0},thickness=.10/width,loboZoneKind=kind,loboZoneEdge=false}
 end
 if kind~='exclusion' then stroke(points);return end
 local step,length=.50,.12
 local nextDot,distance=step*.5,0
 for i=2,#points do
  local a,b=loboZoneVector(points[i-1]),loboZoneVector(points[i])
  local aw,bw=target.positionToWorld(a),target.positionToWorld(b)
  local span=math.sqrt((bw.x-aw.x)^2+(bw.z-aw.z)^2)
  while span>0 and nextDot<=distance+span do
   local t0=math.max(0,(nextDot-distance-length/2)/span)
   local t1=math.min(1,(nextDot-distance+length/2)/span)
   stroke({{a.x+(b.x-a.x)*t0,a.y+(b.y-a.y)*t0,a.z+(b.z-a.z)*t0},
           {a.x+(b.x-a.x)*t1,a.y+(b.y-a.y)*t1,a.z+(b.z-a.z)*t1}})
   nextDot=nextDot+step
  end
  distance=distance+span
 end
end
-- One generation per MAT, shared by every contributing script. Late jobs cannot
-- restore old guides after Off, another selection, a clear, or a color change.
local function loboZoneWrite(target,source)
 if not target or target.isDestroyed() then return end
 local combined={}
 for _,line in ipairs(source or {})do if not line.loboStandardGuide then combined[#combined+1]=line end end
 for _,line in ipairs(target.getTable('LoboStandardGuides')or{})do combined[#combined+1]=line end
 source=combined
 target.setTable('LoboZoneSourceR1',source or {})
 local generation=(target.getVar('LoboZoneGenerationR1') or 0)+1
 target.setVar('LoboZoneGenerationR1',generation)
 local colors=target.getTable('LoboZoneColorsR1') or {}
 local result,tasks,cache={},{},{}
 local bounds=target.getBounds()
 local floor=bounds.center.y+bounds.size.y/2
 local tags={};for _,tag in ipairs(target.getTags() or {})do if tag:sub(1,8)=='LoboMap:' then tags[tag]=true end end
 local function terrain(o)
  if not o or o.isDestroyed() then return false end
  if o==target then return true end
  if o.hasTag('mission') or o.hasTag('controller') or o.hasTag('LoboBackgroundController') then return false end
  for tag in pairs(tags)do if o.hasTag(tag) then return true end end
  return false
 end
 for _,line in ipairs(source or {})do
  local kind=line.loboZoneKind
  if not kind then result[#result+1]=line
  else
   local rgb=kind=='scoring' and {.92,.94,1} or loboZonePalette[loboZoneIndex(colors[kind],kind=='exclusion' and 3 or 1)].rgb
   local path={}
   local copy={points=path,color=line.loboZoneEdge and {.015,.015,.015} or rgb,thickness=line.thickness}
   result[#result+1]=copy
   local function point(w)
    local key=string.format('%.5f:%.5f',w.x,w.z)
    local entry=cache[key]
    if not entry then entry={world=w,points={}};cache[key]=entry;tasks[#tasks+1]=entry end
    local p={0,0,0};path[#path+1]=p
    local lift=line.loboZoneEdge and .035 or .042
    if kind=='exclusion' then lift=lift+.009 end
    entry.points[#entry.points+1]={p=p,lift=lift}
   end
   local previous=nil
   for _,p in ipairs(line.points or {})do
    local w=target.positionToWorld(loboZoneVector(p))
    if previous then
     local distance=math.sqrt((w.x-previous.x)^2+(w.z-previous.z)^2)
     local count=math.max(1,math.ceil(distance/.5))
     for j=1,count do local t=j/count;point(Vector(previous.x+(w.x-previous.x)*t,0,previous.z+(w.z-previous.z)*t))end
    else point(w)end
    previous=w
   end
  end
 end
 local index=1
 local function step()
  if self.isDestroyed() or target.isDestroyed() or target.getVar('LoboZoneGenerationR1')~=generation then return end
  for work=1,8 do
   local item=tasks[index]
   if not item then target.setVectorLines(result);return end
   local w=item.world;local y=floor
   if Physics and Physics.cast then
    local ok,hits=pcall(Physics.cast,{origin={w.x,math.max(50,floor+40),w.z},direction={0,-1,0},type=1,max_distance=100})
    if ok then for _,hit in ipairs(hits or {})do
     if hit.point and terrain(hit.hit_object) then y=math.max(y,hit.point.y)end
    end end
   end
   for _,ref in ipairs(item.points)do
    local p=target.positionToLocal(Vector(w.x,y+ref.lift,w.z))
    ref.p[1],ref.p[2],ref.p[3]=p.x,p.y,p.z
   end
   index=index+1
  end
  Wait.frames(step,1)
 end
 if #tasks==0 then target.setVectorLines(result)else Wait.frames(step,1)end
end
-- END LOBO BRIGHT ZONES R1
