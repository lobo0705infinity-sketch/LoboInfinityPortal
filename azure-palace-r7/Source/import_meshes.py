"""Partition the two detailed R6 courts without changing a triangle, UV or collision hull."""
from collections import Counter
from pathlib import Path
import numpy as np
from common import OUT, ROOT, release, write

R6=release(6)
# The villa garden and existing patio occupy opposite sides of its wall.
# At the spa, both halves use the same authored origin and material.
PARTS={'east-villa':(0,3.24,('villa-terraces','villa-private-garden')),
       'azure-spa':(2,0.,('spa-sheltered-walk','spa-garden-court'))}

def read_obj(path):
    attrs=[[],[],[]];faces=[];group='visible'
    for line in path.read_text().splitlines():
        words=line.split()
        if not words or words[0]=='#':continue
        tag=words[0]
        if tag in ('v','vt','vn'):
            vals=words[1:];assert np.isfinite(list(map(float,vals))).all()
            attrs[('v','vt','vn').index(tag)].append(' '.join(vals))
        elif tag in ('g','o'):
            group=' '.join(words[1:])
        elif tag=='f':
            assert len(words)==4,(path,'non-triangle')
            tri=tuple(tuple(int(a)-1 for a in b.split('/'))for b in words[1:])
            assert all(0<=value<len(attrs[i]) for corner in tri for i,value in enumerate(corner))
            faces.append((group,tri))
    return attrs,faces

def write_part(path,attrs,faces,collision):
    if collision:
        # Match the compound format used by the working colliders: each closed
        # hull declares its own vertices and references them with global indices.
        groups={}
        for group,tri in faces:groups.setdefault(group,[]).append(tri)
        lines=['# Azure Palace | convex collision hulls']
        offset=0
        for group,triangles in groups.items():
            indices=sorted({c[0] for tri in triangles for c in tri})
            remap={j:offset+i+1 for i,j in enumerate(indices)}
            lines.extend(('o '+group,'g '+group))
            lines.extend('v '+attrs[0][j] for j in indices)
            lines.extend('f '+' '.join(str(remap[c[0]])for c in tri)for tri in triangles)
            offset+=len(indices)
        path.write_text('\n'.join(lines)+'\n',encoding='ascii')
        return
    wanted=[set()for _ in attrs]
    for _,tri in faces:
        for corner in tri:
            for i,j in enumerate(corner):wanted[i].add(j)
    remaps=[];lines=['# Azure Palace | Tabletop Simulator | authored local origin']
    for tag,used,store in zip(('v','vt','vn'),wanted,attrs):
        ordered=sorted(used);remaps.append({j:i+1 for i,j in enumerate(ordered)})
        lines += [f'{tag} {store[j]}' for j in ordered]
    previous=None
    for group,tri in faces:
        if group!=previous:
            lines.append('g '+group);previous=group
        lines.append('f '+' '.join('/'.join(str(remaps[i][j])for i,j in enumerate(corner)) for corner in tri))
    path.write_text('\n'.join(lines)+'\n',encoding='ascii')

def corners(attrs,tri):
    return tuple(tuple(attrs[k][j]for k,j in enumerate(c))for c in tri)

def split(source,axis,threshold,names,collision=False):
    suffix='-col.obj' if collision else '.obj'
    attrs,faces=read_obj(source)
    positions=np.array([tuple(map(float,s.split()))for s in attrs[0]])
    groups={}
    if collision:
        by_group={}
        for g,tri in faces:by_group.setdefault(g,set()).update(v[0]for v in tri)
        assert all(sum(name==g for name,_ in faces)<256 for g in by_group)
        groups={g:int(positions[list(indices),axis].mean()>threshold) for g,indices in by_group.items()}
    parts=[[],[]]
    for group,tri in faces:
        section=groups[group] if collision else int(positions[[v[0]for v in tri],axis].mean()>threshold)
        parts[section].append((group,tri))
    expected=Counter((g,corners(attrs,tri)) for g,tri in faces);rejoined=Counter();counts=[]
    for name,rows in zip(names,parts,strict=True):
        assert rows
        path=OUT/(name+suffix);write_part(path,attrs,rows,collision)
        ra,rf=read_obj(path)
        rejoined.update((g,corners(ra,t))for g,t in rf)
        count=len({corner for _,tri in rf for corner in tri})
        assert len(rf)*3<25000 and count<25000,(path,'import size',count)
        counts.append({'file':path.name,'imported_vertices':count,'triangles':len(rf)})
    assert expected==rejoined,(source,'attribute or hull mismatch')
    return counts

if __name__=='__main__':
    checks=[]
    for building,(axis,threshold,names) in PARTS.items():
        for is_collider in (False,True):
            suffix='-col.obj' if is_collider else '.obj'
            checks+=split(R6/'Assets'/(building+'-court'+suffix),axis,threshold,names,is_collider)
    write(ROOT/'Review/split-check.json',checks)
    for result in checks:print(result,flush=True)
