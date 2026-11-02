from pathlib import Path
import json,re,shutil
R=Path(__file__).resolve().parent;O=R/'five-release';A=R/'five-portal/lobo-infinity-portal';M=R/'five-merge-inputs';P=A/'public/assets/maps/approved-five-map-update-20261102-r1'
def load(p):return json.loads(p.read_text())
def write(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
c=load(O/'Files/Lobo-Workshop-Current-Maps-and-Rules.json');c['ObjectStates']=[o for o in c['ObjectStates']if o['GUID']!='e1da22'];catalogue=load(O/'Source/catalogue.json');catalogue=[r for r in catalogue if r['guid']!='e1da22']
def lua(v):
 if isinstance(v,dict):return '{'+','.join('['+json.dumps(k)+']='+lua(q)for k,q in v.items())+'}'
 if isinstance(v,list):return '{'+','.join(lua(q)for q in v)+'}'
 if isinstance(v,str):return json.dumps(v,ensure_ascii=False)
 if isinstance(v,bool):return str(v).lower()
 if v is None:return 'nil'
 return repr(v)
c['LuaScript']=re.sub(r'^local ITEMS = .*$',lambda _:'local ITEMS = '+lua(catalogue),c['LuaScript'],count=1,flags=re.M);write(O/'Files/Lobo-Workshop-Current-Maps-and-Rules.json',c);write(O/'Source/catalogue.json',catalogue)
index=load(O/'Source/saved-object-index.json');write(O/'Source/saved-object-index.json',[r for r in index if r['guid']!='e1da22'])
pairs=load(O/'Source/map-pairs.json');write(O/'Source/map-pairs.json',[p for p in pairs if p['name']!='Kestrel Lunar Base'])
for ext in ['.json','.png']:
 p=O/'Saved-Objects'/('Lobos Top 40 Kestrel Lunar Base - Data Harvest'+ext)
 if p.exists():p.unlink()
write(O/'Source/retired-map-index.json',[dict(guid='e1da22',name='Lobos Top 40 Kestrel Lunar Base - Data Harvest')])
# Keep all newer portal changes, then add only the five approved assignments.
old=(A/'shared/top40-round-maps.mjs').read_text();start=old.index('[',old.index('export const TOP40_ROUND_MAPS'));end=old.index('\n]',start)+2;five=[m for m in json.loads(old[start:end])if m['bracket']=='Losers'and m['round']in [3,4,5,6,7]]
s=(M/'top40-round-maps.mjs').read_text();start=s.index('[',s.index('export const TOP40_ROUND_MAPS'));end=s.index('\n]',start)+2;rows=json.loads(s[start:end])+five;rows.sort(key=lambda m:(m['bracket']=='Losers',m['round']));s=s[:start]+json.dumps(rows,ensure_ascii=False,indent=2)+s[end:];s=s.replace('/assets/maps/seven-map-update-20261102-r1/Lobo-Seven-Map-Workshop-Update-Installer.zip','/assets/maps/approved-five-map-update-20261102-r1/Lobo-Five-Map-Workshop-Update-Installer.zip');(A/'shared/top40-round-maps.mjs').write_text(s)
meta=load(A/'shared/lobo-workshop-current.json');latest=load(M/'lobo-workshop-current.json');next(m for m in meta['maps']if m['guid']=='1008da')['sourceNote']=next(m for m in latest['maps']if m['guid']=='1008da')['sourceNote'];write(A/'shared/lobo-workshop-current.json',meta)
for name,folder in [('top40-round-maps.d.mts','shared'),('public-search-content.mjs','shared'),('public-search-page-check.mjs','scripts'),('sitemap-check.mjs','scripts'),('vercel.json','')]:shutil.copy2(M/name,A/folder/name)
for name in ['Top40MapPage.tsx','Top40PreparationPage.tsx']:
 s=(M/name).read_text().replace('Download the seven-map installer (ZIP)','Download the current map update installer (ZIP)').replace('Six Top 40 bags, their six general mission copies, and Nereid’s Aurora VII terrain bag','Ten Top 40 bags, eleven general mission bags, and Nereid’s Aurora VII terrain bag').replace('Includes all six Top 40 bags and their general copies, plus Nereid for Aurora VII.','Includes all ten Top 40 bags, eleven general bags, and Nereid for Aurora VII.').replace('Lobo’s Infinity Maps - Seven Map Update R1','Lobo’s Infinity Maps - Five Map Update R1')
 (A/'src/public'/name).write_text(s)
p=A/'scripts/top40-maps-scores-check.mts';s=(M/p.name).read_text().replace("map!=='TBD').length,5","map!=='TBD').length,10").replace("map==='TBD').length,9","map==='TBD').length,4").replace('TOP40_MAPS.length,5','TOP40_MAPS.length,10').replace("r.maps[0]==='TBD').length,9","r.maps[0]==='TBD').length,4").replace('five assigned round maps, nine TBD slots','ten assigned round maps, four TBD slots').replace('same five/TBD','same ten/TBD');p.write_text(s)
p=O/'Install.ps1';s=p.read_text(encoding='utf-8-sig').replace('$items.Count -ne 48','$items.Count -ne 46').replace('all 23 named map pairs','all 22 named map pairs').replace('23 map bags','22 map bags');anchor="    Write-Host 'Installed five approved map replacements and the updated collection.'"
retirement='''    # Remove the retired tournament-only Kestrel copy, preserving its general map.
    $retireNames = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'Source/retired-map-index.json') -Raw | ConvertFrom-Json
    foreach ($row in $retireNames) {
        foreach ($folder in @('Saved Objects', 'Saved Objects/Lobo Workshop - Current Maps')) {
            foreach ($stem in @([string]$row.name, [string]$row.guid)) {
                $jsonPath = Join-Path $saves ($folder + '/' + $stem + '.json')
                if (-not (Test-Path -LiteralPath $jsonPath -PathType Leaf)) { continue }
                try { $data = Get-Content -LiteralPath $jsonPath -Raw | ConvertFrom-Json } catch { continue }
                if (@($data.ObjectStates).Count -ne 1 -or [string]$data.ObjectStates[0].GUID -ne [string]$row.guid -or [string]$data.ObjectStates[0].Nickname -notlike 'SET_*') { continue }
                foreach ($extension in @('.json', '.png')) {
                    $relative = $folder + '/' + $stem + $extension
                    $oldFile = Join-Path $saves $relative
                    if (-not (Test-Path -LiteralPath $oldFile -PathType Leaf)) { continue }
                    $oldBackup = Join-Path $backup ('Retired-Top40-Copies/' + $relative)
                    $null = New-Item -ItemType Directory -Path (Split-Path $oldBackup -Parent) -Force
                    Copy-Item -LiteralPath $oldFile -Destination $oldBackup -Force
                    if ((Get-FileHash $oldFile -Algorithm SHA256).Hash -ne (Get-FileHash $oldBackup -Algorithm SHA256).Hash) { throw ('Retirement backup failed: ' + $relative) }
                    $retired += [pscustomobject]@{Path=$oldFile; Backup=$oldBackup}
                    Remove-Item -LiteralPath $oldFile
                }
            }
        }
    }
'''
assert anchor in s;s=s.replace(anchor,retirement+anchor);p.write_bytes(b'\xef\xbb\xbf'+s.replace('\r\n','\n').replace('\n','\r\n').encode())
for p in [O/'START-HERE.txt',A/'docs/five-map-update-20261102.md']:
 s=p.read_text().replace('11 Top 40','10 Top 40').replace('23 named','22 named').replace('the earlier 13 named bags plus','the earlier twelve named bags (retired Top 40 Kestrel excluded) plus').replace('Kestrel remains an additional Data Harvest map without an assigned round.','Kestrel remains only in the general Data Harvest pool. Its retired Top 40 copy is backed up and removed.').replace('Kestrel remains the additional Data Harvest entry without a tournament round.','Kestrel remains in the general Data Harvest pool only, preserving the latest portal correction.');p.write_text(s)
p=R/'validate_five.py';s=p.read_text().replace("if o['GUID']!='100e3e':","if o['GUID']not in ['100e3e','e1da22']:").replace('campaign=50,top40=11','campaign=50,top40=10');p.write_text(s)
p=O/'Source/test_catalogue.py';s=p.read_text().replace("startswith('11 results')","startswith('10 results')").replace("('top40',11),('all',101)","('top40',10),('all',100)");p.write_text(s)
p=O/'Source/test_installer.py';s=p.read_text().replace('len(entries)==48','len(entries)==46').replace("*.json')))==11","*.json')))==10").replace('installedFiles=48,namedBags=23,top40Bags=11','installedFiles=46,namedBags=22,top40Bags=10')
s=s.replace("run(OUT,tts);assert all(sha(target(tts,e))==e['sha256']for e in entries);assert unrelated.read_bytes()==unrelated_bytes;assert not legacy.exists()","kestrel=tts/'Saves/Saved Objects/Lobos Top 40 Kestrel Lunar Base - Data Harvest.json';kestrel.write_text(json.dumps(dict(ObjectStates=[dict(GUID='e1da22',Nickname=\"SET_Lobo's Top 40 Kestrel Lunar Base — Data Harvest\")])));kestrel_bytes=kestrel.read_bytes()\n run(OUT,tts);assert all(sha(target(tts,e))==e['sha256']for e in entries);assert unrelated.read_bytes()==unrelated_bytes;assert not legacy.exists();assert not kestrel.exists()")
s=s.replace("assert (backup/'Previous-GUID-Copies/Saved Objects/1007ad.json').read_bytes()==legacy_bytes","assert (backup/'Previous-GUID-Copies/Saved Objects/1007ad.json').read_bytes()==legacy_bytes\n assert (backup/'Retired-Top40-Copies/Saved Objects/Lobos Top 40 Kestrel Lunar Base - Data Harvest.json').read_bytes()==kestrel_bytes\n assert (tts/'Saves/Saved Objects/Kestrel Lunar Base - Data Harvest.json').exists()")
p.write_text(s)
p=R/'package_five.py';s=p.read_text().replace('assert len(manifest)==48','assert len(manifest)==46').replace("'package_five.py']","'package_five.py','reconcile_kestrel.py']");p.write_text(s)
p=R/'prepare_five_portal.py';s=p.read_text().replace('top40Maps=11','top40Maps=10');p.write_text(s)
print('Preserved latest Kestrel correction in portal and installer; 40 general + 50 Aurora VII + 10 Top 40, 22 named bags.')
