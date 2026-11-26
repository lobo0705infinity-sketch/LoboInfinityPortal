"""Build the review sheet, TTS save thumbnail and four-file Windows playtest installer."""
from pathlib import Path
from io import BytesIO
import hashlib
import json
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED, ZIP_STORED

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
RELEASE = ROOT / 'release'
NAME = 'Lobo-Cairnfall-Sanctuary-Courtyards-R3-Playtest.zip'
FILES = ('Play-Table.json', 'Cairnfall-Sanctuary.json', 'Cairnfall-Top40-Losers-R4.json', 'Preview.png')
TITLE = 'Cairnfall Sanctuary - Courtyards R3 - Battleground - Play Table'


def previews():
    renders = ROOT / 'review'
    thumbnail = Image.open(renders / 'overview.png').convert('RGB')
    thumbnail.thumbnail((650,650), Image.Resampling.LANCZOS)
    thumbnail.save(RELEASE / 'Preview.png', optimize=True)
    sheet = Image.new('RGB',(1990,955),'#172320')
    pen = ImageDraw.Draw(sheet)
    serif = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf',46)
    label = ImageFont.truetype('/usr/share/fonts/truetype/lato/Lato-Bold.ttf',27)
    body = ImageFont.truetype('/usr/share/fonts/truetype/lato/Lato-Regular.ttf',25)
    pen.text((30,17),'Cairnfall Sanctuary  /  Gardeners Workshop',font=serif,fill='#f5efdf')
    for i,(name,heading,note) in enumerate([
            ('roof-before','R2','The sloped sheet crosses the deck. The ladder meets a solid wall.'),
            ('roof-after','R3','A level copper terrace and a stone opening above the ladder.')]):
        left=30+i*975
        pen.text((left,88),heading,font=label,fill='#c8d1b9')
        image=Image.open(renders/(name+'.png')).convert('RGB')
        sheet.paste(ImageOps.fit(image,(950,740),Image.Resampling.LANCZOS),(left,137))
        pen.text((left,899),note,font=body,fill='#f5efdf')
    sheet.save(RELEASE/'Cairnfall-Workshop-Roof-R3.jpg',quality=92,subsampling=0,optimize=True)


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
    readme = f"""Cairnfall Sanctuary | Courtyards R3
ITS18 Battleground | Tabletop Simulator playtest

1. Extract the entire ZIP and run Install.cmd.
2. In Tabletop Simulator, open Games > Save & Load.
3. Select {TITLE}.

If you use a custom TTS data location, drag your Tabletop Simulator or Saves folder onto Install.cmd.
The installer creates a new save slot. Both Stage bags are available under Objects > Saved Objects in the Lobo-Cairnfall-Courtyards-R3 folder. Choose the general Battleground bag or the Top 40 Losers Round 4 bag when you already have the Infinity Stage open.

The Gardeners Workshop has a flat copper terrace with a roof drain. The widened ladder and the opening in the stone parapet share a centerline. The roof and its collision follow the building state.
"""
    with ZipFile(target / NAME, 'w') as archive:
        add(archive, 'Install.cmd', b'@echo off\r\n"%~dp0Cairnfall-Setup.exe" %*\r\n')
        add(archive, 'Readme.txt', readme.replace('\n','\r\n').encode())
        add(archive, 'Cairnfall-Setup.exe', (ROOT / 'qa/Cairnfall-Setup.exe').read_bytes())
        add(archive, 'Files/payload.zip', payload.getvalue(), ZIP_STORED)
    print((target / NAME).name, (target / NAME).stat().st_size)

if __name__ == '__main__':
    package()
