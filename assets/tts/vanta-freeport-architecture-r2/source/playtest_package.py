"""Build a photo comparison from native models and package the Windows playtest."""
from map_release import *
from PIL import Image,ImageDraw,ImageFont,ImageOps
from zipfile import ZipFile,ZIP_DEFLATED,ZIP_STORED
import hashlib,sys
FILENAME='Vanta-Customs-Yard-Freeport-Architecture-R2-Playtest.zip'
PREVIEW='Vanta-Customs-Yard-Before-and-After.jpg'
ROOMS='Vanta-Customs-Yard-Interiors.jpg'
ink='#233b3d';paper='#e9e5db';secondary='#435a59';accent='#92533f';dark='#364345'
def font(size,bold=False,serif=False):
 name=('DejaVuSerif' if serif else 'DejaVuSans')+('-Bold' if bold else '')
 return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/'+name+'.ttf',size)
def write(draw,xy,s,size,color=ink,bold=False,serif=False):draw.text(xy,s,font=font(size,bold,serif),fill=color,stroke_width=0)
def image(path):
 im=Image.open(path).convert('RGBA');bg=Image.new('RGB',im.size,dark);bg.paste(im,mask=im.getchannel('A'));return bg
def paste_fit(im,source,xy,dim,crop=None):
 photo=image(source)
 if crop:photo=photo.crop(crop)
 tile=ImageOps.fit(photo,dim,method=Image.Resampling.LANCZOS)
 im.paste(tile,xy)
def cards():
 w=2280;m=57;gap=34;cw=(w-2*m-gap)//2
 # Both overviews share the exact lens, camera position, scale and crop.
 im=Image.new('RGB',(w,1970),paper);dr=ImageDraw.Draw(im)
 write(dr,(m,36),'Vanta Customs Yard',66,serif=True)
 write(dr,(w-778,64),'FREEPORT ARCHITECTURE     /     B-PONG PLAYTEST',23,secondary,True)
 dr.line((m,150,w-m,150),fill=ink,width=2)
 for i,(tag,path)in enumerate([('Previous yard',R1/'work/overview.png'),('Freeport revision',W/'overview.png')]):
  x=m+i*(cw+gap);write(dr,(x,177),tag,34,bold=True)
  # Fill the frame while leaving a visible border around every edge of the board.
  bg=image(path);tile=ImageOps.contain(bg,(cw,823),method=Image.Resampling.LANCZOS)
  im.paste(Image.new('RGB',(cw,823),dark),(x,240));im.paste(tile,(x+(cw-tile.width)//2,240+(823-tile.height)//2))
 dr.line((m,1110,w-m,1110),fill=secondary,width=2)
 for i,(tag,filename,cap)in enumerate([('Dispatch Exchange','dispatch','Limestone, curved gallery windows and a patinated copper clock roof.'),('Seal Inspection Works','sealworks','Brick receiving hall, corrugated laboratory and glazed sawtooth roof.')]):
  x=m+i*(cw+gap);paste_fit(im,W/(filename+'.png'),(x,1147),(cw,645))
  write(dr,(x,1818),tag,37,bold=True);write(dr,(x,1882),cap,24,secondary)
 im.save(D/PREVIEW,quality=92,subsampling=0,optimize=True)
 im=Image.new('RGB',(w,1820),paper);dr=ImageDraw.Draw(im)
 write(dr,(m,35),'Inside Vanta Freeport',66,serif=True)
 write(dr,(m,135),'Four furnished ground-floor states from the playable table.',29,secondary)
 dr.line((m,211,w-m,211),fill=ink,width=2)
 for i,(n,head,line)in enumerate([
  ('desk','Dispatch Exchange','The clerk’s keyboard, berth chart, stamp and the latest bill of lading.'),
  ('lab','Seal Inspection Works','Samples from lot VX-417 beside the caliper and the open seal case.'),
  ('fridge','Quarantine Cold Store','Insulated cabinets, temperature records and the refrigeration controls.'),
  ('library','Manifest Archive','Filed consignment records beside the access ladder to the roof.')]):
  x=m+(i%2)*(cw+gap);y=242+i//2*778;paste_fit(im,W/(n+'.png'),(x,y),(cw,625))
  write(dr,(x,y+641),head,36,bold=True);write(dr,(x,y+702),line,24,secondary)
 im.save(D/ROOMS,quality=93,subsampling=0,optimize=True)
 ImageOps.contain(image(W/'overview.png'),(704,575),Image.Resampling.LANCZOS).save(W/'Preview.png',optimize=True)
def package():
 cards()
 sources=yard.load(W/'texture-sources/sources.json')
 credits='Vanta Freeport photographic materials\n\nColor and normal maps adapted from Poly Haven CC0 scans.\nhttps://polyhaven.com/license\n\n'+'\n'.join(name.replace('_',' ')+'  —  https://polyhaven.com/a/'+name for name in sources)+'\n\nArchitecture, interior furnishings, port signs, clock face, documents and night-mail print made for this playtest.\n'
 (W/'material-credits.txt').write_text(credits)
 names=('Play-Table.json','Vanta-Customs-Yard.json','Preview.png')
 dig={n:hashlib.sha256((W/n).read_bytes()).hexdigest()for n in names}
 with ZipFile(W/'payload.zip','w',ZIP_DEFLATED,compresslevel=8)as z:
  for n in names:z.write(W/n,n)
  z.writestr('manifest.json',json.dumps(dig,indent=2))
 readme=f'''Vanta Customs Yard | Freeport Architecture R2
ITS18 B-Pong playtest for Tabletop Simulator

Extract the entire ZIP and run Install.cmd. Open Games > Save & Load and choose
{TITLE}

The installer creates a fresh local save slot and a reusable map bag under Objects > Saved Objects > Lobo-Vanta-Freeport-Architecture-R2. To place the bag on a compatible Infinity table, clear its prior map and drop this bag onto Stage. For a custom TTS data directory, drag that directory onto Install.cmd.

On the table, inspect Dispatch Exchange and Seal Inspection Works on opposite sides of the tracking beacon. Right-click a building and choose Show Ground floor or Show Upper floor to visit a room. Choose Show Roof to close it.

Gate 01 flags consignment VX-417. At Inspection, an examiner has opened the sample case. The matching refrigerated container is held on shore power at Quarantine Q2. The transfer crew is collecting a different, cleared load under the dock canopy.

The Preview folder includes the map at the same angle before and after the rebuild, plus four views of furnished rooms.
'''
 with ZipFile(D/FILENAME,'w',ZIP_DEFLATED,compresslevel=8)as z:
  z.writestr('Install.cmd',b'@echo off\r\n"%~dp0Vanta-Setup.exe" %*\r\nexit /b %errorlevel%\r\n')
  z.write(W/'Vanta-Setup.exe','Vanta-Setup.exe');z.write(W/'payload.zip','Files/payload.zip',compress_type=ZIP_STORED)
  for name in (PREVIEW,ROOMS):z.write(D/name,'Preview/'+name,compress_type=ZIP_STORED)
  z.writestr('Readme.txt',readme.replace('\n','\r\n').encode('utf-8-sig'));z.writestr('Materials.txt',credits.replace('\n','\r\n').encode('utf-8-sig'))
 print(FILENAME,(D/FILENAME).stat().st_size)
if __name__=='__main__':package()
