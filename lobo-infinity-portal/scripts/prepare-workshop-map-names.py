"""Prepare renamed TTS bags from the original Workshop JSON without publishing it."""

import argparse
import json
import subprocess
from pathlib import Path


def portal_maps(project_root):
    script = (
        "import {loboWorkshopMaps} from './shared/lobo-workshop-maps.mjs'; "
        "console.log(JSON.stringify(loboWorkshopMaps.map(({index,guid,name,workshopName,missionSetups}) "
        "=> ({index,guid,name,workshopName,missionSetups}))))"
    )
    result = subprocess.check_output(
        ['node', '--input-type=module', '-e', script], cwd=project_root, text=True
    )
    return json.loads(result)


def prepare(source, destination):
    if source.resolve() == destination.resolve():
        raise ValueError('Source and review copy must have different paths')

    project_root = Path(__file__).resolve().parent.parent
    maps = portal_maps(project_root)
    by_guid = {entry['guid'].lower(): entry for entry in maps}
    save = json.loads(source.read_text(encoding='utf-8'))
    matched = set()

    def visit(objects):
        if not isinstance(objects, list):
            return
        for obj in objects:
            entry = by_guid.get(str(obj.get('GUID', '')).lower())
            if entry and obj.get('Name') == 'Bag':
                guid = entry['guid']
                if guid in matched:
                    raise ValueError(f'Workshop bag {guid} appears more than once')
                matched.add(guid)
                obj['Nickname'] = f"SET_{entry['name']} [{entry['index']:02d}]"
                start, end = '[Lobo Portal map]', '[/Lobo Portal map]'
                prior = str(obj.get('Description', ''))
                if start in prior and end in prior:
                    prefix, remaining = prior.split(start, 1)
                    _, suffix = remaining.split(end, 1)
                    prior = (prefix + suffix).strip()
                summary = '\n'.join([
                    start,
                    f"Workshop save {entry['index']:02d}: {entry['name']}",
                    f"Original bag name: {entry['workshopName']}",
                    'Named mission setup: ' + (
                        ', '.join(entry['missionSetups']) if entry['missionSetups']
                        else 'none; place objectives for your chosen mission'
                    ),
                    end,
                ])
                obj['Description'] = summary + ('\n\n' + prior if prior else '')
            visit(obj.get('ContainedObjects'))
            for state in (obj.get('States') or {}).values():
                visit([state])

    visit(save.get('ObjectStates'))
    missing = [entry['index'] for entry in maps if entry['guid'] not in matched]
    if missing:
        raise ValueError(f'Original save is missing {len(missing)} expected map bags: {missing}')

    with destination.open('x', encoding='utf-8') as file:
        json.dump(save, file, ensure_ascii=False, indent=2)
        file.write('\n')
    print(f'Prepared {len(matched)} renamed map bags in {destination}. Review in TTS before updating the Workshop item.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path, help='Original published Workshop save JSON')
    parser.add_argument('destination', type=Path, help='New JSON file to review in TTS')
    arguments = parser.parse_args()
    prepare(arguments.source, arguments.destination)
