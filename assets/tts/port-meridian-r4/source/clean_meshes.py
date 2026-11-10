import pathlib,json,numpy as np
R=pathlib.Path(__file__).resolve().parents[1];m=json.loads((R/'Source/new-models.json').read_text());report=[]
for e in m:
 p=R/'Assets'/e['file'];lines=p.read_text().splitlines();vertices=[];other=[];faces=[]
 for line in lines:
  b=line.split()
  if b and b[0]=='v':vertices.append(list(map(float,b[1:])))
  if b and b[0]=='f':faces.append(b[1:])
  else:other.append(line)
 v=np.array(vertices);valid=[];removed=0
 for f in faces:
  ids=[int(t.split('/')[0])-1 for t in f];a,b,c=v[ids]
  if np.linalg.norm(np.cross(b-a,c-a))<1e-10:removed+=1;continue
  valid.append(f)
 flipped=False
 if e['physics']:
  idx=np.array([[int(t.split('/')[0])-1 for t in f]for f in valid]);vol=np.einsum('ij,ij->i',v[idx[:,0]],np.cross(v[idx[:,1]],v[idx[:,2]])).sum()/6
  if vol<0:valid=[list(reversed(f))for f in valid];flipped=True
 p.write_text('\n'.join(other+['f '+' '.join(f)for f in valid])+'\n');e['triangles']=len(valid)
 if not e['physics']:e['face_corners']=len(valid)*3
 report.append(dict(file=e['file'],degenerate_faces_removed=removed,collider_winding_corrected=flipped))
(R/'Source/new-models.json').write_text(json.dumps(m,indent=2));(R/'Source/mesh-cleanup.json').write_text(json.dumps(report,indent=2));print('Cleaned',len(m),'meshes; removed',sum(x['degenerate_faces_removed']for x in report),'zero-area faces')
