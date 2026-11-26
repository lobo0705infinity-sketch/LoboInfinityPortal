from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageOps,ImageFilter
import numpy as np
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'assets';COLS=4
INDEX={n:i for i,n in enumerate(['oak','stone','bronze','patina','iron','canvas','linen','green','paper','slate','soil','willow','edge','clinic','herbs','water'])}
def source(s):return Image.open(next((ROOT/'cache').glob('*'+s))).convert('RGB')
def tile(sheet,n):
    w,h=sheet.size;c=n%4;r=n//4
    return sheet.crop((round((c+.04)*w/4),round((r+.04)*h/4),round((c+.96)*w/4),round((r+.96)*h/4))).resize((512,512),Image.Resampling.LANCZOS)
def tint(src,base,contrast,colour=.15):
    img=np.asarray(src,dtype='float32');l=img@np.array([.299,.587,.114]);d=l-np.median(l)
    return Image.fromarray(np.uint8(np.clip(np.array(base)+d[:,:,None]*contrast+(img-l[:,:,None])*colour,0,255)))
def fonts(size,serif=False):
    path='/usr/share/fonts/truetype/dejavu/'+('DejaVuSerif-Bold.ttf' if serif else 'DejaVuSansCondensed-Bold.ttf')
    return ImageFont.truetype(path,size)
def panel(cell,title,sub,symbol=False):
    d=ImageDraw.Draw(cell);d.rounded_rectangle((17,25,494,487),radius=14,outline=(166,151,107),width=4)
    if symbol:
        d.rectangle((213,74,299,240),fill=(225,221,186));d.rectangle((170,115,344,201),fill=(225,221,186))
    else:
        d.line((159,144,351,144),fill=(166,151,110),width=3)
        for i in range(3):
            y=132+i*12;d.line((220+i*14,y,242+i*14,y-28),fill=(181,184,135),width=5)
    def center(y,text,sz,color):
        f=fonts(sz);width=d.textlength(text,font=f)
        if width>438:f=fonts(round(sz*438/width))
        d.text((256,y),text,font=f,anchor='mm',fill=color,stroke_width=0)
    center(292,title,68,(236,232,204));center(386,sub,39,(214,206,163))
    for x in (34,478):
        for y in (44,468):d.ellipse((x-5,y-5,x+4,y+4),fill=(136,122,84))
def build():
    sheet=source('625060c7afd839a8a0.jpg')
    specs=[(12,(100,72,48),.74),(0,(134,127,105),.68),(3,(116,84,49),.61),(3,(66,100,90),.85),(6,(68,70,64),.44),(9,(126,141,117),.49),(9,(204,201,178),.49),(3,(64,91,75),.61),(14,(177,172,146),.43),(2,(87,89,81),.66),(4,(76,69,51),.61),(12,(129,101,62),.98),(6,(145,141,117),.40),(3,(38,74,64),.37),(12,(53,71,48),.35),(3,(64,88,83),.50)]
    atlas=Image.new('RGB',(2048,2048));ns=Image.new('RGB',atlas.size,(128,128,255))
    for name,(i,col,con) in zip(INDEX,specs):
        cell=tint(tile(sheet,i),col,con)
        if name=='clinic':panel(cell,'FIELD CLINIC','PATIENT ENTRANCE',True)
        if name=='herbs':panel(cell,'PHYSIC GARDEN','DRYING ROOM')
        if name=='water':panel(cell,'WELL COURT','DRINKING WATER')
        h=np.array(cell.convert('L'),dtype='float32')/255;dy,dx=np.gradient(h);strength=.8 if name not in ('clinic','herbs','water')else .2
        normals=np.dstack((-dx*strength,dy*strength,np.ones_like(dx)));normals/=np.linalg.norm(normals,axis=2,keepdims=True)
        pos=(INDEX[name]%4*512,INDEX[name]//4*512);atlas.paste(cell,pos);ns.paste(Image.fromarray(np.uint8((normals+1)*127.5)),pos)
    atlas.save(OUT/'sanctuary-craft.jpg',quality=91,subsampling=0);ns.resize((1024,1024),Image.Resampling.LANCZOS).save(OUT/'sanctuary-craft-normal.png',optimize=True)
    # Original UVs occupy the unmodified left half. New porch roof UVs occupy the right.
    joint=Image.new('RGB',(4096,2048));joint.paste(sheet.resize((2048,2048),Image.Resampling.LANCZOS),(0,0));joint.paste(atlas,(2048,0))
    joint.resize((3072,1536),Image.Resampling.LANCZOS).save(OUT/'clinic-and-porch.jpg',quality=92,subsampling=0)
if __name__=='__main__':build()
