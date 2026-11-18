"""Render catalogue previews from the exact published TTS bags.

Usage: python scripts/render-current-map-previews.py --output public/assets/maps/...
Requires numpy, Pillow, trimesh, pyrender and an EGL software renderer.
The manifest binds each preview to the SHA256 of its source bag. TTS scripts,
interactive overlays and Unity particle effects are not executed by this renderer.
"""
import argparse
import concurrent.futures
import hashlib
import json
import math
import os
from pathlib import Path
import re
import time
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def placements(bag):
    result = {}
    for line in bag.get('LuaScript', '').splitlines():
        if re.match(r'^--[a-f0-9]{6},', line):
            fields = line[2:].split(',')
            result[fields[0]] = dict(zip(
                ['posX', 'posY', 'posZ', 'rotX', 'rotY', 'rotZ'], map(float, fields[1:])))
    return result


def assets_for(objects):
    for obj in objects:
        mesh = obj.get('CustomMesh', {})
        for field in ['MeshURL', 'DiffuseURL']:
            if mesh.get(field):
                yield mesh[field]
        image = obj.get('CustomImage', {}).get('ImageURL')
        if image:
            yield image


def fetch_asset(url, cache):
    path = cache / digest(url.encode())
    if path.exists():
        return url, str(path)
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={'User-Agent': 'Lobo-map-preview/1.0'}), timeout=60) as response:
                data = response.read()
            if not data or data.lstrip().lower().startswith((b'<!doctype html', b'<html')):
                raise ValueError('Expected a terrain asset, received an empty file or HTML')
            path.write_bytes(data)
            return url, str(path)
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    parser.add_argument('--cache', default='/tmp/lobo-map-preview-assets')
    parser.add_argument('--slug')
    parser.add_argument('--view', choices=['overhead', 'angled'])
    parser.add_argument('--download-only', action='store_true')
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()
    output = Path(args.output).resolve()
    cache = Path(args.cache).resolve()
    output.mkdir(parents=True, exist_ok=True)
    cache.mkdir(parents=True, exist_ok=True)
    catalogue = json.loads((ROOT / 'shared/lobo-workshop-current.json').read_text())
    entries = []
    for entry in catalogue['maps']:
        if args.slug and entry['slug'] != args.slug:
            continue
        data = (ROOT / ('public' + entry['download'])).read_bytes()
        bag = json.loads(data)['ObjectStates'][0]
        entries.append((entry, bag, digest(data)))
    urls = sorted(set(url for _, bag, _ in entries for url in assets_for(bag['ContainedObjects'])))
    assets = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
        futures = {pool.submit(fetch_asset, url, cache): url for url in urls}
        for i, future in enumerate(concurrent.futures.as_completed(futures), 1):
            url, path = future.result()
            assets[url] = path
            if i % 50 == 0 or i == len(urls):
                print(f'Assets ready: {i}/{len(urls)}', flush=True)
    if args.download_only:
        return
    os.environ.setdefault('PYOPENGL_PLATFORM', 'egl')
    import numpy as np
    np.infty = np.inf  # pyrender 0.1 compatibility with NumPy 2.
    import trimesh
    import pyrender
    from PIL import Image

    def camera_pose(eye, target, up):
        eye, target = np.array(eye, float), np.array(target, float)
        z = eye - target
        z /= np.linalg.norm(z)
        x = np.cross(up, z)
        x /= np.linalg.norm(x)
        y = np.cross(z, x)
        matrix = np.eye(4)
        matrix[:3, :3] = np.stack([x, y, z], axis=1)
        matrix[:3, 3] = eye
        return matrix

    def object_pose(obj, placement):
        t = {**obj['Transform'], **placement}
        x, y, z = [math.radians(t[k]) for k in ['rotX', 'rotY', 'rotZ']]
        matrix = (trimesh.transformations.rotation_matrix(y, [0, 1, 0]) @
                  trimesh.transformations.rotation_matrix(x, [1, 0, 0]) @
                  trimesh.transformations.rotation_matrix(z, [0, 0, 1]))
        matrix[:3, :3] = matrix[:3, :3] @ np.diag([t['scaleX'], t['scaleY'], t['scaleZ']])
        matrix[:3, 3] = [t['posX'], t['posY'], t['posZ']]
        return matrix

    for entry, bag, sha in entries:
        slug = entry['slug']
        record_path = output / (slug + '-preview.json')
        if not args.force and record_path.exists() and json.loads(record_path.read_text()).get('bagSha256') == sha:
            print('Already rendered:', slug, flush=True)
            continue
        scene = pyrender.Scene(bg_color=[.035, .055, .075, 1], ambient_light=[.52, .52, .52])
        positions = placements(bag)
        print('Rendering:', slug, flush=True)
        meshes = {}
        materials = {}
        textures = {}
        omitted, rendered = [], []
        for obj in bag['ContainedObjects']:
            placement = positions.get(obj['GUID'], {})
            pose = object_pose(obj, placement)
            x, y, z = pose[:3, 3]
            if abs(x) > 29 or abs(z) > 29 or y < 0 or y > 35:
                omitted.append({'guid': obj['GUID'], 'name': obj.get('Nickname', ''), 'reason': 'off-board control or object'})
                continue
            if obj.get('Nickname', '').startswith('Sky traffic /'):
                omitted.append({'guid': obj['GUID'], 'name': obj['Nickname'], 'reason': 'animated sky traffic outside the playable table'})
                continue
            cm = obj.get('CustomMesh')
            ci = obj.get('CustomImage')
            if cm:
                key = (cm['MeshURL'], cm.get('DiffuseURL', ''), tuple(obj.get('ColorDiffuse', {}).values()), cm.get('MaterialIndex'))
                if key not in meshes:
                    mesh = trimesh.load(assets[cm['MeshURL']], file_type='obj', force='mesh', process=False)
                    # Unity/TTS imports OBJ with an X reflection; reverse winding as well.
                    mesh.vertices[:, 0] *= -1
                    mesh.faces = mesh.faces[:, ::-1]
                    texture_url = cm.get('DiffuseURL', '')
                    if texture_url and texture_url not in textures:
                        image = Image.open(assets[texture_url]).convert('RGBA')
                        image.thumbnail((2048, 2048))
                        textures[texture_url] = (pyrender.Texture(source=image, source_channels='RGBA'), image.getextrema()[3][0] < 255)
                    texture, transparent = textures.get(texture_url, (None, False))
                    if texture is not None and (not hasattr(mesh.visual, 'uv') or mesh.visual.uv is None):
                        raise ValueError(f'{slug}: textured mesh has no UV coordinates: {obj["GUID"]}')
                    tint = obj.get('ColorDiffuse', {})
                    glass = cm.get('MaterialIndex') == 4
                    material_key = (texture_url, tuple(tint.values()), glass)
                    if material_key not in materials:
                        materials[material_key] = pyrender.MetallicRoughnessMaterial(
                            baseColorTexture=texture,
                            baseColorFactor=[tint.get(k, 1) for k in ['r', 'g', 'b']] + [.35 if glass else 1],
                            metallicFactor=.02, roughnessFactor=.9, doubleSided=True,
                            alphaMode='BLEND' if glass else 'MASK' if transparent else 'OPAQUE')
                    material = materials[material_key]
                    meshes[key] = pyrender.Mesh.from_trimesh(mesh, material=material, smooth=False)
                    # from_trimesh deep-copies materials; share the immutable material
                    # explicitly so repeated atlas textures are uploaded only once.
                    for primitive in meshes[key].primitives:
                        primitive.material = material
                scene.add(meshes[key], pose=pose)
            elif ci and obj['Name'] == 'Custom_Tile':
                # TTS square tiles have a two-inch base width before object scale.
                kind = ci.get('CustomTile', {}).get('Type', 0)
                if kind != 0:
                    raise ValueError(f'Unsupported tile shape {kind}: {slug} {obj["GUID"]}')
                vertices = [[-1, 0, -1], [-1, 0, 1], [1, 0, 1], [1, 0, -1]]
                uv = [[1, 1], [1, 0], [0, 0], [0, 1]]
                mesh = trimesh.Trimesh(vertices=vertices, faces=[[0, 1, 2], [0, 2, 3]], process=False)
                texture = Image.open(assets[ci['ImageURL']]).convert('RGB')
                texture.thumbnail((2048, 2048))
                mesh.visual = trimesh.visual.texture.TextureVisuals(uv=uv, image=texture)
                scene.add(pyrender.Mesh.from_trimesh(mesh, material=pyrender.MetallicRoughnessMaterial(
                    baseColorTexture=texture, metallicFactor=0, roughnessFactor=1, doubleSided=True), smooth=False), pose=pose)
            else:
                omitted.append({'guid': obj['GUID'], 'name': obj.get('Nickname', ''), 'reason': obj['Name']})
                continue
            rendered.append(obj['GUID'])
        if len(rendered) < 10:
            raise ValueError(f'Incomplete terrain scene for {slug}')
        for eye, intensity in [([20, 70, 25], 2.0), ([-40, 40, -25], .65)]:
            scene.add(pyrender.DirectionalLight(color=[1, .98, .94], intensity=intensity),
                      pose=camera_pose(eye, [0, 4, 0], [0, 1, 0]))
        paths = {}
        for view, eye, mag, size in [('overhead', [0, 100, .01], 26.5, (1600, 1600)),
                                     ('angled', [65, 72, 65], 37, (1600, 1200))]:
            if args.view and args.view != view:
                paths[view] = f'{slug}-{view}.webp'
                continue
            node = scene.add(pyrender.OrthographicCamera(xmag=mag, ymag=mag * size[1] / size[0], znear=.1, zfar=300),
                             pose=camera_pose(eye, [0, 4, 0], [0, 0, -1] if view == 'overhead' else [0, 1, 0]))
            renderer = pyrender.OffscreenRenderer(*size)
            rgb, _ = renderer.render(scene, flags=pyrender.RenderFlags.SHADOWS_DIRECTIONAL)
            renderer.delete()
            scene.remove_node(node)
            path = output / f'{slug}-{view}.webp'
            rendered_image = Image.fromarray(rgb)
            rendered_image.save(path, quality=91, method=6)
            rendered_image.thumbnail((640, 640))
            rendered_image.save(output / f'{slug}-{view}-thumb.webp', quality=85, method=6)
            paths[view] = path.name
            print(f'Rendered {slug}: {view}', flush=True)
        if not all((output / name).exists() for name in paths.values()):
            continue
        record_path.write_text(json.dumps({'slug': slug, 'name': entry['name'], 'bagUrl': entry['download'],
            'bagSha256': sha, 'views': paths, 'renderedObjects': rendered, 'omittedObjects': omitted,
            'note': 'Published terrain and saved states; interactive overlays, Unity bundle markers and particle effects are not rendered.'}, indent=2) + '\n')


if __name__ == '__main__':
    main()
