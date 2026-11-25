from model import *
from PIL import Image,ImageOps,ImageEnhance
artdir=ROOT/'work'/'art';artdir.mkdir(exist_ok=True)
def installart(p,n):
 import shutil
 dest=artdir/(n+'.png')
 if not dest.is_file():shutil.copyfile(next((ROOT.parent/'generated_images').glob('exec-'+p+'*.png')),dest)
 return Image.open(dest).convert('RGB')
rooms=[installart('2a6c6240','rooms-civic'),installart('8eec8ddb','rooms-specialist')];murals=installart('a13202a5','murals')
atlas=Image.new('RGB',(4096,4096),(61,64,62));old=Image.open(BASE/'assets/civic-materials.jpg').convert('RGB').resize((3072,3072),Image.Resampling.LANCZOS)
# Discard the old reflection-heavy facade swatch even on hidden backing faces.
old.paste(old.crop((7*384,1*384,8*384,2*384)),(3*384,0));atlas.paste(old)
def install(im,cols,rows,index,key,interior):
 W,H=im.size;i=index%cols;j=index//cols
 p=im.crop((round(i*W/cols)+3,round(j*H/rows)+3,round((i+1)*W/cols)-3,round((j+1)*H/rows)-3))
 x,y,w,h=RECT[key]
 if interior:
  p=ImageEnhance.Color(p).enhance(.88);p=ImageEnhance.Brightness(p).enhance(.83)
 p=p.resize((w,h),Image.Resampling.LANCZOS);ar=np.array(p);atlas.paste(Image.fromarray(np.pad(ar,((5,5),(5,5),(0,0)),mode='edge')),(x-5,y-5))
for i in range(8):install(rooms[i//4],2,2,i%4,'room'+str(i),True)
for i in range(6):install(murals,2,3,i,'art'+str(i),False)
atlas.save(AS/'civic-r2.jpg',quality=92,subsampling=0,optimize=True)
