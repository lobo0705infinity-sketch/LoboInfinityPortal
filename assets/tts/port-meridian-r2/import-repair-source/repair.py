import pathlib,json,copy,re,hashlib,sys,shutil
ROOT=pathlib.Path(__file__).resolve().parent
ASSETS=ROOT/'repo/assets/tts/port-meridian-r2'
OUT=ROOT/'repaired'
def parse(p):
    arrays={'v':[],'vt':[],'vn':[]};faces=[]
    for line in p.read_text().splitlines():
        bits=line.split()
        if not bits:continue
        if bits[0] in arrays:arrays[bits[0]].append(bits[1:])
        elif bits[0]=='f':
            assert len(bits)==4
            faces.append(bits[1:])
    return arrays,faces
def signature(arrays,faces):
    h=hashlib.sha256()
    for face in faces:
        for token in face:
            ids=token.split('/')
            h.update(json.dumps([arrays[k][int(v)-1] if v else None for k,v in zip(('v','vt','vn'),ids)],separators=(',',':')).encode())
    return h.hexdigest()
def split():
    mapping={};audit=[]
    for p in sorted(ASSETS.glob('*.obj')):
        arrays,faces=parse(p)
        expanded=len({t for f in faces for t in f})
        if expanded<=18000:continue
        names=[];newfaces=[];newarrays={'v':[],'vt':[],'vn':[]}
        # Each part stays safe even for importers that expand every face corner.
        for idx,start in enumerate(range(0,len(faces),6000)):
            batch=faces[start:start+6000];maps={k:{}for k in arrays};lines=[]
            for face in batch:
                for token in face:
                    for k,v in zip(('v','vt','vn'),token.split('/')):
                        if v:maps[k].setdefault(int(v),len(maps[k])+1)
            outarrays={k:[arrays[k][i-1]for i in maps[k]]for k in arrays}
            outfaces=[['/'.join(str(maps[k][int(v)])if v else ''for k,v in zip(('v','vt','vn'),t.split('/')))for t in f]for f in batch]
            for k in arrays:
                lines.extend(k+' '+' '.join(a)for a in outarrays[k])
            lines.extend('f '+' '.join(f)for f in outfaces)
            name=p.stem+f'-safe-{idx}.obj';(ASSETS/name).write_text('\n'.join(lines)+'\n');names.append(name)
            assert signature(arrays,batch)==signature(*parse(ASSETS/name))
        mapping[p.name]=names;audit.append(dict(mesh=p.name,source_positions=len(arrays['v']),import_vertices=expanded,triangles=len(faces),parts=len(names),geometry_exact=True))
    (ROOT/'split-map.json').write_text(json.dumps(mapping,indent=2))
    (ROOT/'split-audit.json').write_text(json.dumps(audit,indent=2));print('Split',len(mapping),'meshes into',sum(map(len,mapping.values())),'parts')
def package(commit):
    shutil.copytree(ROOT/'original',OUT,dirs_exist_ok=True)
    mapping=json.loads((ROOT/'split-map.json').read_text())
    save=json.loads((OUT/'Saves/TS_Save_Port_Meridian_R2.json').read_text())
    bagfile=json.loads((OUT/'Saved Objects/Port Meridian R2.json').read_text());bag=bagfile['ObjectStates'][0]
    config=json.loads((OUT/'Source/config.json').read_text());entries={e['guid']:e for e in config['items']};newentries=[];objects=[]
    base=f'https://raw.githubusercontent.com/lobo0705infinity-sketch/LoboInfinityPortal/{commit}/assets/tts/port-meridian-r2/'
    for o in save['ObjectStates']:
        mesh=o.get('CustomMesh',{}).get('MeshURL','').rsplit('/',1)[-1]
        if mesh not in mapping:objects.append(o);continue
        for idx,name in enumerate(mapping[mesh]):
            n=copy.deepcopy(o);n['CustomMesh']['MeshURL']=base+name
            if idx:
                n['GUID']=hashlib.sha1((o['GUID']+name).encode()).hexdigest()[:6]
                for s in n.get('States',{}).values():s['GUID']=hashlib.sha1((s['GUID']+name).encode()).hexdigest()[:6]
                e=copy.deepcopy(entries[o['GUID']]);e.update(guid=n['GUID'],key=e['key']+f'-safe-{idx}');newentries.append(e)
            notes=json.loads(n['GMNotes']);notes['mesh']=name;n['GMNotes']=json.dumps(notes)
            objects.append(n)
    config['items']+=newentries
    for o in objects:
        if 'local config=JSON.decode([==[' in o.get('LuaScript',''):
            o['LuaScript']=re.sub(r'local config=JSON.decode\(\[==\[.*?\]==\]\)',lambda m:'local config=JSON.decode([==['+json.dumps(config,separators=(',',':'))+']==])',o['LuaScript'],flags=re.S)
    save['ObjectStates']=objects;save['SaveName']='Port Meridian — Last Launch — R2 Import Repair RC'
    save['Note']='Corrected expanded OBJ vertex budgets. Exact geometry retained. Live TTS, fresh-cache and multiplayer import untested.'
    bag['ContainedObjects']=copy.deepcopy(objects);placements=[]
    for o in bag['ContainedObjects']:
        t=o['Transform'];placements.append(dict(guid=o['GUID'],position=[t[k]for k in ['posX','posY','posZ']],rotation=[t[k]for k in ['rotX','rotY','rotZ']]))
        t.update(posX=70,posY=100,posZ=70)
    bag['LuaScript']=re.sub(r'local placements=JSON.decode\(\[==\[.*?\]==\]\)',lambda m:'local placements=JSON.decode([==['+json.dumps(placements)+']==])',bag['LuaScript'],flags=re.S)
    bag['Nickname']='Port Meridian R2 — Import Repair RC'
    (OUT/'Saves/TS_Save_Port_Meridian_R2.json').write_text(json.dumps(save,indent=2))
    (OUT/'Saved Objects/Port Meridian R2.json').write_text(json.dumps(bagfile,indent=2))
    (OUT/'Source/config.json').write_text(json.dumps(config,indent=2))
    shutil.copy(ROOT/'repair.py',OUT/'Source/import-repair.py');shutil.copy(ROOT/'split-audit.json',OUT/'Source/import-repair-audit.json')
    (OUT/'README.txt').write_text('PORT MERIDIAN R2 — IMPORT REPAIR RELEASE CANDIDATE\n\nExtract all files, run Install.cmd, then open the fresh save named\nPort Meridian — Last Launch — R2 Import Repair RC.\nFor saved objects, delete the incomplete map and deploy the newly installed\nPort Meridian R2 — Import Repair RC bag onto a clear table.\n\nThe old OBJ budget counted positions but missed UV/normal expansion.\nOversized visual meshes are now split at 6,000 triangles per new part,\nwith at most 18,000 face corners. All original face coordinates, UVs,\nnormals, textures, collision, placement and floor controls are preserved.\nNew URLs avoid the failed model cache. No local runtime assets are used.\n\nOffline validation and exact hosted download checks accompany this package.\nLive TTS import, fresh-cache loading and two-client multiplayer remain UNTESTED.\nThis package does not publish or replace the Steam Workshop collection.\n')
    p=OUT/'Install.ps1';p.write_text(p.read_text().replace('R2 Review.','R2 Import Repair RC.'))
    print('Packaged',len(objects),'objects;',len(newentries),'new control entries')
if __name__=='__main__':
    if len(sys.argv)==1:split()
    else:package(sys.argv[1])
