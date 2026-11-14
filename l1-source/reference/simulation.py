import copy,json,heapq
from lupa.lua52 import LuaRuntime
class Simulation:
    def __init__(self,data):
        self.lua=LuaRuntime(unpack_returned_tuples=True)
        self.world=[];self.queue=[];self.sequence=0;self.tick=0;self.ui={};self.assets=[];self.messages=[];self.chest_requests=[]
        g=self.lua.globals()
        g.JSON=self.table({'decode':lambda s:self.table(json.loads(s)),'encode':lambda t:json.dumps(self.python(t))})
        g.Time=self.table({'time':0})
        g.UI=self.table({'loading':False,'setValue':lambda k,v:self.ui.__setitem__(k,v),'getValue':lambda k:self.ui.get(k,''),
            'setAttribute':lambda k,a,v:self.ui.__setitem__((k,a),v),'getCustomAssets':lambda:self.table(self.assets),'setXml':self.set_xml})
        g.Wait=self.table({'frames':lambda f,n:self.schedule(f,n),'time':lambda f,n:self.schedule(f,n*60),
            'condition':lambda f,c,*rest:self.schedule(f,1) if c() else None})
        g.broadcastToAll=lambda m,*_:self.messages.append(m)
        g.broadcastToColor=lambda m,*_:self.messages.append(m)
        g.getObjectsWithTag=lambda tag:self.lua.table_from([o for o in self.world if not o['_dead'] and o.hasTag(tag)])
        g.getObjectFromGUID=lambda guid:next((o for o in self.world if not o['_dead'] and o.getGUID()==guid),None)
        g.destroyObject=lambda o:o.__setitem__('_dead',True)
        g.Global=self.table({'getVectorLines':lambda:self.table([]),'setVectorLines':lambda x:None})
        self.chest=self.object(data['ObjectStates'][3]);self.world.append(self.chest)
        self.api=self.lua.execute(data['LuaScript']+"\nreturn {state=S,decode=decodeBattlePayload,layout=unpackBattleLayout,catalogue=catalogue}")
        self.player=self.table({'host':True,'color':'White'})

    def table(self,value):
        if isinstance(value,dict): return self.lua.table_from({k:self.table(v) for k,v in value.items()})
        if isinstance(value,list): return self.lua.table_from([self.table(v) for v in value])
        return value

    def python(self,value):
        if hasattr(value,'items'):
            d={k:self.python(v) for k,v in value.items()}
            if d and set(d)==set(range(1,len(d)+1)):return [d[i] for i in range(1,len(d)+1)]
            return d
        return value

    def schedule(self,fn,frames):
        self.sequence+=1;heapq.heappush(self.queue,(self.tick+frames,self.sequence,fn))

    def drain(self):
        calls=0
        while self.queue:
            tick,_,fn=heapq.heappop(self.queue);self.tick=tick;self.lua.globals().Time.time=tick/60
            fn();calls+=1
            assert calls<10000,'scheduler stalled'

    def set_xml(self,xml,assets):self.assets=self.python(assets)

    def object(self,data):
        data=copy.deepcopy(data)
        obj=self.lua.table();obj['_dead']=False;obj['loading_custom']=False;obj['spawning']=False
        tags=set(data.get('Tags',[]));children=list(data.get('ContainedObjects',[]))
        obj.getGUID=lambda:data['GUID']
        obj.isDestroyed=lambda:bool(obj['_dead'])
        obj.hasTag=lambda t:t in tags
        obj.addTag=lambda t:tags.add(t)
        obj.removeTag=lambda t:tags.discard(t)
        obj.setLock=lambda v:obj.__setitem__('_locked',v)
        obj.setPosition=lambda v:obj.__setitem__('_position',v)
        obj.setRotation=lambda v:obj.__setitem__('_rotation',v)
        obj.getGMNotes=lambda:data.get('GMNotes','')
        obj.getObjects=lambda:self.table([{'guid':o['GUID'],'name':o.get('Nickname',''),'index':i,'gm_notes':o.get('GMNotes',''),'memo':o.get('Memo','')} for i,o in enumerate(children)])
        def take(params):
            guid=params['guid'];index=next(i for i,v in enumerate(children) if v['GUID']==guid)
            child_data=children.pop(index)
            child=self.object(child_data);self.world.append(child)
            child['_source']=self.table(child_data)
            if data['GUID']=='ac9012':self.chest_requests.append(guid)
            callback=params['callback_function']
            if callback:callback(child)
            return child
        obj.takeObject=take
        def put(child):
            children.append(self.python(child['_source']));child['_dead']=True
        obj.putObject=put
        def clone(_):
            cloned_data=copy.deepcopy(data);cloned_data['ContainedObjects']=copy.deepcopy(children)
            cloned=self.object(cloned_data);self.world.append(cloned);return cloned
        obj.clone=clone
        return obj

def vector(v):
 if isinstance(v,dict):return {k:v.get(k,v.get(i)) for i,k in enumerate(['x','y','z'],1)}
 return dict(zip(['x','y','z'],v))

class GroundSimulation(Simulation):
 def __init__(self,data):
  super().__init__(data)
  self.lua.globals().Physics=self.table({'cast':self.cast})
 def object(self,data):
  obj=super().object(data);t=data['Transform']
  state={'position':{a:t['pos'+a.upper()] for a in ['x','y','z']},'rotation':{a:t['rot'+a.upper()] for a in ['x','y','z']},'scale':{a:t['scale'+a.upper()] for a in ['x','y','z']}}
  for method,k in [('Position','position'),('Rotation','rotation'),('Scale','scale')]:
   obj['get'+method]=lambda k=k:self.table(state[k])
   obj['set'+method]=lambda v,k=k:state.__setitem__(k,vector(self.python(v)))
  obj.getLock=lambda:bool(obj['_locked']);obj.setVelocity=lambda v:None;obj.setAngularVelocity=lambda v:None
  # All support maps used here have identity transforms. Unit rotations are
  # handled by r33Pose's exact footprint axes, not this ground-only adapter.
  obj.positionToLocal=lambda v:self.table({k:vector(self.python(v))[k]-state['position'][k] for k in ['x','y','z']})
  obj.positionToWorld=lambda v:self.table({k:vector(self.python(v))[k]+state['position'][k] for k in ['x','y','z']})
  return obj
 def cast(self,params):
  p=vector(self.python(params.origin));hits=[]
  for o in self.world:
   if o['_dead'] or not o.hasTag('LoboGroundMesh'):continue
   n=json.loads(o.getGMNotes());g=n.get('r23Surface')
   if not g:continue
   if not(g['x0']<=p['x']<=g['x0']+g['nx']*g['stepX'] and g['z0']<=p['z']<=g['z0']+g['nz']*g['stepZ']):continue
   h=self.lua.globals()["__groundHeight"](o,self.table(n),p['x'],p['z'])
   if h is not None and h<=p['y']:hits.append(self.lua.table_from({'hit_object':o,'point':self.table({'x':p['x'],'y':h,'z':p['z']})}))
  return self.lua.table_from(hits)
