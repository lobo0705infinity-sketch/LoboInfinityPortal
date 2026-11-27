"""Build the one-click Windows installer for the complete collection and the play table."""
from hashlib import sha256
from zipfile import ZIP_DEFLATED, ZIP_STORED, ZipFile
from PIL import Image, ImageOps
from final_map import COLLECTION, D, FILENAME, PLAY, STEAM_ID, W
import json

def thumbnail(name):
    image = Image.open(W/(name+'.png')).convert('RGBA')
    canvas = Image.new('RGB',image.size,(28,39,47))
    canvas.paste(image,(0,0),image.getchannel('A'))
    return canvas

def package():
    ImageOps.contain(thumbnail('overview'),(760,600),Image.Resampling.LANCZOS).save(W/'Preview.png',optimize=True)
    thumbnail('apron').save(W/'Shuttle-Apron.jpg',quality=91,optimize=True)
    names=['Workshop-Save.json','Play-Table.json','Kestrel-Lunar-Base.json','Preview.png']
    with ZipFile(W/'payload.zip','w',ZIP_DEFLATED,compresslevel=7) as payload:
        digests={}
        for name in names:
            path=W/name
            digests[name]=sha256(path.read_bytes()).hexdigest()
            payload.write(path,name)
        payload.writestr('manifest.json',json.dumps(digests,indent=2))
    readme=f"""Kestrel Lunar Base | Data Harvest

Installing on Windows

1. Extract the entire ZIP to one folder.
2. Double-click Install.cmd. If you use a custom Tabletop Simulator data folder, drag that folder onto Install.cmd.
3. In Tabletop Simulator, go to Games > Save & Load.

Publishing to the existing Workshop item

Open "{COLLECTION}". This save contains the 107-map collection.
Choose Upload > Workshop Upload > Update Workshop. Select Lobo's Infinity Maps ({STEAM_ID}) and confirm the update.

Playing Kestrel directly

Open "{PLAY}". The base and all three Data Harvest Tech-Coffins are on the table.
The shuttle apron has a four-inch return on its blast shield beside the flight-side Tech-Coffin.

On another compatible Infinity table, clear the old map, then drop the Kestrel bag from Objects > Saved Objects on the Stage.

The installer uses two free save slots and creates a new Kestrel folder under Saved Objects. Multiplayer assets use public URLs.
"""
    zip_path=D/FILENAME
    with ZipFile(zip_path,'w',ZIP_DEFLATED,compresslevel=7) as out:
        out.writestr('Install.cmd',b'@echo off\r\n"%~dp0Kestrel-Setup.exe" %*\r\nexit /b %errorlevel%\r\n')
        out.write(W/'Kestrel-Setup.exe','Kestrel-Setup.exe')
        out.write(W/'payload.zip','Files/payload.zip',compress_type=ZIP_STORED)
        out.writestr('Readme.txt',readme.replace('\n','\r\n').encode('utf-8-sig'))
        out.write(W/'Shuttle-Apron.jpg','Preview/Shuttle-Apron.jpg',compress_type=ZIP_STORED)
    print(zip_path.name,zip_path.stat().st_size,sha256(zip_path.read_bytes()).hexdigest())

if __name__=='__main__':
    package()
