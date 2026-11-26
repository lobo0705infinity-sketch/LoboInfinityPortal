from PIL import Image,ImageDraw,ImageFilter,ImageOps
import numpy as np
from scipy.ndimage import gaussian_filter
from materials import OUT,source,tile
from layout import GATE,GARDEN,CLINIC,RAMP,RAMP_CROSS
from pathlib import Path
N=3072;M=N/48
rng=np.random.default_rng(20261126)
def pt(x,z):return (round((x+24)*M),round((24-z)*M))
def grey(im):return np.array(im.convert('L'),dtype=np.float32)
def noise(size):
    a=rng.normal(0,34,(size,size)).clip(-100,100).astype(np.int16)+128
    return (grey(Image.fromarray(a.astype('uint8')).resize((N,N),Image.Resampling.BICUBIC))-128)/34
def pathmask(lines,ellipses=()):
    layer=Image.new('L',(N,N));pen=ImageDraw.Draw(layer)
    for points,w in lines:
        coords=[pt(*p) for p in points];width=round(w*M);pen.line(coords,255,width=width,joint='curve')
        for (x,y) in coords:
            pen.ellipse((x-width/2,y-width/2,x+width/2,y+width/2),fill=255)
    for x,z,rx,rz in ellipses:
        a,b=pt(x-rx,z+rz);c,d=pt(x+rx,z-rz);pen.ellipse((a,b,c,d),fill=255)
    return layer
def color(l,t):return np.uint8(np.clip(l[:,:,None]+np.array(t,dtype='float32'),0,255))
def lay(a,b,mask):
    if isinstance(mask,np.ndarray):mask=Image.fromarray(np.uint8(np.clip(mask*255,0,255)))
    return Image.composite(b,a,mask)
def remap_mask(image,soft,irregular,mottling):
    m=grey(image.filter(ImageFilter.GaussianBlur(soft)))/255
    return np.clip(m+(m*(1-m))*irregular*mottling,0,1)
def paving_texture(macro,grain):
    # Beds of hand-laid flags, with irregular chamfers and very fine, recessed mortar joints.
    l=Image.new('L',(N,N),102);d=ImageDraw.Draw(l);y=-90
    while y<N+20:
        h=int(rng.integers(41,73));x=int(rng.integers(-136,-10));joints=[y+int(rng.integers(-3,4)),y+h+int(rng.integers(-3,4))]
        while x<N:
            w=int(rng.integers(49,151));c=[int(t) for t in rng.integers(1,6,8)];top,btm=joints
            shape=[(x+1+c[0],top+2),(x+w-2-c[1],top+2),(x+w-2,top+2+c[2]),(x+w-2,btm-2-c[3]),(x+w-2-c[4],btm-2),(x+1+c[5],btm-2),(x+1,btm-2-c[6]),(x+1,top+2+c[7])]
            v=int(rng.normal(156,6));d.polygon(shape,fill=v);d.line(shape[:3],fill=min(200,v+10),width=1);d.line(shape[3:7],fill=v-9,width=1)
            x+=w
        y+=h
    levels=grey(l.filter(ImageFilter.GaussianBlur(.6)));levels += .24*grain + 5*macro
    return Image.fromarray(color(levels,[0,-3,-12]))
def build():
    original=source('cfcef3c504b32cad95.jpg').resize((N,N),Image.Resampling.LANCZOS)
    phot=grey(original);broad=gaussian_filter(phot,6);grain=(phot-broad)
    detail=noise(235);macro=noise(18)
    soil=tile(source('625060c7afd839a8a0.jpg'),4).resize((527,527),Image.Resampling.LANCZOS)
    grains=np.tile(grey(soil),(6,6))[:N,:N];grains-=gaussian_filter(grains,3.0)
    grains=np.clip(grains,-38,38)
    field=90+.11*(broad-np.median(broad))+.085*np.clip(grain,-40,40)+.67*grains+5.3*macro+3.1*detail
    img=Image.fromarray(color(field,[14,11,-1]))
    # Exposed limestone around the actual outcrops. The normal pavement can be much quieter.
    rings=[(-10,-6,3.85,2.95),(9.03,7.47,3.59,3.30),(-3.5,16.7,3.8,4.5),(-15.1,17,3.1,2.83),(-11,21,3.1,2.25),(11,-20,2.95,2.60),(-22,-21,3.25,2.4),(21.5,22,3.0,2.7),(7.45,-3.49,3.3,3.1)]
    exposed=pathmask([],rings);m=remap_mask(exposed,51,1.8,.78*macro+.52*detail)
    rock=Image.fromarray(color(137+.69*(phot-np.median(phot))+.53*grain+5.4*macro,[9,6,-2]));img=lay(img,rock,m*.77);del rock,m
    # Fine gravel and leaf fall soften the planting courts, with dirt limited to the root beds.
    garden=Image.new('L',(N,N));pen=ImageDraw.Draw(garden)
    pen.polygon([pt(*p)for p in [(-6.48,-6.63),(.55,-6.63),(.55,.18),(-1.5,1.38),(-6.46,1.38)]],fill=255)
    loose=Image.fromarray(color(99+.55*grains+4*detail+5*macro+rng.normal(0,4,(N,N)).astype('float32'),[14,10,-4]))
    img=lay(img,loose,garden.filter(ImageFilter.GaussianBlur(6)))
    trees=[(-22,10),(20.31,-15.96),(-11,14),(10,1.5),(-1,-13),(2,18),(-17.08,-21.39),(-5.2,-.91)]
    rootmask=pathmask([],[(x,z,1.24,1.02) for x,z in trees]);ground=Image.fromarray(color(75+.48*grain+7*detail+6*macro,[12,6,-7]));img=lay(img,ground,remap_mask(rootmask,35,.86,detail)*.7)
    leaves=Image.new('RGBA',(N,N));dr=ImageDraw.Draw(leaves)
    for x,z in trees:
        for _ in range(155):
            px,pz=pt(x+rng.normal(0,.85),z+rng.normal(0,.76));a,b=rng.integers(2,6,2)
            c=[(111,76,41,97),(131,90,43,113),(96,86,48,100)][int(rng.integers(3))]
            dr.polygon([(px-a,pz),(px,pz-b),(px+a,pz-1),(px+1,pz+2)],fill=c)
    img=Image.alpha_composite(img.convert('RGBA'),leaves).convert('RGB')
    # Small, discontinued service walks to the refectory and dispensary use crushed stone.
    paths=[([(-18,-9.05),(-18,-7.15),(-16.0,-5.28),(-13.2,-4.7),(-10.2,-3.0),(-7.7,-1.1),(-6.9,1.8),(-3.0,2.4),(-.4,1.85)],1.15),
           ([(-16.3,6.77),(-16.0,5.18),(-14.75,4),(-13.50,2.05),(-13.52,-.9),(-12.58,-3.12)],1.10)]
    secondary=pathmask(paths);img=lay(img,loose,remap_mask(secondary,16,1.55,detail)*.69)
    lines=[(GATE,2.15),(GARDEN[:-2],1.97),(GARDEN[-3:],1.27),(CLINIC,1.86),(RAMP,1.84),(RAMP_CROSS,1.31)]
    mask=pathmask(lines,[(18,12.72,2.12,1.05),(16.92,-3.52,1.75,.73),(1.4,1.85,1.38,.83)])
    edges=remap_mask(mask,14,1.0,detail);img=lay(img,loose,edges)
    # A narrow gravel shoulder bleeds into the stone surface, without a painted outline.
    flags=paving_texture(macro,grains);img=lay(img,flags,remap_mask(mask,4.5,.95,detail))
    img.save(OUT/'cloister-walk-ground.jpg',quality=92,optimize=True,subsampling=0)
if __name__=='__main__':build()
