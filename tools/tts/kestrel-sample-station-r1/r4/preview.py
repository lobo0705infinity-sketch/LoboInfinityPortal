"""Build the thumbnail and sightline scene from the same object as the installer."""
from final_map import W, SHIELD, read, resource, r3
import render

def prepare():
    bag = read(W / 'Kestrel-Lunar-Base.json')['ObjectStates'][0]
    for name in ('tech-coffin.obj', 'tech-coffin.png'):
        dest = W / name
        if not dest.exists():
            dest.symlink_to(r3.W / name)
    render.WORK = W
    render.local = resource
    render.build_bag = lambda: bag
    render.manifest()
    shield = next(obj for obj in bag['ContainedObjects'] if obj['GUID'] == SHIELD)
    view = [row for row in read(W / 'render-scene.json') if row['name'] == shield['Nickname']]
    assert len(view) == 1 and view[0]['mesh'] == str(resource(shield['CustomMesh']['MeshURL']))
    assert sum(row['name'] == 'Tech-Coffin' for row in read(W / 'render-scene.json')) == 3
    src = (r3.W / 'blender-r3.py').read_text()
    views = [
        ('overview', (62,69,0), (0,6.55,0), 57, 1240, 970),
        ('apron', (7,18,-28), (-1.5,7.1,-16.7), 12.8, 1050, 735),
    ]
    src = src[:src.index('views=')] + 'views=' + repr(views) + '\n' + src[src.index("if '--'"):]
    (W / 'render-final.py').write_text(src)

if __name__ == '__main__':
    prepare()
