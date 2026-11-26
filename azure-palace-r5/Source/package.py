"""Update Azure Palace's state data and shelf entry without touching another map."""
import hashlib,json,re,sys
from pathlib import Path
from copy import deepcopy
from common import *
TAG='LoboMap:87b699';BAG='87b699';RELEASE=ROOT/'Release'
def rec(o):
    yield o
    for x in [*o.get('ChildObjects',[]),*o.get('States',{}).values(),*o.get('ContainedObjects',[])]:yield from rec(x)
def controls(controller,scene):
    ids=[n['GUID'] for o in scene for n in rec(o)];assert len(ids)==len(set(ids))
    s=controller['LuaScript']
    m=re.search(r'local config=JSON.decode\(\[==\[(.*?)\]==\]\)',s,re.S);cfg=json.loads(m[1]);cfg['owned']=ids
    s=s[:m.start(1)]+json.dumps(cfg,ensure_ascii=False,separators=(',',':'))+s[m.end(1):]
    a,b=s.split('-- BEGIN LOBO STANDARD MAP CONTROLS V1',1)
    m=re.search(r'local config=JSON.decode\(("[^\n]*")\)',b);cfg=json.loads(json.loads(m[1]));cfg['guids']={i:True for i in ids}
    controller['LuaScript']=a+'-- BEGIN LOBO STANDARD MAP CONTROLS V1'+b[:m.start(1)]+json.dumps(json.dumps(cfg,separators=(',',':')))+b[m.end(1):]
def build(base):
    base=base.rstrip('/')+'/'
    files={p.name:p for p in OUT.iterdir() if p.is_file()}
    # Geometrically identical villa and hotel colliders share one download.
    aliases={};by_hash={}
    for name,p in sorted(files.items()):aliases[name]=by_hash.setdefault(hashlib.sha256(p.read_bytes()).digest(),name)
    def url(name):return base+aliases[name]
    play=read(R4/'Release/Play-Table.json');old=[o for o in play['ObjectStates']if TAG in o.get('Tags',[])]
    ground=deepcopy(old[0]);ground['CustomMesh'].update(MeshURL=url('recessed-pool.obj'),DiffuseURL=url('palace-courts.jpg'))
    tex=old[13]['CustomMesh']['DiffuseURL']
    def court(child,slug):
        child['Nickname']=('Pool Club' if slug=='pool' else poses[slug].get('slug',slug).replace('-',' ').title())+' | Exterior court'
        child['Description']='Fixed exterior architecture, furniture and planting.';child['GMNotes']=TAG+' Azure Palace R5'
        child['CustomMesh'].update(MeshURL=url(slug+'-court.obj'),ColliderURL=url(slug+'-court-col.obj'),DiffuseURL=tex)
        child['LuaScript']='';child['LuaScriptState']=''
        child['Transform']={k:(1 if k.startswith('scale') else 0) for k in old[1]['Transform']}
    kid=deepcopy(old[1]['ChildObjects'][0]);kid['GUID']=old[17]['GUID'];court(kid,'pool');ground['ChildObjects']=[kid]
    ground['Description']='Blue basalt promenade, four centered stairways and a fitted poolside towel deck.'
    scene=[ground]
    for o,slug in zip(deepcopy(old[1:13]),poses,strict=True):
        for q,ix in [(o,1)]+[(v,int(i)+1)for i,v in o['States'].items()]:
            n=slug+'-'+str(ix);q['CustomMesh'].update(MeshURL=url(n+'.obj'),ColliderURL=url(n+'-col.obj'),DiffuseURL=url('palace-interiors.jpg'))
            child,=q['ChildObjects'];court(child,slug)
        scene.append(o)
    scene+=deepcopy(old[-3:])
    for antenna in scene[-3:-1]:antenna['CustomMesh']['MeshURL']=url('crossing-lines-antenna.obj')
    controls(scene[-1],scene)
    play['ObjectStates']=[o for o in play['ObjectStates'] if TAG not in o.get('Tags',[])]+scene
    play['SaveName']='Azure Palace R5 - Crossing Lines - Play Table';write(RELEASE/'Play-Table.json',play)
    bag=read(R4/'Release/Azure-Palace.json')['ObjectStates'][0];bag['Nickname']=bag['Nickname'].replace('R4','R5');bag['Description']=bag['Description'].replace('R4','R5');rows=[]
    for o in scene:
        for q in [o,*o.get('States',{}).values()]:
            t=q['Transform'];rows.append('--'+q['GUID']+','+','.join(format(t[k],'.10g')for k in ['posX','posY','posZ','rotX','rotY','rotZ']))
    bag['LuaScript']='\r\n'.join(rows)+'\r\n';bag['ContainedObjects']=deepcopy(scene)
    for o in bag['ContainedObjects']:o['Transform'].update(posX=70,posY=100,posZ=70)
    write(RELEASE/'Azure-Palace.json',{'ObjectStates':[bag]})
    extras=read(R4/'Release/Azure-Palace-Scatter.json');extras['ObjectStates'][0]['Nickname']='Azure Palace R5 - Optional Resort Furniture';write(RELEASE/'Azure-Palace-Scatter.json',extras)
    work=read(R4/'Release/Workshop-Save.json');i=next(i for i,o in enumerate(work['ObjectStates'])if o['GUID']==BAG)
    item=deepcopy(bag);item['Transform']=work['ObjectStates'][i]['Transform'];work['ObjectStates'][i]=item
    work['SaveName']=work['SaveName'].replace('R4','R5');work['LuaScript']=work['LuaScript'].replace('Azure Palace R4','Azure Palace R5');write(RELEASE/'Workshop-Save.json',work)
    write(ROOT/'Review/url-names.json',sorted({v[len(base):] for o in scene for q in rec(o) for v in q.get('CustomMesh',{}).values() if isinstance(v,str) and v.startswith(base)}))
    print(len(scene),'roots,',len(rows),'stage configurations,',len(aliases),'authored assets',flush=True)
if __name__=='__main__':build(sys.argv[1])
