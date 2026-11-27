"""Use Assimp's native Wavefront importer and enforce the TTS per-object limit."""
import ctypes as C
from collections import Counter
from pathlib import Path
import hashlib, json
import numpy as np

base=Path(__file__).resolve().parents[1]
class Mesh(C.Structure):
    _fields_=[('primitives',C.c_uint),('vertices',C.c_uint),('faces',C.c_uint)]
class Scene(C.Structure):
    _fields_=[('flags',C.c_uint),('root',C.c_void_p),('num_meshes',C.c_uint),
              ('meshes',C.POINTER(C.POINTER(Mesh)))]
assimp=C.CDLL('libassimp.so.5')
assimp.aiImportFile.argtypes=[C.c_char_p,C.c_uint]
assimp.aiImportFile.restype=C.POINTER(Scene)
assimp.aiReleaseImport.argtypes=[C.POINTER(Scene)]
assimp.aiGetErrorString.restype=C.c_char_p

def import_obj(path,join=True):
    # Validate structure, triangulate, optionally share identical UV/normal/position tuples.
    result=assimp.aiImportFile(str(path).encode(),0x400|0x8|(0x2 if join else 0))
    assert result, (path.name,assimp.aiGetErrorString().decode())
    try:
        scene=result.contents
        assert scene.num_meshes==1
        m=scene.meshes[0].contents
        assert m.primitives & 4
        return m.vertices,m.faces
    finally:
        assimp.aiReleaseImport(result)

def inspect(path):
    vertices=[];normals=[];tex=[];faces=[]
    for line in path.read_text('ascii').splitlines():
        v=line.split()
        if not v:continue
        if v[0]=='v':vertices.append([float(x) for x in v[1:]])
        elif v[0]=='vn':normals.append([float(x) for x in v[1:]])
        elif v[0]=='vt':tex.append([float(x) for x in v[1:]])
        elif v[0]=='f':
            assert len(v)==4,path.name
            faces.append(v[1:])
    split={q for tri in faces for q in tri}
    assert np.isfinite(vertices).all() and np.isfinite(normals).all() and np.isfinite(tex).all(),path
    for q in split:
        n=[int(qi) for qi in q.split('/')]
        assert len(n)==(1 if path.name.endswith('-col.obj') else 3)
        assert all(0<i<=size for i,size in zip(n,(len(vertices),len(tex),len(normals)))),(path.name,q)
    vi,nf=import_obj(path)
    expanded,exp_faces=import_obj(path,False)
    assert exp_faces==nf==len(faces)
    assert max(len(split),vi,expanded)<25000,(path.name,len(split),vi,expanded)
    if path.name.startswith('passenger-stair-') and path.name.endswith('-col.obj'):
        assert nf<255
        edges=Counter();directions=Counter()
        verts=np.array(vertices)
        for f in faces:
            t=[int(k)-1 for k in f];a,b,c=verts[t]
            assert np.linalg.norm(np.cross(b-a,c-a))>1e-8
            for i,j in zip(t,t[1:]+t[:1]):
                edges[tuple(sorted((i,j)))]+=1;directions[(i,j)]+=1
        assert set(edges.values())=={2} and all(directions[(i,j)]==directions[(j,i)]==1 for i,j in edges)
        assert len(verts)-len(edges)+nf==2
    return dict(raw_positions=len(vertices),position_uv_normal=len(split),imported_vertices=vi,fully_expanded_vertices=expanded,triangles=nf)

scene=json.loads((base/'build/scene.json').read_text())
files={s[k] for s in scene['models'].values() for k in ('mesh','col')}|{'proxy-point-col.obj'}
report={n:inspect(base/'assets'/n) for n in sorted(files)}
old=base.parent/'bellwether-r2/assets/station-stairways.obj'
if old.exists():
    old_n,old_tri=import_obj(old)
    assert old_n>25000,old_n
    print('R2 stair import',old_n,'vertices,',old_tri,'triangles')
print('Native OBJ import passed for',len(report),'mesh and collider files')
print('Worst uncached vertex stream',max((v['fully_expanded_vertices'],n) for n,v in report.items()))
for n,v in report.items():
    if n.startswith('passenger-stair'):print(n,v)
(base/'qa/native-import.json').write_text(json.dumps(report,indent=2))
