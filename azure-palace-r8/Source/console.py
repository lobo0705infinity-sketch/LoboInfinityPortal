"""Read the original Micro Art Studio bundle for the native base measurements and review render."""
from pathlib import Path
import hashlib,json,urllib.request
import numpy as np
from scipy.spatial.transform import Rotation
import UnityPy
from UnityPy.helpers.MeshHelper import MeshHandler
ROOT=Path(__file__).resolve().parents[1];cache=ROOT/'Review/cache'
def vec(v):return [v.x,v.y,v.z]
def run():
    file=cache/'approved-console.unity3d'
    expected='daf1e5f864a43c1ae1c7d4657fa1cacc28c78f9f'
    url='https://steamusercontent-a.akamaihd.net/ugc/1331327576943612361/'+expected.upper()+'/'
    cache.mkdir(parents=True,exist_ok=True)
    if not file.exists():
        with urllib.request.urlopen(url,timeout=45) as response:data=response.read()
        assert hashlib.sha1(data).hexdigest()==expected
        file.write_bytes(data)
    (cache/'asset-source.json').write_text(json.dumps(dict(url=url,sha1=expected,bytes=file.stat().st_size)))
    assert hashlib.sha1(file.read_bytes()).hexdigest()==expected
    env=UnityPy.load(str(file));parts={o.type.name:o for o in env.objects}
    poses={o.path_id:o.read()for o in env.objects if o.type.name=='Transform'}
    child=next(o for o in poses.values()if o.m_Father.path_id);root=poses[child.m_Father.path_id]
    def matrix(tf):
        q=tf.m_LocalRotation;a=np.eye(4);a[:3,:3]=Rotation.from_quat([q.x,q.y,q.z,q.w]).as_matrix()@np.diag(vec(tf.m_LocalScale));a[:3,3]=vec(tf.m_LocalPosition);return a
    xf=matrix(root)@matrix(child)
    mesh=parts['Mesh'].read();handler=MeshHandler(mesh);handler.process()
    p=np.asarray(handler.m_Vertices)@xf[:3,:3].T+xf[:3,3]
    f=handler.get_triangles()[0];uv=np.asarray(handler.m_UV0)
    assert len(f)>10 and len(uv)==len(p)
    bottom=p[:,1].min();ring=p[abs(p[:,1]-bottom)<.029]
    from scipy.optimize import least_squares
    from scipy.spatial import ConvexHull
    edge=ring[ConvexHull(ring[:,[0,2]]).vertices][:,[0,2]]
    fit=least_squares(lambda a:np.linalg.norm(edge-a[:2],axis=1)-a[2],[edge[:,0].mean(),edge[:,1].mean(),.78])
    xc,zc,r=fit.x
    radius_bounds=[np.linalg.norm(edge-[xc,zc],axis=1).min(),np.linalg.norm(edge-[xc,zc],axis=1).max()]
    data=dict(bottom=float(bottom),center=[xc,zc],radius=r,radius_bounds=radius_bounds,height=np.ptp(p[:,1]),triangles=len(f))
    print(data,flush=True)
    (cache/'console-bounds.json').write_text(json.dumps(data))
    # Right-handed coordinates for the review renderer only. The save uses the original Steam bundle.
    lines=['# Native console, extracted locally for visual review']
    lines+=['v %.7f %.7f %.7f'%(-x,y,z)for x,y,z in p]
    lines+=['vt %.7f %.7f'%tuple(q[:2]) for q in uv]
    lines+=['f '+' '.join(f'{j+1}/{j+1}'for j in fc) for fc in f]
    (cache/'native-console.obj').write_text('\n'.join(lines)+'\n')
    parts['Texture2D'].read().image.convert('RGB').save(cache/'native-console.jpg',quality=94)
if __name__=='__main__':run()
