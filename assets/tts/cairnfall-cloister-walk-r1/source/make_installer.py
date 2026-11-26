"""Build the review sheet, TTS save thumbnail and four-file Windows playtest installer."""
from pathlib import Path
from io import BytesIO
import hashlib
import json
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED, ZIP_STORED

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
RELEASE = ROOT / 'release'
NAME = 'Lobo-Cairnfall-Sanctuary-Cloister-Walk-R1-Playtest.zip'
FILES = ('Play-Table.json', 'Cairnfall-Sanctuary.json', 'Cairnfall-Top40-Losers-R4.json', 'Preview.png')
TITLE = 'Cairnfall Sanctuary - Cloister Walk R1 - Battleground - Play Table'


def previews():
    renders = ROOT / 'review'
    overview = Image.open(renders / 'overview.png').convert('RGB')
    thumbnail = overview.copy()
    thumbnail.thumbnail((650, 650), Image.Resampling.LANCZOS)
    thumbnail.save(RELEASE / 'Preview.png', optimize=True)
    background = '#182321'
    paper = '#f5f0e4'
    secondary = '#c4c9b9'
    sheet = Image.new('RGB', (1940, 1350), background)
    pen = ImageDraw.Draw(sheet)
    serif = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf', 54)
    sans = '/usr/share/fonts/truetype/lato/'
    subtitle = ImageFont.truetype(sans + 'Lato-Regular.ttf', 28)
    caption = ImageFont.truetype(sans + 'Lato-Bold.ttf', 28)
    small = ImageFont.truetype(sans + 'Lato-Regular.ttf', 23)
    pen.text((40, 22), 'Cairnfall Sanctuary', font=serif, fill=paper)
    pen.text((43, 92), 'Cloister Walk R1  /  ITS18 Battleground', font=subtitle, fill=secondary)
    pen.line((40, 150, 1900, 150), fill='#52615a', width=2)
    hero = ImageOps.contain(overview, (1280, 1116), Image.Resampling.LANCZOS)
    sheet.paste(hero, (40 + (1260 - hero.width)//2, 166 + (1104 - hero.height)//2))
    pen.text((44, 1272), 'The East Gate approach branches toward the clinic and the cloister garden.', font=small, fill=secondary)
    for i, (shot, text) in enumerate([('clinic', 'Apse Field Clinic receiving porch'),
                                      ('herbs', 'Cloister herb garden and reading bench'),
                                      ('gate', 'Guesthouse drinking fountain')]):
        y = 166 + i*384
        photo = Image.open(renders / (shot + '.png')).convert('RGB')
        cut = ImageOps.fit(photo, (562, 330), Image.Resampling.LANCZOS, centering=(.5,.5))
        sheet.paste(cut, (1337, y))
        pen.text((1338, y+339), text, font=caption, fill=paper)
    sheet.save(RELEASE / 'Cairnfall-Cloister-Walk-R1.jpg', quality=93, subsampling=0, optimize=True)


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
    readme = f"""Cairnfall Sanctuary | Cloister Walk R1
ITS18 Battleground | Tabletop Simulator playtest

1. Extract the entire ZIP and run Install.cmd.
2. In Tabletop Simulator, open Games > Save & Load.
3. Select {TITLE}.

If you use a custom TTS data location, drag your Tabletop Simulator or Saves folder onto Install.cmd.
The installer creates a new save slot. Both Stage bags are available under Objects > Saved Objects in the Lobo-Cairnfall-Cloister-Walk-R1 folder. Choose the general Battleground bag or the Top 40 Losers Round 4 bag when you already have the Infinity Stage open.

Try the sheltered route beside the Guesthouse fountain, the offset herb garden gate, and the clinic approach from the side ramp. Opening the clinic removes its canopy with the roof. The equipment stays on the receiving porch.
"""
    with ZipFile(target / NAME, 'w') as archive:
        add(archive, 'Install.cmd', b'@echo off\r\n"%~dp0Cairnfall-Setup.exe" %*\r\n')
        add(archive, 'Readme.txt', readme.replace('\n','\r\n').encode())
        add(archive, 'Cairnfall-Setup.exe', (ROOT / 'qa/Cairnfall-Setup.exe').read_bytes())
        add(archive, 'Files/payload.zip', payload.getvalue(), ZIP_STORED)
    print((target / NAME).name, (target / NAME).stat().st_size)

if __name__ == '__main__':
    package()
