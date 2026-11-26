import json,io,hashlib,pathlib,shutil,subprocess,tempfile,zipfile
r=pathlib.Path(__file__).resolve().parent
archive=r/'delivery/Lobo-Azure-Palace-Workshop-Installer-R7.zip'
with tempfile.TemporaryDirectory() as td:
 parent=pathlib.Path(td); dest=parent/'Installer folder';home=parent/'Tabletop Simulator';saves=home/'Saves';saves.mkdir(parents=True)
 with zipfile.ZipFile(archive) as z:
  assert z.testzip() is None
  assert set(z.namelist())=={'Install.cmd','Lobo-Azure-Palace-Setup.exe','Readme.txt','Files/payload.zip'}
  assert b'Lobo-Azure-Palace-Setup.exe' in z.read('Install.cmd') and z.read('Lobo-Azure-Palace-Setup.exe')[:2]==b'MZ'
  z.extractall(dest)
 with zipfile.ZipFile(dest/'Files/payload.zip') as z:
  assert z.testzip() is None
  manifest=json.loads(z.read('manifest.json'));assert len(manifest)==5
  assert all(hashlib.sha256(z.read(k)).hexdigest()==h for k,h in manifest.items())
  for n in ('Workshop-Save.json','Play-Table.json','Azure-Palace.json','Azure-Palace-Scatter.json'):
   val=z.read(n)
   assert b'placeholder.invalid' not in val and b'preview.invalid' not in val
   assert (b'/azure-palace-r4/Assets/' if n=='Azure-Palace-Scatter.json' else b'/azure-palace-r7/Assets/') in val
  assert all(manifest[n]==hashlib.sha256((r/'Release'/n).read_bytes()).hexdigest()for n in manifest)
 (saves/'TS_Save_1.json').write_bytes(b'existing save');(saves/'TS_Save_2.png').write_bytes(b'existing thumbnail')
 shutil.copy2(r/'install-test',dest/'setup-test')
 for i,p in enumerate([home,saves]):
  result=subprocess.run([str(dest/'setup-test'),'-no-pause','-no-browser','-tts-root',str(p)],cwd=dest,capture_output=True,text=True)
  assert result.returncode==0,result.stdout+result.stderr
  for filename,j in [('Play-Table.json',3+i*2),('Workshop-Save.json',4+i*2)]:
   installed=saves/f'TS_Save_{j}.json'
   assert hashlib.sha256(installed.read_bytes()).hexdigest()==manifest[filename]
   assert hashlib.sha256(installed.with_suffix('.png').read_bytes()).hexdigest()==manifest['Preview.png']
 assert (saves/'TS_Save_1.json').read_bytes()==b'existing save' and (saves/'TS_Save_2.png').read_bytes()==b'existing thumbnail'
 assert not (saves/'Saves').exists()
 bags=list((saves/'Saved Objects').iterdir());assert len(bags)==2
 for d in bags:
  for n in ['Azure-Palace.json','Azure-Palace-Scatter.json']:
   assert hashlib.sha256((d/n).read_bytes()).hexdigest()==manifest[n]
 before={str(f.relative_to(home)):f.stat().st_size for f in home.rglob('*')}
 bad=dest/'damaged.zip'
 with zipfile.ZipFile(dest/'Files/payload.zip') as original,zipfile.ZipFile(bad,'w') as z:
  for k in original.namelist():z.writestr(k,original.read(k) if k!='Preview.png' else b'bad')
 result=subprocess.run([str(dest/'setup-test'),'-no-pause','-no-browser','-tts-root',str(saves),'-payload',str(bad)],capture_output=True,text=True)
 assert result.returncode and 'checksum failed' in result.stdout
 assert before=={str(f.relative_to(home)):f.stat().st_size for f in home.rglob('*')}
print('Install, repeat installation, Saves-folder detection, payload integrity, existing save and thumbnail preservation and damaged-payload rollback all passed.')
