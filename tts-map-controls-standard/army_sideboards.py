"""Keep the two TTS sideboard buttons and map-owned replacement buttons on the same release channel."""
from pathlib import Path
import argparse, json, re

ROOT = Path(__file__).resolve().parent
LAUNCHER = (ROOT / 'army-launcher.lua').read_text()
REVISION = int(re.search(r'^LOBO_ARMY_LAUNCHER_REVISION = (\d+)$', LAUNCHER, re.M)[1])
REV = re.compile(r'^LOBO_ARMY_LAUNCHER_REVISION\s*=\s*(\d+)\s*$', re.M)
BUTTON = re.compile(r'^(?P<before> +local (?P<side>blue|red)\s*=\s*\[(?P<eq>=*)\[)(?P<body>[^\n]+?)(?P<after>\](?P=eq)\])\s*$', re.M)
GATE = re.compile(r'(found\.getVar\("LOBO_ARMY_LAUNCHER_REVISION"\)[^\n]*?>=)(\d+)( then return true end)')
OLD_START = ' -- Shared table tools live outside the battlefield and survive map changes.'
MOUNT_START = ' local function mount()'
TAG = 'LoboArmyLauncher'
COMPACT = dict(ensure_ascii=True, separators=(',', ':'))
PLACEHOLDER = '__LOBO_CURRENT_ARMY_LAUNCHER__'

def canonical_loader():
    template = (ROOT / 'table-tools.lua').read_text().rstrip()
    if template.count(PLACEHOLDER) != 2:
        raise ValueError('Missing red or blue launcher template')
    return template.replace(PLACEHOLDER, json.dumps(LAUNCHER, **COMPACT)[1:-1])

def upgrade_legacy(owner):
    start = owner.index(OLD_START)
    end = owner.index(MOUNT_START, start)
    legacy = owner[start:end]
    army_row = next((s for s in legacy.splitlines(True) if '{key="army"' in s), None)
    old_check = '(tableTools[1].done and tableTools[2].done)'
    if not army_row or old_check not in legacy or 'local function ensureTableTools()' not in legacy:
        raise ValueError('Unrecognized legacy map tool bootstrap')
    orders = legacy.replace(army_row, '', 1).replace(old_check, 'tableTools[1].done', 1)
    orders = orders.replace('local function ensureTableTools()', 'local function ensureLegacyOrderPanel()', 1)
    buttons = canonical_loader()
    buttons = re.sub(r'^ local panel=\[==\[.*?\]==\]\n', '', buttons, count=1, flags=re.M)
    a = buttons.index('  local panelReady,older=false,nil')
    b = buttons.index('  local blueReady=ensureButton', a)
    buttons = buttons[:a] + buttons[b:]
    buttons = buttons.replace('toolsPlaced=panelReady and blueReady and redReady','toolsPlaced=blueReady and redReady')
    buttons = buttons.replace('local function ensureTableTools()', 'local function ensureArmySideboards()')
    mount = '\n local function ensureTableTools()\n  ensureLegacyOrderPanel()\n  ensureArmySideboards()\n end\n'
    return owner[:start] + orders + buttons + mount + owner[end:]

def upgrade_owner(script):
    if 'local function ensureButton(side,source)' in script:
        sides = []
        def update(match):
            data = json.loads(match['body'])
            old = data['LuaScript']
            revision = REV.search(old)
            if not revision or TAG + match['side'].capitalize() not in data.get('Tags', []):
                raise ValueError('Unrecognized embedded Army button')
            if int(revision[1]) > REVISION:
                raise ValueError('This map has a newer Army launcher')
            sides.append(match['side'])
            if old == LAUNCHER:
                return match[0]
            # Replace only the actual Lua string, preserving every other field and its encoding.
            new_body = match['body'].replace(json.dumps(old, **COMPACT), json.dumps(LAUNCHER, **COMPACT), 1)
            if json.loads(new_body)['LuaScript'] != LAUNCHER:
                raise ValueError('Could not replace embedded launcher')
            return match['before'] + new_body + match['after']
        result = BUTTON.sub(update, script)
        gates = GATE.findall(result)
        if sorted(sides) != ['blue', 'red'] or len(gates) != 1 or int(gates[0][1]) > REVISION:
            raise ValueError('Wrong seat count or launcher gate')
        return GATE.sub(lambda m: m[1] + str(REVISION) + m[3], result)
    if OLD_START in script and 'ensureLegacyOrderPanel' not in script:
        return upgrade_legacy(script)
    return script

def walk(save):
    stack = list(save.get('ObjectStates', []))
    while stack:
        obj = stack.pop()
        yield obj
        for key in ('ContainedObjects', 'ChildObjects'):
            stack.extend(obj.get(key) or [])
        stack.extend((obj.get('States') or {}).values())

def repair(save, spawner=None):
    counts = {'buttons':0, 'maps':0, 'spawners':0}
    for obj in walk(save):
        script = obj.get('LuaScript', '')
        if TAG in obj.get('Tags', []):
            if any(TAG+s in obj['Tags'] for s in ('Blue','Red')):
                revision=REV.search(script)
                if not revision or int(revision[1])>REVISION:
                    raise ValueError('Unrecognized physical launcher')
                obj['LuaScript'] = LAUNCHER
                counts['buttons'] += 1
        elif 'LOBO_STANDARD_VERSION=1' in script:
            upgraded = upgrade_owner(script)
            if 'local function ensureButton(side,source)' not in upgraded:
                raise ValueError('Standard map is missing sideboards: '+obj.get('GUID','?'))
            obj['LuaScript'] = upgraded
            counts['maps'] += 1
        elif spawner and 'local function decodeArmyCode(' in script and 'function onSpawnClick(' in script:
            version = re.search(r'^LOBO_ARMY_DATA_REVISION\s*=\s*(\d+)',script,re.M)
            minimum = int(re.search(r'^LOBO_ARMY_DATA_REVISION\s*=\s*(\d+)',spawner['LuaScript'],re.M)[1])
            if not version or int(version[1])<minimum:
                for key in ('LuaScript','Nickname','Description'): obj[key]=spawner[key]
                counts['spawners']+=1
    return counts

def check(save, require_room=False):
    seats=[]; maps=0
    for obj in walk(save):
        s=obj.get('LuaScript','')
        if TAG in obj.get('Tags',[]):
            if obj.get('LuaScript')!=LAUNCHER: raise ValueError('Stale physical Army launcher in '+obj.get('GUID',''))
            seats.extend(side for side in ('Blue','Red') if TAG+side in obj['Tags'])
        if 'LOBO_STANDARD_VERSION=1' in s:
            forms = list(BUTTON.finditer(s))
            if sorted(f['side'] for f in forms)!=['blue','red'] or any(json.loads(f['body'])['LuaScript']!=LAUNCHER for f in forms):
                raise ValueError('Map can recreate stale Army buttons: '+obj.get('GUID',''))
            if [int(m[1]) for m in GATE.findall(s)] != [REVISION]: raise ValueError('Stale map launcher gate')
            maps+=1
    if require_room and sorted(seats)!=['Blue','Red']: raise ValueError('Missing room sideboards')
    return maps

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path);parser.add_argument('output',type=Path)
    args=parser.parse_args()
    if args.source.resolve()==args.output.resolve():parser.error('Choose a separate output file.')
    save=json.loads(args.source.read_text(encoding='utf-8-sig'));print(repair(save));check(save)
    args.output.write_text(json.dumps(save,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
