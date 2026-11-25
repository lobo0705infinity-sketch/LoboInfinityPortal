"""Extract the installed collection's exact dated console geometry for offline previews."""
from project import *
from scipy.spatial.transform import Rotation
from UnityPy.helpers.MeshHelper import MeshHandler
import UnityPy
env=UnityPy.load(str(BASE/'standard-console.unity3d'));obs=[o.read()for o in env.objects if o.type.name in ['Mesh','Transform','Texture2D']];tr=next(x for x in obs if hasattr(x,'m_LocalScale') and x.m_LocalScale.x>1)
vec=lambda v:[v.x,v.y,v.z]
mesh=next(x for x in obs if getattr(x,'m_VertexData',None));h=MeshHandler(mesh);h.process();q=tr.m_LocalRotation
rot=Rotation.from_quat([q.x,q.y,q.z,q.w]);vs=(rot.apply(np.array(h.m_Vertices)*vec(tr.m_LocalScale))+vec(tr.m_LocalPosition))*.4
lines=['# Preview only. Official public Steam bundle is used by the save.']+['v '+row((-x,y,z))for x,y,z in vs]+['vt '+row(v)for v in h.m_UV0]
# Unity mesh triangles are clockwise; Unity -> OBJ negates X.
for face in h.get_triangles()[0]:lines.append('f '+' '.join(f'{i+1}/{i+1}'for i in face))
(WORK/'console-render.obj').write_text('\n'.join(lines)+'\n')
for x in obs:
 if hasattr(x,'m_TextureFormat'):x.image.convert('RGB').save(WORK/'console-diffuse.jpg',quality=95)
