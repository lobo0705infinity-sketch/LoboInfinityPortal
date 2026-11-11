from collections import Counter
from pathlib import Path
import hashlib
import json

import numpy as np
from PIL import Image
from scipy import ndimage

from geometry import groups, mesh

ROOT = Path(__file__).parent
SOURCE = ROOT / 'source'
OUTPUT = ROOT / 'assets'
HEIGHT = 2048
Y0 = 1690
Y1 = 2010
WIDTH_FRACTION = .225
STANDING_HEIGHT = 1.30

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

def bounds(vertices):
    return vertices.min(axis=(0,1)), vertices.max(axis=(0,1))

def build_mesh(src, dst, sprites):
    v, uv, faces = mesh(src)
    assert uv[faces[:,:,1],1].min() > .20
    components = groups(v,faces)
    standings = {1:[], -1:[]}
    details = []
    for i,g in enumerate(components):
        p = v[g[:,:,0]]
        lower,upper = bounds(p)
        direction = int(np.sign(np.cross(p[:,1]-p[:,0],p[:,2]-p[:,0])[:,2].sum()))
        x,y,z = (lower+upper)/2
        if upper[2]-lower[2] < .0001 and upper[1] > 1.39 and upper[1]-lower[1] > 1.20 and len(g)>300:
            standings[direction].append((x,z,i,lower[1],upper[0]-lower[0]))
        elif upper[2]-lower[2] < .0001 and upper[1]>1.01 and direction:
            details.append((x,z,i,direction))
    front = sorted(standings[1],key=lambda s:(round(s[1],3),s[0]))
    assert len(front) in (6,9,12) and len(front)==len(standings[-1])
    fronts = [f for f in front]
    backs = list(standings[-1])
    chosen = {}
    counts = Counter()
    for n,(x,z,i,floor,width) in enumerate(fronts):
        j = min(range(len(backs)), key=lambda k:abs(backs[k][0]-x)+abs(backs[k][1]-z))
        back = backs.pop(j)
        assert abs(back[0]-x)<.20 and abs(back[1]-z)<.04
        variant = n % 3
        counts[variant] += 1
        if variant:
            for direction,data in ((1,(x,z,i,floor,width)),(-1,back)):
                chosen[data[2]] = (direction,variant,data)
    removed = set(chosen)
    for x,z,i,direction in details:
        peers = [s for s in standings[direction] if abs(s[1]-z)<.00001]
        if peers and min(peers,key=lambda s:abs(x-s[0]))[2] in chosen:
            removed.add(i)
    kept = np.concatenate([g for i,g in enumerate(components) if i not in removed])
    used_v = sorted(set(kept[:,:,0].ravel()))
    used_uv = sorted(set(kept[:,:,1].ravel()))
    vertices = [tuple(v[i]) for i in used_v]
    uvs = [tuple(uv[i]) for i in used_uv]
    vert_map = {n:i+1 for i,n in enumerate(used_v)}
    uv_map = {n:i+1 for i,n in enumerate(used_uv)}
    out_faces = [tuple((vert_map[a],uv_map[b]) for a,b in t) for t in kept]
    for direction,variant,(x,z,_,floor,old_width) in chosen.values():
        index = (0 if direction==1 else 2) + variant-1
        _, mask, aspect = sprites[index]
        h,w = mask.shape
        width = min(STANDING_HEIGHT*aspect, old_width*1.04)
        start_u = (index+.5)/4-WIDTH_FRACTION/2
        vertices_for_sprite = {}
        def point(px,py):
            key = (px,py)
            if key not in vertices_for_sprite:
                frac_x,frac_y = px/w,py/h
                vertices.append((x+(frac_x-.5)*width*direction,floor+(1-frac_y)*STANDING_HEIGHT,z))
                uvs.append((start_u+frac_x*WIDTH_FRACTION,1-(Y0+frac_y*(Y1-Y0))/HEIGHT))
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
    return dict(standing=len(front), by_pose=dict(counts), triangles=len(out_faces))

def build_atlas(src,dst,sprites):
    atlas = Image.open(src).convert('RGB')
    width,height = atlas.size
    assert height==HEIGHT
    for index,(image,_,_) in enumerate(sprites):
        left = round(width*((index+.5)/4-WIDTH_FRACTION/2))
        right = round(width*((index+.5)/4+WIDTH_FRACTION/2))
        atlas.paste(image.resize((right-left,Y1-Y0),Image.Resampling.LANCZOS),(left,Y0))
    atlas.save(dst)

def main():
    OUTPUT.mkdir(exist_ok=True)
    plan = json.loads((ROOT/'plan.json').read_text())
    result = {}
    for name,meshes in plan.items():
        sprites = extract_sprites(ROOT/f'{name}-poses.jpg')
        for url,textures in meshes.items():
            source = filename(url)
            new_mesh = OUTPUT / f'{name.lower()}-{source}'
            stats = build_mesh(SOURCE/source,new_mesh,sprites)
            result[url] = {'file':new_mesh.name,'stats':stats,'textures':{}}
            for texture in textures:
                src = filename(texture)
                new_texture = OUTPUT / f'{name.lower()}-{Path(src).stem}.png'
                if not new_texture.exists():
                    build_atlas(SOURCE/src,new_texture,sprites)
                result[url]['textures'][texture] = new_texture.name
    hashes = {p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in OUTPUT.iterdir() if p.suffix in ('.obj','.png')}
    (OUTPUT/'manifest.json').write_text(json.dumps(dict(models=result,sha256=hashes),indent=2))
    for u,info in result.items():
        print(info['file'],info['stats'])

if __name__=='__main__':
    main()
