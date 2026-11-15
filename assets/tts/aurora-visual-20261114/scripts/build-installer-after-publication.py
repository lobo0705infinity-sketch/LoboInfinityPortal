import pathlib,json,hashlib,shutil,csv,zipfile
root=pathlib.Path('/workspace/scratch/0a8319f0878e');out=root/'output';package=out/'Aurora-VII-Installer';package.mkdir(exist_ok=True)
for source,target in [('Workshop-Save.json','Workshop-Save.json'),('validation.json','validation.json'),('hosted-assets-validation.json','hosted-assets-validation.json'),('Aurora-VII-24-Location-Building-Preview.jpg','Building-Preview.jpg')]:shutil.copy2(out/source,package/target)
shutil.copy2(root/'baseline/Workshop-Save.png',package/'Workshop-Save.png')
hash=hashlib.sha256((package/'Workshop-Save.json').read_bytes()).hexdigest().upper()
s=(root/'baseline/Install-Workshop.ps1').read_text();start=s.index("    $sourceAssets =");end=s.index('\n    $slot =',start)
s=s[:start]+"    [IO.File]::Copy($payload, $tempSave, $false)\n    if ((Get-FileHash -LiteralPath $tempSave -Algorithm SHA256).Hash -ne $expected) { throw 'Installed save checksum failed.' }\n"+s[end:]
s=s.replace('F7CF4C04AE11FCF9222AF6AE86232C25811C7C4B9AB1E751EB6440B659C200C5',hash).replace('Lobo Infinity Maps - All 104 Raised Boards and Visual Update - Stage and Verdant Fix','Lobo Infinity Maps - Aurora VII 24 Locations Visual Refresh - R1').replace('Upload the bundled local textures through Cloud Manager first. Then use','All visual assets are already hosted publicly. Use')
(package/'Install-Workshop.ps1').write_text(s,newline='\r\n')
(package/'INSTALL.cmd').write_text('@echo off\nsetlocal\nif "%~1"=="" (\n  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Workshop.ps1"\n) else (\n  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-Workshop.ps1" -TtsRoot "%~1"\n)\nset "LOBO_INSTALL_EXIT=%ERRORLEVEL%"\necho.\npause\nexit /b %LOBO_INSTALL_EXIT%\n',newline='\r\n')
(package/'START-HERE.txt').write_text('''LOBO INFINITY — AURORA VII 24-LOCATION VISUAL REFRESH — R1

1. Extract this entire ZIP to a folder on your Windows PC.
2. Double-click INSTALL.cmd. It installs a NEW save slot and opens Workshop item 3719263238 in your browser.
3. In Tabletop Simulator, open Games > Save & Load and load:
   Lobo Infinity Maps - Aurora VII 24 Locations Visual Refresh - R1
4. Use the existing stage/map-bag controls. All 24 Aurora VII locations have been refreshed in BOTH Frontline and Supremacy.
5. To publish your collection update: Upload > Workshop Upload > Update Workshop; enter 3719263238; click Update.

All new assets use public HTTPS URLs pinned to an exact source commit. The installer copies the ready save unchanged. The save does not require this extracted folder or textures from your PC after installation.

Custom TTS data directory: drag that Tabletop Simulator data folder onto INSTALL.cmd. Existing saves are not overwritten. If the normal Saves folder is absent, open TTS and save a game once first.

Includes the approved full 104-map collection, with this visual refresh applied only to the 48 Aurora VII territorial setups. Building materials, room finishes, artwork and signs were updated. Furniture geometry, raised platforms, collision, transforms, state keys and control scripts were retained.

Validation status: all offline geometry/JSON/coverage checks and exact public-asset download checks passed. Representative roof-on/roof-off renders were reviewed for all 24 locations. Live TTS import, fresh-cache loading, miniature state-switching, multiplayer and Windows installer execution have not been observed. The polar models retain their original open-shell geometry; this release changes their materials and wall artwork, not that geometry. Steam publication has not been performed automatically.

See VALIDATION.md, Location-Coverage.csv and Building-Preview.jpg.
''')
assets=root/'aurora-source/assets/tts/aurora-visual-20261114';audit=json.load(open(assets/'coverage.json'));v=json.load(open(out/'validation.json'));host=json.load(open(out/'hosted-assets-validation.json'))
with (package/'Location-Coverage.csv').open('w',newline='') as f:
 w=csv.writer(f);w.writerow(['Territory','Location','Missions','Building instances','Building states','Wall panels across states','Texture atlas'])
 for loc in dict.fromkeys(r['location'] for r in audit):
  rows=[r for r in audit if r['location']==loc];w.writerow([rows[0]['territory'],loc,'Frontline + Supremacy',sum(r['buildings'] for r in rows),sum(r['states'] for r in rows),sum(r['new_panels'] for r in rows),rows[0]['atlas']])
report=f'''# Aurora VII visual refresh — validation

24 locations, 48 mission setups, {v['building_instances']} building instances and {v['building_states']} states updated. The save retains the full 104-map collection.

- 24 distinct RGB material/artwork atlases; exterior and interior materials remapped; wall illustrations, controls and signs added.
- {v['unique_new_meshes']} mesh variants checked; {v['new_wall_panels_across_states']} panels across all saved states.
- Original triangles and vertex identity retained. Collider URLs, transforms, state keys, scripts, raised platforms and controls compared unchanged against the approved baseline.
- All meshes triangulated with valid indices and finite coordinates/UVs. Maximum effective vertex count: {v['max_expanded_vertices']} (under 25,000).
- {v['decoded_texture_files']} textures decoded. {v['typed_colors_checked']} numeric color structures checked; {v['nested_objects_checked']} nested objects inspected.
- {host['asset_count']} exact public release URLs downloaded, returned HTTP 200 and matched local SHA-256 hashes. Includes inherited texture bytes relocated to public hosting. Unchanged legacy assets were not republished.
- No local file URLs, local drive asset paths or unresolved asset placeholders remain in the ready save.
- Representative building renders, with roofs present and removed, reviewed for all 24 locations. Canopy vertex welding and coastal atlas alignment defects found during review were corrected.
- ZIP integrity and packaged save SHA-256 verified. Installer copies into a free save slot and verifies the save hash.

## Remaining runtime checks

Live Tabletop Simulator import, a clean-cache load, state switching with miniatures, multiplayer access, performance timings and Windows installer execution have not been observed here. Do not treat offline checks as proof of those runtime behaviors. Steam Workshop publication has not been performed.

The polar representative buildings retain pre-existing open-shell geometry also visible in the approved source models. That geometry is outside this material/artwork refresh and remains present; it should be checked in TTS. Existing furniture geometry was retained, not replaced with new furniture models.

## Release identity

Asset commit: `{host['commit']}`

Ready save SHA-256: `{hash}`

Workshop item: https://steamcommunity.com/sharedfiles/filedetails/?id=3719263238
'''
(package/'VALIDATION.md').write_text(report);(out/'Aurora-VII-Visual-Refresh-Validation.md').write_text(report)
zipname=out/'Lobo-Aurora-VII-24-Location-Visual-Refresh-Installer.zip'
with zipfile.ZipFile(zipname,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(package.iterdir()):z.write(p,p.name)
with zipfile.ZipFile(zipname) as z:
 assert z.testzip() is None
 assert hashlib.sha256(z.read('Workshop-Save.json')).hexdigest().upper()==hash
 assert '__LOBO' not in z.read('Workshop-Save.json').decode() and '__AURORA' not in z.read('Workshop-Save.json').decode()
 assert hash in z.read('Install-Workshop.ps1').decode()
print(json.dumps({'zip':str(zipname),'bytes':zipname.stat().st_size,'sha256':hashlib.sha256(zipname.read_bytes()).hexdigest(),'save_sha256':hash},indent=2))
