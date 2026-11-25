"""Build the Windows distribution and the installer's checksummed payload."""
from hashlib import sha256
import json
import zipfile

from PIL import Image

from rooftops import PREVIOUS, OUT, ROOT, WORK, RELEASE, MISSION_URL
BASE = PREVIOUS/"base"

ZIPNAME = f'Lobo-Cloudbreak-Array-Workshop-Installer-{RELEASE}.zip'
PREVIEWS = [
    'Cloudbreak-Array-R4-Rooftops.png',
    'Cloudbreak-Array-R4-Skybridge.png',
    'Cloudbreak-Array-R4-Playmat.jpg',
    'Cloudbreak-Array-R4-Courier-Spire.jpg',
    'Cloudbreak-Array-R4-Weather-Lab.jpg',
]


def delivery():
    preview = Image.open(OUT/PREVIEWS[0]).convert('RGB')
    preview.thumbnail((720,720),Image.Resampling.LANCZOS)
    preview.save(WORK/'Preview.png',optimize=True)
    files = {name: OUT/name for name in ('Workshop-Save.json','Play-Table.json','Cloudbreak-Array.json')}
    files['Preview.png'] = WORK/'Preview.png'
    hashes = {name: sha256(path.read_bytes()).hexdigest() for name,path in files.items()}
    payload = WORK/'payload.zip'
    with zipfile.ZipFile(payload,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=7) as archive:
        for name,path in files.items():
            archive.write(path,name)
        archive.writestr('manifest.json',json.dumps(hashes,indent=2))
    with zipfile.ZipFile(OUT/ZIPNAME,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=5) as archive:
        archive.write(payload,'Files/payload.zip',compress_type=zipfile.ZIP_STORED)
        archive.write(WORK/'Lobo-Cloudbreak-Array-Setup.exe','Lobo-Cloudbreak-Array-Setup.exe')
        archive.write(BASE/'INSTALL-CLOUDBREAK-ARRAY.cmd','INSTALL-CLOUDBREAK-ARRAY.cmd')
        archive.write(ROOT/'README.txt','README.txt')
        archive.writestr('Network Node - MissionGeist.url',f'[InternetShortcut]\r\nURL={MISSION_URL}\r\n')
        archive.write(BASE/'Aurora-VII-Network-Node.json','Files/Aurora-VII-Network-Node.json')
        for name in PREVIEWS:
            archive.write(OUT/name,'Review/'+name,compress_type=zipfile.ZIP_STORED)
    with zipfile.ZipFile(OUT/ZIPNAME) as archive:
        assert archive.testzip() is None
    print(ZIPNAME,(OUT/ZIPNAME).stat().st_size,flush=True)


if __name__ == '__main__':
    delivery()
