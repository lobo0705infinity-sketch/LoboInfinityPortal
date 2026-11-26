"""Edit authored, connected mesh components and combine rooftop gardens with their supporting state."""
from pathlib import Path
from collections import defaultdict
import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from scipy.spatial.transform import Rotation
from scene import BASE, bag, deployed, local
OUT=BASE/'assets'
MIRROR=np.diag([-1.,1.,1.])

def pose(item):
    t=item['Transform']
    rot=Rotation.from_euler('YXZ',[t['rot'+k] for k in 'YXZ'],degrees=True).as_matrix()
    return rot@MIRROR@np.diag([t['scale'+k] for k in 'XYZ']),np.array([t['pos'+k] for k in 'XYZ'])

class Obj:
    def __init__(self,file):
        self.v=[];self.uv=[];self.norm=[];self.faces=[]
        self.file=file;group=''
        for line in file.read_text().splitlines():
            terms=line.split()
            if not terms:continue
            tok=terms[0]
            if tok in ('v','vt','vn'):
                field={'v':self.v,'vt':self.uv,'vn':self.norm}[tok]
                field.append(tuple(map(float,terms[1:])))
            elif tok in ('g','o'):group=' '.join(terms[1:])
            elif tok=='f':
                indices=[tuple(int(v)-1 if v else None for v in term.split('/')) for term in terms[1:]]
                self.faces.append((group,indices))
        self.v=np.asarray(self.v);self.norm=np.asarray(self.norm)
    def components(self):
        ends=[(f[i-1][0],v[0])for _,f in self.faces for i,v in enumerate(f)]
        a,b=np.asarray(ends).T;g=coo_matrix((np.ones(len(a)),(a,b)),shape=(len(self.v),len(self.v)))
        n,lab=connected_components(g,directed=False)
        return [np.nonzero(lab==i)[0] for i in range(n)]
    def omit_hidden_faces(self):
        # Architectural solids meet at the undersides of cabinets, trim and steps.
        # A triangle can disappear only when its entire outward side lies inside another cuboid.
        parts=self.components();boxes=[]
        for k,vs in enumerate(parts):
            p=self.v[vs];low=p.min(0);high=p.max(0)
            if len(vs)==8 and np.all(high-low>.0001) and np.all((abs(p-low)<.000001)|(abs(p-high)<.000001)):
                boxes.append((k,low,high))
        if not boxes:return
        ids=np.array([k for k,_,_ in boxes]);mins=np.array([a for _,a,_ in boxes]);maxs=np.array([b for _,_,b in boxes])
        own=np.zeros(len(self.v),dtype=int)
        for i,vs in enumerate(parts):own[vs]=i
        keep=[]
        for g,f in self.faces:
            vs=[v[0]for v in f];t=self.v[vs]
            n=np.cross(t[1]-t[0],t[2]-t[0]);length=np.linalg.norm(n)
            if length<1.e-10:continue
            test=t+.00025*n/length
            lo=test.min(0);hi=test.max(0);center=test.mean(0)
            buried=np.any((ids!=own[vs[0]])&np.all(lo>=mins-.000002,axis=1)&np.all(hi<=maxs+.000002,axis=1)&np.all(center>mins+.00001,axis=1)&np.all(center<maxs-.00001,axis=1))
            if not buried:keep.append((g,f))
        self.faces=keep
    def append(self,extra,linear,offset):
        counts=(len(self.v),len(self.uv),len(self.norm))
        self.v=np.vstack([self.v,extra.v@linear.T+offset]);self.uv.extend(extra.uv)
        if len(extra.norm):
            new=extra.norm@np.linalg.inv(linear);new/=np.linalg.norm(new,axis=1)[:,None]
            self.norm=np.vstack([self.norm.reshape(-1,3),new])
        for group,face in extra.faces:
            face=[tuple(ix+counts[i] if ix is not None else None for i,ix in enumerate(vertex)) for vertex in face]
            self.faces.append(('roof-planter'+('-'+group if group else ''),face))
    def write(self,path):
        # Group/part boundaries are retained for compound colliders. Compact away removed ladder vertices.
        used=sorted({v[0] for _,f in self.faces for v in f})
        remap={v:j+1 for j,v in enumerate(used)}
        line=['# Cairnfall Sanctuary | '+path.stem]
        def fmt(array):return ' '.join('{:.7f}'.format(t).rstrip('0').rstrip('.') or '0' for t in array)
        for key,values in [('v',self.v[used]),('vt',self.uv),('vn',self.norm)]:
            line.extend(key+' '+fmt(v) for v in values)
        grp=None
        for group,face in self.faces:
            if group!=grp:
                line.append('o '+(group or 'building'));grp=group
            indices=['/'.join([str(remap[v[0]])]+[str(ix+1) if ix is not None else '' for ix in v[1:]])for v in face]
            line.append('f '+' '.join(indices))
        path.write_text('\n'.join(line)+'\n')

def fix(current,parent,planter,kind,field,slug):
    obj=Obj(local(current['CustomMesh'][field]));col=field=='ColliderURL'
    if kind=='clinic':
        selected=[]
        for part in obj.components():
            a,b=obj.v[part].min(0),obj.v[part].max(0)
            if a[0]>=-2.026 and b[0]<=-.774 and a[1]>=3.449 and b[1]<=4.129 and a[2]>=-2.954 and b[2]<=-2.046:selected.extend(part)
        assert len(selected)>=(8 if col else 600)
        obj.v[selected]+=np.array([0.,0.,2.45])
        assert obj.v[selected,2].min()>-.51
    if kind=='archive':
        removal=set();pieces=0
        for part in obj.components():
            a,b=obj.v[part].min(0),obj.v[part].max(0)
            if a[0]>=3.789 and 4.025<=b[0]<=4.066 and a[2]>=-3.056 and b[2]<=-2.244 and a[1]>=3.539 and b[1]<=7.551:
                removal.update(part);pieces+=1
        assert pieces==(2 if col else 25),(pieces,slug)
        obj.faces=[(g,f)for g,f in obj.faces if f[0][0] not in removal]
    if kind=='archive' and not col:obj.omit_hidden_faces()
    if planter:
        assert parent['CustomMesh']['DiffuseURL']==planter['CustomMesh']['DiffuseURL']
        p,origin=pose(parent);q,from_=pose(planter)
        obj.append(Obj(local(planter['CustomMesh'][field])),np.linalg.solve(p,q),np.linalg.solve(p,from_-origin))
    if col and kind in ('archive','cloister'):
        from compound import join_groups
        join_groups(obj)
    out=OUT/(slug+('-col' if col else '')+'.obj');obj.write(out)
    print(out.name,len(obj.faces))
def build():
    o=deployed(bag())
    for idx,alt,plant,kind,slug in [(64,None,None,'clinic','clinic-roof'),(70,'2',None,'archive','archive-upper'),(70,None,71,'archive','archive-roof'),(60,None,69,'cloister','cloister-roof')]:
        state=o[idx] if alt is None else o[idx]['States'][alt]
        for field in ['MeshURL','ColliderURL']:fix(state,o[idx],o[plant] if plant else None,kind,field,slug)
if __name__=='__main__':build()
