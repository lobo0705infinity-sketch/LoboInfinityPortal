from yard import *
from package import FILENAME,PREVIEW
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZipFile,ZIP_DEFLATED
import subprocess,struct,shutil
def verify():
 with TemporaryDirectory()as temp:
  root=Path(temp);files=root/'extracted';tts=root/'Custom TTS data';saves=tts/'Saves';saves.mkdir(parents=True)
  (saves/'TS_Save_1.json').write_text('prior');(saves/'TS_Save_2.png').write_bytes(b'prior thumbnail')
  with ZipFile(D/FILENAME)as z:
   assert z.testzip() is None;z.extractall(files)
  assert (files/'Preview'/PREVIEW).read_bytes()==(D/PREVIEW).read_bytes()
  data=(files/'Vanta-Setup.exe').read_bytes();off=struct.unpack_from('<I',data,0x3c)[0]
  assert data[:2]==b'MZ' and data[off:off+4]==b'PE\0\0' and struct.unpack_from('<H',data,off+4)[0]==0x8664
  native=files/'test-setup';shutil.copy2(W/'test-setup',native)
  payload=files/'Files/payload.zip'
  with ZipFile(payload)as z:
   assert z.testzip() is None;hashes=json.loads(z.read('manifest.json'))
   for n,h in hashes.items():assert hashlib.sha256(z.read(n)).hexdigest()==h
  for i,loc in enumerate([tts,saves]):
   subprocess.run([native,'-no-pause','-tts-root',loc],check=True,capture_output=True)
   stem=saves/('TS_Save_'+str(3+i))
   assert stem.with_suffix('.json').read_bytes()==(W/'Play-Table.json').read_bytes()
   assert stem.with_suffix('.png').read_bytes()==(W/'Preview.png').read_bytes()
   bags=list((saves/'Saved Objects').glob('*/Vanta-Customs-Yard.json'));assert len(bags)==i+1
   assert all(b.read_bytes()==(W/'Vanta-Customs-Yard.json').read_bytes() and b.with_suffix('.png').read_bytes()==(W/'Preview.png').read_bytes()for b in bags)
  assert (saves/'TS_Save_1.json').read_text()=='prior' and (saves/'TS_Save_2.png').read_bytes()==b'prior thumbnail'
  corrupt=root/'corrupt.zip'
  with ZipFile(payload)as orig,ZipFile(corrupt,'w',ZIP_DEFLATED)as z:
   for name in orig.namelist():z.writestr(name,orig.read(name)+(b' 'if name=='Vanta-Customs-Yard.json'else b''))
  before=set(tts.rglob('*'));res=subprocess.run([native,'-no-pause','-tts-root',tts,'-payload',corrupt],capture_output=True)
  assert res.returncode and b'checksum failed'in res.stderr and set(tts.rglob('*'))==before
 out={'twoInstalls':True,'saveSlotsPreserved':True,'sha256':hashlib.sha256((D/FILENAME).read_bytes()).hexdigest(),'previewSha256':hashlib.sha256((D/PREVIEW).read_bytes()).hexdigest()}
 save(W/'installer-qa.json',out);print(out)
if __name__=='__main__':verify()
