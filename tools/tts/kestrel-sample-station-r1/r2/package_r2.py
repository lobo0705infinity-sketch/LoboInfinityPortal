"""Build the Windows playtest distribution using the checked native room and Stage bag."""
from common import *
from assemble_r2 import TITLE
from PIL import Image, ImageOps, ImageDraw, ImageFont
from zipfile import ZipFile,ZIP_DEFLATED
import hashlib

back=(15,23,31);panel=(23,33,44);pale=(235,238,238);muted=(174,190,199);bronze=(233,184,112)
def font(size,bold=False):
    return ImageFont.truetype('/usr/share/fonts/truetype/open-sans/OpenSans-'+('Bold' if bold else 'Regular')+'.ttf',size)
def photo(name):
    im=Image.open(W/(name+'.png')).convert('RGBA')
    if name=='overhead':im=im.transpose(Image.Transpose.ROTATE_90)
    b=Image.new('RGB',im.size,panel);b.paste(im,(0,0),im.getchannel('A'));return b
def frame(main,name,x,y,w,h,contain=False):
    im=photo(name)
    if contain:
        f=Image.new('RGB',(w,h),panel)
        im=ImageOps.contain(im,(w,h),Image.Resampling.LANCZOS);f.paste(im,((w-im.width)//2,(h-im.height)//2));im=f
    else:im=ImageOps.fit(im,(w,h),method=Image.Resampling.LANCZOS)
    main.paste(im,(x,y))
def build():
    sheet=Image.new('RGB',(1844,1215),back);d=ImageDraw.Draw(sheet)
    d.text((45,22),'Kestrel Lunar Base',font=font(57,True),fill=pale)
    d.text((48,103),'Sample Station R2   /   ITS18 Data Harvest',font=font(25),fill=muted)
    d.line((46,155,1798,155),fill=(75,92,103),width=2)
    frame(sheet,'cartway',45,180,1108,575);frame(sheet,'overhead',1168,180,630,575,True)
    d.text((46,770),'Shuttle apron and sample cartway',font=font(24,True),fill=pale)
    d.text((1168,770),'Full table',font=font(24,True),fill=pale)
    specs=[('west','Western board edge','One exposed ridge in level regolith'),('assay','Assay dome','Thermal shutters lift with the glazing'),('algae','Algae culture lab','Twin photobioreactor benches'),('bay','Rover service bay','Screw jack and a wire-mesh spare wheel')]
    for i,(name,title,caption) in enumerate(specs):
        x=45+442*i;frame(sheet,name,x,834,427,275)
        d.text((x,1125),title,font=font(23,True),fill=bronze)
        d.text((x,1168),caption,font=font(17),fill=muted)
    preview=D/'Kestrel-Sample-Station-R2-Preview.jpg'
    sheet.save(preview,quality=93,subsampling=0,optimize=True)
    thumb=Image.new('RGB',(700,540),panel);frame(thumb,'overview',0,0,700,540,True);thumb.save(W/'Preview.png',optimize=True)
    entries={'Play-Table.json':W/'room.json','Kestrel-Sample-Station.json':W/'bag.json','Preview.png':W/'Preview.png'}
    hashes={n:hashlib.sha256(p.read_bytes()).hexdigest() for n,p in entries.items()}
    payload=W/'payload.zip'
    with ZipFile(payload,'w',ZIP_DEFLATED,compresslevel=9) as z:
        for n,p in entries.items():z.write(p,n)
        z.writestr('manifest.json',json.dumps(hashes,indent=2))
    readme=f'''Kestrel Lunar Base — Sample Station R2
ITS18 Data Harvest playtest

Extract this ZIP, double-click Install.cmd, then open Games > Save & Load in Tabletop Simulator. Select this new numbered save.

{TITLE}

The installer also places the Kestrel bag under Objects > Saved Objects. Use this bag on the Stage of an existing Infinity table after clearing its previous map. The ready-to-play table already has the map on it.

The western playable edge is a single ridge. All six former basins are level lunar dust. The dark freight cartway links the shuttle apron to the sample dust lock and the assay dome. The assay shutters lift with the glazed roof. The algae benches stay on the floor when the roof is removed. The rover bay is beside the crew habitat.

The three Tech-Coffins are the original Data Harvest objectives. The map controls link to the mission.

If your Tabletop Simulator files use a custom folder, drag that folder onto Install.cmd.
'''
    package=D/'Lobo-Kestrel-Lunar-Base-Sample-Station-R2-Playtest.zip'
    with ZipFile(package,'w',ZIP_DEFLATED,compresslevel=9) as z:
        z.writestr('Install.cmd',b'@echo off\r\n"%~dp0Kestrel-Setup.exe" %*\r\nexit /b %errorlevel%\r\n')
        z.write(W/'Kestrel-Setup.exe','Kestrel-Setup.exe');z.write(payload,'Files/payload.zip')
        z.writestr('Readme.txt',readme.replace('\n','\r\n').encode('utf-8-sig'));z.write(preview,'Preview/'+preview.name)
    with ZipFile(package) as z:assert z.testzip() is None
    print(package.name,package.stat().st_size,preview.name,preview.stat().st_size)
if __name__=='__main__':build()
