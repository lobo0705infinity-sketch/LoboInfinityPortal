#!/usr/bin/env python3
"""Validate coverage, unchanged gameplay data, typed save fields, and every new mesh."""
import collections, hashlib, json, math, pathlib, sys, importlib.util
import numpy as np
from PIL import Image
ROOT=pathlib.Path(sys.argv[1]);ASSETS=ROOT/'aurora-source/assets/tts/aurora-visual-20261114'
PREPUBLISH='--prepublish' in sys.argv
spec=importlib.util.spec_from_file_location('builder',pathlib.Path(__file__).with_name('aurora-visual-refresh-20261114.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
old=json.load(open(ROOT/'baseline/Workshop-Save.json'));new=json.load(open(ROOT/'output/Workshop-Save.json'));audit=json.load(open(ASSETS/'coverage.json'));meshmeta=json.load(open(ASSETS/'mesh-validation.json'));sources={e['url']:e['path'] for e in json.load(open(ROOT/'inspection/source-assets.json'))}
assert len(audit)==48
assert len({r['location'] for r in audit})==24
for loc in {r['location'] for r in audit}:
    rows=[r for r in audit if r['location']==loc]
    assert {r['mission'] for r in rows}=={'Frontline','Supremacy'}
    assert all(r['buildings']>0 and r['new_panels']>0 for r in rows)
assert len(old['ObjectStates'])==len(new['ObjectStates'])
changes=collections.Counter();typed_colors=0;objects=0;asset_refs=0
color_keys={'ColorDiffuse','SpecularColor','AmbientSkyColor','AmbientEquatorColor','AmbientGroundColor','LightColor','visibleColor','colorstate'}
def compare(a,b,path=''):
    if a==b:return
    if isinstance(a,dict):
        assert set(a)==set(b),(path,'keys')
        for k in a:compare(a[k],b[k],path+'/'+k)
    elif isinstance(a,list):
        assert len(a)==len(b),(path,'length')
        for i,(x,y) in enumerate(zip(a,b)):compare(x,y,path+'/'+str(i))
    else:
        allowed=path.endswith(('/CustomMesh/MeshURL','/CustomMesh/DiffuseURL','/ColorDiffuse/r','/ColorDiffuse/g','/ColorDiffuse/b')) or path=='/SaveName'
        legacy=isinstance(a,str) and '__LOBO_TEXTURE_ROOT__' in a
        assert allowed or legacy,(path,a,b)
        if legacy:assert b.replace(b.split('/inherited-textures')[0]+'/inherited-textures','__LOBO_TEXTURE_ROOT__')==a or '__LOBO_TEXTURE_ROOT__' not in b
        changes[path.rsplit('/',1)[-1]]+=1
compare(old,new)
def walk(v,path=''):
    global typed_colors,objects,asset_refs
    if isinstance(v,dict):
        if 'GUID' in v and 'Name' in v:objects+=1
        for k,x in v.items():
            if k in color_keys and x is not None:
                assert isinstance(x,dict) and all(isinstance(x.get(c),(int,float)) and not isinstance(x.get(c),bool) and math.isfinite(x[c]) for c in 'rgb'),(path,k,x)
                typed_colors+=1
            if k.endswith('URL') and isinstance(x,str) and x:
                assert x.startswith(('https://','http://')) or (PREPUBLISH and x.startswith('__AURORA_ASSET_BASE__/')),(path,k,x)
                assert 'file://' not in x and '__LOBO' not in x,(path,k,x)
                asset_refs+=1
            walk(x,path+'/'+k)
    elif isinstance(v,list):
        for i,x in enumerate(v):walk(x,path+'/'+str(i))
walk(new)
tabs=new.get('TabStates',{})
for tab in (tabs.values() if isinstance(tabs,dict) else tabs):
    assert isinstance(tab.get('color',''),str)
    assert isinstance(tab.get('id',-1),int)
errors=[];maxexpanded=0;maxpos=0;new_triangles=0
for i,meta in enumerate(meshmeta):
    v,u,n,f=m.read_obj(ASSETS/meta['mesh']);sv,su,sn,sf=m.read_obj(sources[meta['source_mesh']]);a=np.array(v);sa=np.array(sv)
    assert len(f)==len(sf)+len(meta['panels'])*2
    before=sa[np.array([[q[0] for q in face] for face in sf])]
    after=a[np.array([[q[0] for q in face] for face in f[:len(sf)]])]
    assert np.allclose(before,after,atol=.00002,rtol=0),meta['mesh']
    topology={}
    for original,updated in zip(sf,f):
        for oq,nq in zip(original,updated):
            assert topology.setdefault(oq[0],nq[0])==nq[0]
    assert len(set(topology.values()))==len(topology),('welded original vertices',meta['mesh'])
    assert np.isfinite(a).all() and np.isfinite(np.array(u)).all()
    assert all(len(face)==3 for face in f)
    assert all(0<=q[0]<len(v) and 0<=q[1]<len(u) and -1<=q[2]<len(n) for face in f for q in face)
    assert all(-.0001<=x<=1.0001 for uv in u for x in uv)
    expanded=len({tuple(q) for face in f for q in face});maxexpanded=max(maxexpanded,expanded);maxpos=max(maxpos,len(v))
    assert expanded<25000,(meta['mesh'],expanded)
    assert np.all(a.min(axis=0)>=sa.min(axis=0)-.007) and np.all(a.max(axis=0)<=sa.max(axis=0)+.007),meta['mesh']
    new_triangles+=len(f)-len(sf)
    if i%100==0:print('Validated meshes',i,'/',len(meshmeta),flush=True)
textures=list(ASSETS.glob('*.png'))+list((ASSETS/'inherited-textures').glob('*'))
for p in textures:
    with Image.open(p) as im:im.load();assert im.mode in ('RGB','RGBA'),(p,im.mode)
result={'locations':24,'mission_setups':48,'building_instances':sum(r['buildings'] for r in audit),'building_states':sum(r['states'] for r in audit),'unique_new_meshes':len(meshmeta),'new_wall_panels_across_states':sum(r['new_panels'] for r in audit),'new_triangles_across_unique_meshes':new_triangles,'max_expanded_vertices':maxexpanded,'max_position_vertices':maxpos,'decoded_texture_files':len(textures),'typed_colors_checked':typed_colors,'nested_objects_checked':objects,'asset_url_fields_checked':asset_refs,'changed_fields':dict(changes),'original_geometry_preserved':True,'colliders_transforms_states_scripts_preserved':True,'live_tts_import_tested':False,'fresh_cache_tested':False,'multiplayer_tested':False,'steam_publication_observed':False}
(ROOT/'output/validation.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
