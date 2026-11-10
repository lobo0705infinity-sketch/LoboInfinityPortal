import bpy,pathlib,json,math
from mathutils import Vector
R=pathlib.Path(__file__).resolve().parents[1]
names={'Terminal':('passenger-terminal',-13,13),'Hangar':('maintenance-hangar',-13,-12.5),'Transit House':('transit-house',14,-12.5)}
def category(o):
 p=o.get('part','');n=o.name
 if p in ['Roof and service plant','Hotel roof']:return 'upper-roof'
 if p=='Barrel vault roof':return 'roof'
 if p in ['Upper operations','Guest rooms']:return 'upper'
 if p=='Upper gallery':return 'roof'
 if p=='Stairs and gallery' and not n.startswith(('Stair','Tread')):return 'roof'
 return 'ground'
def write(name,vs,faces,uvs,norms):
 # Preserve explicit normals while indexing repeated UVs and normals.
 ut={};nt={};uf=[];nf=[]
 for uv in uvs:
  for x in uv:ut.setdefault(tuple(round(v,6) for v in x),len(ut)+1)
 for ns in norms:
  for x in ns:nt.setdefault(tuple(round(v,6) for v in x),len(nt)+1)
 with open(R/'Assets'/name,'w')as f:
  for x,y,z in vs:f.write('v %.6g %.6g %.6g\n'%(x,z,-y))
  for u,v in ut:f.write('vt %.6g %.6g\n'%(u,v))
  for x,y,z in nt:f.write('vn %.6g %.6g %.6g\n'%(x,z,-y))
  for face,uv,ns in zip(faces,uvs,norms):f.write('f '+' '.join(f'{v+1}/{ut[tuple(round(a,6) for a in t)]}/{nt[tuple(round(a,6) for a in n)]}' for v,t,n in zip(face,uv,ns))+'\n')
manifest=[]
for name,(key,x,y) in names.items():
 c=bpy.data.collections[name];c.hide_viewport=False
bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get()
for name,(key,x,y) in names.items():
 groups={};physics={}
 for o in bpy.data.collections[name].objects:
  if o.type not in ['MESH','FONT','CURVE']:continue
  cat=category(o);m=o.data.materials[0];tex=m.get('texture','meridian-r2-materials.jpg');cell=m.get('atlas_cell',0)
  ev=o.evaluated_get(deps);me=ev.to_mesh();me.calc_loop_triangles();vs=[tuple(o.matrix_world@v.co)for v in me.vertices];uv=me.uv_layers.active if o.type!='FONT' else None;nm=o.matrix_world.to_3x3().inverted().transposed()
  fs=[];us=[];ns=[]
  for t in me.loop_triangles:
   ids=list(t.vertices)
   if (Vector(vs[ids[1]])-Vector(vs[ids[0]])).cross(Vector(vs[ids[2]])-Vector(vs[ids[0]])).length<1e-10:continue
   ts=[]
   for li in t.loops:
    u,v=tuple(uv.data[li].uv)if uv else (cell%4*.25+.12,1-(cell//4)*.25-.12)
    if tex=='meridian-r2-materials.jpg':
     l=cell%4*.25;b=1-(cell//4+1)*.25;u=max(l+.001,min(l+.249,u));v=max(b+.001,min(b+.249,v))
    ts.append((u,v))
   fs.append(ids);us.append(ts);ns.append([tuple((nm@me.corner_normals[li].vector).normalized()) for li in t.loops])
  groups.setdefault((cat,tex),[]).append((vs,fs,us,ns));ev.to_mesh_clear()
  # Physical support uses the original solid geometry before cosmetic bevels.
  if o.type=='MESH' and min(o.dimensions)>.035 and max(o.dimensions)>.20:
   me=o.data;me.calc_loop_triangles();pv=[tuple(o.matrix_world@v.co)for v in me.vertices];pf=[list(t.vertices)for t in me.loop_triangles]
   if len(pf)<=240:physics.setdefault(cat,[]).append((pv,pf))
 for (cat,tex),pieces in groups.items():
  batch=[];count=0;index=0
  def emit(batch,index):
   vv=[];ff=[];uu=[];nn=[]
   for vs,fs,us,ns in batch:
    off=len(vv);vv+=vs;ff.extend([[v+off for v in f]for f in fs]);uu+=us;nn+=ns
   file=f'{key}-{cat}-{index}-{tex[:4]}.obj';write(file,vv,ff,uu,nn);manifest.append(dict(file=file,texture=tex,category=cat,building=key,x=x,y=y,physics=False))
  for p in pieces:
   if count+sum(len(f) for f in p[1])>18000 and batch:emit(batch,index);index+=1;batch=[];count=0
   batch.append(p);count+=sum(len(f) for f in p[1])
  if batch:emit(batch,index)
 for cat,pieces in physics.items():
  batch=[];count=0;index=0
  def physical(batch,index):
   vv=[];ff=[]
   for vs,fs in batch:
    off=len(vv);vv+=vs;ff.extend([[v+off for v in f]for f in fs])
   file=f'{key}-{cat}-physics-{index}.obj';write(file,vv,ff,[[(.1,.1)]*3 for f in ff],[[(0,0,1)]*3 for f in ff]);manifest.append(dict(file=file,texture='meridian-r2-materials.jpg',category=cat,building=key,x=x,y=y,physics=True,triangles=len(ff)))
  for p in pieces:
   if count+len(p[1])>240 and batch:physical(batch,index);index+=1;batch=[];count=0
   batch.append(p);count+=len(p[1])
  if batch:physical(batch,index)
(R/'Source/replacements.json').write_text(json.dumps(manifest,indent=2));print('Exported',len(manifest),'visual/collision components')
