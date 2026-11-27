"""Check the actual release files, including the live Workshop catalogue and Stage."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import sys
from final_map import COLLECTION, MAP, PLAY, SHIELD, W, find_map, r3, read, resource, write
from base import get
from build_station import AXES, poses

def load_bag():
    return read(W / 'Kestrel-Lunar-Base.json')['ObjectStates'][0]

def check_public():
    urls = set()
    for obj in load_bag()['ContainedObjects']:
        for part in r3.r2.walk(obj):
            for field in ('CustomMesh','CustomAssetbundle'):
                for name, url in part.get(field, {}).items():
                    if name.endswith('URL') and url:
                        assert url.startswith('https://') and 'localhost' not in url and '/LOCAL/' not in url
                        urls.add(url)
    def download(url):
        data = get(url)
        assert data == resource(url).read_bytes(), url
        return url, hashlib.sha256(data).hexdigest()
    with ThreadPoolExecutor(8) as workers:
        sums = dict(workers.map(download,sorted(urls)))
    write(W / 'public-qa.json',sums)
    print(len(sums),'distinct public asset URLs matched the authored bytes')

def check_geometry():
    from shapely.geometry import Point, LineString, box
    from shapely.ops import unary_union
    import check_geometry as qa
    import survey
    qa.WORK = r3.W
    qa.local = survey.local = resource
    bag = load_bag()
    sections = qa.scene_sections(bag, 1.5)
    def footprints(b):
        regions = survey.footprints(b)
        for guid in ('e53204','e53206',SHIELD):
            regions[guid] = sections[guid]
        return regions
    qa.footprints = footprints
    contacts = qa.targets(bag, sections)
    assert len(contacts) == 6 and set(contacts.values()) == {8}, contacts
    edge = max(qa.edge_runs(sections,1.5).values())
    assert edge < 26
    obj = next(o for o in bag['ContainedObjects'] if o['GUID'] == SHIELD)
    component = lambda h: unary_union(qa.component_sections(obj,6.25+h))
    body = component(1.5)
    assert body.geom_type == 'MultiPolygon' or body.geom_type == 'Polygon'
    assert body.covers(LineString([(-2.85,-17.23),(1.25,-17.23)]))
    assert .415 < body.intersection(LineString([(0,-18),(0,-16)])).length < .445
    assert component(2.050).covers(Point(0,-17.23))
    assert not component(2.08).covers(Point(0,-17.23))
    rim = body.distance(Point(0,-20)) - 20/25.4
    assert rim > 40/25.4, rim
    return_leg = body.intersection(box(-2.45,-18,1.5,-17))
    cartway = LineString([(x,z) for z,x in r3.ROADS[0]]).buffer(1.06,cap_style=2)
    margin = return_leg.distance(cartway)
    assert margin > .4, margin
    report = {'objectiveContactSectors':contacts, 'maxGroundEdgeRunIn':edge,
              'shieldToObjectiveRimIn':round(rim,3), 'returnToCartwayShoulderIn':round(margin,3)}
    write(W/'geometry-qa.json',report)
    print(report)

def check_saves():
    from lupa.lua52 import LuaRuntime
    bag = load_bag()
    roots = bag['ContainedObjects']
    old = read(r3.W / 'bag.json')['ObjectStates'][0]
    by = {o['GUID']:o for o in roots}
    before = {o['GUID']:o for o in old['ContainedObjects']}
    assert list(before) == list(by)
    assert {g for g in by if by[g]!=before[g]} == {SHIELD,'c70000'}
    assert {k for k in by[SHIELD] if by[SHIELD][k]!=before[SHIELD][k]} == {'Nickname','Description','CustomMesh'}
    assert {k for k in by[SHIELD]['CustomMesh'] if by[SHIELD]['CustomMesh'][k]!=before[SHIELD]['CustomMesh'][k]} == {'MeshURL','ColliderURL'}
    assert {k for k in by['c70000'] if by['c70000'][k]!=before['c70000'][k]} == {'Description'}
    table = read(W / 'Play-Table.json')
    earlier = read(r3.W / 'room.json')
    keep = [o for o in earlier['ObjectStates'] if r3.TAG not in o.get('Tags',[])]
    assert table['ObjectStates'] == keep + roots and table['SaveName'] == PLAY
    assert {k for k in table if table[k]!=earlier[k]} <= {'SaveName','ObjectStates','Note'}
    axes = AXES
    state_rows = {l[2:8]:list(map(float,l.split(',')[1:])) for l in bag['LuaScript'].splitlines()}
    all_states = [s for o in roots for s in poses(o)]
    assert len(state_rows)==len(all_states)==len(set(s['GUID'] for s in all_states))
    for s in all_states:
        assert all(abs(record-s['Transform'][axis]) < 1e-7
                   for record,axis in zip(state_rows[s['GUID']],axes)), s['GUID']
    assert {o['GUID'] for o in roots if 'mission' in o['Tags']}=={'c7f100','c7f101','c7f102'}
    catalogue = read(W/'Workshop-Save.json')
    live = read(W/'live-collection.json')
    existing = find_map(live)
    updated = find_map(catalogue)
    assert updated['ContainedObjects']==roots and updated['LuaScript']==bag['LuaScript']
    assert {k for k in updated if updated[k]!=existing[k]} == {'ContainedObjects','Description','LuaScript'}
    def map_entries(objects):
        for obj in objects:
            if obj.get('Nickname','').startswith('SET_') and (obj.get('Name')=='Custom_Model_Bag' or obj.get('ContainedObjects')):
                yield obj['GUID']
            yield from map_entries(obj.get('ContainedObjects',[]))
    maps = list(map_entries(live['ObjectStates']))
    assert len(maps)==len(set(maps))==107 and maps.count(MAP)==1
    assert catalogue['SaveName']==COLLECTION
    # Put back the original shell and title in memory. Everything else has to match the Steam download.
    catalogue['ObjectStates'][catalogue['ObjectStates'].index(updated)] = existing
    catalogue['SaveName'] = live['SaveName']
    assert catalogue == live
    for guid in ('a5b703','a5b704','d4c0a3'):
        tool = next(o for o in keep if o['GUID']==guid)
        published = next(o for o in live['ObjectStates'] if o['GUID']==guid)
        for k in ('LuaScript','LuaScriptState','XmlUI'):
            assert tool.get(k)==published.get(k), (guid,k)
    stage = next(o['LuaScript'] for o in keep if o['Nickname']=='Stage')
    assert stage == next(o['LuaScript'] for o in live['ObjectStates'] if o['Nickname']=='Stage')
    owner = by['c70000']['LuaScript']
    lua = LuaRuntime(unpack_returned_tuples=True)
    compile_lua=lua.eval('function(s)local f,e=load(s);return f~=nil,e end')
    scripts={s['LuaScript'] for o in table['ObjectStates'] for s in r3.r2.walk(o) if s.get('LuaScript')}|{table['LuaScript'],bag['LuaScript']}
    for script in scripts:
        ok,error=compile_lua(script)
        assert ok, error
    shared=(r3.r2.ROOT/'src/verify_save.py').read_text()
    shared=shared[shared.index('lua.globals().decode='):shared.rindex('print(')]
    exec(compile(shared,'Stage and rotation checks','exec'),{**globals(),**locals()})
    report={'collectionMaps':len(maps),'otherMapEntriesPreserved':len(maps)-1,'stageMapObjects':len(roots),
            'stateRecords':len(all_states),'persistentPlayTableObjects':len(keep),'compiledLuaScripts':len(scripts),
            'stageRotateTwiceClear':True,'steamSourceUpdated':read(W/'steam-meta.json')['time_updated']}
    write(W/'save-qa.json',report)
    print(report)

if __name__=='__main__':
    {'network':check_public,'routes':check_geometry,'saves':check_saves}[sys.argv[1]]()
