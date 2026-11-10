import pathlib,json,collections,numpy as np
R=pathlib.Path(__file__).resolve().parents[1];OLD=R.parent/'repo/assets/tts/port-meridian-r2';A=R/'Assets';mapping={};audit=[]
def parse(p):
 arrays={'v':[],'vt':[],'vn':[]};faces=[]
 for l in p.read_text().splitlines():
  b=l.split()
  if not b:continue
  if b[0]in arrays:arrays[b[0]].append(b[1:])
  elif b[0]=='f':faces.append(b[1:])
 return arrays,faces
def repair(arrays,faces,close_skin=False,remove_skin=False):
 v=np.array(arrays['v'],dtype=float);parents=list(range(len(v)))
 def root(i):
  while parents[i]!=i:parents[i]=parents[parents[i]];i=parents[i]
  return i
 fi=[[int(t.split('/')[0])-1 for t in f]for f in faces]
 for f in fi:
  a=root(f[0])
  for i in f[1:]:parents[root(i)]=a
 groups=collections.defaultdict(list)
 for i,f in enumerate(fi):groups[root(f[0])].append(i)
 invert=set();skin=set();details=[]
 for ids in groups.values():
  f=np.array([fi[i]for i in ids]);t=v[f];norm=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);volume=np.einsum('ij,ij->i',t[:,0],np.cross(t[:,1],t[:,2])).sum()/6
  edges=collections.Counter(tuple(sorted(e))for f0 in f for e in [(f0[0],f0[1]),(f0[1],f0[2]),(f0[2],f0[0])]);closed=all(n==2 for n in edges.values());span=t.reshape(-1,3).max(axis=0)-t.reshape(-1,3).min(axis=0)
  openroof=not closed and span[0]>10 and span[2]>7 and t[:,:,1].min()>3.5 and norm[:,1].sum()<-.01
  if openroof:skin.update(ids)
  if (closed and volume< -1e-7)or openroof:
   invert.update(ids);details.append(dict(faces=len(ids),old_signed_volume=float(volume),closed=closed,open_inward_roof=bool(openroof)))
 normals={tuple(n):i+1 for i,n in enumerate(arrays['vn'])}
 def normal(n):
  key=tuple(format(float(x),'.8g')for x in n)
  if key not in normals:normals[key]=len(arrays['vn'])+1;arrays['vn'].append(list(key))
  return str(normals[key])
 fixed=[]
 for i,face in enumerate(faces):
  f=[]
  for token in face:
   bits=token.split('/')
   if i in invert and len(bits)>2 and bits[2]:bits[2]=normal([-float(x)for x in arrays['vn'][int(bits[2])-1]])
   f.append('/'.join(bits))
  fixed.append(list(reversed(f))if i in invert else f)
 shell=[]
 if close_skin:
  assert len(skin)==48,'Unexpected roof-sheet topology'
  outer=[fixed[i]for i in sorted(skin)];shell.extend(outer);vertexmap={};edgecount=collections.Counter();edges={}
  for f in outer:
   for token in f:
    vi=int(token.split('/')[0])
    if vi not in vertexmap:
     point=list(arrays['v'][vi-1]);point[1]=format(float(point[1])-.08,'.8g');vertexmap[vi]=len(arrays['v'])+1;arrays['v'].append(point)
   for a,b in zip(f,f[1:]+f[:1]):
    key=tuple(sorted((int(a.split('/')[0]),int(b.split('/')[0]))));edgecount[key]+=1;edges[key]=(a,b)
   inner=[]
   for token in reversed(f):
    bits=token.split('/');bits[0]=str(vertexmap[int(bits[0])]);bits[2]=normal([-float(x)for x in arrays['vn'][int(bits[2])-1]]);inner.append('/'.join(bits))
   shell.append(inner);fixed.append(inner)
  for key,count in edgecount.items():
   if count!=1:continue
   a,b=edges[key];aa=a.split('/');bb=b.split('/');va=int(aa[0]);vb=int(bb[0]);quad=[vb,va,vertexmap[va],vertexmap[vb]];p=[np.array(arrays['v'][i-1],dtype=float)for i in quad];n=np.cross(p[1]-p[0],p[2]-p[0]);n/=np.linalg.norm(n);ni=normal(n)
   tokens=[f'{quad[0]}/{bb[1]}/{ni}',f'{quad[1]}/{aa[1]}/{ni}',f'{quad[2]}/{aa[1]}/{ni}',f'{quad[3]}/{bb[1]}/{ni}']
   for tri in [[tokens[0],tokens[1],tokens[2]],[tokens[0],tokens[2],tokens[3]]]:fixed.append(tri);shell.append(tri)
 if remove_skin:fixed=[f for i,f in enumerate(fixed)if i not in skin]
 return fixed,details,shell
def write(name,arrays,faces):
 maps={k:{}for k in arrays}
 for f in faces:
  for t in f:
   for key,i in zip(('v','vt','vn'),t.split('/')):
    if i:maps[key].setdefault(int(i),len(maps[key])+1)
 lines=['# Port Meridian R4: outward roof shell; original exterior positions and UVs retained.']
 for key in ('v','vt','vn'):lines.extend(key+' '+' '.join(arrays[key][i-1])for i in maps[key])
 for f in faces:lines.append('f '+' '.join('/'.join(str(maps[key][int(i)])if i else''for key,i in zip(('v','vt','vn'),t.split('/')))for t in f))
 (A/name).write_text('\n'.join(lines)+'\n')
arrays,faces=parse(OLD/'maintenance-hangar-roof-0-meri.obj');fixed,details,shell=repair(arrays,faces,close_skin=True)
for i,start in enumerate(range(0,len(fixed),6000)):
 name=f'maintenance-hangar-roof-outward-{i}.obj';write(name,arrays,fixed[start:start+6000]);mapping[f'maintenance-hangar-roof-0-meri-safe-{i}.obj']=name
assert len(shell)<=240
write('maintenance-hangar-roof-shell-collider.obj',arrays,shell)
audit.append(dict(source='maintenance-hangar-roof-0-meri.obj',reversed_components=details,roof_shell_triangles=len(shell),roof_thickness_inches=.08))
for p in sorted(OLD.glob('maintenance-hangar-roof-physics-*.obj')):
 arrays,faces=parse(p);fixed,details,_=repair(arrays,faces,remove_skin=True);name=p.stem+'-outward.obj';write(name,arrays,fixed);mapping[p.name]=name;audit.append(dict(source=p.name,reversed_components=details,triangles=len(fixed)))
(R/'Source/outward-fixes.json').write_text(json.dumps(mapping,indent=2));(R/'Source/winding-audit.json').write_text(json.dumps(audit,indent=2));print(json.dumps(audit,indent=2))
