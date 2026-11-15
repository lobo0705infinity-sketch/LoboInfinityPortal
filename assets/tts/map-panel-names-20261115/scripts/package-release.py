#!/usr/bin/env python3
"""Package the validated map-name update, retaining the existing install flow."""
import hashlib,json,pathlib,shutil,sys,zipfile

package,checks,release=map(pathlib.Path,sys.argv[1:])
release.mkdir(parents=True,exist_ok=True)
v=json.loads((checks/'validation.json').read_text())
a=json.loads((package/'assets-validation.json').read_text())
assert v['all_passed'] and a['all_passed']
save=json.loads((package/'Workshop-Save.json').read_text())
digest=hashlib.sha256((package/'Workshop-Save.json').read_bytes()).hexdigest()
assert digest.upper() in (package/'Install-Workshop.ps1').read_text()
shutil.copy2(checks/'validation.json',package/'validation.json')
(package/'START-HERE.txt').write_text(f'''LOBO INFINITY MAPS - MAP NAMES ON ALL CONTROL PANELS - RC1

1. Extract this entire ZIP.
2. Double-click INSTALL.cmd. It adds a NEW save slot and opens Workshop item 3719263238.
3. In TTS, select Games > Save & Load and load:
   {save['SaveName']}
4. Drop a map bag on the Stage. Its name appears beneath Map Controls and on the collapsed controls tab.
5. To publish the collection: Upload > Workshop Upload > Update Workshop, item 3719263238, then Update.

All 104 map setups are included: ITS18, Aurora VII, narrative maps and Top 40 copies.
The refreshed Aurora VII artwork is retained. Existing terrain, textures, placement,
raised platforms, floor states, missions and controls are preserved.

Existing saves are not overwritten. To use a custom TTS data directory, drag it onto INSTALL.cmd.
All assets remain publicly hosted. No local asset uploads or path changes are required.

This is a release candidate: actual TTS loading, fresh-cache loading, multiplayer and
Windows installer execution were not tested here. Steam Workshop has not been updated automatically.
See VALIDATION.md and Map-Name-Coverage.csv.
''')
report=f'''# Infinity map names on control panels — RC1

Each of the 104 map setups now displays its map name beneath the Map Controls heading and on the collapsed tab. Names follow the approved save's labels, including Vanta Customs Yard and Veyra Gate. All Top 40 copies use their actual map name.

## Verification

- {v['named_controllers']} controllers across all 104 setups updated; {v['unique_map_names']} distinct map names.
- All 8 existing drawer implementations retained and compiled in Lua, along with every changed controller.
- {v['broker_name_lifecycle_runs']} Lua execution checks cover every name on every drawer variant: opening, per-player closing/reopening, two controllers sharing a map, callback routing, switching maps and anchor cleanup. No duplicate or stale title after clearing.
- All names fit both existing panel widths and the collapsed tab in the offline font/layout check. Representative layouts visually reviewed.
- The exact save comparison found only 162 controller Lua edits plus SaveName. All remaining fields — including object transforms, collision, assets, states, bag scripts, Stage and global scripts — are identical to the Aurora VII RC1 baseline.
- {v['typed_colors_checked']} typed color structures checked; notebook color/id types retained. No file URLs or unresolved asset placeholders introduced.
- {a['count']} exact public asset URLs downloaded successfully and matched the prior source audit's SHA-256 hashes ({a['total_bytes']:,} bytes). {a['decoded_images']} textures decoded; {a['parsed_meshes']} meshes/colliders parsed. Existing geometry/footprint validation remains applicable because every asset and transform is unchanged.
- Installer uses a new free save slot, copies the ready save unchanged and checks SHA-256. Packaged ZIP integrity and payload checksum verified.

## Runtime status

Live TTS import, fresh-cache loading, two-client multiplayer, load timings and Windows installer execution remain untested. This is an offline-validated release candidate. Steam Workshop publication has not been performed.

## Source and identity

- Baseline: Aurora VII RC1 installer, repository commit `76b7102294bb70133361625f3297e80852d6ec7e`.
- No asset URL was added, removed or repointed. The baseline's original public asset commits are retained.
- Save: **{save['SaveName']}**
- Save SHA-256: `{digest}`
- Workshop item: https://steamcommunity.com/sharedfiles/filedetails/?id=3719263238
'''
(package/'VALIDATION.md').write_text(report)
(release/'VALIDATION.md').write_text(report)
shutil.copy2(package/'Map-Name-Coverage.csv',release/'Map-Name-Coverage.csv')
archive=release/'Lobo-Infinity-All-104-Map-Names-Installer.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in sorted(package.iterdir()):
        if p.is_file():z.write(p,p.name)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert hashlib.sha256(z.read('Workshop-Save.json')).hexdigest()==digest
    assert digest.upper().encode() in z.read('Install-Workshop.ps1')
    assert b'file://' not in z.read('Workshop-Save.json')
    assert not any(x in z.read('Workshop-Save.json') for x in [b'__LOBO',b'__AURORA'])
summary={'archive':archive.name,'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'save_sha256':digest,'validation':v,'asset_count':a['count']}
(release/'release.json').write_text(json.dumps(summary,indent=2))
print(json.dumps(summary,indent=2))
