from pathlib import Path
import json,re,hashlib,copy

ROOT=Path(__file__).resolve().parent
BASE=ROOT/'unpacked/Lobo-Leviathans-Wake-Workshop-Setup-R4/payload/Workshop-Save.json'
OUT=ROOT/'output';OUT.mkdir(exist_ok=True)
RENDER=(ROOT/'zone-render.lua').read_text()
COLORS=(ROOT/'zone-colors.lua').read_text()

def walk(o):
    yield o
    for key in ['ContainedObjects','ChildObjects']:
        for c in o.get(key,[]):yield from walk(c)
    for c in o.get('States',{}).values():yield from walk(c)

def bags(d):
    def visit(o):
        if o.get('Name')=='Bag' and o.get('Nickname','').startswith('SET_') and re.search(r'^--[a-f0-9]{6},',o.get('LuaScript',''),re.M):
            yield o;return
        for c in o.get('ContainedObjects',[]):yield from visit(c)
    for o in d['ObjectStates']:yield from visit(o)

def config(s):
    m=re.search(r'local universalConfig=JSON.decode\((".*")\)',s)
    return json.loads(json.loads(m[1])) if m else None

def replace_function(s,name,body):
    pat=rf'(?m)^(?:local )?function {re.escape(name)}\([^\n]*\).*?\nend\n'
    s,n=re.subn(pat,lambda m:body+'\n',s,count=1,flags=re.S)
    if n!=1:raise ValueError('Function missing '+name)
    return s

def universal_build(s):
    old=re.search(r'local function universalBuild\(\).*?\nend\n',s,re.S)[0]
    zsign='sign' if 'z=sign*(24-depth*math.sin(angle))' in old else '-sign'
    localizer='lmr.positionToLocal(mat,' if 'lmr.positionToLocal(mat,' in old else 'mat.positionToLocal('
    return f'''local function universalBuild()
 universalGeneration=universalGeneration+1
 local mat=universalMat();if not mat or mat.isDestroyed() then return end
 universalGuides={{}}
 for _,offset in ipairs({{0,4,8}})do if universalEnabled[offset]then
  for side=1,2 do
   local points={{}};local depth=universalConfig.depth+offset
   for sample=0,96 do
    local x,z
    if universalConfig.shape=='corner' then
     local sign=side==1 and 1 or -1;local angle=sample*math.pi/192
     x=sign*(24-depth*math.cos(angle));z={zsign}*(24-depth*math.sin(angle))
    else x=(side==1 and -1 or 1)*(24-depth);z=-24+sample*.5 end
    local p={localizer}Vector(x,0,z));points[#points+1]={{p.x,p.y,p.z}}
   end
   loboInk(mat,universalGuides,points,'deployment')
  end
 end end
 universalCommit()
end'''

TOGGLE='''local function universalToggle(offset)
 local wasBase=universalEnabled[0]
 local selected=not universalEnabled[offset]
 for _,option in ipairs({0,4,8})do universalEnabled[option]=option==offset and selected end
 if wasBase~=universalEnabled[0] and universalConfig.linked then
  local linked=getObjectFromGUID(universalConfig.linked.guid)
  if linked then pcall(function()linked.call(universalConfig.linked.callback,{color='White'})end)end
 end
 universalBuild();universalRefresh()
end'''

def patch_script(s,primary,mat):
    if 'BEGIN LOBO BRIGHT ZONES R1' in s:return s
    old=s
    # Frostline's two releases wait for V5 while embedding the V4 broker.
    s=s.replace("LoboMapUIBrokerV5","LoboMapUIBrokerV4")
    s=s.replace("getVar('LOBO_UI_BROKER_VERSION')==5", "getVar('LOBO_UI_BROKER_VERSION')==4")
    if 'local function loboInk(' in s:s=replace_function(s,'loboInk','')
    if 'local function loboContrastDraw(target,source)' in s:
        # Preserve the special mission classification in the archived Crossing Lines mat.
        special="""local a,b=line.points[1],line.points[#line.points]
   local x=function(p)return p.x or p[1]end
   if math.abs(math.abs(x(a))-4)<.04 and math.abs(x(a)-x(b))<.04 then kind='exclusion'
   elseif math.abs(x(a))<.04 and math.abs(x(b))<.04 then kind='scoring' end""" if "kind='exclusion'" in re.search(r'local function loboContrastDraw.*?\nend',s,re.S)[0] else ''
        writer='loboUniversalWrite' if 'local function loboUniversalWrite' in s else 'loboZoneWrite'
        s=replace_function(s,'loboContrastDraw',f'''local function loboContrastDraw(target,source)
 if not target or target.isDestroyed() then return end
 local strokes={{}}
 for _,line in ipairs(source or {{}})do
  if line.points and #line.points>1 then
   local kind=line.kind
   {special}
   loboInk(target,strokes,line.points,kind)
  end
 end
 {writer}(target,strokes)
end''')
    if config(s):
        s=replace_function(s,'universalBuild',universal_build(s))
        s=replace_function(s,'universalToggle',TOGGLE)
    if 'local function vantaDrawExclusion()' in s:
        localizer='lmr.positionToLocal(mat,' if 'local lmr=' in s else 'mat.positionToLocal('
        s=replace_function(s,'vantaDrawExclusion',f'''local function vantaDrawExclusion()
 local mat=universalMat();if not mat then return end
 vantaExclusionLines={{}}
 if vantaExclusion then for _,x in ipairs({{-4,4}})do
  local points={{}}
  for _,z in ipairs({{-24,24}})do local p={localizer}Vector(x,0,z));points[#points+1]={{p.x,p.y,p.z}}end
  loboInk(mat,vantaExclusionLines,points,'exclusion')
 end end
 universalCommit()
end''')
    if 'LOBO_VEYRA_READY' in s:
        # DZ and exclusion overlays share four boundaries. Both remain visible:
        # solid DZ underneath and exclusion dots above, rather than hiding the DZ.
        start=s.index('local function draw()');end=s.index('local function refresh()',start)
        draw=s[start:end]
        draw=draw.replace('if not state.exclusion then\n   line(-d', 'if true then\n   line(-d',1)
        s=s[:start]+draw+s[end:]
    # Route final mat writes through the common height/color renderer. Do not touch
    # neon-sign writes on other objects or the UI broker embedded as JSON text.
    s=re.sub(r'(?<![\w\\])\b(mat|target)\.setVectorLines\(',r'loboZoneWrite(\1,',s)
    if 'local function loboInk' in old or 'local function loboContrastDraw' in old or primary:
        s=RENDER+'\n'+s
    if primary:
        normalization=''
        if config(s):
            normalization="local selected=nil;for _,n in ipairs({0,4,8})do if universalEnabled[n]then selected=n end end;for _,n in ipairs({0,4,8})do universalEnabled[n]=n==selected end"
        s+='\n'+COLORS.replace('__MAT_GUID__',json.dumps(mat)).replace('__NORMALIZE_DZ__',normalization)
    return s

def main():
    d=json.loads(BASE.read_text());before=copy.deepcopy(d);report=[];patches=[]
    for b in bags(d):
        candidates=[o for o in b['ContainedObjects'] if config(o.get('LuaScript',''))]
        if not candidates:candidates=[o for o in b['ContainedObjects']if 'function loboUniversalDeployment0' in o.get('LuaScript','')]
        assert len(candidates)==1,(b['Nickname'],len(candidates))
        primary=candidates[0];s=primary['LuaScript'];cfg=config(s)
        mat=cfg['mat'] if cfg else re.search(r'local loboLifeAnchor="(\w+)"',s)[1]
        objs=list(walk(b));mats=[o for o in objs if o.get('GUID')==mat];assert len(mats)==1
        placement=re.search(r'^--'+mat+r',([^\n]+)',b['LuaScript'],re.M)
        assert placement,(b['Nickname'],mat)
        height=float(placement[1].split(',')[1])
        row={'guid':b['GUID'],'name':b['Nickname'].removeprefix('SET_'),'owner':primary['GUID'],'mat':mat,
             'shape':cfg['shape'] if cfg else ('crossing' if 'Veyra' in b['Nickname'] else 'rect'),
             'depth':cfg['depth'] if cfg else 12,'mat_height':height,
             'old_surface':cfg.get('surface') if cfg else None,
             'old_nonexclusive':bool(cfg and 'local selected=not universalEnabled[offset]' not in s),
             'broker_version_mismatch':'LoboMapUIBrokerV5' in s,
             'scripts_changed':0}
        for o in objs:
            old=o.get('LuaScript','')
            raw_mat=o.get('GUID')==mat and '.setVectorLines('in old and 'local function loboInk('not in old and 'loboContrastDraw'not in old
            if raw_mat:
                # Neon switching uses the mat's vector layer too. Contribute its
                # paths to the existing compositor instead of erasing DZ guides.
                new=old.replace('self.setVectorLines(', 'loboNeonMatWrite(')
                new=f'''local function loboNeonMatWrite(lines)
 local owner=getObjectFromGUID('{primary['GUID']}')
 if owner then local ok,handled=pcall(function()return owner.call('loboUniversalSetBase',{{guid=self.getGUID(),lines=lines}})end);if ok and handled then return end end
 self.setVectorLines(lines)
end
'''+new
                patches.append({'map':b['GUID'],'guid':o['GUID'],'old_sha256':hashlib.sha256(old.encode()).hexdigest(),'old':old,'new':new})
                o['LuaScript']=new;row['scripts_changed']+=1
            elif o is primary or 'local function loboInk('in old or 'local function loboContrastDraw(target,source)'in old:
                new=patch_script(old,o is primary,mat)
                if new!=old:
                    patches.append({'map':b['GUID'],'guid':o['GUID'],'old_sha256':hashlib.sha256(old.encode()).hexdigest(),'old':old,'new':new})
                    o['LuaScript']=new;row['scripts_changed']+=1
        report.append(row)
    assert len(report)==105
    for old,new in zip(walk({'ContainedObjects':before['ObjectStates']}),walk({'ContainedObjects':d['ObjectStates']})):
        assert {k:v for k,v in old.items()if k not in ['LuaScript','ContainedObjects','ChildObjects','States']}=={k:v for k,v in new.items()if k not in ['LuaScript','ContainedObjects','ChildObjects','States']}
    d['SaveName']='Lobo Maps - Bright DZ and Exclusion Colors R1'
    (OUT/'Workshop-Save.json').write_text(json.dumps(d,ensure_ascii=False,separators=(',',':')))
    (OUT/'zone-patches.json').write_text(json.dumps(patches,ensure_ascii=False,separators=(',',':')))
    (ROOT/'audit/map-audit.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
    print('Patched',len(report),'maps;',len(patches),'object scripts; terrain/assets/states unchanged')
    print('Nonexclusive controls',sum(r['old_nonexclusive']for r in report),'stale universal floor',sum(r['old_surface']is not None and r['old_surface']<r['mat_height']-.1 for r in report))

if __name__=='__main__':main()
