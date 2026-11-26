"""Make the preview from the rendered game objects and package the playable save."""
from pathlib import Path
from hashlib import sha256
import json
from zipfile import ZipFile, ZIP_DEFLATED
from PIL import Image, ImageDraw, ImageFont, ImageOps

root=Path(__file__).resolve().parents[1]
work=root/'work'
dist=root/'dist'
dist.mkdir(exist_ok=True)
back=(15,23,31)
panel=(23,33,44)
text=(235,238,238)
muted=(177,190,198)
accent=(231,175,95)
def font(size,bold=False):
    face='OpenSans-Bold.ttf' if bold else 'OpenSans-Regular.ttf'
    return ImageFont.truetype('/usr/share/fonts/truetype/open-sans/'+face,size)
def composite(name,bbox=None):
    rgba=Image.open(work/(name+'.png')).convert('RGBA')
    if bbox=='tight':
        x0,y0,x1,y1=rgba.getchannel('A').getbbox()
        rgba=rgba.crop((max(0,x0-6),max(0,y0-6),min(rgba.width,x1+6),min(rgba.height,y1+6)))
    img=Image.new('RGB',rgba.size,panel)
    img.paste(rgba,(0,0),rgba.getchannel('A'))
    return img
def fit_map(canvas,name,rect):
    x,y,w,h=rect
    frame=Image.new('RGB',(w,h),panel)
    img=ImageOps.contain(composite(name,'tight'),(w-30,h-22),Image.Resampling.LANCZOS)
    frame.paste(img,((w-img.width)//2,(h-img.height)//2))
    canvas.paste(frame,(x,y))
def detail(canvas,name,x,y,w,h):
    img=ImageOps.fit(composite(name),(w,h),method=Image.Resampling.LANCZOS)
    canvas.paste(img,(x,y))

sheet=Image.new('RGB',(1800,1208),back)
draw=ImageDraw.Draw(sheet)
draw.text((45,25),'Kestrel Lunar Base',font=font(58,True),fill=text)
draw.text((48,103),'Sample Station R1   /   ITS18 Data Harvest',font=font(25),fill=muted)
draw.line((46,152,1754,152),fill=(80,94,105),width=2)
top_y=176
fit_map(sheet,'overview',(46,top_y,1089,539));fit_map(sheet,'overhead',(1148,top_y,606,539))
draw.text((47,730),'Approach from the shuttle apron',font=font(23,True),fill=text)
draw.text((1148,730),'Overhead layout',font=font(23,True),fill=text)
for x,name,title,sub in [(46,'receiving','Sample receiving','Flight cases and twin-door dust lock'),(620,'solar','Power and research','Solar field and enclosed lab transfer'),(1194,'crew','Crew quarters','Suitports and the passage to the commons')]:
    detail(sheet,name,x,795,560,306)
    draw.text((x,1118),title,font=font(25,True),fill=accent)
    draw.text((x,1162),sub,font=font(19),fill=muted)
preview=dist/'Kestrel-Sample-Station-R1-Preview.jpg'
sheet.save(preview,quality=92,subsampling=0,optimize=True)
thumb=Image.new('RGB',(640,460),panel)
fit_map(thumb,'overview',(0,0,640,460));thumb.save(work/'Preview.png',optimize=True)
payload={'Play-Table.json':work/'room.json','Kestrel-Sample-Station.json':work/'bag.json','Preview.png':work/'Preview.png'}
manifest={n:sha256(p.read_bytes()).hexdigest() for n,p in payload.items()}
with ZipFile(work/'payload.zip','w',ZIP_DEFLATED,compresslevel=9) as z:
    for n,p in payload.items():z.write(p,n)
    z.writestr('manifest.json',json.dumps(manifest,indent=2))
install=b'@echo off\r\n"%~dp0Kestrel-Setup.exe" %*\r\nexit /b %errorlevel%\r\n'
readme="""Kestrel Lunar Base — Sample Station R1
Infinity ITS18 Data Harvest

Extract the entire ZIP, then double-click Install.cmd. In Tabletop Simulator, open Games > Save & Load and select the following save.

Kestrel Lunar Base - Sample Station R1 - Data Harvest - Play Table

The installer adds a new numbered save and a Kestrel map bag under Objects > Saved Objects. To use the bag with an existing Infinity table, clear the previous map and drop the Kestrel bag on Stage. The ready-to-play save already has the terrain in place.

Use state 1 to reveal the interior of the receiving lock or either of the two pressure passages. The three Tech-Coffins are the Data Harvest objectives. The map controls provide the mission link.

If you use a custom Tabletop Simulator data directory, drag that directory onto Install.cmd.
"""
release=dist/'Lobo-Kestrel-Lunar-Base-Sample-Station-R1-Playtest.zip'
with ZipFile(release,'w',ZIP_DEFLATED,compresslevel=9) as z:
    z.writestr('Install.cmd',install)
    z.write(work/'Kestrel-Setup.exe','Kestrel-Setup.exe')
    z.write(work/'payload.zip','Files/payload.zip')
    z.writestr('Readme.txt',readme.replace('\n','\r\n').encode('utf-8-sig'))
    z.write(preview,'Preview/'+preview.name)
with ZipFile(release) as z:assert z.testzip() is None
print(release.name,release.stat().st_size,preview.name,preview.stat().st_size)
