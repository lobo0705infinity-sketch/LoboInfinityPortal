"""Package the ready-to-play save, reusable bag, and a preview of the actual map."""
from yard import *
from zipfile import ZipFile, ZIP_DEFLATED, ZIP_STORED
from PIL import Image,ImageDraw,ImageOps,ImageFont
FILENAME='Vanta-Customs-Yard-Held-Consignment-Playtest.zip'
PREVIEW='Vanta-Customs-Yard-Held-Consignment.jpg'
DARK=(29,38,43);LIGHT=(235,235,223);MUTED=(183,193,191);ACCENT=(226,175,95)
def font(size,bold=False):
 return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans'+('-Bold' if bold else '')+'.ttf',size)
def photo(name):
 im=Image.open(W/(name+'.png')).convert('RGBA');bg=Image.new('RGB',im.size,DARK);bg.paste(im,mask=im.getchannel('A'));return bg
def preview():
 sheet=Image.new('RGB',(2100,1580),DARK);d=ImageDraw.Draw(sheet)
 d.text((49,34),'Vanta Customs Yard',font=font(63,True),fill=LIGHT)
 d.text((53,123),'VX-417 arrived with a seal discrepancy. Customs diverted the load to Quarantine Bay Q2.',font=font(31),fill=MUTED)
 d.text((2050,76),'B-PONG     /     48 × 48 IN',font=font(24,True),anchor='rm',fill=ACCENT)
 d.line((51,196,2049,196),fill=(96,111,111),width=2)
 im=photo('overview');left=ImageOps.contain(im,(1030,742),Image.Resampling.LANCZOS)
 sheet.paste(left,((1066-left.width)//2,214+(742-left.height)//2))
 right=ImageOps.fit(photo('hold'),(984,662),Image.Resampling.LANCZOS,centering=(.50,.55));sheet.paste(right,(1066,225))
 d.text((1070,906),'Quarantine receiving',font=font(34,True),fill=LIGHT)
 d.text((1071,956),'The plugged-in reefer and lift occupy the marked hold bay.',font=font(25),fill=MUTED)
 d.line((50,1031,2050,1031),fill=(87,103,104),width=2)
 for idx,(name,head,caption) in enumerate([
  ('intake','Gate Intake','The weighbridge reader flags VX-417.'),
  ('seal','Inspection Hall','The matching seal and witness case are on the bench.'),
  ('release','Covered Transfer Dock','The electric tug collects cleared freight.')]):
  x=50+idx*675
  sheet.paste(ImageOps.fit(photo(name),(649,345),Image.Resampling.LANCZOS),(x,1062))
  d.text((x+2,1430),head,font=font(31,True),fill=LIGHT)
  d.text((x+2,1483),caption,font=font(22),fill=MUTED)
 sheet.save(D/PREVIEW,quality=93,subsampling=0,optimize=True)
 ImageOps.contain(photo('overview'),(704,575),Image.Resampling.LANCZOS).save(W/'Preview.png',optimize=True)
def package():
 preview()
 names=('Play-Table.json','Vanta-Customs-Yard.json','Preview.png')
 dig={n:hashlib.sha256((W/n).read_bytes()).hexdigest()for n in names}
 with ZipFile(W/'payload.zip','w',ZIP_DEFLATED,compresslevel=8)as z:
  for n in names:z.write(W/n,n)
  z.writestr('manifest.json',json.dumps(dig,indent=2))
 readme=f'''Vanta Customs Yard | Held Consignment
ITS18 B-Pong playtest

Extract the entire ZIP, run Install.cmd, then open Games > Save & Load in Tabletop Simulator and select:
{TITLE}

A ready-to-play table occupies a fresh save slot. A copy of the map is in Objects > Saved Objects under Lobo-Vanta-Held-Consignment. To use it on another compatible Infinity table, clear the previous map and drop the Vanta bag onto Stage. For a custom Tabletop Simulator data directory, drag that directory onto Install.cmd.

Start at Gate Intake. The axle scale has flagged VX-417 for a seal discrepancy. At the inspection hall the evidence case is open. At the quarantine warehouse the same refrigerated box is on shore power, with a tagged load on the forklift. Cleared goods leave from the separate transfer dock. The two consoles and the central tracking beacon belong to the B-Pong mission.
'''
 with ZipFile(D/FILENAME,'w',ZIP_DEFLATED,compresslevel=8)as z:
  z.writestr('Install.cmd',b'@echo off\r\n"%~dp0Vanta-Setup.exe" %*\r\nexit /b %errorlevel%\r\n')
  z.write(W/'Vanta-Setup.exe','Vanta-Setup.exe');z.write(W/'payload.zip','Files/payload.zip',compress_type=ZIP_STORED)
  z.write(D/PREVIEW,'Preview/'+PREVIEW,compress_type=ZIP_STORED);z.writestr('Readme.txt',readme.replace('\n','\r\n').encode('utf-8-sig'))
 print(FILENAME,(D/FILENAME).stat().st_size)
if __name__=='__main__':package()
