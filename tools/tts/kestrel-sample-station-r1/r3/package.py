"""Package the native save and Stage bag and render their layout comparison."""
from plan import *
from PIL import Image,ImageDraw,ImageOps,ImageFont
from zipfile import ZipFile,ZIP_DEFLATED
import hashlib
PKG='Lobo-Kestrel-Lunar-Base-Station-Plan-R3-Playtest.zip'
PREVIEW='Kestrel-Lunar-Base-R2-R3-Comparison.jpg'
INK=(22,31,38);FRAME=(28,39,47);WHITE=(236,239,236);GRAY=(170,185,191);GOLD=(226,177,94)
def face(px,bold=False):return ImageFont.truetype('/usr/share/fonts/truetype/open-sans/OpenSans-'+('Bold'if bold else 'Regular')+'.ttf',px)
def photo(path,top=False):
 im=Image.open(path).convert('RGBA')
 if top:im=im.transpose(Image.Transpose.ROTATE_90)
 out=Image.new('RGB',im.size,FRAME);out.paste(im,(0,0),im.getchannel('A'));return out
def spread():
 sheet=Image.new('RGB',(2310,1742),INK);d=ImageDraw.Draw(sheet)
 d.text((45,26),'Kestrel Lunar Base',font=face(57,True),fill=WHITE)
 d.text((2264,59),'DATA HARVEST    /    48 × 48 INCHES',fill=GRAY,font=face(25),anchor='rm')
 d.line((47,115,2264,115),fill=(88,106,113),width=2)
 for i,(w,label) in enumerate([(r2.W,'R2    Sample Station'),(W,'R3    Station Plan')]):
  x=45+i*1120;d.text((x,135),label,font=face(31,True),fill=GOLD if i else GRAY)
  im=photo(w/'overhead.png',True)
  # Identical framing and camera scale for both boards.
  sheet.paste(ImageOps.contain(im,(1095,1095),Image.Resampling.LANCZOS),(x,194))
 for i,(name,label,caption) in enumerate([('science','Research wing','The observatory and sample-prep hall share doors with the main biosphere.'),('crew','Crew court','The cross-passage joins the infirmary and sleeping berths around the EVA yard.')]):
  x=45+i*1120
  im=photo(W/(name+'.png'));sheet.paste(ImageOps.fit(im,(1095,303),Image.Resampling.LANCZOS,centering=(.5,.54)),(x,1310))
  d.text((x,1628),label,font=face(26,True),fill=WHITE);d.text((x,1685),caption,font=face(22),fill=GRAY)
 sheet.save(D/PREVIEW,quality=93,subsampling=0,optimize=True)
 thumb=ImageOps.contain(photo(W/'overview.png'),(704,548),Image.Resampling.LANCZOS);thumb.save(W/'Preview.png',optimize=True)
def package():
 spread();files={'Play-Table.json':W/'room.json','Kestrel-Sample-Station.json':W/'bag.json','Preview.png':W/'Preview.png'}
 manifest={n:hashlib.sha256(p.read_bytes()).hexdigest()for n,p in files.items()}
 with ZipFile(W/'payload.zip','w',ZIP_DEFLATED,compresslevel=9)as z:
  for n,p in files.items():z.write(p,n)
  z.writestr('manifest.json',json.dumps(manifest,indent=2))
 instructions=f'''Kestrel Lunar Base — Station Plan R3
ITS18 Data Harvest | Playtest

Extract the ZIP and double-click Install.cmd. In Tabletop Simulator, open Games > Save & Load and select:

{TITLE}

The same map is also available as a Saved Object bag. To use it on a compatible Infinity table, clear the previous map and drop the Kestrel bag on Stage. The full play table already contains the deployed map.

Follow the science wing from command to the main biosphere, sample preparation and the culture annex. The service hall turns toward the infirmary and the two crew berths. The PV plant has its own maintenance yard. The shuttle feeds sample receiving by a marked cartway. Both transfer crossings have opposing hatches for larger bases. State 1 exposes the halls and passages.

If you use a custom Tabletop Simulator folder, drag that folder onto Install.cmd.
'''
 with ZipFile(D/PKG,'w',ZIP_DEFLATED,compresslevel=9)as z:
  z.writestr('Install.cmd',b'@echo off\r\n"%~dp0Kestrel-Setup.exe" %*\r\nexit /b %errorlevel%\r\n')
  z.write(W/'Kestrel-Setup.exe','Kestrel-Setup.exe');z.write(W/'payload.zip','Files/payload.zip')
  z.writestr('Readme.txt',instructions.replace('\n','\r\n').encode('utf-8-sig'));z.write(D/PREVIEW,'Preview/'+PREVIEW)
 with ZipFile(D/PKG)as z:assert z.testzip() is None
if __name__=='__main__':package()
