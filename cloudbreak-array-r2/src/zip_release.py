from project import *
from PIL import Image,ImageDraw,ImageFont
import zipfile,shutil
ZIPNAME='Lobo-Cloudbreak-Array-Workshop-Installer-R2.zip'
def delivery():
 from environment import sheet
 skies=[Image.open(AS/('sky-'+mode+'.jpg')).convert('RGB') for mode in ('day','night')]
 sheet(skies).save(OUT/'Cloudbreak-Array-R2-Backgrounds.jpg',quality=94,subsampling=0)
 preview=Image.open(OUT/'Cloudbreak-Array-R2-Rooftops.png').convert('RGB')
 preview.thumbnail((720,720),Image.Resampling.LANCZOS);preview.save(WORK/'Preview.png',optimize=True)
 detail=Image.new('RGB',(1524,630),(15,26,34));d=ImageDraw.Draw(detail);f='/usr/share/fonts/truetype/dejavu/DejaVuSans'
 font=lambda n,b=False:ImageFont.truetype(f+('-Bold'if b else '')+'.ttf',n)
 d.text((20,12),'Cloudbreak Array',font=font(32,True),fill='#eee9da');d.text((360,24),'Rooftop nursery and switching floor',font=font(18),fill='#b8c9d0')
 for i,(file,title,subtitle)in enumerate([('detail-green.png','Glasshouse Quay','Three passages run the length of the growing beds.'),('detail-interior.png','Switching House, level 1','Operator workstations and instruments leave the center floor open to movement.')]):
  im=Image.open(WORK/file).convert('RGB');im.thumbnail((733,486),Image.Resampling.LANCZOS);x=20+i*754;detail.paste(im,(x,63));d.text((x,559),title,font=font(22,True),fill='#e9d6ad');d.text((x,593),subtitle,font=font(15),fill='#c4d0d5')
 detail.save(OUT/'Cloudbreak-Array-R2-Terrain-Details.jpg',quality=93,subsampling=0)
 files={n:(OUT/n)for n in ('Workshop-Save.json','Play-Table.json','Cloudbreak-Array.json')};files['Preview.png']=WORK/'Preview.png'
 sig={n:hashlib.sha256(p.read_bytes()).hexdigest() for n,p in files.items()}
 payload=WORK/'payload.zip'
 with zipfile.ZipFile(payload,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=7)as z:
  for name,path in files.items():z.write(path,name)
  z.writestr('manifest.json',json.dumps(sig,indent=2))
 with zipfile.ZipFile(OUT/ZIPNAME,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=5)as z:
  z.write(payload,'Files/payload.zip',compress_type=zipfile.ZIP_STORED)
  z.write(BASE/'INSTALL-CLOUDBREAK-ARRAY.cmd','INSTALL-CLOUDBREAK-ARRAY.cmd')
  z.write(WORK/'Cloudbreak-Array-Setup.exe','Lobo-Cloudbreak-Array-Setup.exe')
  z.write(ROOT/'README.txt','README.txt');z.write(BASE/'Aurora-VII-Network-Node.json','Files/Aurora-VII-Network-Node.json')
  for path in sorted(OUT.glob('Cloudbreak-Array-R2-*')):z.write(path,'Review/'+path.name,compress_type=zipfile.ZIP_STORED)
 with zipfile.ZipFile(OUT/ZIPNAME)as z:assert z.testzip() is None
 print(ZIPNAME,(OUT/ZIPNAME).stat().st_size)
if __name__=='__main__':delivery()
