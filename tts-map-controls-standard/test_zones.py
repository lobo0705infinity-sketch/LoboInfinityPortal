import json,math,heapq,re,copy
from pathlib import Path
from xml.etree import ElementTree as ET
from lupa.lua52 import LuaRuntime,lua_type
from patch_maps import ROOT,bags,walk,config

def py(v):
    if lua_type(v)=='table':
        keys=list(v.keys())
        if keys and all(isinstance(k,int) for k in keys) and sorted(keys)==list(range(1,len(keys)+1)):
            return [py(v[i]) for i in range(1,len(keys)+1)]
        return {k:py(x)for k,x in v.items()}
    return v

class World:
    def __init__(self,bag):
        self.bag=bag;self.items={o['GUID']:copy.deepcopy(o)for o in walk(bag)if o.get('GUID')};self.run={};self.vars={};self.tables={};self.lines={};self.ui={};self.events=[];self.serial=0;self.now=0;self.errors=[];self.dead=set();self.casts=0;self.max_casts=0;self.per_frame={};self.broker_vars={'LOBO_UI_BROKER_VERSION':4,'LOBO_UI_BROKER_REVISION':'korin-r3','LOBO_UI_STANDARD_REVISION':'lobo-standard-20261118-v1'}
        for m in re.finditer(r'^--([a-f0-9]{6}),([^\n]+)',bag['LuaScript'],re.M):
            if m[1]in self.items:
                vals=list(map(float,m[2].split(',')));t=self.items[m[1]]['Transform']
                for k,v in zip(['posX','posY','posZ','rotX','rotY','rotZ'],vals):t[k]=v
        self.primary=next(o for o in bag['ContainedObjects']if 'LOBO_ZONE_COLOR_VERSION=1' in o.get('LuaScript',''))
        self.mat=re.search(r'local loboColorMatGUID="(\w+)"',self.primary['LuaScript'])[1]
        self.floor=self.items[self.mat]['Transform']['posY']+.04
        for o in walk(bag):
            if 'BEGIN LOBO BRIGHT ZONES R1' in o.get('LuaScript',''):self.init(o)
    def mount_ui(self, text, *args):
        self.ui_root = ET.fromstring('<Root>' + text + '</Root>')
        self.ui_by_id = {n.get('id'): n for n in self.ui_root.iter() if n.get('id')}

    def ui_attribute(self, ident, name):
        node = getattr(self, 'ui_by_id', {}).get(ident)
        return node.get(name) if node is not None else None

    def set_ui_attribute(self, ident, name, value):
        node = getattr(self, 'ui_by_id', {}).get(ident)
        if node is not None:
            node.set(name, str(value))

    def set_ui_value(self, ident, value):
        node = getattr(self, 'ui_by_id', {}).get(ident)
        if node is not None:
            node.text = str(value)

    @property
    def xml(self):
        return ''.join(ET.tostring(node, encoding='unicode') for node in self.ui_root)

    def schedule(self,fn,delay,rep=None):
        self.serial+=1;i=self.serial
        heapq.heappush(self.events,(self.now+max(delay,1/60),i,fn,delay,rep));return i
    def advance(self,seconds=3):
        end=self.now+seconds;n=0
        while self.events and self.events[0][0]<=end:
            t,i,f,delay,rep=heapq.heappop(self.events);self.now=t;n+=1
            if i in self.dead:continue
            try:f()
            except Exception as e:self.errors.append(str(e));raise
            if rep==-1 or rep and rep>1:
                self.schedule(f,delay,-1 if rep==-1 else rep-1)
            assert n<100000,'event storm'
        self.now=end
    def init(self,o):
        key=o['GUID'];l=LuaRuntime(unpack_returned_tuples=True);g=l.globals();self.run[key]=(l,g)
        def lua(v):
            if isinstance(v,dict):return l.table_from({k:lua(x)for k,x in v.items()})
            if isinstance(v,(list,tuple)):return l.table_from([lua(x)for x in v])
            return v
        def vector(x=0,y=0,z=0):
            if lua_type(x)=='table':return lua({'x':x.x or x[1]or 0,'y':x.y or x[2]or 0,'z':x.z or x[3]or 0})
            return lua({'x':x,'y':y,'z':z})
        def coordinates(p):
            p=py(p);return [p.get(a,p.get(i+1,0))for i,a in enumerate('xyz')]if isinstance(p,dict)else p
        def obj(guid):
            if guid=='broker' and not getattr(self,'real_broker',False):
                def call(fn,p=None):
                    p=py(p)if p is not None else {};owner=p.get('owner',key)
                    if fn=='loboUIRegister':return 'token-'+owner
                    if fn=='loboUIRead':return lua(self.ui.get(owner,[]))
                    if fn=='loboUIWrite':self.ui[owner]=p['nodes'];return True
                    if fn=='loboUISetAttribute':
                        def setattrs(n):
                            if n.get('attributes',{}).get('id')==p['id']:n['attributes'][p['attribute']]=p['value']
                            for c in n.get('children',[]):setattrs(c)
                        for n in self.ui.get(owner,[]):setattrs(n)
                        return True
                    if fn=='loboDrawerResolve':
                        def find(ns):
                            for n in ns:
                                a=n.get('attributes',{})
                                if a.get('id')==p.get('id') and '/' in a.get('onClick',''):return {'callback':a['onClick'].split('/')[1]}
                                r=find(n.get('children',[]))
                                if r:return r
                        return lua(find(self.ui.get(owner,[])))
                    return lua({'mode':'night','background':'night','active':True})
                return lua({'getGUID':lambda:'broker','isDestroyed':lambda:False,'getVar':lambda n:self.broker_vars.get(n),'call':call,'setLuaScript':lambda *_:None,'setVar':lambda n,v:self.broker_vars.__setitem__(n,v),'reload':lambda:obj('broker')})
            if guid not in self.items or guid in self.dead:return None
            d=self.items[guid];t=d['Transform'];tags=d.get('Tags',[])
            def localworld(p,inverse=False):
                x,y,z=coordinates(p);a=math.radians(t.get('rotY',0));cs,sn=math.cos(a),math.sin(a)
                sx,sy,sz=[t.get('scale'+c,1) for c in 'XYZ']
                if inverse:
                    x-=t['posX'];y-=t['posY'];z-=t['posZ'];x,z=cs*x-sn*z,sn*x+cs*z
                    return vector(x/sx,y/sy,z/sz)
                x*=sx;y*=sy;z*=sz;x,z=cs*x+sn*z,-sn*x+cs*z
                return vector(x+t['posX'],y+t['posY'],z+t['posZ'])
            def call(fn,p=None):
                if guid not in self.run:return None
                ll,gg=self.run[guid];f=gg[fn]
                if f is None:return None
                pp=py(p)
                def cv(v):
                    if isinstance(v,dict):return ll.table_from({k:cv(x)for k,x in v.items()})
                    if isinstance(v,list):return ll.table_from([cv(x)for x in v])
                    return v
                result=f(cv(pp)) if p is not None else f();return lua(py(result))
            def setpos(p,*a):
                for k,v in zip(['posX','posY','posZ'],coordinates(p)):t[k]=v
            def setrot(p,*a):
                for k,v in zip(['rotX','rotY','rotZ'],coordinates(p)):t[k]=v
            fns={'getGUID':lambda:guid,'getName':lambda:d.get('Nickname',''),'getDescription':lambda:d.get('Description',''),
                'isDestroyed':lambda:guid in self.dead,'getPosition':lambda:vector(t['posX'],t['posY'],t['posZ']),
                'getRotation':lambda:vector(t.get('rotX',0),t.get('rotY',0),t.get('rotZ',0)),
                'getScale':lambda:vector(t.get('scaleX',1),t.get('scaleY',1),t.get('scaleZ',1)),
                'getBounds':lambda:lua({'center':{'x':t['posX'],'y':t['posY'],'z':t['posZ']},'size':{'x':48,'y':.08,'z':48}}),
                'hasTag':lambda tag:tag in tags,'getTags':lambda:lua(tags),
                'setVar':lambda n,v:self.vars.setdefault(guid,{}).__setitem__(n,py(v)),
                'getVar':lambda n:lua(self.vars.get(guid,{}).get(n))if n in self.vars.get(guid,{})else (self.run[guid][1][n] if guid in self.run and lua_type(self.run[guid][1][n])!='table'else None),
                'setTable':lambda n,v:self.tables.setdefault(guid,{}).__setitem__(n,py(v)),
                'getTable':lambda n:lua(self.tables.get(guid,{}).get(n))if n in self.tables.get(guid,{}) else (lua(py(self.run[guid][1][n]))if guid in self.run and lua_type(self.run[guid][1][n])=='table'else None),
                'setVectorLines':lambda v:self.lines.__setitem__(guid,py(v)),
                'getVectorLines':lambda:lua(self.lines.get(guid,[])),
                'positionToWorld':lambda p:localworld(p),'positionToLocal':lambda p:localworld(p,True),
                'setPosition':setpos,'setPositionSmooth':setpos,'setRotation':setrot,'setRotationSmooth':setrot,
                'call':call,'getData':lambda:lua(d),'getJSON':lambda:json.dumps(d),'getStateId':lambda:1,
                'getStates':lambda:lua([]),'getObjects':lambda *args:lua([]),'getLock':lambda:d.get('Locked',False),'setLock':lambda value:d.__setitem__('Locked',value),
                'destruct':lambda:self.dead.add(guid),'reload':lambda:obj(guid)}
            for fn in ['setScale','setInvisibleTo','setColorTint','setCustomObject','setDecals','setSnapPoints','setFogOfWarReveal','setName','setDescription','createButton','editButton','removeButton','clearButtons','addContextMenuItem','clearContextMenu','addTag','removeTag','setLuaScript','setVelocity','setAngularVelocity','setState']:
                fns[fn]=lambda *args:None
            fns['tag']=d.get('Name','');fns['interactable']=False
            return lua(fns)
        def condition(fn,check,timeout=60,fail=None):
            start=self.now
            def test():
                if check():fn()
                elif self.now-start<timeout:self.schedule(test,1/60)
                elif fail:fail()
            return self.schedule(test,1/60)
        def cast(p):
            p=py(p);x,y,z=p['origin'];self.casts+=1;frame=round(self.now*60);self.per_frame[frame]=self.per_frame.get(frame,0)+1
            hits=[{'hit_object':obj(self.mat),'point':vector(x,self.floor,z)}]
            # Roof surface on the center part of each line. Keep the normal map tag.
            if abs(z)<3:hits.append({'hit_object':obj(self.mat),'point':vector(x,self.floor+4,z)})
            return lua(hits)
        g.JSON=lua({'decode':lambda s,*unused:lua(json.loads(s)),'encode':lambda x:json.dumps(py(x),separators=(',',':'))})
        g.Vector=vector;g.self=obj(key);g.getObjectFromGUID=obj
        g.getObjectsWithTag=lambda tag:lua([obj(k)for k,v in self.items.items()if tag in v.get('Tags',[])]) if tag!='LoboMapUIBrokerV4'else lua([obj('broker')])
        g.getAllObjects=lambda:lua([obj(k)for k in self.items if k not in self.dead])
        g.Global=lua({'getVar':lambda n:'broker'if n=='LoboMapUIBrokerV4'else None,'setVar':lambda *args:None,'call':lambda *args:None})
        g.getObjects = g.getAllObjects
        g.Global.getTable = lambda key: lua(self.tables.get('Global', {}).get(key))
        g.Global.setTable = lambda key, value: self.tables.setdefault('Global', {}).__setitem__(key, py(value))
        g.Wait=lua({'frames':lambda f,n:self.schedule(f,n/60),'time':lambda f,t,r=None:self.schedule(f,t,r),'condition':condition,'stop':lambda i:self.dead.add(i)})
        g.UI=lua({'getXmlTable':lambda:lua([]),'setXmlTable':lambda *args:None,'setXml':self.mount_ui,'getCustomAssets':lambda:lua([]),'getAttribute':self.ui_attribute,'setAttribute':self.set_ui_attribute,'setValue':self.set_ui_value,'loading':False})
        g.Physics=lua({'cast':cast});g.Lighting=lua({'setAmbientIntensity':lambda *a:None,'setLightIntensity':lambda *a:None,'setCustomSkybox':lambda *a:None})
        for fn in ['setLightColor','setAmbientSkyColor','setAmbientEquatorColor','setAmbientGroundColor','apply']:
            g.Lighting[fn]=lambda *args:None
        for fn in ['getAmbientSkyColor','getAmbientEquatorColor','getAmbientGroundColor','getLightColor']:g.Lighting[fn]=lambda:lua([1,1,1])
        g.Player=lua({c:{'seated':True,'color':c,'admin':True,'host':True}for c in ['White','Blue','Red']})
        g.printToColor=lambda *a:setattr(self,'printed',a);g.broadcastToAll=lambda *a:None;g.broadcastToColor=lambda *a:None;g.print=lambda *a:None
        g.spawnObjectData=lambda *a:obj('broker');g.spawnObjectJSON=lambda *a:obj('broker')
        g.log=lambda *a:None
        g.Time=lua({'time':0})
        g.Backgrounds=lua({'getBackground':lambda:'Studio','getCustomURL':lambda:getattr(self,'background_url',''),'setCustomURL':lambda url:setattr(self,'background_url',url),'setBackground':lambda *a:None})
        g.Grid=lua({'show_lines':False,'snapping':1})
        l.execute(o['LuaScript'])
    def load(self,states=None):
        for key,(l,g)in self.run.items():
            if g.onLoad:g.onLoad((states or {}).get(key,self.items[key].get('LuaScriptState','')))
        self.advance(4)
        # All onLoad/lifecycle handshakes have settled. Unrelated infinite scenery
        # timers are omitted from the subsequent control scenarios.
        self.events=[e for e in self.events if e[4]!=-1];heapq.heapify(self.events)
    def call(self,name,*args):
        l,g=self.run[self.primary['GUID']]
        def cv(v):return l.table_from(v)if isinstance(v,dict)else v
        return g[name](*[cv(a)for a in args])
    def source(self):return self.tables.get(self.mat,{}).get('LoboZoneSourceR1',[])

PALETTE=[[1,0,0],[1,.45,0],[1,1,0],[0,1,0],[.10,.35,1],[.50,.20,1],[.90,.08,1]]
def check_render(w):
    source=w.source();rendered=w.lines.get(w.mat,[])
    assert len(source)==len(rendered),(len(source),len(rendered))
    l,g=w.run[w.primary['GUID']];mat=g.getObjectFromGUID(w.mat)
    colors=w.tables[w.mat]['LoboZoneColorsR1']
    for old,line in zip(source,rendered):
        kind=old.get('loboZoneKind')
        if not kind:continue
        if not old.get('loboZoneEdge'):
            expect=[.92,.94,1]if kind=='scoring'else PALETTE[colors[kind]-1]
            assert line['color']==expect,('wrong visible color',kind,line['color'],expect)
        for p in line['points']:
            world=py(mat.positionToWorld(l.table_from(p)))
            assert world['y']>=w.floor+.0349,('buried guide',world,w.floor)
    return source

def deployment_state(w):
    data=json.loads(w.call('onSave'))
    while 'original' in data and isinstance(data['original'],str):
        try:data=json.loads(data['original'])
        except (ValueError,TypeError):break
    return data.get('loboUniversal',{})if isinstance(data,dict)else {}

def main():
    data=json.loads((ROOT/'output/Workshop-Save.json').read_text());report=[]
    for i,b in enumerate(bags(data)):
        import sys
        if len(sys.argv)>1 and i<int(sys.argv[1])-1:continue
        w=World(b)
        try:
            w.load()
            root='loboMission_ZoneColors_'+w.primary['GUID'];player={'color':'White'}
            assert any(n.get('attributes',{}).get('id')==root for n in w.ui[w.primary['GUID']]),'palette not mounted'
            for offset in [0,4,8,8,0]:
                previous=deployment_state(w)
                w.call('loboUniversalDeployment'+str(offset));w.advance(3)
                assert w.lines.get(w.mat) is not None,'no line write'
                check_render(w)
                current=deployment_state(w)
                if current:
                    assert sum(bool(v)for v in current.values())<=1,'overlapping DZ modes'
                    assert bool(current.get(str(offset)))!=bool(previous.get(str(offset))),'DZ did not toggle'
            original=copy.deepcopy(w.source())
            cores=[x for x in original if x.get('loboZoneKind')=='deployment' and not x.get('loboZoneEdge')]
            assert len(cores)>=2,'DZ missing after enabled'
            for kind in ['deployment','exclusion']:
                for n in range(1,8):
                    w.call('loboZonePickColor',player,'',root+'_pick_'+kind+'_'+str(n));w.advance(3)
                    assert w.tables[w.mat]['LoboZoneColorsR1'][kind]==n
                    check_render(w)
                    assert w.source()==original,'color changed measured paths'
            saved={k:g.onSave()if g.onSave else ''for k,(l,g)in w.run.items()}
            w2=World(b);w2.load(saved)
            assert w2.tables[w2.mat]['LoboZoneColorsR1']=={'deployment':7,'exclusion':7},'color restore'
            check_render(w2)
            # Cancel several in-flight paints and confirm the final click wins.
            for n in [2,5,3,1]:w2.call('loboZonePickColor',player,'',root+'_pick_deployment_'+str(n))
            w2.advance(3);check_render(w2)
            assert w2.tables[w2.mat]['LoboZoneColorsR1']['deployment']==1
            # A destroyed mat must cancel pending projection without errors.
            w2.call('loboZonePickColor',player,'',root+'_pick_deployment_4')
            w2.dead.add(w2.mat);w2.advance(3)
            report.append({'map':b['GUID'],'name':b['Nickname'],'passed':True})
            print(i+1,b['GUID'],'PASS',flush=True)
        except Exception as e:
            print('FAILED',i+1,b['Nickname'],str(e),flush=True);raise
    (ROOT/'audit/runtime-results.json').write_text(json.dumps(report,indent=2))

if __name__=='__main__':main()
