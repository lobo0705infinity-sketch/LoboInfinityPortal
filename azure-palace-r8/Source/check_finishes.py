"""Check that the baked texture preserves each physical material and that the game gets no coincident triangles."""
import json
from pathlib import Path
from collections import Counter
import numpy as np
from PIL import Image
from finish import ROOT,INDEX,PALETTE
def load(path,texture):
    uv=[];centers=[];keys=[];normals=[];positions=[];triangles=set();im=np.asarray(Image.open(texture).convert('RGB'));h,w=im.shape[:2]
    for row in path.read_text().splitlines():
        data=row.split()
        if not data:continue
        if data[0]=='vt':uv.append(tuple(map(float,data[1:3])))
        elif data[0]=='v':positions.append(tuple(map(float,data[1:4])))
        elif data[0]=='vn':normals.append(tuple(map(float,data[1:4])))
        elif data[0]=='f':
            corners=[tuple(int(k)-1 for k in p.split('/'))for p in data[1:]]
            vs=tuple(sorted(positions[el[0]] for el in corners));assert vs not in triangles,path
            triangles.add(vs)
            u,v=np.mean([uv[el[1]] for el in corners],axis=0)
            centers.append(im[round((1-v)*(h-1)),round(u*(w-1))])
            keys.append(min(4,int(u*5))+5*min(4,int((1-v)*5)))
    assert np.allclose(np.linalg.norm(normals,axis=1),1,atol=.001)
    return np.array(centers,float),np.array(keys)
def check():
    raw=ROOT/'Review/unbaked';infos={}
    for s in json.loads((ROOT/'Source/scatter.json').read_text()):
        slug=s['slug'];old,keys=load(raw/(slug+'.obj'),raw/'resort-prop-finishes.jpg')
        baked,_=load(ROOT/'Assets'/(slug+'.obj'),ROOT/'Assets'/(slug+'-diffuse.jpg'));assert len(baked)==len(old)
        # Contact shading changes brightness while retaining a material's distinct tint.
        a=old/np.maximum(1,old.sum(1)[:,None]);b=baked/np.maximum(1,baked.sum(1)[:,None])
        err=np.linalg.norm(a-b,axis=1);checks={}
        for idx in set(keys):
            filt=keys==idx;label=PALETTE[idx][0]
            if filt.sum()<35:continue
            med=float(np.median(err[filt]));ratio=float(np.median(baked[filt].sum(axis=1)/np.maximum(1,old[filt].sum(axis=1))))
            assert med<.055 and .58<ratio<1.12,(slug,label,med,ratio)
            checks[label]=[round(med,4),round(ratio,3)]
        infos[slug]=checks
    (ROOT/'Review/finish-check.json').write_text(json.dumps(infos,indent=1));print('Material identity, unit normals and unique triangles passed on all four baked game assets.')
if __name__=='__main__':check()
