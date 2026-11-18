from test_standard import *
D=json.loads((ROOT/'output/Workshop-Save.json').read_text());b=list(bags(D))[69];w=RealWorld(b);w.load()
w.items['probe2']={'GUID':'probe2','Name':'Figurine','Transform':{'posX':23,'posY':8.5,'posZ':0,'rotX':0,'rotY':0,'rotZ':0},'Locked':False}
before={k:copy.deepcopy(o['Transform'])for k,o in w.items.items()}
w.call('nereidDeckLift');w.advance(5)
lifted={k:copy.deepcopy(o['Transform'])for k,o in w.items.items()if o['Transform']['posX']>80 and o['Transform']['posY']>-10}
assert lifted,'Test must include outer lifted deck beyond x=80'
w.click('turn')
for k,t in lifted.items():assert abs(w.items[k]['Transform']['posX']+t['posX'])<.001,(k,'lifted deck not rotated')
w.call('nereidDeckStack');w.advance(5);w.click('turn')
for k,t in before.items():
 if k=='broker':continue
 for field in ['posX','posY','posZ']:
  assert abs(w.items[k]['Transform'][field]-t[field])<.001,(k,field,w.items[k]['Transform'][field],t[field])
print('Nereid lifted deck rotates completely and stacks correctly')
(ROOT/'audit/lifted-rotation.json').write_text(json.dumps({'passed':True,'outer_lifted_objects':len(lifted),'rotate_then_stack_then_return':True},indent=2))
