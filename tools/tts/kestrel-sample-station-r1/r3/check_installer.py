from plan import *
import subprocess,tempfile,io
from zipfile import ZipFile,ZIP_DEFLATED
release=next(D.glob('*.zip'))
with tempfile.TemporaryDirectory() as tmp:
    t=Path(tmp);game=t/'Tabletop Simulator';saves=game/'Saves';saves.mkdir(parents=True)
    previous=saves/'TS_Save_1.json';original=(r2.W/'room.json').read_bytes();previous.write_bytes(original)
    orphan=saves/'TS_Save_2.png';orphan.write_bytes(b'existing thumbnail')
    with ZipFile(release) as z:
        assert z.testzip() is None and z.read('Install.cmd').count(b'Kestrel-Setup.exe')==1
        binary=z.read('Kestrel-Setup.exe');assert binary[:2]==b'MZ' and b'PE\x00\x00' in binary[:2048]
        payload=t/'payload.zip';payload.write_bytes(z.read('Files/payload.zip'))
    def install(file):
        return subprocess.run([str(W/'test-setup'),'-tts-root',str(saves),'-payload',str(file),'-no-pause'],capture_output=True,text=True)
    result=install(payload);assert result.returncode==0,result.stderr
    assert previous.read_bytes()==original and orphan.read_bytes()==b'existing thumbnail'
    assert json.loads((saves/'TS_Save_3.json').read_bytes())['SaveName']==TITLE
    assert (saves/'TS_Save_3.json').read_bytes()==(W/'room.json').read_bytes()
    assert (saves/'TS_Save_3.png').read_bytes()==(W/'Preview.png').read_bytes()
    bags=list((saves/'Saved Objects').rglob('*.json'));assert len(bags)==1 and bags[0].read_bytes()==(W/'bag.json').read_bytes()
    old=set(game.rglob('*'))
    invalid=t/'invalid.zip'
    with ZipFile(payload) as a,ZipFile(invalid,'w',ZIP_DEFLATED) as b:
        for name in a.namelist():
            data=a.read(name)
            if name=='Play-Table.json':data+=b'x'
            b.writestr(name,data)
    result=install(invalid);assert result.returncode and 'checksum failed' in result.stderr and set(game.rglob('*'))==old
    print('Playtest installs beside the existing R2 save; exact table, bag and thumbnail; tampering rejected.')
