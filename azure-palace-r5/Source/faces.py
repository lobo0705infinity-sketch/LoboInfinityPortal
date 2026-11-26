"""Partition each plane into nonoverlapping UV-preserving triangles. Closed solids lose their shared interior faces."""
from collections import defaultdict
import numpy as np
import shapely
from shapely.geometry import Polygon
from common import M
def clean(mesh,bottom=False,other=None):
    own_faces=len(mesh.f)
    if other is not None:
        merged=M();merged.add(mesh);merged.add(other);mesh=merged
    v=np.asarray(mesh.v,float);uv=np.asarray(mesh.uv,float);idx=np.asarray(mesh.f,int)
    tri=v[idx];cr=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);ln=np.linalg.norm(cr,axis=1)
    axes=np.argmax(abs(cr),axis=1); groups=defaultdict(list);out=M();removed=0
    for i in np.flatnonzero(ln>1.e-8):
        n=cr[i]/ln[i];sg=1 if n[axes[i]]>0 else -1
        if bottom and sg<0 and axes[i]==1 and max(abs(tri[i,:,1]))<.00003:continue
        n=n*sg
        key=tuple(np.round(n,6))+ (round(float(np.dot(n,tri[i,0])),6),)
        groups[key].append((i,sg))
    def add(p,t):
        j=len(out.v);out.v.extend(p);out.uv.extend(t);out.f.append([j,j+1,j+2])
    for plane,group in groups.items():
        if len(group)==1:
            i,_=group[0]
            if i<own_faces:add(tri[i],uv[idx[i]])
            continue
        axis=axes[group[0][0]];dims=[j for j in range(3) if j!=axis]
        pp=[Polygon(tri[i][:,dims]) for i,sg in group];tree=shapely.STRtree(pp)
        for j,(i,sg) in enumerate(group):
            if i>=own_faces:continue
            poly=pp[j];others=[]
            for k in tree.query(poly,predicate='intersects'):
                if k==j or (k<j and group[k][1]==sg):continue
                hit=poly.intersection(pp[k])
                if hit.area>1e-8:others.append(hit)
            if not others:
                add(tri[i],uv[idx[i]]);continue
            removed+=1;part=poly.difference(shapely.union_all(others))
            if part.area<1e-8:continue
            xy=tri[i][:,dims];origin=xy[0];basis=np.stack([xy[1]-origin,xy[2]-origin]);inv=np.linalg.inv(basis)
            def emit(poly2):
                if poly2.geom_type=='Polygon' and poly2.area>1e-8:
                    for t in shapely.constrained_delaunay_triangles(poly2).geoms:
                        q=np.array(t.exterior.coords)[:3];b=(q-origin)@inv;weights=np.column_stack((1-b.sum(axis=1),b));p=weights@tri[i];tuv=weights@uv[idx[i]]
                        if np.dot(np.cross(p[1]-p[0],p[2]-p[0]),cr[i])<0:p=p[::-1];tuv=tuv[::-1]
                        add(p,tuv)
                elif hasattr(poly2,'geoms'):
                    for geom in poly2.geoms:emit(geom)
            emit(part)
    return out,removed
def give_sheets_thickness(klass):
    """Preserve deliberately double-sided leaves and textile by giving the second face a distinct surface."""
    original=klass.face
    def face(self,vs,mat):
        coords=np.array(vs,dtype=float);prev=getattr(self,'_previous_panel',None)
        if prev is not None and coords.shape==prev.shape and np.allclose(coords,prev[::-1],atol=1.e-9,rtol=0):
            normal=np.cross(coords[1]-coords[0],coords[2]-coords[0]);n=np.linalg.norm(normal)
            if n>1.e-8:coords=coords+.012*normal/n
        self._previous_panel=np.array(vs,copy=True)
        original(self,coords,mat)
    klass.face=face
