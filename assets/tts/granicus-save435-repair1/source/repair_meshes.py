"""Repair normals and atlas bindings while retaining original geometry and artwork."""
from pathlib import Path
import collections,hashlib,json,numpy as np
R=Path(__file__).resolve().parent;O=R/'repaired-assets';O.mkdir(exist_ok=True)
refs=json.loads((R/'instance-manifest.json').read_text()); report=[]
atlas={x['original_url']:x for x in json.loads((R/'atlas-repair-manifest.json').read_text())}
for old in O.glob('normal-repair-*.obj'):old.unlink()
for url in sorted(set(x['mesh'] for x in refs)):
 src=R/'original-assets'/url.rsplit('/',1)[1]
 verts=[];uvs=[];faces=[];vs=[];ts=[]
 for line in src.read_text().splitlines():
  a=line.split()
  if not a:continue
  if a[0]=='v':verts.append(tuple(map(float,a[1:4])));vs.append(line)
  elif a[0]=='vt':uvs.append(tuple(map(float,a[1:3])));ts.append(line)
  elif a[0]=='f':
   f=[tuple(int(q)-1 for q in t.split('/')[:2]) for t in a[1:]]
   assert len(f)==3
   faces.append(f)
 v=np.array(verts);fs=np.array([[t[0] for t in f] for f in faces])
 n=np.cross(v[fs[:,1]]-v[fs[:,0]],v[fs[:,2]]-v[fs[:,0]])
 lens=np.linalg.norm(n,axis=1);assert min(lens)>1e-10
 sums=np.zeros_like(v)
 for j in range(3):np.add.at(sums,fs[:,j],n)
 zero=int(sum(np.linalg.norm(sums,axis=1)<1e-8))
 related=[x for x in refs if x['mesh']==url]
 needs_atlas=related[0]['texture'] in atlas
 assert all((x['texture'] in atlas)==needs_atlas for x in related)
 if not zero and not needs_atlas:continue
 original_ts=ts.copy()
 if needs_atlas:
  # Figure UVs already address the original 2560-wide sheet. Preserve them.
  # The current base, label and rim pixels remain at their current x positions.
  for i,(u,tv) in enumerate(uvs):
   if tv<=1-1100/2048:ts[i]=f'vt {u*1536/2560:.10f} {tv:.10f}'
 norms=n/lens[:,None]
 # Give opposing surfaces separate vertex indices and explicit normals.
 # Keep source decimal coordinates/UV strings verbatim; do not resample artwork.
 normal_ids={};normal_lines=[];vertex_ids={};vertex_lines=[];newfaces=[]
 for f,normal in zip(faces,norms):
  nk=tuple(round(float(x),8) for x in normal)
  if nk not in normal_ids:
   normal_ids[nk]=len(normal_lines)+1
   normal_lines.append('vn '+' '.join(f'{x:.8f}' for x in nk))
  ni=normal_ids[nk];indices=[]
  for vi,ti in f:
   key=(vi,ni)
   if key not in vertex_ids:
    vertex_ids[key]=len(vertex_lines)+1;vertex_lines.append(vs[vi])
   indices.append(f'{vertex_ids[key]}/{ti+1}/{ni}')
  newfaces.append('f '+' '.join(indices))
 data='\n'.join(['# Granicus save 435: original geometry/artwork, repaired atlas mapping and independent surface normals.','s off',*vertex_lines,*ts,*normal_lines,*newfaces])+'\n'
 sha=hashlib.sha256(data.encode()).hexdigest();name='normal-repair-'+sha[:20]+'.obj';(O/name).write_text(data)
 # Independently reconstruct every output face corner and compare exact source text.
 outvs=[];outts=[];outns=[];outfs=[]
 for l in data.splitlines():
  a=l.split()
  if a[0]=='v':outvs.append(l)
  elif a[0]=='vt':outts.append(l)
  elif a[0]=='vn':outns.append(tuple(map(float,a[1:4])))
  elif a[0]=='f':outfs.append([tuple(int(q)-1 for q in t.split('/')) for t in a[1:]])
 assert len(faces)==len(outfs)
 for srcf,newf in zip(faces,outfs):
  for (vi,ti),(nvi,nti,nni) in zip(srcf,newf):
   assert vs[vi]==outvs[nvi] and ts[ti]==outts[nti]
 for norm in outns:assert abs(np.linalg.norm(norm)-1)<1e-7
 assert len(vertex_lines)<65000
 report.append({'original_url':url,'repaired_file':name,'sha256':sha,'triangles':len(faces),'source_vertices':len(v),'repaired_vertices':len(vertex_lines),'source_zero_accumulated_normals':zero,'normals':len(normal_lines),'every_triangle_position_unchanged':True,'figure_uvs_unchanged':all(a==b for a,b,uv in zip(original_ts,ts,uvs) if uv[1]>1-1100/2048),'atlas_restored':needs_atlas,'nonfigure_pixel_locations_preserved':True})
(R/'mesh-repair-manifest.json').write_text(json.dumps(report,indent=2))
print(json.dumps({'models':len(report),'models_with_cancelled_normals':sum(x['source_zero_accumulated_normals']>0 for x in report),'zero_normals_before':sum(x['source_zero_accumulated_normals'] for x in report),'max_vertices':max(x['repaired_vertices'] for x in report),'bytes':sum(x.stat().st_size for x in O.glob('*.obj'))},indent=2))
