"""Resort finishes at prop scale. Blend the existing photographed coastal materials with grain, wear and weave."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'Assets'
UNBAKED=ROOT/'Review/unbaked'
SIZE=256
COLS=5
# Material, reference thumbnail, diffuse base, contrast.
PALETTE=[
    ('teak',8,(156,114,77),.60),('plywood',8,(163,113,65),.64),('steel',5,(147,151,147),.34),('edge',3,(183,177,157),.25),('iron',5,(67,72,70),.28),
    ('tyre',11,(52,51,46),.25),('grip',11,(48,50,48),.25),('enamel',10,(76,111,104),.24),('ivory',2,(218,211,189),.24),('leather',9,(66,61,56),.30),
    ('marine',9,(53,87,90),.39),('saddle',8,(120,81,57),.36),('alloy',5,(160,157,146),.33),('web',9,(66,67,59),.30),('brass',3,(153,130,89),.39),
    ('linen',9,(224,220,201),.34),('cream',9,(204,199,179),.36),('bag',9,(119,117,101),.42),('amber',10,(139,98,50),.29),('lights',7,(223,218,186),.19),
    ('stripe',9,(216,211,191),.35),('label',0,(197,176,137),.21),('rubber',11,(39,43,40),.26),('green',10,(77,91,68),.28),('white',2,(228,221,203),.15)]
INDEX={name:i for i,(name,*_) in enumerate(PALETTE)}

def build():
    local=ROOT.parent/'azure2'/'Assets'/'palace-materials.jpg'
    if not local.exists():local=ROOT.parent/'azure-palace-r2'/'Assets'/local.name
    photo=Image.open(local).convert('L')
    atlas=Image.new('RGB',(COLS*SIZE,COLS*SIZE))
    y,x=np.mgrid[:SIZE,:SIZE];rng=np.random.default_rng(8167)
    for i,(name,ref,base,contrast) in enumerate(PALETTE):
        tile=photo.width//4;l=(ref%4)*tile;t=(ref//4)*tile
        macro=np.asarray(photo.crop((l+8,t+8,l+tile-8,t+tile-8)).resize((SIZE,SIZE),Image.Resampling.LANCZOS),float)
        macro-=np.median(macro)
        noise=rng.normal(0,1.75,(SIZE,SIZE)); bump=macro*contrast+noise
        if name in ('teak','plywood'):
            broad=np.sin(y*.085+1.4*np.sin(x*.017)+np.sin(x*.035+y*.025)*.8)
            grain=np.sin(y*.69+1.9*broad+1.4*np.sin(x*.012))
            pores=np.maximum(0,np.sin(y*1.79+np.sin(x*.021+y*.023))-.72)*11
            bump+=broad*5+grain*4-pores
        if name in ('steel','alloy','edge','iron','brass'):
            bump+=np.sin(y*1.8+np.sin(x*.032))*.9+rng.normal(0,1.8,(SIZE,1))
        if name in ('linen','cream','bag','web','marine','stripe','leather'):
            bump+=(np.sin(x*np.pi*.87+.2*np.sin(y*.21))*2+np.sin(y*np.pi*.71+.2*np.sin(x*.24))*1.7)
        if name in ('rubber','tyre','grip'):bump+=rng.normal(0,2.8,(SIZE,SIZE))
        rgb=np.clip(np.asarray(base)[None,None,:]+bump[:,:,None],0,255)
        if name=='stripe':
            for a,b in [(.14,.18),(.20,.22),(.76,.79),(.82,.86)]:
                rgb[int(a*SIZE):int(b*SIZE)]*=np.array([.35,.53,.52])
        image=Image.fromarray(rgb.astype('uint8'))
        if name=='label':
            painter=ImageDraw.Draw(image); ff='/usr/share/fonts/opentype/urw-base35/NimbusSans-Regular.otf'
            painter.rounded_rectangle((12,14,243,240),radius=12,outline=(121,108,81),width=3)
            painter.text((128,51),'AZURE',font=ImageFont.truetype(ff,24),fill=(76,75,64),anchor='mm')
            painter.text((128,83),'PALACE',font=ImageFont.truetype(ff,19),fill=(76,75,64),anchor='mm')
            for k in range(36):
                w=int(rng.integers(1,4));a=38+5*k
                painter.rectangle((a,117,a+w,171),fill=(85,81,66))
            painter.text((128,201),'BELL DESK  04',font=ImageFont.truetype(ff,15),fill=(84,82,67),anchor='mm')
        atlas.paste(image,(SIZE*(i%COLS),SIZE*(i//COLS)))
    UNBAKED.mkdir(parents=True,exist_ok=True)
    atlas.save(UNBAKED/'resort-prop-finishes.jpg',quality=91,subsampling=0,optimize=True)
if __name__=='__main__':build()
