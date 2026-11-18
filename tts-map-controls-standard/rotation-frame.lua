-- LOBO MAP ROTATION FRAME BEGIN
local lmr={owner="__OWNER__"}
function lmr.flipped()
 local o=getObjectFromGUID(lmr.owner)
 return o and o.getVar('LOBO_MAP_ROTATION_FLIPPED')==true
end
function lmr.vector(p)
 return Vector(p.x or p[1] or 0,p.y or p[2] or 0,p.z or p[3] or 0)
end
function lmr.point(p)
 local v=lmr.vector(p)
 if lmr.flipped() then v.x=-v.x;v.z=-v.z end
 return v
end
function lmr.rotation(p)
 local v=lmr.vector(p)
 if lmr.flipped() then v.y=(v.y+180)%360 end
 return v
end
function lmr.getPosition(o) return lmr.point(o.getPosition()) end
function lmr.getRotation(o) return lmr.rotation(o.getRotation()) end
function lmr.setPosition(o,p,...) return o.setPosition(lmr.point(p),...) end
function lmr.setRotation(o,p,...) return o.setRotation(lmr.rotation(p),...) end
function lmr.setPositionSmooth(o,p,...) return o.setPositionSmooth(lmr.point(p),...) end
function lmr.setRotationSmooth(o,p,...) return o.setRotationSmooth(lmr.rotation(p),...) end
function lmr.positionToLocal(o,p) return o.positionToLocal(lmr.point(p)) end
function lmr.positionToWorld(o,p) return lmr.point(o.positionToWorld(p)) end
function lmr.getBounds(o)
 local b=o.getBounds();if b and b.center then b.center=lmr.point(b.center) end;return b
end
function lmr.getTransformForward(o) return lmr.point(o.getTransformForward()) end
function lmr.getTransformRight(o) return lmr.point(o.getTransformRight()) end
function lmr.getTransformUp(o) return lmr.point(o.getTransformUp()) end
function lmr.copy(p) local q={};for k,v in pairs(p)do q[k]=v end;return q end
function lmr.cast(p)
 local q=lmr.copy(p)
 if q.origin then q.origin=lmr.point(q.origin) end
 if q.direction then q.direction=lmr.point(q.direction) end
 if q.orientation then q.orientation=lmr.rotation(q.orientation) end
 local hits=Physics.cast(q)
 for _,hit in ipairs(hits or{})do
  if hit.point then hit.point=lmr.point(hit.point)end
  if hit.normal then hit.normal=lmr.point(hit.normal)end
 end
 return hits
end
function lmr.data(d)
 if not lmr.flipped()then return d end
 local t=d.Transform
 if t then t.posX=-(t.posX or 0);t.posZ=-(t.posZ or 0);t.rotY=((t.rotY or 0)+180)%360 end
 for _,s in pairs(d.States or{})do lmr.data(s)end
 return d
end
function lmr.getData(o) return lmr.data(o.getData()) end
function lmr.getJSON(o,...) return JSON.encode(lmr.data(JSON.decode(o.getJSON(...)))) end
function lmr.spawnObjectJSON(p)
 local q=lmr.copy(p);q.json=JSON.encode(lmr.data(JSON.decode(q.json)))
 if q.position then q.position=lmr.point(q.position)end
 if q.rotation then q.rotation=lmr.rotation(q.rotation)end
 return spawnObjectJSON(q)
end
function lmr.spawnObjectData(p)
 local q=lmr.copy(p);q.data=lmr.data(q.data)
 if q.position then q.position=lmr.point(q.position)end
 if q.rotation then q.rotation=lmr.rotation(q.rotation)end
 return spawnObjectData(q)
end
function lmr.spawnObject(p)
 local q=lmr.copy(p)
 if q.position then q.position=lmr.point(q.position)end
 if q.rotation then q.rotation=lmr.rotation(q.rotation)end
 return spawnObject(q)
end
-- LOBO MAP ROTATION FRAME END