"""Extend the pedestrian and service routes on the same mat as the Cloister Walk."""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
from scipy.ndimage import gaussian_filter
from scene import BASE,local,bag
from courts import SERVICE,SITES
N=3072
def pt(x,z):return (round((x+24)*N/48),round((24-z)*N/48))
def paths(lines,scale):
    im=Image.new('L',(N,N));d=ImageDraw.Draw(im)
    for j,p in enumerate(lines):
        d.line([pt(*a) for a in p],fill=220,width=round((1.06+.14*(j%3))*N/48*scale),joint='curve')
        r=(1.06+.14*(j%3))*N/48*scale*.5
        for t in p:
            x,y=pt(*t);d.ellipse((x-r,y-r,x+r,y+r),fill=220)
    return im
def build():
    base=Image.open(local(bag()['ContainedObjects'][1]['CustomMesh']['DiffuseURL'])).convert('RGB')
    rng=np.random.default_rng(4221);no=rng.normal(0,8,(N,N)).clip(-27,27).astype(np.int16)
    coarse=Image.fromarray((rng.integers(0,256,size=(125,125),dtype=np.uint8))).resize((N,N),Image.Resampling.BICUBIC)
    c=(np.asarray(coarse,dtype=np.float32)-128)/128
    source=np.asarray(base,dtype=np.float32);micro=np.asarray(base.convert('L'),dtype='float32')
    micro-=gaussian_filter(micro,3.)
    shape=paths(SERVICE,1.58)
    # Finer gravel and compacted shoulders show where barrows and boots travel.
    mask=np.asarray(shape.filter(ImageFilter.GaussianBlur(15)),dtype=np.float32)/255.
    ground=np.clip(128+8*c+.50*micro+.53*no,0,255)
    path=Image.fromarray(np.uint8(np.clip(ground[:,:,None]+np.array([14,8,-6]),0,255)))
    out=Image.composite(path,base,Image.fromarray(np.uint8(np.clip(mask*(.85+.11*c),0,1)*255)))
    worn=paths(SERVICE,1.0).filter(ImageFilter.GaussianBlur(9))
    finer=Image.fromarray(np.uint8(np.clip((ground+5)[:,:,None]+np.array([16,9,-6]),0,255)))
    out=Image.composite(finer,out,worn)
    out.save(BASE/'assets/sanctuary-courts-ground.jpg',quality=92,subsampling=0,optimize=True)
if __name__=='__main__':build()
