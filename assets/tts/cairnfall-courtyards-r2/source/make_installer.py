"""Build the review sheet, TTS save thumbnail and four-file Windows playtest installer."""
from pathlib import Path
from io import BytesIO
import hashlib
import json
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED, ZIP_STORED

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
RELEASE = ROOT / 'release'
NAME = 'Lobo-Cairnfall-Sanctuary-Courtyards-R2-Playtest.zip'
FILES = ('Play-Table.json', 'Cairnfall-Sanctuary.json', 'Cairnfall-Top40-Losers-R4.json', 'Preview.png')
TITLE = 'Cairnfall Sanctuary - Courtyards R2 - Battleground - Play Table'


def previews():
    renders = ROOT / 'review'
    overview = Image.open(renders / 'overview.png').convert('RGB')
    thumbnail = overview.copy()
    thumbnail.thumbnail((650, 650), Image.Resampling.LANCZOS)
    thumbnail.save(RELEASE / 'Preview.png', optimize=True)
    background = '#182321'
    paper = '#f5f0e4'
    secondary = '#c4c9b9'
    sheet = Image.new('RGB', (2000, 1530), background)
    pen = ImageDraw.Draw(sheet)
    serif = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf', 51)
    sans = '/usr/share/fonts/truetype/lato/'
    subtitle = ImageFont.truetype(sans + 'Lato-Regular.ttf', 26)
    caption = ImageFont.truetype(sans + 'Lato-Bold.ttf', 25)
    pen.text((36, 20), 'Cairnfall Sanctuary', font=serif, fill=paper)
    pen.text((39, 84), 'Courtyards R2  /  ITS18 Battleground', font=subtitle, fill=secondary)
    pen.line((36, 132, 1958, 132), fill='#52615a', width=2)
    hero = ImageOps.contain(overview, (1280, 1220), Image.Resampling.LANCZOS)
    sheet.paste(hero, (36 + (1280 - hero.width)//2, 150))
    pen.text((39, 1394), 'The approach from the Laundry, Refectory and Dispensary is in the foreground.', font=subtitle, fill=paper)
    pen.text((39, 1436), 'The paths from the East Gate and clinic enter the cloister from the far side.', font=subtitle, fill=secondary)
    for i, (shot, title) in enumerate([('laundry','Copper Laundry drying court'),('refectory','Kitchen deliveries at the Refectory'),('clinic-roof','Apse Field Clinic roof'),('archive-roof','Stepped Archive roof and terrace')]):
        y=148+340*i
        photo=Image.open(renders/(shot+'.png')).convert('RGB')
        if 'roof' in shot:
            out=ImageOps.contain(photo,(605,294),Image.Resampling.LANCZOS)
            sheet.paste(out,(1355+(605-out.width)//2,y))
        else:
            sheet.paste(ImageOps.fit(photo,(605,294),Image.Resampling.LANCZOS,centering=(.50,.54)),(1355,y))
        pen.text((1356,y+299),title,font=caption,fill=paper)
    sheet.save(RELEASE / 'Cairnfall-Courtyards-R2.jpg', quality=93, subsampling=0, optimize=True)


def add(archive, name, content, method=ZIP_DEFLATED):
    info = ZipInfo(name, (2026, 11, 26, 12, 0, 0))
    info.compress_type = method
    info.external_attr = 0o644 << 16
    archive.writestr(info, content, compresslevel=7)


def package():
    RELEASE.mkdir(exist_ok=True)
    target = ROOT / 'deliver'
    target.mkdir(exist_ok=True)
    previews()
    payload = BytesIO()
    with ZipFile(payload, 'w') as archive:
        manifest = {}
        for name in FILES:
            contents = (RELEASE / name).read_bytes()
            manifest[name] = hashlib.sha256(contents).hexdigest()
            add(archive, name, contents)
        add(archive, 'manifest.json', json.dumps(manifest, sort_keys=True).encode())
    readme = f"""Cairnfall Sanctuary | Courtyards R2
ITS18 Battleground | Tabletop Simulator playtest

1. Extract the entire ZIP and run Install.cmd.
2. In Tabletop Simulator, open Games > Save & Load.
3. Select {TITLE}.

If you use a custom TTS data location, drag your Tabletop Simulator or Saves folder onto Install.cmd.
The installer creates a new save slot. Both Stage bags are available under Objects > Saved Objects in the Lobo-Cairnfall-Courtyards-R2 folder. Choose the general Battleground bag or the Top 40 Losers Round 4 bag when you already have the Infinity Stage open.

Look for the Laundry drying yard, Refectory delivery cart, Archive receiving counter and the sheltered rest outside the clinic. Opening the Dogleg Cloister or Stepped Archive now removes its rooftop planter. The clinic AC unit has its own roof bay and the exposed upper Archive ladder has been removed.
"""
    with ZipFile(target / NAME, 'w') as archive:
        add(archive, 'Install.cmd', b'@echo off\r\n"%~dp0Cairnfall-Setup.exe" %*\r\n')
        add(archive, 'Readme.txt', readme.replace('\n','\r\n').encode())
        add(archive, 'Cairnfall-Setup.exe', (ROOT / 'qa/Cairnfall-Setup.exe').read_bytes())
        add(archive, 'Files/payload.zip', payload.getvalue(), ZIP_STORED)
    print((target / NAME).name, (target / NAME).stat().st_size)

if __name__ == '__main__':
    package()
