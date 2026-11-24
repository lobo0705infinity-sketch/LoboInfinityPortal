from pathlib import Path
import json,shutil,hashlib,zipfile,subprocess,os
R=Path(__file__).resolve().parents[2];D=R/'map-fixes/dig-20261124';P=D/'package';F=P/'Files';F.mkdir(parents=True,exist_ok=True)
M=R/'lobo-infinity-portal/public/assets/maps/dig-access-20261124'
data=json.loads(Path('/workspace/scratch/0474749e36c3/r14-payload/Workshop-Save.json').read_text())
replacements={n:json.loads((M/f'{n}.json').read_text())['ObjectStates'][0]for n in ['810340','8a1c29']}
def replace(o):
 if o.get('GUID') in replacements:
  t=o['Transform'];o.update(replacements[o['GUID']]);o['Transform']=t
 for c in o.get('ContainedObjects',[]):replace(c)
for o in data['ObjectStates']:replace(o)
data['SaveName']='Lobo Maps - The Dig Access R2'
(F/'Workshop-Save.json').write_text(json.dumps(data,separators=(',',':')))
(F/'control-patches.json').write_text('[]')
shutil.copy('/workspace/scratch/0474749e36c3/r14-payload/Workshop-Save.png',F/'Workshop-Save.png')
names=['Workshop-Save.json','control-patches.json','Workshop-Save.png']
(F/'installer-manifest.json').write_text(json.dumps({'version':'Dig Access R2','files':[{'name':n,'sha256':hashlib.sha256((F/n).read_bytes()).hexdigest()}for n in names]}))
with zipfile.ZipFile(F/'payload.zip','w',zipfile.ZIP_DEFLATED)as z:
 for n in names+['installer-manifest.json']:z.write(F/n,n)
S=D/'installer-src';shutil.copytree(R/'tts-map-controls-standard/installer-src',S,dirs_exist_ok=True)
s=(S/'main.go').read_text().replace('"strings"','"strings"\n "sort"').replace('Lobo Maps - Standard Controls R2','Lobo Maps - The Dig Access R2').replace('Standard Controls R2','The Dig Access R2').replace('Standard-Controls-R2-','Dig-Access-R2-')
a=s.index('func selectSave(');b=s.index('func writeNew(',a)
s=s[:a]+'''func selectSave(root, explicit string, files map[string][]byte, ps []patch) (object, string, int, string, error) {
 updates,e:=decode(files["Workshop-Save.json"]);if e!=nil{return nil,"",0,"",e}
 candidates:=[]string{}
 if explicit!="" { candidates=append(candidates,explicit) } else {
  _=filepath.WalkDir(filepath.Join(root,"Saves"),func(p string,d os.DirEntry,err error)error{
   if err==nil && !d.IsDir() && strings.HasSuffix(strings.ToLower(p),".json") {candidates=append(candidates,p)};return nil
  })
  sort.Slice(candidates,func(i,j int)bool{a,_:=os.Stat(candidates[i]);b,_:=os.Stat(candidates[j]);return a.ModTime().After(b.ModTime())})
 }
 for _,p:=range candidates {
  raw,err:=os.ReadFile(p);if err!=nil{continue};d,err:=decode(raw);if err!=nil{continue}
  found:=map[string]object{};for _,m:=range maps(d){found[str(m,"GUID")]=m}
  if found["810340"]==nil || found["8a1c29"]==nil {continue}
  for _,m:=range maps(updates){if str(m,"GUID")!="810340" && str(m,"GUID")!="8a1c29"{continue};dst:=found[str(m,"GUID")];transform:=dst["Transform"];for k:=range dst{delete(dst,k)};for k,v:=range m{dst[k]=v};dst["Transform"]=transform}
  d["SaveName"]=collectionName
  return d,p,2,"Only The Dig and its Top 40 copy updated; all other maps and controls preserved.",nil
 }
 return updates,"Included current R14 collection",2,"Full current collection with only The Dig and Winners Round 4 updated.",nil
}
''' + s[b:]
(S/'main.go').write_text(s)
subprocess.run(['gofmt','-w','main.go'],cwd=S,check=True)
subprocess.run(['go','build','-buildvcs=false','-o',str(D/'installer-test-bin'),'.'],cwd=S,check=True)
subprocess.run(['go','build','-buildvcs=false','-o',str(P/'Lobo-Dig-Access-Setup.exe'),'.'],cwd=S,env={**os.environ,'GOOS':'windows','GOARCH':'amd64'},check=True)
(P/'INSTALL-DIG-UPDATE.cmd').write_bytes(b'@echo off\r\ncd /d "%~dp0"\r\n"%~dp0Lobo-Dig-Access-Setup.exe" %*\r\n')
(P/'START-HERE.txt').write_text('''LOBO - THE DIG ACCESS UPDATE R2

Extract this ZIP, then run INSTALL-DIG-UPDATE.cmd.
The installer uses your newest saved full Lobo collection when available, otherwise the included current R14 collection, and creates a NEW numbered save named "Lobo Maps - The Dig Access R2". Existing saves remain untouched. It updates The Dig and its Winners Round 4 copy; other maps remain unchanged.

If you have unsaved personal collection changes in TTS, save your collection before running this installer so those changes are retained.

Load the NEW save in TTS. Review The Dig. To publish your complete collection, use Upload > Workshop Upload > Update Workshop (3719263238). The installer opens that Workshop page in your browser; Steam publication is still performed inside TTS.

Changes: two pictured annex buildings and Civic Corner West use internal floor-to-floor ladders instead of stairs; Civic Corner West exterior ladder moved to a clear wall; Tenement South and Central Ruined Block each gain a second-floor-to-ledge ladder. Map name added to existing header. Every other control is unchanged.

All models use public URLs and work on other PCs. Offline mesh, collision, Lua and actual-button simulations passed. Live TTS physics/visual review remains necessary.
''')
for n in names+['installer-manifest.json']:(F/n).unlink()
print(P)
