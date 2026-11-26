"""Cairnfall Gardeners Workshop: replace the loose pitch with a walkable copper terrace."""
from collections import defaultdict
from pathlib import Path
import sys

import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components

ROOT = Path(__file__).resolve().parents[1]
# The original building atlas has four material tiles per row.
TILE = {'stone': (.002, .752), 'copper': (.752, .752), 'iron': (.502, .502)}
UP = 3.20
LADDER = -2.
RAIL_HALF = .63
OPEN_HALF = .78


class Model:
    def __init__(self, path, collider):
        self.collider = collider
        self.points, self.uv, self.faces = [], [], []
        group = 'building'
        for row in path.read_text().splitlines():
            terms = row.split()
            if not terms:
                continue
            tag, data = terms[0], terms[1:]
            if tag == 'v':
                self.points.append(tuple(map(float, data)))
            elif tag == 'vt':
                self.uv.append(tuple(map(float, data[:2])))
            elif tag in ('o', 'g'):
                group = data[0]
            elif tag == 'vn':
                raise ValueError('Unexpected authored normals in original workshop')
            elif tag == 'f':
                corners = [v.split('/') for v in data]
                self.faces.append((group, [(int(v[0])-1, int(v[1])-1 if len(v)>1 and v[1] else None) for v in corners]))
        self.points = np.array(self.points, dtype=float)

    def parts(self):
        edges = [(f[i-1][0], c[0]) for _, f in self.faces for i, c in enumerate(f)]
        i, j = np.asarray(edges).T
        graph = coo_matrix((np.ones(len(i)), (i,j)), shape=(len(self.points),)*2)
        n, membership = connected_components(graph, directed=False)
        return [np.flatnonzero(membership == i) for i in range(n)]

    def box(self, name, lo, hi, material, tile_length=2.):
        """Tile long surfaces at their original physical texel density. Only the ends are capped."""
        lo, hi = np.array(lo), np.array(hi)
        steps = 1 if self.collider else int(np.ceil((hi[2]-lo[2])/tile_length))
        zs = np.linspace(lo[2], hi[2], steps+1)
        first = len(self.points)
        points = [(x,y,z) for z in zs for x,y in
                  ((lo[0],lo[1]),(hi[0],lo[1]),(hi[0],hi[1]),(lo[0],hi[1]))]
        self.points = np.vstack((self.points, points))
        def face(indices):
            p = np.array([points[i] for i in indices])
            n = np.abs(np.cross(p[1]-p[0], p[2]-p[0]))
            axes = [(1,2),(0,2),(0,1)][n.argmax()]
            xy = (p[:,axes]-p[:,axes].min(axis=0))*.123
            # Tall downpipe faces can use the complete metal tile.
            xy /= np.maximum(1., xy.max(axis=0)/.246)
            offset = len(self.uv)
            if not self.collider:
                self.uv.extend(xy+TILE[material])
            corners = [(first+i,None if self.collider else offset+j) for j,i in enumerate(indices)]
            self.faces.extend((name,[corners[0],corners[j],corners[j+1]]) for j in range(1,len(indices)-1))
        face([3,2,1,0])
        for j in range(steps):
            a = 4*j
            for i in range(4):
                k=(i+1)%4
                face([a+i,a+k,a+k+4,a+i+4])
        face([4*steps+i for i in range(4)])

    def parapet(self):
        # Intersect the two offset wall lines at every corner. Each miter has one shared edge.
        outline=np.array([[-2.75,-3.25],[2.75,-3.25],[2.75,3.25],[-1.25,3.25],[-2.75,1.75]])
        edges=np.roll(outline,-1,axis=0)-outline
        d=edges/np.linalg.norm(edges,axis=1)[:,None]
        normals=np.c_[d[:,1],-d[:,0]]
        back=np.roll(normals,1,axis=0)
        offset=.1*(normals+back)/(1.+np.sum(normals*back,axis=1))[:,None]
        at=lambda j:(outline[j]+offset[j],outline[j]-offset[j])
        lip=lambda z:(np.array([2.85,z]),np.array([2.65,z]))
        route=[lip(LADDER+OPEN_HALF),at(2),at(3),at(4),at(0),at(1),lip(LADDER-OPEN_HALF)]
        for index,(a,b) in enumerate(zip(route,route[1:])):
            name='parapet_'+str(index)
            length=np.linalg.norm(np.mean(a,axis=0)-np.mean(b,axis=0))
            count=1 if self.collider else int(np.ceil(length/1.48))
            first=len(self.points)
            added=[]
            for f in np.linspace(0.,1.,count+1):
                outer,inner=np.array(a)*(1-f)+np.array(b)*f
                added.extend([(outer[0],UP,outer[1]),(outer[0],3.9,outer[1]),
                              (inner[0],3.9,inner[1]),(inner[0],UP,inner[1])])
            self.points=np.vstack([self.points,added])
            def panel(q,w,h):
                u=len(self.uv)
                if not self.collider:
                    self.uv.extend(np.array([(0,0),(0,h),(w,h),(w,0)])*.123+TILE['stone'])
                corners=[(first+i,None if self.collider else u+n) for n,i in enumerate(q)]
                self.faces.extend([(name,[corners[0],corners[1],corners[2]]),
                                   (name,[corners[0],corners[2],corners[3]])])
            for k in range(count):
                base=4*k
                for j,h in enumerate((.7,.2,.7,.2)):
                    n=(j+1)%4
                    panel([base+j,base+n,base+4+n,base+4+j],length/count,h)
            if self.collider or index==0:
                panel([3,2,1,0],.2,.7)
            if self.collider or index==len(route)-2:
                panel([count*4+i for i in range(4)],.2,.7)

    def write(self, path):
        vertices = sorted({c[0] for _, f in self.faces for c in f})
        uv = sorted({c[1] for _, f in self.faces for c in f if c[1] is not None})
        vi={v:i+1 for i,v in enumerate(vertices)}
        ui={v:i+1 for i,v in enumerate(uv)}
        def fmt(p):return ' '.join(f'{v:.7f}'.rstrip('0').rstrip('.') or '0' for v in p)
        lines=['# Cairnfall Sanctuary | Gardeners Workshop | table inches, Y up']
        lines.extend('v '+fmt(self.points[v]) for v in vertices)
        lines.extend('vt '+fmt(self.uv[v]) for v in uv)
        last=None
        for group,f in self.faces:
            # All surfaces use the original single texture. A collider needs each convex group's name.
            group = group if self.collider else 'workshop'
            if group!=last:
                lines.append('o '+group)
                last=group
            lines.append('f '+' '.join(str(vi[v]) if u is None else f'{vi[v]}/{ui[u]}' for v,u in f))
        path.write_text('\n'.join(lines)+'\n')


def modify(source, destination, roof, collider):
    obj = Model(source, collider)
    remove=set()
    counts=defaultdict(int)
    for part in obj.parts():
        p=obj.points[part];lo=p.min(0);hi=p.max(0)
        loose_sheet = (roof and lo[0]>=-2.301 and hi[0]<=2.601 and lo[1]>=3.12 and hi[1]<=4.04
                       and lo[2]>=.18 and hi[2]<=3.24)
        old_lip = roof and np.allclose([lo[1],hi[1]],[3.2,3.9])
        ladder = (lo[0]>=2.78 and 3.015<hi[0]<3.07 and lo[2]>=-2.41 and hi[2]<=-1.58 and hi[1]<3.76)
        if loose_sheet or old_lip:
            remove.update(part)
            counts['sheet' if loose_sheet else 'lip']+=1
        elif ladder:
            if hi[2]-lo[2]>.5:
                obj.points[part,2]=LADDER+(p[:,2]-LADDER)*(RAIL_HALF/.37)
            else:
                obj.points[part,2]+=np.sign(p[:,2].mean()-LADDER)*(RAIL_HALF-.37)
            counts['ladder']+=1
    assert counts['ladder']==(2 if collider else 24), counts
    if roof:
        assert counts['lip']==6 and counts['sheet']==(1 if collider else 38), counts
    obj.faces=[(g,f) for g,f in obj.faces if f[0][0] not in remove]
    if roof:
        obj.parapet()
    if not collider:
        # The square copper rainwater leader faces the workshop potting yard. Fittings sit against the wall.
        obj.box('leader',(.755,.18,3.392),(.855,2.95,3.49),'copper')
        for i,y in enumerate((.48,1.52,2.55)):
            obj.box(f'pipe_saddle_{i}',(.738,y-.023,3.32),(.872,y+.023,3.50),'iron')
        obj.box('discharge_shoe',(.74,.12,3.382),(.87,.245,3.585),'copper')
        if roof:
            obj.box('rainhead',(.66,2.89,3.367),(.95,3.14,3.55),'copper')
            obj.box('rainhead_rim',(.645,3.119,3.359),(.965,3.16,3.564),'copper')
            obj.box('drain_recess',(.59,UP+.004,2.65),(1.02,UP+.015,3.01),'iron')
            for i in range(6):
                x=.605+i*.076
                obj.box(f'grate_{i}',(x,UP+.015,2.656),(x+.024,UP+.030,3.004),'copper')
    obj.write(destination)

def build():
    for roof, key in ((True,'roof'),(False,'floor1')):
        for collider,suffix in ((False,''),(True,'-collider')):
            name=f'workshop-{key}{suffix}.obj'
            modify(ROOT/'base'/name, ROOT/'assets'/name, roof, collider)

if __name__=='__main__':
    build()
