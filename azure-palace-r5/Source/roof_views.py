"""Cast three-dimensional sightlines from playable points on both pairs of overlooking roofs."""
import json,math
from pathlib import Path
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
r=Path(__file__).resolve().parents[1]
scene=json.loads((r/'Release/Play-Table.json').read_bytes());poses={};verts=[];faces=[]
def add(node,t):
    m=node.get('CustomMesh',{});url=m.get('ColliderURL','')
    if url:
        n=url.split('/')[-1];dirs=[r/'Assets',r.parent/'azure2/Assets',r.parent/'azure2/original/Assets',r.parent/'azure2/original/deps']
        if '/azure-palace-r5/' not in url:dirs=dirs[1:]
        path=next(d/n for d in dirs if (d/n).exists());start=len(verts);aa=math.radians(t['rotY']);c,s=math.cos(aa),math.sin(aa)
        for line in path.read_text().splitlines():
            bits=line.split()
            if not bits:continue
            if bits[0]=='v':
                x,y,z=map(float,bits[1:]);x=-x;verts.append((t['posX']+c*x+s*z,t['posY']-3.9+y,t['posZ']-s*x+c*z))
            elif bits[0]=='f':
                corners=[start+int(a.split('/')[0])-1 for a in bits[1:]]
                faces.extend((corners[0],corners[j],corners[j+1]) for j in range(1,len(corners)-1))
    for child in node.get('ChildObjects',[]):add(child,t)
for o in scene['ObjectStates']:
    if 'LoboMap:87b699' in o.get('Tags',[]) and o.get('CustomMesh'):
        t=o['Transform'];add(o,t);poses[o['Nickname']]=t
bvh=BVHTree.FromPolygons(verts,faces,all_triangles=True)
v=np.arange(-24,24.001,.40);X,Z=np.meshgrid(v,v);obs={}
def pos(name,u,z,h):
    t=poses[name];a=math.radians(t['rotY']);return Vector((t['posX']+math.cos(a)*u+math.sin(a)*z,h,t['posZ']-math.sin(a)*u+math.cos(a)*z))
for side,sources in [('west',[('Sunward Hotel Wing',2.15,.05,11.02),('Azure Spa',2.6,-1.06,7.93)]),('east',[('Seaward Hotel Wing',-2.28,-.65,11.02),('Terrace Restaurant',-2.65,.05,7.93)])]:
    counts=np.zeros(X.shape,np.uint8)
    for spec in sources:
        eye=pos(*spec)
        for i in range(len(v)):
            for j in range(len(v)):
                target=Vector((X[i,j],1.57,Z[i,j]));diff=target-eye;dist=diff.length
                hit=bvh.ray_cast(eye,diff.normalized(),max(0,dist-.025))[0]
                if hit is None:counts[i,j]+=1
    obs[side]=counts
np.savez(r/'Review/roofs.npz',v=v,**obs)
print('Sampled visibility from four legal rooftop miniature positions over',X.size,'points.')
