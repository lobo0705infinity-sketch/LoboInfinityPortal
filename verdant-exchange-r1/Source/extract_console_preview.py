"""Extract the approved native console for offline previews; never a TTS OBJ replacement."""
from pathlib import Path
import json, hashlib, urllib.request
import UnityPy, trimesh, numpy as np
from scipy.spatial.transform import Rotation
ROOT=Path(__file__).resolve().parent
entries=json.loads((ROOT/'native-objective-assets.json').read_text())
for entry in entries:
    path=ROOT/entry['filename']
    if not path.exists():path.write_bytes(urllib.request.urlopen(entry['url'],timeout=45).read())
    assert hashlib.sha256(path.read_bytes()).hexdigest()==entry['sha256']
env=UnityPy.load(str(ROOT/'console-reference.unity3d'))
transforms=[o.read()for o in env.objects if o.type.name=='Transform']
parent=next(t for t in transforms if not t.m_Father.path_id)
child=next(t for t in transforms if t.m_Father.path_id)
for obj in env.objects:
    if obj.type.name=='Texture2D':obj.read().image.save(ROOT/'console-preview.png')
    elif obj.type.name=='Mesh':(ROOT/'console-preview.obj').write_text(obj.read().export())
mesh=trimesh.load(ROOT/'console-preview.obj',force='mesh',process=False)
mesh.vertices[:,0]*=-1;mesh.faces=mesh.faces[:,::-1]
q=child.m_LocalRotation;s=child.m_LocalScale;p=child.m_LocalPosition
mesh.vertices=(mesh.vertices*np.array([s.x,s.y,s.z]))@Rotation.from_quat([q.x,q.y,q.z,q.w]).as_matrix().T+np.array([p.x,p.y,p.z])
scale=parent.m_LocalScale;mesh.vertices*=np.array([scale.x,scale.y,scale.z])
# Store geometry and UVs without an external material dependency.
text=['# Approved console, native prefab transforms applied, Y-up']
text += ['v '+' '.join(map(str,v))for v in mesh.vertices]
text += ['vt '+' '.join(map(str,uv))for uv in mesh.visual.uv]
text += ['f '+' '.join(f'{i+1}/{i+1}'for i in face)for face in mesh.faces]
(ROOT/'console-preview-grounded.obj').write_text('\n'.join(text)+'\n')
print('Approved console preview extracted; original assetbundle remains in TTS bag.')
