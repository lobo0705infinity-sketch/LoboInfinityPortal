#!/usr/bin/env python3
"""Add map names to all drawer variants in the approved 104-setup save.

Usage: build.py BASELINE_DIRECTORY CATALOG_JSON OUTPUT_DIRECTORY
Only map controller Lua and SaveName change. No hosted assets are changed.
"""
import copy, csv, hashlib, json, pathlib, re, shutil, sys

BROKER = re.compile(r'local loboLifeBrokerData=("(?:[^"\\]|\\.)*")')
TOP40 = {
    'ca7100': '8100c6', '3d6a97': '100f50', '03c892': '1010b1',
    '8a1c29': '810340', 'f50418': '1002d9', 'a7c0c1': '100135',
    'bc0000': '1007ad', 'bc005f': '8101d2', 'bc00b7': '100326',
    'bc0117': '810241', 'bd0003': '100e3e', 'ff1100': '100993',
    '1e880b': '8102b2', 'df2866': '1005e4',
}

def replace_once(text, before, after):
    assert text.count(before) == 1, (before, text.count(before))
    return text.replace(before, after, 1)

def patch_broker(script):
    script = replace_once(script, 'owner=p.owner,anchor=p.anchor,token=nextToken,',
                          'owner=p.owner,anchor=p.anchor,mapName=p.mapName,token=nextToken,')
    script = replace_once(script, 'function loboUIFlush()',
                          pathlib.Path(__file__).with_name('map-name-header.lua').read_text()+'\nfunction loboUIFlush()')
    return replace_once(script, 'local nodes=drawerRender(view());',
                        'local nodes=loboNamedDrawer(drawerRender(view()));')

def patch_controller(script, name):
    match = BROKER.search(script)
    if not match:
        return None
    assert len(BROKER.findall(script)) == 1
    broker = json.loads(json.loads(match[1]))
    broker['LuaScript'] = patch_broker(broker['LuaScript'])
    encoded = json.dumps(json.dumps(broker, ensure_ascii=False, separators=(',', ':')), ensure_ascii=False)
    script = script[:match.start(1)] + encoded + script[match.end(1):]
    pattern = r"(broker\.call\('loboUIRegister',\{)([^\n}]+)(\}\))"
    script, count = re.subn(pattern, r'\1mapName=loboLifeMapName,\2\3', script)
    assert count == 1, count
    return 'local loboLifeMapName='+json.dumps(name, ensure_ascii=False)+'\n'+script

def walk_objects(objects):
    for obj in objects:
        yield obj
        yield from walk_objects(obj.get('ContainedObjects', []))
        yield from walk_objects(list(obj.get('States', {}).values()))

def main():
    baseline, catalog, out = map(pathlib.Path, sys.argv[1:])
    out.mkdir(parents=True, exist_ok=True)
    save = json.loads((baseline/'Workshop-Save.json').read_text())
    original = copy.deepcopy(save)
    names = {m['guid']: m['name'] for m in json.loads(catalog.read_text())['maps']}
    # The installed save contains newer names than two portal catalog entries.
    # Prefer its approved bag labels (Vanta Customs Yard and Veyra Gate).
    for bag in save['ObjectStates']:
        label=bag.get('Nickname','')
        if label.startswith('SET_ITS18 '):
            parts=re.split(r' — | - ',label)
            assert len(parts)>=2,label
            names[bag['GUID']]=re.sub(r' R\d+$','',parts[1])
    rows=[]
    for bag in save['ObjectStates']:
        label=bag.get('Nickname','')
        if not label.startswith('SET_'):
            continue
        guid=bag['GUID']
        if guid in TOP40:
            name=names[TOP40[guid]]
        elif guid in names:
            name=names[guid]
        else:
            parts=label.removeprefix('SET_').split(' · ')
            assert len(parts)>=3, label
            name=re.sub(r' R\d+$','',parts[1])
        controllers=[]
        for obj in walk_objects(bag.get('ContainedObjects', [])):
            patched=patch_controller(obj.get('LuaScript',''), name)
            if patched:
                obj['LuaScript']=patched
                controllers.append(obj['GUID'])
        assert controllers, label
        rows.append({'bag_guid':guid,'bag_label':label,'map_name':name,'controller_guids':controllers})
    assert len(rows)==104, len(rows)
    save['SaveName']='Lobo Infinity Maps - All 104 Map Names on Controls - RC1'
    (out/'Workshop-Save.json').write_text(json.dumps(save,ensure_ascii=False,separators=(',',':')))
    with (out/'Map-Name-Coverage.csv').open('w',newline='') as f:
        w=csv.writer(f);w.writerow(['Bag GUID','Bag label','Map name','Controller GUIDs'])
        for r in rows:w.writerow([r['bag_guid'],r['bag_label'],r['map_name'],';'.join(r['controller_guids'])])
    (out/'map-name-coverage.json').write_text(json.dumps(rows,indent=2,ensure_ascii=False))
    for filename in ['Workshop-Save.png','INSTALL.cmd']:
        shutil.copy2(baseline/filename,out/filename)
    digest=hashlib.sha256((out/'Workshop-Save.json').read_bytes()).hexdigest().upper()
    ps=(baseline/'Install-Workshop.ps1').read_text()
    ps=re.sub(r"\$expected = '[A-F0-9]{64}'",f"$expected = '{digest}'",ps)
    ps=ps.replace(original['SaveName'],save['SaveName'])
    (out/'Install-Workshop.ps1').write_text(ps,newline='\r\n')
    print(json.dumps({'setups':len(rows),'controllers':sum(len(r['controller_guids']) for r in rows),'save_sha256':digest}))

if __name__=='__main__':
    main()
