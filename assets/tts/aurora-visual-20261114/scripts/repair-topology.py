import importlib.util,pathlib,json,numpy as np
sp=importlib.util.spec_from_file_location('b','aurora-source/scripts/aurora-visual-refresh-20261114.py');m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
out=pathlib.Path('aurora-source/assets/tts/aurora-visual-20261114');meta=json.load(open(out/'mesh-validation.json'));sources={r['url']:r['path'] for r in json.load(open('inspection/source-assets.json'))};layouts=json.load(open('inspection/atlas-layout.json'));maxtuples=(0,'')
for i,r in enumerate(meta):
 slug=next(s for s in m.SOURCE_LAYOUTS if r['mesh'].startswith(s+'-'))
 if slug in ('tidal','coastal-access'):
  m.LEFT_LAYOUT=m.SOURCE_LAYOUTS[slug];lay=layouts[slug];m.ATLAS_ROWS=np.array(lay['rows'])/lay['height'];sign=next((p['slot']-16 for p in r['panels'] if p['kind']=='exterior'),0);role=next((p['slot']-20 for p in r['panels'] if p['kind']=='interior'),0)
  s=m.remesh(sources[r['source_mesh']],sources[r['source_texture']],out/r['mesh'],role,sign);r.update(s)
 else:
  sv,su,sn,sf=m.read_obj(sources[r['source_mesh']]);v,u,n,f=m.read_obj(out/r['mesh']);newv=[];vmap={};nf=[]
  for j,face in enumerate(f):
   ff=[]
   for k,(vi,ui,ni) in enumerate(face):
    key=('source',sf[j][k][0]) if j<len(sf) else ('panel',vi)
    if key not in vmap:vmap[key]=len(newv);newv.append(sv[key[1]] if key[0]=='source' else v[vi])
    ff.append((vmap[key],ui,ni))
   nf.append(ff)
  lines=['# Aurora VII 20261114: preserve original vertex topology; refreshed materials and artwork']
  for label,values in [('v',newv),('vt',u),('vn',n)]:lines.extend(label+' '+' '.join(f'{x:.9g}' for x in value) for value in values)
  for face in nf:lines.append('f '+' '.join(f'{vi+1}/{ui+1}/{ni+1}' if ni>=0 else f'{vi+1}/{ui+1}' for vi,ui,ni in face))
  (out/r['mesh']).write_text('\n'.join(lines)+'\n');r['vertices']=len(newv)
  v,u,n,f=newv,u,n,nf
 v,u,n,f=m.read_obj(out/r['mesh']);expanded=len({tuple(q) for face in f for q in face});maxtuples=max(maxtuples,(expanded,r['mesh']));assert expanded<25000,(expanded,r['mesh'])
 if i%100==0:print(i,len(meta),'max',maxtuples,flush=True)
(out/'mesh-validation.json').write_text(json.dumps(meta,indent=2));print('COMPLETE',maxtuples)
