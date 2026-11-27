"""Install the shipped payload twice using disposable TTS slots and compare its outputs."""
from hashlib import sha256
from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZipFile, ZIP_DEFLATED
import json
import shutil
import struct
import subprocess
from final_map import D, FILENAME, W, write

def checksum(data):
    return sha256(data).hexdigest()

def test():
    with TemporaryDirectory() as tmp:
        work = Path(tmp)
        with ZipFile(D/FILENAME) as outer:
            assert outer.testzip() is None
            assert set(outer.namelist())=={'Install.cmd','Kestrel-Setup.exe','Files/payload.zip','Readme.txt','Preview/Shuttle-Apron.jpg'}
            outer.extractall(work/'release')
        release=work/'release'
        assert (release/'Install.cmd').read_bytes()==b'@echo off\r\n"%~dp0Kestrel-Setup.exe" %*\r\nexit /b %errorlevel%\r\n'
        pe=(release/'Kestrel-Setup.exe').read_bytes()
        assert pe[:2]==b'MZ'
        off=struct.unpack_from('<I',pe,0x3c)[0]
        assert pe[off:off+4]==b'PE\0\0' and struct.unpack_from('<H',pe,off+4)[0]==0x8664
        # Exercise default payload discovery with the same Go program built for this host.
        native=release/'test-setup'
        shutil.copy2(W/'test-setup',native)
        payload=release/'Files/payload.zip'
        with ZipFile(payload) as z:
            assert z.testzip() is None
            manifest=json.loads(z.read('manifest.json'))
            assert set(manifest)=={'Workshop-Save.json','Play-Table.json','Kestrel-Lunar-Base.json','Preview.png'}
            for name,digest in manifest.items():
                assert checksum(z.read(name))==checksum((W/name).read_bytes())==digest
        tts=work/'Custom Tabletop Simulator'
        saves=tts/'Saves'
        saves.mkdir(parents=True)
        (saves/'TS_Save_1.json').write_bytes(b'preexisting save')
        (saves/'TS_Save_2.png').write_bytes(b'preexisting thumbnail')
        for i in range(2):
            target=tts if i==0 else saves
            subprocess.run([native,'-no-pause','-tts-root',target],check=True,stdout=subprocess.PIPE)
            begin=3+2*i
            for slot,name in ((begin,'Play-Table.json'),(begin+1,'Workshop-Save.json')):
                assert checksum((saves/f'TS_Save_{slot}.json').read_bytes())==manifest[name]
                assert checksum((saves/f'TS_Save_{slot}.png').read_bytes())==manifest['Preview.png']
            bags=list((saves/'Saved Objects').glob('*/Kestrel-Lunar-Base.json'))
            assert len(bags)==i+1
            for bag in bags:
                assert checksum(bag.read_bytes())==manifest['Kestrel-Lunar-Base.json']
                assert checksum(bag.with_suffix('.png').read_bytes())==manifest['Preview.png']
        assert (saves/'TS_Save_1.json').read_bytes()==b'preexisting save'
        assert (saves/'TS_Save_2.png').read_bytes()==b'preexisting thumbnail'
        # Reject a corrupt data file before creating any output.
        bad=work/'corrupt.zip'
        with ZipFile(payload) as original,ZipFile(bad,'w',ZIP_DEFLATED,compresslevel=1) as corrupt:
            for name in original.namelist():
                data=original.read(name)
                if name=='Kestrel-Lunar-Base.json': data+=b' '
                corrupt.writestr(name,data)
        before=set(tts.rglob('*'))
        attempt=subprocess.run([native,'-no-pause','-tts-root',tts,'-payload',bad],capture_output=True)
        assert attempt.returncode!=0 and b'checksum failed' in attempt.stderr
        assert set(tts.rglob('*'))==before
    report={'filename':FILENAME,'archiveSha256':checksum((D/FILENAME).read_bytes()),
            'archiveBytes':(D/FILENAME).stat().st_size,'windowsInstaller':'PE32+ x86-64',
            'nativeTestInstallations':2,'occupiedSlotsPreserved':True,'corruptPayloadRejected':True,
            'installedFilesMatchedManifest':True}
    write(W/'installer-qa.json',report)
    print(report)

if __name__=='__main__':
    test()
