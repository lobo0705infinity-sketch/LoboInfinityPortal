from pathlib import Path
import json, re, copy, hashlib, unicodedata, argparse
import patch_maps

ROOT=Path(__file__).resolve().parent
DEFAULT_SOURCE=ROOT.parent/'current-map-sources/Lobo-Leviathans-Wake-Workshop-Setup-R5/Files/payload/Workshop-Save.json'
REVISION='lobo-standard-20261118-v1'

def ascii_text(s):
    # Explicit replacements keep units and operators meaningful in TTS fonts.
    replacements={'°':' deg','″':' in','′':"'",'“':"'",'”':"'",'‘':"'",'’':"'",'–':'-','—':' - ','−':'-',
                  '×':'x','÷':'/','≤':'<=','≥':'>=','≠':'!=','→':'->','←':'<-','±':'+/-','•':'*','·':' - ',
                  '▾':'v','▼':'v','▲':'^','▸':'>','▴':'^','…':'...','✅':'PASS','✓':'OK','⚠':'Warning',
                  '\u00a0':' ','\ufeff':''}
    for a,b in replacements.items():s=s.replace(a,b)
    return unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode('ascii')

def code_chunks(s):
    """Only transform Lua executable text, never quoted/long strings/comments."""
    p=0;start=0
    while p<len(s):
        end=None
        if s.startswith('--',p):
            m=re.match(r'--\[(=*)\[',s[p:])
            if m:
                close=']'+m[1]+']';q=s.find(close,p+len(m[0]));end=len(s)if q<0 else q+len(close)
            else:
                q=s.find('\n',p);end=len(s)if q<0 else q
        elif s[p] in "\"'":
            quote=s[p];q=p+1
            while q<len(s):
                if s[q]=='\\':q+=2
                elif s[q]==quote:q+=1;break
                else:q+=1
            end=q
        elif s[p]=='[':
            m=re.match(r'\[(=*)\[',s[p:])
            if m:
                close=']'+m[1]+']';q=s.find(close,p+len(m[0]));end=len(s)if q<0 else q+len(close)
        if end is not None:
            if p>start:yield True,s[start:p]
            yield False,s[p:end];p=end;start=p
        else:p+=1
    if start<len(s):yield True,s[start:]

def ascii_lua(s):
    result=[]
    for code,chunk in code_chunks(s):
        if not code and len(chunk)>1 and chunk[0]in "\"'":
            quote=chunk[0]
            inner=chunk[1:-1]
            for char in ('‘','’','′','“','”')if quote=="'"else():
                inner=inner.replace(char,'\\'+quote)
            chunk=quote+ascii_text(inner)+quote
        else:chunk=ascii_text(chunk)
        result.append(chunk)
    return ''.join(result)

def rotation_adapt(s,owner):
    if '-- LOBO MAP ROTATION FRAME BEGIN' in s:return s
    methods=['getPosition','getRotation','setPosition','setRotation','setPositionSmooth','setRotationSmooth',
             'positionToLocal','positionToWorld','getBounds','getTransformForward','getTransformRight','getTransformUp','getData','getJSON']
    receiver=r'\b((?!lmr\b)[A-Za-z_]\w*(?:(?:\.[A-Za-z_]\w*)|(?:\[[A-Za-z_0-9.]+\]))*)'
    def transform(c):
        for method in methods:
            c=re.sub(receiver+r'\.'+method+r'\(\s*\)',lambda m:'lmr.'+method+'('+m[1]+')',c)
            c=re.sub(receiver+r'\.'+method+r'\((?!\s*\))',lambda m:'lmr.'+method+'('+m[1]+',',c)
        c=c.replace('Physics.cast(', 'lmr.cast(')
        c=re.sub(r'(?<![\w.])spawnObjectJSON\(', 'lmr.spawnObjectJSON(',c)
        c=re.sub(r'(?<![\w.])spawnObjectData\(', 'lmr.spawnObjectData(',c)
        c=re.sub(r'(?<![\w.])spawnObject\(', 'lmr.spawnObject(',c)
        return c
    # Projection/rendering works in physical world coordinates; do not adapt it.
    prefix=''
    end='-- END LOBO BRIGHT ZONES R1'
    if s.startswith('-- BEGIN LOBO BRIGHT ZONES R1'):
        n=s.index(end)+len(end);prefix=s[:n]+'\n';s=s[n:]
    frame=(ROOT/'rotation-frame.lua').read_text().replace('__OWNER__',owner)
    return prefix+frame+'\n'+''.join(transform(t)if code else t for code,t in code_chunks(s))

def primary_for(bag):
    candidates=[o for o in bag['ContainedObjects']if patch_maps.config(o.get('LuaScript',''))]
    if not candidates:candidates=[o for o in bag['ContainedObjects']if 'function loboUniversalDeployment0' in o.get('LuaScript','')]
    assert len(candidates)==1,(bag['Nickname'],len(candidates))
    return candidates[0]

def mat_for(owner):
    c=patch_maps.config(owner['LuaScript'])
    return c['mat']if c else re.search(r'local loboLifeAnchor="(\w+)"',owner['LuaScript'])[1]

def build(source,destination):
    original=json.loads(source.read_text());data=copy.deepcopy(original)
    broker=(ROOT/'standard-broker.lua').read_text()
    assert broker.isascii()
    report=[];patches=[]
    mission_text=json.loads((ROOT/'mission-text.json').read_text())
    allbags=list(patch_maps.bags(data));originals={b['GUID']:b for b in patch_maps.bags(original)}
    permanent={o['GUID']:True for o in data['ObjectStates']if o.get('Name')!='Bag' and o.get('GUID')}
    for bag in allbags:
        before=originals[bag['GUID']];owner=primary_for(bag);key=owner['GUID'];mat=mat_for(owner)
        if 'LOBO_STANDARD_VERSION=1' in owner['LuaScript']:
            raise ValueError('Input already standardized; use retained source baseline')
        objects=list(patch_maps.walk(bag));by_guid={o.get('GUID'):o for o in objects}
        rotation={'anchor':mat,'exclude':permanent,'guids':{o['GUID']:True for o in objects[1:] if o.get('GUID')},
                  'tags':sorted({tag for o in objects for tag in o.get('Tags',[])if tag.startswith('LoboMap:')})}
        # The collection can contain other map bags. Never rotate bag staging/archives.
        for b in allbags:rotation['exclude'][b['GUID']]=True
        for o in objects:
            old=o.get('LuaScript','')
            if not old or o is bag:continue
            s=old
            s=re.sub(r'-- LOBO MAP ROTATION CONTROL BEGIN\n.*?-- LOBO MAP ROTATION CONTROL END','',s,flags=re.S)
            raw_mat=o.get('GUID')==mat and '.setVectorLines('in s and 'local function loboInk('not in s and 'loboContrastDraw'not in s
            if raw_mat and 'BEGIN LOBO BRIGHT ZONES R1'not in s and 'loboNeonMatWrite'not in s:
                s=s.replace('self.setVectorLines(', 'loboNeonMatWrite(')
                s="local function loboNeonMatWrite(lines)\n local owner=getObjectFromGUID('"+key+"')\n if owner then local ok,handled=pcall(function()return owner.call('loboUniversalSetBase',{guid=self.getGUID(),lines=lines})end);if ok and handled then return end end\n self.setVectorLines(lines)\nend\n"+s
            elif o is owner or 'local function loboInk('in s or 'local function loboContrastDraw(target,source)'in s:
                s=patch_maps.patch_script(s,o is owner,mat)
            s=rotation_adapt(s,key)
            s=re.sub(r"getVar\('LOBO_UI_BROKER_REVISION'\)==('[^']+')","getVar('LOBO_UI_STANDARD_REVISION')=='"+REVISION+"'",s)
            def background_day(m):
                cfg=json.loads(json.loads(m[1]))
                if 'day' not in cfg:
                    cfg['day']='https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/2e0bd4f65e4057129c5f03ed31348cbfe75d7ec1/assets/tts/neon-shogunate-r3-20261103/day.png'
                return 'local backgroundConfig=JSON.decode('+json.dumps(json.dumps(cfg,separators=(',',':')))+')'
            s=re.sub(r'local backgroundConfig=JSON.decode\((".*")\)',background_day,s)
            def replace_broker(m):
                obj=json.loads(json.loads(m[1]));obj['LuaScript']=broker
                return 'local loboLifeBrokerData='+json.dumps(json.dumps(obj,separators=(',',':'),ensure_ascii=True))
            s=re.sub(r'local loboLifeBrokerData=(".*")',replace_broker,s)
            # Each map asks for the same service and rejects a stale previous menu.
            if 'local function loboLifeGetBroker()'in s:
                upgrade="""local function loboLifeGetBroker()
 if loboLifeBroker and not loboLifeBroker.isDestroyed()then return loboLifeBroker end
 local guid=Global.getVar('LoboMapUIBrokerV4')
 local broker=guid and getObjectFromGUID(guid)or nil
 if not broker then for _,candidate in ipairs(getObjectsWithTag('LoboMapUIBrokerV4')or{})do broker=candidate;break end end
 if not broker then
  broker=spawnObjectData({data=JSON.decode(loboLifeBrokerData)})
  if broker then Global.setVar('LoboMapUIBrokerV4',broker.getGUID())end
 end
 if broker and broker.getVar('LOBO_UI_STANDARD_REVISION')~='__REVISION__' then
  broker.setLuaScript(JSON.decode(loboLifeBrokerData).LuaScript)
  broker=broker.reload()
  if broker then Global.setVar('LoboMapUIBrokerV4',broker.getGUID())end
 end
 loboLifeBroker=broker;return broker
end""".replace('__REVISION__',REVISION)
                s=patch_maps.replace_function(s,'loboLifeGetBroker',upgrade)
                s=s.replace('math.abs(p.y)<=26','math.abs(p.y)<=80').replace('math.abs(q.y)<=26','math.abs(q.y)<=80')
                s=s.replace('math.abs(p.y)>26','math.abs(p.y)>80').replace('math.abs(q.y)>26','math.abs(q.y)>80')
                s=s.replace("ipairs({'night','off'})", "ipairs({'day','night','off'})")
                s+='\nfunction loboStandardInvoke(p)\n local fn=p and _G[p.callback]\n if type(fn)=="function"then return fn({color=p.color},p.value,p.id)end\nend\n'
            if o is owner:
                cfg=patch_maps.config(s)
                meta={'version':1,'revision':REVISION,'map':bag['GUID'],'title':ascii_text(bag['Nickname'].removeprefix('SET_')),'anchor':mat}
                match=re.search(r'mission=("[^"]+")',s)
                mission=json.loads(match[1])if match else''
                meta['mission']=mission
                meta['missionText']=mission_text.get(mission,{}).get('text',ascii_text(bag.get('Description','')))
                s+='\n'+(ROOT/'standard-owner.lua').read_text().replace('__META__',json.dumps(json.dumps(meta,separators=(',',':')))).replace('__ROTATION_CONFIG__',json.dumps(json.dumps(rotation,separators=(',',':'))))
            s=ascii_lua(s)
            o['LuaScript']=s
            if old!=s:patches.append({'map':bag['GUID'],'guid':o['GUID'],'old':old,'new':s})
        # States, geometry, transforms, textures, tags, names and authored placements are immutable here.
        def without_scripts(o):
            if isinstance(o,dict):return {k:without_scripts(v)for k,v in o.items()if k!='LuaScript'}
            if isinstance(o,list):return [without_scripts(v)for v in o]
            return o
        assert without_scripts(before)==without_scripts(bag),bag['Nickname']
        report.append({'map':bag['GUID'],'name':bag['Nickname'],'owner':key,'mat':mat,'objects':len(objects)-1,
                       'scripts_changed':sum(p['map']==bag['GUID']for p in patches),'terrain_preserved':True})
    # Normalize already-saved service instances as well as the embedded templates.
    for o in data['ObjectStates']:
        if 'LOBO_UI_BROKER_VERSION='in o.get('LuaScript','') and o.get('GUID') not in {r['owner']for r in report}:
            o['LuaScript']=broker
    data['SaveName']='Lobo Maps - Standard Controls R2'
    destination.mkdir(parents=True,exist_ok=True)
    (destination/'Workshop-Save.json').write_text(json.dumps(data,ensure_ascii=True,separators=(',',':')))
    (destination/'control-patches.json').write_text(json.dumps(patches,ensure_ascii=True,separators=(',',':')))
    (destination/'inventory.json').write_text(json.dumps(report,indent=2,ensure_ascii=True))
    print(json.dumps({'maps':len(report),'scripts':len(patches),'output':str(destination)}))
    return data

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--source',type=Path,default=DEFAULT_SOURCE);ap.add_argument('--output',type=Path,default=ROOT/'output');args=ap.parse_args()
    build(args.source,args.output)
