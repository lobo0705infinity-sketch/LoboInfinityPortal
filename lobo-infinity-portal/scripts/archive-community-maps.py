"""Package the 21 legacy setups without changing any map bag contents.

Usage: python scripts/archive-community-maps.py CURRENT_WORKSHOP.json OUTPUT_DIR
The input must be the decoded, current public Workshop payload.
"""
import copy
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path

ARCHIVED_IDS = {
    '100013', '100081', '1000cb', '100211', '1003bd', '100434', '100508',
    '100544', '1006b8', '100843', '810417', '810183', '100ac2', '81046b',
    '100b8d', '100bff', '8104c6', '100daf', '100e9f', '100fb0', '810394',
}
ARCHIVE_GUID = 'c0a216'
SAVE_NAME = 'Lobo Infinity Maps - Community Archive'


def encoded(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode('utf-8')


def archive_save(original):
    result = copy.deepcopy(original)
    bags = [o for o in result['ObjectStates'] if o.get('Nickname', '').startswith('SET_')]
    archived = sorted([o for o in bags if o['GUID'] in ARCHIVED_IDS], key=lambda o: o['Nickname'])
    assert len(archived) == 21 and len(bags) == 104
    assert not any(o.get('GUID') == ARCHIVE_GUID for o in result['ObjectStates'])
    archive = {k: copy.deepcopy(v) for k, v in archived[0].items() if k not in ('ContainedObjects', 'LuaScript')}
    archive.update(GUID=ARCHIVE_GUID, Nickname='Community Maps Archive - 16 Maps / 21 Setups',
        Description='Archived community maps. Right-click and Search to choose a map bag.\n'
        'Take out one map bag, Save Object, and drop that inner bag onto the normal Infinity Stage.\n'
        'This outer bag is storage only.\n\n' + '\n'.join(o['Nickname'][4:] for o in archived),
        GMNotes='LoboCommunityArchive:20261116',
        Transform={'posX': -47, 'posY': 2.3, 'posZ': -25, 'rotX': 0, 'rotY': 0, 'rotZ': 0,
                   'scaleX': 2, 'scaleY': 2, 'scaleZ': 2},
        ColorDiffuse={'r': .42, 'g': .30, 'b': .18}, Locked=True, Grid=False, Snap=False,
        LuaScript='', LuaScriptState='', XmlUI='', ContainedObjects=archived)
    result['ObjectStates'] = [o for o in result['ObjectStates'] if o.get('GUID') not in ARCHIVED_IDS] + [archive]
    lua = result['LuaScript']
    # Keep the original catalogue records for the retained maps. Remove entire
    # top-level Lua records, respecting nested tables and quoted strings.
    start = lua.index('local ITEMS = ') + len('local ITEMS = ')
    assert lua[start] == '{'
    depth, quote, escape, entry_start, entries, end = 0, None, False, None, [], None
    for i in range(start, len(lua)):
        char = lua[i]
        if quote:
            if escape: escape = False
            elif char == '\\': escape = True
            elif char == quote: quote = None
        elif char in ('"', "'"): quote = char
        elif char == '{':
            depth += 1
            if depth == 2: entry_start = i
        elif char == '}':
            if depth == 2: entries.append(lua[entry_start:i + 1])
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    def entry_guid(entry):
        match = re.search(r'(?:\["guid"\]|guid)\s*=\s*"([a-f0-9]{6})"', entry)
        assert match, entry
        return match.group(1)
    kept = [e for e in entries if entry_guid(e) not in ARCHIVED_IDS]
    assert len(entries) - len(kept) == 21
    lua = lua[:start] + '{' + ','.join(kept) + '}' + lua[end:]
    exclusions = 'local COMMUNITY_ARCHIVED = {' + ','.join('["' + x + '"]=true' for x in sorted(ARCHIVED_IDS)) + '}\n'
    lua = exclusions + lua
    condition = "if object.type=='Bag' and name:sub(1,4)=='SET_' and not object.getDescription():find('PICKUP COPY:',1,true) then"
    assert condition in lua
    lua = lua.replace(condition, condition.replace(' then', ' and not COMMUNITY_ARCHIVED[object.getGUID()] then'), 1)
    lua += '''\nfunction loboCommunityArchive(player)
    local archive=getObjectFromGUID("c0a216")
    if archive and player and player.color and player.color~='Grey' then
        player.lookAt({position=archive.getPosition(),pitch=65,yaw=0,distance=14})
        broadcastToColor('Community Maps Archive: right-click the brown bag and Search for a map. Take out an inner map bag to use it.',player.color,{1,0.85,0.6})
    end
end
'''
    result['LuaScript'] = lua
    result['XmlUI'] = re.sub(r'\d+ MAPS / \d+ GENERAL / \d+ AURORA VII / \d+ TOP 40',
                            '83 ACTIVE / 19 GENERAL / 50 AURORA / 14 TOP 40', result['XmlUI'])
    anchor = ' <Button onClick="loboOverview"'
    assert anchor in result['XmlUI']
    result['XmlUI'] = result['XmlUI'].replace(anchor,
        ' <Button onClick="loboCommunityArchive" rectAlignment="UpperLeft" offsetXY="160 -633" width="120" height="30" color="#73512e" textColor="#ffffff" fontSize="11">ARCHIVE (21)</Button>\n' + anchor, 1)
    result['SaveName'] = SAVE_NAME
    result['LuaScriptState'] = ''
    # Compare entire original bags, not a subset of their properties.
    original_by_id = {o['GUID']: o for o in original['ObjectStates']}
    for bag in [o for o in result['ObjectStates'] if o.get('Nickname', '').startswith('SET_')] + archived:
        assert bag == original_by_id[bag['GUID']], bag['GUID']
    assert len([o for o in result['ObjectStates'] if o.get('Nickname', '').startswith('SET_')]) == 83
    return result, archive


def build(source, output):
    original = json.loads(Path(source).read_text())
    save, archive = archive_save(original)
    output.mkdir(parents=True, exist_ok=True)
    payload = encoded(save)
    archive_payload = encoded({'ObjectStates': [archive]})
    sha = hashlib.sha256(payload).hexdigest()
    ps1 = r'''param([string]$TtsRoot)
$ErrorActionPreference = 'Stop'
if (-not $TtsRoot) { $TtsRoot = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'My Games\Tabletop Simulator' }
$source = Join-Path $PSScriptRoot 'Lobo-Community-Archive-Ready.json'
if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant() -ne '__SHA__') { throw 'Save integrity check failed. Extract the complete installer again.' }
$saves = Join-Path $TtsRoot 'Saves'
$objects = Join-Path $saves 'Saved Objects'
New-Item -ItemType Directory -Path $saves -Force | Out-Null
New-Item -ItemType Directory -Path $objects -Force | Out-Null
$slot = 1
do { $destination = Join-Path $saves ('TS_Save_' + $slot + '.json'); $slot++ } while (Test-Path -LiteralPath $destination)
Copy-Item -LiteralPath $source -Destination $destination
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Lobo-Community-Maps-Archive.json') -Destination (Join-Path $objects 'Lobo-Community-Maps-Archive.json') -Force
if ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant() -ne '__SHA__') { throw 'Installed save verification failed.' }
Write-Host ''
Write-Host 'Installed: Lobo Infinity Maps - Community Archive' -ForegroundColor Green
Write-Host 'Open TTS > Games > Save & Load and load that save.'
Write-Host 'The brown Community Maps Archive bag contains all 21 older setups.'
Write-Host 'Then Upload > Workshop Upload > Update Workshop > item 3719263238.'
Write-Host 'Your other save slots have been preserved.'
if (-not $env:LOBO_INSTALLER_NO_BROWSER) { Start-Process 'https://steamcommunity.com/sharedfiles/filedetails/?id=3719263238' }
'''.replace('__SHA__', sha)
    readme = ('LOBO INFINITY MAPS - COMMUNITY ARCHIVE\n\n'
        'Extract this entire ZIP and double-click INSTALL.cmd.\n'
        'In TTS, load "' + SAVE_NAME + '" from Games > Save & Load.\n'
        'The main catalogue has 83 active setups. The brown Community Maps Archive bag holds 21 older setups (16 map names).\n'
        'Use ARCHIVE (21) to find the storage bag. Right-click > Search, take out one map bag, and save that inner bag as an Object.\n'
        'To publish: Upload > Workshop Upload > Update Workshop > Lobo\'s Infinity Maps (3719263238).\n'
        'All 104 map payloads and their public asset URLs are preserved. No local asset paths are added.\n'
        'A separate Saved Object containing the archive is installed as well.\n'
        'This is a snapshot of the published collection checked November 16, 2026.\n'
        'Offline content-preservation and catalogue checks passed. Live TTS and Windows execution have not been observed.\n')
    installer = output / 'Lobo-Community-Maps-Archive-Installer.zip'
    with zipfile.ZipFile(installer, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        z.writestr('Lobo-Community-Archive-Ready.json', payload)
        z.writestr('Lobo-Community-Maps-Archive.json', archive_payload)
        z.writestr('INSTALL.ps1', ps1.replace('\n', '\r\n'))
        z.writestr('INSTALL.cmd', '@echo off\r\ncd /d "%~dp0"\r\npowershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0INSTALL.ps1"\r\nif errorlevel 1 echo Installation failed. See the error above.\r\npause\r\n')
        z.writestr('README.txt', readme)
    general = [o for o in save['ObjectStates'] if o.get('Nickname', '').startswith('SET_ITS18')]
    assert len(general) == 19
    with zipfile.ZipFile(output / 'Lobo-Active-ITS18-Map-Bags.zip', 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for bag in general:
            name = re.sub(r'[^A-Za-z0-9._-]+', '-', bag['Nickname'][4:])
            z.writestr(name + '.json', encoded({'ObjectStates': [bag]}))
    # These two portal slots still describe the community maps they replaced.
    for guid, name in [('810053', 'Vanta-Customs-Yard'), ('810108', 'Veyra-Gate')]:
        bag = next(o for o in general if o['GUID'] == guid)
        (output / (name + '.json')).write_bytes(encoded({'ObjectStates': [bag]}))
    inventory = {'date': '2026-11-16', 'workshopId': '3719263238', 'activeSetups': 83,
        'generalSetups': 19, 'top40Setups': 14, 'auroraSetups': 50, 'archivedSetups': 21,
        'archivedMapNames': 16, 'archiveGuid': ARCHIVE_GUID, 'readySaveSha256': sha,
        'archivedMaps': [{'guid': o['GUID'], 'name': o['Nickname']} for o in archive['ContainedObjects']],
        'unchangedMapPayloads': 104}
    (output / 'archive-inventory.json').write_text(json.dumps(inventory, indent=2) + '\n')
    print(json.dumps({'installer': str(installer), 'installerBytes': installer.stat().st_size, **inventory}, indent=2))


if __name__ == '__main__':
    build(sys.argv[1], Path(sys.argv[2]))
