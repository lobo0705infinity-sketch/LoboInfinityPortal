"""Build the Windows distribution and the installer's checksummed payload."""
from hashlib import sha256
import json
import zipfile

from PIL import Image

from district import BASE, OUT3, SOURCES, WORK3

ZIPNAME = 'Lobo-Cloudbreak-Array-Workshop-Installer-R3.zip'
PREVIEWS = [
    'Cloudbreak-Array-R3-Rooftops.png',
    'Cloudbreak-Array-R3-Glasshouse.png',
    'Cloudbreak-Array-R3-Sightlines.jpg',
]


def delivery():
    preview = Image.open(OUT3/PREVIEWS[0]).convert('RGB')
    preview.thumbnail((720,720),Image.Resampling.LANCZOS)
    preview.save(WORK3/'Preview.png',optimize=True)
    files = {name: OUT3/name for name in ('Workshop-Save.json','Play-Table.json','Cloudbreak-Array.json')}
    files['Preview.png'] = WORK3/'Preview.png'
    hashes = {name: sha256(path.read_bytes()).hexdigest() for name,path in files.items()}
    payload = WORK3/'payload.zip'
    with zipfile.ZipFile(payload,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=7) as archive:
        for name,path in files.items():
            archive.write(path,name)
        archive.writestr('manifest.json',json.dumps(hashes,indent=2))
    with zipfile.ZipFile(OUT3/ZIPNAME,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=5) as archive:
        archive.write(payload,'Files/payload.zip',compress_type=zipfile.ZIP_STORED)
        archive.write(WORK3/'Lobo-Cloudbreak-Array-Setup.exe','Lobo-Cloudbreak-Array-Setup.exe')
        archive.write(BASE/'INSTALL-CLOUDBREAK-ARRAY.cmd','INSTALL-CLOUDBREAK-ARRAY.cmd')
        archive.write(SOURCES/'README.txt','README.txt')
        archive.write(BASE/'Aurora-VII-Network-Node.json','Files/Aurora-VII-Network-Node.json')
        for name in PREVIEWS:
            archive.write(OUT3/name,'Review/'+name,compress_type=zipfile.ZIP_STORED)
    with zipfile.ZipFile(OUT3/ZIPNAME) as archive:
        assert archive.testzip() is None
    print(ZIPNAME,(OUT3/ZIPNAME).stat().st_size,flush=True)


if __name__ == '__main__':
    delivery()
