"""Check replacement identities, mission parity, archives, and Saved Objects bags."""
import json
import runpy
import zipfile
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
positions = runpy.run_path(str(Path(__file__).with_name('repair-map-alignment.py')))['positions']
catalog = json.loads((ROOT / 'shared/lobo-workshop-current.json').read_text())
retired = json.loads((ROOT / 'shared/lobo-workshop-archive-20261020.json').read_text())
replacements = [entry for entry in catalog['maps'] if entry['slug'].endswith('-satellite')]
assert len(catalog['maps']) == 40
assert len({entry['layoutKey'] for entry in catalog['maps']}) == 25
assert Counter(entry['name'] for entry in catalog['maps'])['Azure Circuit'] == 2
assert len(retired) == len(replacements) == 9
assert len({entry['slug'] for entry in catalog['maps'] + retired}) == 49
assert len({entry['id'] for entry in catalog['maps'] + retired}) == 49
assert all(count == 2 for count in Counter(m for e in catalog['maps'] for m in e['missionSetups']).values())

def load(entry):
    return json.loads((ROOT / ('public' + entry['download'])).read_text())['ObjectStates'][0]

def mission_objects(bag):
    return [o for o in bag['ContainedObjects'] if 'mission base' in o.get('Description', '')
            or 'Corner DZ Template' in o.get('Nickname', '')]

def mission_signature(bag):
    places = positions(bag)
    return sorted((o.get('Nickname', ''), tuple(places[o['GUID']])) for o in mission_objects(bag))

all_ids = set()
mission_count = 0
with zipfile.ZipFile(ROOT / ('public' + catalog['download'])) as archive:
    collection = json.loads(archive.read('Lobo-ITS18-Drop-Zone-Library.json'))
    collection_bags = {o['GUID']: o for o in collection['ObjectStates'] if o.get('Name') == 'Bag'}
    for entry in catalog['maps']:
        data = (ROOT / ('public' + entry['download'])).read_bytes()
        assert data == archive.read(entry['slug'] + '.json')
        assert collection_bags[entry['guid']] == json.loads(data)['ObjectStates'][0]
    for entry in replacements:
        old = next(e for e in retired if e['missionSetups'] == entry['missionSetups'])
        before, bag = load(old), load(entry)
        assert old['isCurrent'] is False
        assert old['layoutKey'] == 7 and old['layoutKey'] != entry['layoutKey']
        assert mission_signature(before) == mission_signature(bag)
        mission_count += len(mission_objects(bag))
        assert entry['previewKind'] == 'diagram'
        assert entry['overhead'] != old['overhead']
        assert (ROOT / ('public' + entry['overhead'])).is_file()
        assert len(bag['ContainedObjects']) == entry['objectCount']
        records = positions(bag)
        assert set(records) == {o['GUID'] for o in bag['ContainedObjects']}
        ids = {bag['GUID'], *records}
        assert not all_ids.intersection(ids)
        all_ids.update(ids)
        assert bag['LuaScript'].endswith('\r\n')
        for values in records.values():
            assert abs(values[0]) < 44 and abs(values[1]) < 26 and abs(values[2]) < 26
            assert all(0 <= value < 360 for value in values[3:])
        raw = json.dumps(bag)
        for forbidden in ['obje.glitch.me', 'Object base code', 'Spawning object', 'loseta.obj',
                          '929303676573608844/077667514B9647A58E54408941578615A56F05A7',
                          '1763691960017049066/36D6D884FB499477D0B075EF8D6FD47B195CA5CE']:
            assert forbidden not in raw

print(f'9 replacements passed: {mission_count} mission objects retain exact placement; '
      '40 archive bags match downloads; historical identities remain separate; '
      '25 layouts / two Azure Circuit variants; no known broken source references.')
