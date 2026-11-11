from collections import Counter
from pathlib import Path
import hashlib
import json

import numpy as np
from PIL import Image
from scipy import ndimage

from geometry import mesh
from placements import dimensions, group_sides, learn, pattern

ROOT = Path(__file__).parent
SOURCE = ROOT / 'source'
OUTPUT = ROOT / 'assets'
WIDTH_FRACTION = .225

def filename(url):
    return url.rsplit('/', 1)[-1]

def extract_sprites(path):
    image = np.array(Image.open(path).convert('RGB'))
    height, width = image.shape[:2]
    sprites = []
    for row in range(2):
        for col in range(2):
            rgb = image[row*height//2:(row+1)*height//2, col*width//2:(col+1)*width//2].copy()
            r,g,b = rgb.astype('int16').transpose(2,0,1)
            mask = ~((g > 75) & (g > r * 1.22 + 8) & (g > b * 1.20 + 8))
            labels, count = ndimage.label(mask)
            sizes = np.bincount(labels.ravel())
            keep = np.flatnonzero(sizes >= 12)
            mask = np.isin(labels, keep[keep != 0])
            yy,xx = np.nonzero(mask)
            assert yy.size > 10000 and xx.min() > 0 and xx.max() < rgb.shape[1]-1
            area = np.s_[yy.min():yy.max()+1, xx.min():xx.max()+1]
            rgb, mask = rgb[area], mask[area]
            # Extend edge colors outside the silhouette for texture filtering.
            nearest = ndimage.distance_transform_edt(~mask, return_distances=False, return_indices=True)
            rgb = rgb[nearest[0], nearest[1]]
            w,h = mask.shape[1], mask.shape[0]
            silhouette = Image.fromarray(mask.astype('uint8')*255)
            small = silhouette.resize((round(w*176/h),176),Image.Resampling.BOX)
            pixels = np.asarray(small) >= 112
            sprites.append((Image.fromarray(rgb), pixels, w/h))
    return sprites

def strips(mask):
    active = {}
    rectangles = []
    for y in range(mask.shape[0]+1):
        edges = np.flatnonzero(np.diff(np.r_[False, mask[y] if y < len(mask) else np.zeros(mask.shape[1],bool), False]))
        intervals = set(zip(edges[::2],edges[1::2]))
        for span in sorted(active.keys() - intervals):
            rectangles.append((span[0], active.pop(span), span[1], y))
        for span in intervals:
            active.setdefault(span,y)
    return rectangles

def target_height(source_height):
    return 2048 if source_height==1536 else 4096

def build_mesh(src,dst,sprites,slots,present,poses,source_height,fix_persian):
    v,uv,faces=mesh(src)
    atlas_height=target_height(source_height)
    uv[:,1]=1-(1-uv[:,1])*source_height/atlas_height
    y0=source_height+32
    y1=y0+352
    removed=set()
    chosen=[]
    counts=Counter()
    for index,pair in present.items():
        variant=poses[index]
        counts[variant]+=1
        if variant:
            for direction,indices,data in zip((1,-1),pair,slots[index]):
                removed.update(indices)
                chosen.append((direction,variant,data))
    kept=faces[[i for i in range(len(faces)) if i not in removed]]
    used_v = sorted(set(kept[:,:,0].ravel()))
    used_uv = sorted(set(kept[:,:,1].ravel()))
    vertices = [tuple(v[i]) for i in used_v]
    uvs = [tuple(uv[i]) for i in used_uv]
    vert_map = {n:i+1 for i,n in enumerate(used_v)}
    uv_map = {n:i+1 for i,n in enumerate(used_uv)}
    out_faces = [tuple((vert_map[a],uv_map[b]) for a,b in t) for t in kept]
    for direction,variant,(x,z,floor,height,old_width,_,_,_,_) in chosen:
        if fix_persian:
            floor,height=.16,1.30
        index = (0 if direction==1 else 2) + variant-1
        _, mask, aspect = sprites[index]
        h,w = mask.shape
        width = min(height*aspect, old_width*1.04)
        start_u = (index+.5)/4-WIDTH_FRACTION/2
        vertices_for_sprite = {}
        def point(px,py):
            key = (px,py)
            if key not in vertices_for_sprite:
                frac_x,frac_y = px/w,py/h
                vertices.append((x+(frac_x-.5)*width*direction,floor+(1-frac_y)*height,z))
                uvs.append((start_u+frac_x*WIDTH_FRACTION,1-(y0+frac_y*(y1-y0))/atlas_height))
                vertices_for_sprite[key]=(len(vertices),len(uvs))
            return vertices_for_sprite[key]
        for left,top,right,bottom in strips(mask):
            a,b,c,d=point(left,top),point(left,bottom),point(right,bottom),point(right,top)
            out_faces.extend(((a,b,c),(a,c,d)))
    assert len(out_faces) <= 20000
    with dst.open('w') as f:
        f.write('# Roman pose variation\ns off\n')
        for point in vertices:
            f.write('v %.8f %.8f %.8f\n'%point)
        for point in uvs:
            f.write('vt %.8f %.8f\n'%point)
        for face in out_faces:
            f.write('f '+' '.join('%d/%d'%p for p in face)+'\n')
    return dict(standing=len(present), by_pose=dict(counts), triangles=len(out_faces))

def build_atlas(src,dst,sprites):
    atlas = Image.open(src).convert('RGB')
    width,height = atlas.size
    y0=height+32
    combined = Image.new('RGB',(width,target_height(height)),(35,28,19))
    combined.paste(atlas,(0,0))
    for index,(image,_,_) in enumerate(sprites):
        left = round(width*((index+.5)/4-WIDTH_FRACTION/2))
        right = round(width*((index+.5)/4+WIDTH_FRACTION/2))
        combined.paste(image.resize((right-left,352),Image.Resampling.LANCZOS),(left,y0))
    combined.save(dst,compress_level=3)

def build_family(entry):
    name,meshes=entry
    result={}
    sprites=extract_sprites(ROOT/f'{name}-poses.jpg')
    first=next(iter(meshes))
    source_width,_=dimensions(meshes[first])
    slots=learn(SOURCE/filename(first))
    states={}
    for url,textures in meshes.items():
        width,_=dimensions(textures)
        model=mesh(SOURCE/filename(url))
        states[url]=group_sides(*model,slots,source_width/width)
    fix_persian=name.startswith('Persian')
    poses=pattern(len(slots),states.values(),fix_persian)
    for url,textures in meshes.items():
        source=filename(url)
        _,height=dimensions(textures)
        new_mesh=OUTPUT/f'{name.lower()}-{source}'
        stats=build_mesh(SOURCE/source,new_mesh,sprites,slots,states[url],poses,height,fix_persian)
        result[url]={'file':new_mesh.name,'stats':stats,'textures':{},'full':url==first}
        for texture in textures:
            src=filename(texture)
            new_texture=OUTPUT/f'{name.lower()}-{Path(src).stem}.png'
            if not new_texture.exists():
                build_atlas(SOURCE/src,new_texture,sprites)
            result[url]['textures'][texture]=new_texture.name
        print(name,source,stats,flush=True)
    return result

def main():
    from concurrent.futures import ProcessPoolExecutor
    import sys
    OUTPUT.mkdir(exist_ok=True)
    plan=json.loads((ROOT/'plan.json').read_text())
    only=sys.argv[1:]
    entries=[(name,meshes) for name,meshes in plan.items() if not only or name in only]
    result={}
    with ProcessPoolExecutor(max_workers=6) as pool:
        for family in pool.map(build_family,entries):
            assert not result.keys() & family.keys()
            result.update(family)
    if only:return
    hashes={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(OUTPUT.iterdir()) if p.suffix in ('.obj','.png')}
    (OUTPUT/'manifest.json').write_text(json.dumps(dict(models=result,sha256=hashes),indent=2))

if __name__=='__main__':
    main()
