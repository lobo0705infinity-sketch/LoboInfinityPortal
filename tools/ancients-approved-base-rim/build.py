from collections import Counter
from concurrent.futures import ProcessPoolExecutor
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.spatial import ConvexHull

from fetch import ROOT,file
from geometry import mesh
from palette import COLS,GRID,PALETTE,palette_slots,palette_uv

OUT=ROOT/'assets'

def asset_name(url,suffix):
    return hashlib.sha256(url.encode()).hexdigest()[:20]+suffix

def edge_index(dx,dz):
    if abs(dx)>=abs(dz):
        return 2 if dx>0 else 0
    return 1 if dz>0 else 3

def build_mesh(job):
    url,slot=job
    verts,uv,faces=mesh(file(url))
    positions=verts[faces[:,:,0]]
    normals=np.cross(positions[:,1]-positions[:,0],positions[:,2]-positions[:,0])
    lowest=positions[:,:,1].min(axis=1)
    highest=positions[:,:,1].max(axis=1)
    y=.16
    top=(abs(lowest-y)<1e-6)&(abs(highest-y)<1e-6)&(normals[:,1]>1e-8)
    points=np.unique(positions[top][:,:,[0,2]].reshape(-1,2),axis=0)
    polygon=points[ConvexHull(points).vertices[::-1]]
    size=np.ptp(polygon,axis=0)
    assert len(polygon) in (4,64) and np.allclose(size,size[0],atol=1e-5),(url,size,len(polygon))
    center=polygon.mean(axis=0)
    base_sides=(lowest>=-1e-6)&(lowest<y-.002)&(highest<=y+1e-6)&(np.linalg.norm(normals[:,[0,2]],axis=1)>1e-8)
    side_count=int(base_sides.sum())
    assert side_count in (8,16,128),(url,side_count)
    existing_bevel=side_count==16
    # A constant UV per face samples the center of a matte palette swatch.
    new_uv=np.array([palette_uv(slot,i) for i in range(len(PALETTE))])
    for i in np.flatnonzero(base_sides):
        nx,ny,nz=normals[i]
        palette=2+edge_index(nx,nz) if ny>1e-7 else int(abs(nx)>abs(nz))
        faces[i,:,1]=len(uv)+palette

    added_verts=[]
    added_faces=[]
    r=float(size[0]/2)
    # The 2.94-inch top already slopes down to its 3-inch footprint.
    # Carry that bevel into the new palette and add its inset band.
    if existing_bevel:
        dimensions=((r,y+.0003),(r-.095,y+.0004))
        colors=(6,)
    else:
        dimensions=((r,y+.0003),(r*.97,y+.008),(r*(1-.125/1.5),y+.0004))
        colors=(2,6)
    for radius,height in dimensions:
        ring=center+(polygon-center)*(radius/r)
        added_verts.extend((x,height,z) for x,z in ring)
    count=len(polygon)
    for ring,palette in enumerate(colors):
        for i in range(count):
            j=(i+1)%count
            outer=len(verts)+ring*count
            inner=outer+count
            idx=palette+edge_index(*((polygon[i]+polygon[j])/2-center))
            tex=len(uv)+idx
            a,b,c,d=outer+i,outer+j,inner+j,inner+i
            added_faces.extend((((a,tex),(b,tex),(c,tex)),((a,tex),(c,tex),(d,tex))))
    points=np.array(added_verts)
    assert np.all(points[:,[0,2]].min(0)>=verts[:,[0,2]].min(0)-1e-7)
    assert np.all(points[:,[0,2]].max(0)<=verts[:,[0,2]].max(0)+1e-7)
    assert points[:,1].max()<.17
    dst=asset_name(url,'.obj')
    with (OUT/dst).open('w') as f:
        f.write('# Clash of Empires matte base rim\ns off\n')
        f.writelines('v %.8f %.8f %.8f\n'%tuple(v) for v in np.vstack([verts,points]))
        f.writelines('vt %.8f %.8f\n'%tuple(uv) for uv in np.vstack([uv,new_uv]))
        f.writelines('f '+' '.join(f'{v+1}/{t+1}' for v,t in a)+'\n' for a in np.concatenate([faces,np.array(added_faces)]))
    return url,dict(file=dst,side_faces=side_count,rim_faces=len(added_faces),vertices=len(verts)+len(points),triangles=len(faces)+len(added_faces))

def swatch_boxes(width,height,slots):
    for x,y,unit in sorted(slots):
        for i,color in enumerate(PALETTE):
            c,r=i%COLS,i//COLS
            x0=round((x+c*unit)*width/GRID)
            x1=round((x+(c+1)*unit)*width/GRID)-1
            y0=round((1-(y+(r+1)*unit)/GRID)*height)
            y1=round((1-(y+r*unit)/GRID)*height)-1
            yield (x0,y0,x1,y1),color

def build_texture(job):
    url,slots=job
    src=Image.open(file(url))
    lossless=src.format=='PNG'
    img=src.convert('RGBA' if lossless and 'A' in src.getbands() else 'RGB')
    draw=ImageDraw.Draw(img)
    w,h=img.size
    for box,color in swatch_boxes(w,h,slots):
        draw.rectangle(box,fill=(*color,255) if img.mode=='RGBA' else color)
    dst=asset_name(url,'.png' if lossless else '.jpg')
    if lossless:
        img.save(OUT/dst,compress_level=3)
    else:
        img.save(OUT/dst,quality=97,subsampling=0,optimize=True)
    return url,dst

def main():
    plan=json.loads((ROOT/'plan.json').read_text())
    OUT.mkdir(exist_ok=True)
    slots,swatches=palette_slots(plan)
    with ProcessPoolExecutor(max_workers=8) as pool:
        models=dict(pool.map(build_mesh,slots.items()))
        print('Rebuilt models',len(models),Counter(x['side_faces'] for x in models.values()),flush=True)
        textures={}
        for url,dst in pool.map(build_texture,swatches.items()):
            textures[url]=dst
            if len(textures)%75==0:print('Rebuilt textures',len(textures),flush=True)
    hashes={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(OUT.iterdir()) if p.suffix in ('.obj','.jpg','.png')}
    manifest=dict(meshes=models,textures=textures,sha256=hashes)
    (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
    print('Verified build inventory',len(models),len(textures),len(hashes),flush=True)

if __name__=='__main__':
    main()
