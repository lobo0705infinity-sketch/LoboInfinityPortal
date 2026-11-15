#!/usr/bin/env python3
"""Execute each actual broker in Lua and check names, callbacks and cleanup."""
import collections, hashlib, importlib.util, json, pathlib, re, sys, xml.etree.ElementTree as ET
from lupa import LuaRuntime

spec=importlib.util.spec_from_file_location('builder',pathlib.Path(__file__).with_name('build.py'))
builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
before=json.loads(pathlib.Path(sys.argv[1]).read_text())
after=json.loads(pathlib.Path(sys.argv[2]).read_text())
out=pathlib.Path(sys.argv[3]);out.mkdir(exist_ok=True,parents=True)
coverage=json.loads((pathlib.Path(sys.argv[2]).parent/'map-name-coverage.json').read_text())
by_bag={r['bag_guid']:r for r in coverage}
changed=[];brokers={};typed_colors=0

def diff(a,b,path=''):
    if type(a)!=type(b):raise AssertionError(('type changed',path))
    if isinstance(a,dict):
        assert a.keys()==b.keys(),path
        for k in a:diff(a[k],b[k],path+'/'+k)
    elif isinstance(a,list):
        assert len(a)==len(b),path
        for i,(x,y) in enumerate(zip(a,b)):diff(x,y,path+'/'+str(i))
    elif a!=b:
        assert path.endswith('/LuaScript') or path=='/SaveName',path
        changed.append(path)
diff(before,after)
assert len(changed)==163,len(changed)
assert before['LuaScript']==after['LuaScript']

def check_colors(value):
    global typed_colors
    if isinstance(value,dict):
        for k,v in value.items():
            if k in ('ColorDiffuse','ColorTint','SkyColor','EquatorColor','GroundColor','LightColor','visibleColor') and v is not None:
                assert isinstance(v,dict) and all(isinstance(v.get(c),(int,float)) for c in 'rgb'),(k,v)
                typed_colors+=1
            check_colors(v)
    elif isinstance(value,list):
        for v in value:check_colors(v)
check_colors(after)
tabs=after.get('TabStates',{})
for tab in (tabs.values() if isinstance(tabs,dict) else tabs):
    assert isinstance(tab['color'],str) and isinstance(tab['id'],int)

compiler=LuaRuntime()
compile_lua=compiler.eval("function(s) local f,e=load(s);assert(f,e);return true end")
for bag in after['ObjectStates']:
    if bag.get('GUID') not in by_bag:continue
    row=by_bag[bag['GUID']]
    found=[]
    for obj in builder.walk_objects(bag.get('ContainedObjects',[])):
        script=obj.get('LuaScript','');m=builder.BROKER.search(script)
        if not m:continue
        found.append(obj['GUID'])
        assert script.startswith('local loboLifeMapName='+json.dumps(row['map_name'],ensure_ascii=False)+'\n')
        assert "broker.call('loboUIRegister',{mapName=loboLifeMapName," in script
        compile_lua(script)
        broker=json.loads(json.loads(m[1]))['LuaScript'];compile_lua(broker)
        brokers[hashlib.sha256(broker.encode()).hexdigest()]=broker
    assert found==row['controller_guids']
assert len(brokers)==8

def lua_plain(v):
    if hasattr(v,'items'):
        values={k:lua_plain(x) for k,x in v.items()}
        if values and set(values)==set(range(1,len(values)+1)):return [values[k] for k in range(1,len(values)+1)]
        return values
    return v

def exercise(script,names,index):
    lua=LuaRuntime(unpack_returned_tuples=True)
    g=lua.globals();frames=[]
    g.py_encode=lambda t:json.dumps(lua_plain(t),sort_keys=True)
    g.py_capture=lambda s,*_:frames.append(s)
    lua.execute('''
      JSON={encode=py_encode}
      UI={loading=false,getXmlTable=function()return {}end,getCustomAssets=function()return {}end,setXml=py_capture,setAttribute=function()end}
      Global={UI=UI,setVar=function()end,getVar=function()end}
      self={getGUID=function()return 'feed00'end}
      alive={}
      function makeAlive(guid)
       alive[guid]={isDestroyed=function()return false end,getGUID=function()return guid end,getPosition=function()return {x=0,y=5,z=0}end}
      end
      function getObjectFromGUID(guid)return alive[guid]end
    ''')
    lua.execute(script)
    tf=lambda d:lua.table_from(d,recursive=True)
    def register(owner,anchor,name):
        g.makeAlive(owner);g.makeAlive(anchor)
        token=g.loboUIRegister(tf({'owner':owner,'anchor':anchor,'mapName':name}))
        node={'tag':'Panel','attributes':{'id':'loboBackground_'+owner},'children':[
            {'tag':'Button','attributes':{'id':'mission_'+owner,'onClick':owner+'/openMission','text':'Mission'}},
            {'tag':'Button','attributes':{'id':'deployment_'+owner,'onClick':owner+'/loboUniversalDeployment0','text':'DZ: OFF'}},
            {'tag':'Button','attributes':{'id':'bg_'+owner+'_day','onClick':owner+'/loboChooseBackground','text':'Day'}}]}
        p={'owner':owner,'token':token,'nodes':[node]}
        g.loboUIWrite(tf(p));g.loboUIFlush()
        return p
    def rendered():return ET.fromstring('<Root>'+frames[-1]+'</Root>')
    def current(name):
        root=rendered();headers=root.findall(".//*[@id='loboMapDrawerV1_mapName']")
        assert len(headers)==1 and headers[0].text==name,(index,name,ET.tostring(root))
        panel=root.find(".//*[@id='loboMapDrawerV1_panel']")
        assert panel is not None
        top=float(headers[0].get('offsetXY').split()[1]);bottom=top-float(headers[0].get('height'))
        for child in panel:
            if child.get('id')==headers[0].get('id'):continue
            y=float(child.get('offsetXY','0 0').split()[1])
            if y<=-44:assert y<=bottom,('overlap',index,child.attrib)
        tab=root.find(".//*[@id='loboMapDrawerV1_tab']")
        if tab is None:tab=root.find(".//*[@id='loboMapDrawerV1_toggle']")
        assert tab.get('text')=='Map Controls\n'+name
        return root
    g.loboUIFlush();assert not rendered().findall(".//*[@id='loboMapDrawerV1_mapName']")
    for n,name in enumerate(names):
        p=register('abc001','abc002',name)
        root=current(name)
        # Player-specific close/open keeps the map name and other seats intact.
        g.loboDrawerClose(tf({'color':'Red'}));g.loboUIFlush();current(name)
        panel=rendered().find(".//*[@id='loboMapDrawerV1_panel']")
        assert 'Red' not in panel.get('visibility','').split('|')
        assert 'Blue' in panel.get('visibility','').split('|')
        g.loboDrawerToggle(tf({'color':'Red'}));g.loboUIFlush();current(name)
        # A second controller for the same map must retain the identical title.
        q=register('abc003','abc002',name);current(name)
        route=g.loboDrawerResolve(tf({'owner':'abc001','id':'deployment_abc001','color':'Blue'}))
        assert route['callback']=='loboUniversalDeployment0'
        g.loboUIRelease(tf(q));g.loboUIFlush();current(name)
        if n==0:(out/f'broker-{index}-example.xml').write_text(frames[-1])
        # Switching without an intervening empty frame must select the new map.
        r=register('def001','def002','Transit & Maintenance Hub');current('Transit & Maintenance Hub')
        g.onObjectDestroy(g.alive['abc002']);g.alive['abc002']=None;current('Transit & Maintenance Hub')
        g.onObjectDestroy(g.alive['def002']);g.alive['def002']=None
        assert not rendered().findall(".//*[@id='loboMapDrawerV1_mapName']"), 'stale title after cleanup'
    return len(names)

names=sorted({r['map_name'] for r in coverage})
runs=sum(exercise(script,names,i) for i,script in enumerate(brokers.values()))
summary={'all_passed':True,'map_setups':len(coverage),'named_controllers':162,'broker_variants':len(brokers),
         'unique_map_names':len(names),'broker_name_lifecycle_runs':runs,'typed_colors_checked':typed_colors,
         'modified_fields':len(changed),'other_save_fields_unchanged':True,'live_tts_tested':False}
(out/'validation.json').write_text(json.dumps(summary,indent=2));print(json.dumps(summary))
